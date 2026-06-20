-- =====================================================================
-- Email Automation module — dedicated cold-outreach lead store
-- Separate from the sales CRM (crm_leads); driven by the Automations
-- section in the app and the outreach Edge Functions / pg_cron jobs.
-- Apply once against the live Aczen database.
-- =====================================================================

-- ---------------------------------------------------------------------
-- email_automation_leads
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_automation_leads (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name        TEXT NOT NULL,
  business_email       TEXT NOT NULL,
  language             TEXT NOT NULL DEFAULT 'English'
                       CHECK (language IN ('English','Telugu','Hindi','Marathi','Kannada','Tamil')),
  status               TEXT NOT NULL DEFAULT 'NOT_SENT'
                       CHECK (status IN ('NOT_SENT','PROCESSING','SENT','GOT_RESPONSE','FOLLOWED_UP','FAILED')),

  -- Gemini research output  { industry, summary, pain_points[] }
  industry             TEXT,
  summary              TEXT,
  pain_points          JSONB,

  -- Gemini-generated email  { subject (in language), body (English) }
  email_subject        TEXT,
  email_body           TEXT,
  email_generated_at   TIMESTAMPTZ,

  -- send tracking (both ids returned by Zoho are stored — STEP 8)
  provider_message_id  TEXT,
  provider_thread_id   TEXT,
  sent_at              TIMESTAMPTZ,
  last_attempt_at      TIMESTAMPTZ,
  failure_reason       TEXT,

  -- reply tracking (no AI — matched by sender email — STEP 13)
  reply_body           TEXT,
  reply_date           TIMESTAMPTZ,

  -- meta
  created_by           TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eal_status     ON public.email_automation_leads(status);
CREATE INDEX IF NOT EXISTS idx_eal_created_at ON public.email_automation_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eal_email      ON public.email_automation_leads(lower(business_email));

-- updated_at trigger (reuses the helper created by earlier migrations)
DROP TRIGGER IF EXISTS trg_eal_updated ON public.email_automation_leads;
CREATE TRIGGER trg_eal_updated
  BEFORE UPDATE ON public.email_automation_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- RLS (permissive while stabilising — matches existing app pattern).
-- The outreach Edge Functions use the service-role key and bypass RLS.
-- ---------------------------------------------------------------------
ALTER TABLE public.email_automation_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth can all on email_automation_leads" ON public.email_automation_leads;
CREATE POLICY "auth can all on email_automation_leads"
  ON public.email_automation_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.email_automation_leads';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ---------------------------------------------------------------------
-- Atomic claim — the drip worker calls this once per tick to grab the
-- next NOT_SENT lead and flip it to PROCESSING in a single statement,
-- so two concurrent ticks can never pick the same lead (no double-send).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_next_email_automation_lead()
RETURNS public.email_automation_leads
LANGUAGE plpgsql
AS $$
DECLARE
  claimed public.email_automation_leads;
BEGIN
  UPDATE public.email_automation_leads
     SET status = 'PROCESSING',
         last_attempt_at = now()
   WHERE id = (
     SELECT id
       FROM public.email_automation_leads
      WHERE status = 'NOT_SENT'
        AND business_email IS NOT NULL
        AND business_email <> ''
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
  RETURNING * INTO claimed;

  RETURN claimed; -- NULL row when nothing is left to send
END;
$$;

-- =====================================================================
-- Campaign control + Gemini key health (used by the Edge worker + cron)
-- =====================================================================

-- ---------------------------------------------------------------------
-- outreach_control — single-row switch the cron arms at each window and
-- the drip worker clears when the batch drains / keys are exhausted.
-- Also holds the reply-poll cursor.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_control (
  id              INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  sending_armed   BOOLEAN NOT NULL DEFAULT false,
  armed_at        TIMESTAMPTZ,
  window_label    TEXT,
  reply_cursor    TIMESTAMPTZ,          -- last reply-poll high-water mark
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.outreach_control (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_outreach_control_updated ON public.outreach_control;
CREATE TRIGGER trg_outreach_control_updated
  BEFORE UPDATE ON public.outreach_control
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- gemini_key_state — per-key health so the worker skips dead/cooled keys
-- (key_index maps to env var geminiapi{key_index}).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gemini_key_state (
  key_index      INTEGER PRIMARY KEY,
  cooldown_until TIMESTAMPTZ,           -- skip this key until this time
  last_status    TEXT,                  -- 'ok' | '429' | '400' | '403' | '404' | '5xx'
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_gemini_key_state_updated ON public.gemini_key_state;
CREATE TRIGGER trg_gemini_key_state_updated
  BEFORE UPDATE ON public.gemini_key_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- RLS — readable by authenticated employees (for debugging in-app);
-- the Edge worker uses the service role and bypasses RLS for writes.
-- ---------------------------------------------------------------------
ALTER TABLE public.outreach_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gemini_key_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth can read outreach_control" ON public.outreach_control;
DROP POLICY IF EXISTS "auth can read gemini_key_state" ON public.gemini_key_state;

CREATE POLICY "auth can read outreach_control"
  ON public.outreach_control FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth can read gemini_key_state"
  ON public.gemini_key_state FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------
-- arm_outreach_window — one-statement helper the pg_cron jobs call at
-- 09:00 / 12:05 / 15:00 IST to start a sending sweep.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.arm_outreach_window(p_label TEXT)
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE public.outreach_control
     SET sending_armed = true,
         armed_at      = now(),
         window_label  = p_label
   WHERE id = 1;
$$;
