-- =====================================================================
-- Email Automation — funnel tracking, suppression, follow-ups, CRM promotion
-- Adds the columns/tables/functions behind:
--   • confidence-gated personalization        (#6)
--   • open / click funnel tracking            (#8 / BMP #3)
--   • bounce suppression list                 (#5)
--   • stale-PROCESSING reaper                  (tech #6)
--   • auto-promote a reply into the sales CRM  ((c))
-- Apply once against the live Aczen database, after the base
-- email_automation_leads migration.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. New columns on email_automation_leads
-- ---------------------------------------------------------------------
ALTER TABLE public.email_automation_leads
  ADD COLUMN IF NOT EXISTS confidence           INTEGER,         -- 0-100 from research call (#6)
  ADD COLUMN IF NOT EXISTS personalization_mode TEXT
      CHECK (personalization_mode IN ('personalized','generic')),
  ADD COLUMN IF NOT EXISTS delivered_at         TIMESTAMPTZ,     -- accepted by Zoho & not bounced
  ADD COLUMN IF NOT EXISTS opened_at            TIMESTAMPTZ,     -- first open (tracking pixel)
  ADD COLUMN IF NOT EXISTS open_count           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_at           TIMESTAMPTZ,     -- first click (wrapped link)
  ADD COLUMN IF NOT EXISTS click_count          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounced_at           TIMESTAMPTZ,     -- detected bounce
  ADD COLUMN IF NOT EXISTS crm_lead_id          UUID;            -- set when promoted to crm_leads

-- NOTE: automated follow-ups are intentionally NOT built yet. The FOLLOWED_UP
-- status value remains available for a future follow-up strategy.

-- ---------------------------------------------------------------------
-- 2. Suppression list (#5) — addresses we must never email again.
--    Stored lowercased. Bounces + (future) unsubscribes land here.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_suppression (
  email      TEXT PRIMARY KEY,        -- always lowercased
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_suppression ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth can read email_suppression" ON public.email_suppression;
CREATE POLICY "auth can read email_suppression"
  ON public.email_suppression FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------
-- 3. Claim RPC — now skips suppressed addresses.
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
        AND lower(business_email) NOT IN (SELECT email FROM public.email_suppression)
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
  RETURNING * INTO claimed;

  RETURN claimed; -- NULL row when nothing is left to send
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Funnel tracking RPCs — called by the track-open / track-click
--    Edge Functions (which use the service role).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_email_open(p_lead UUID)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE public.email_automation_leads
     SET open_count = open_count + 1,
         opened_at  = COALESCE(opened_at, now())
   WHERE id = p_lead;
$$;

CREATE OR REPLACE FUNCTION public.record_email_click(p_lead UUID)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE public.email_automation_leads
     SET click_count = click_count + 1,
         clicked_at  = COALESCE(clicked_at, now()),
         opened_at   = COALESCE(opened_at, now())   -- a click implies an open
   WHERE id = p_lead;
$$;

-- ---------------------------------------------------------------------
-- 5. Suppress an address (#5) — adds to the list and parks any matching
--    leads as FAILED so they are never (re)sent.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.suppress_email(p_email TEXT, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.email_suppression(email, reason)
  VALUES (lower(p_email), p_reason)
  ON CONFLICT (email) DO NOTHING;

  UPDATE public.email_automation_leads
     SET status         = 'FAILED',
         bounced_at     = now(),
         failure_reason = COALESCE(failure_reason, p_reason)
   WHERE lower(business_email) = lower(p_email)
     AND status IN ('NOT_SENT','PROCESSING','SENT','FOLLOWED_UP');
END;
$$;

-- ---------------------------------------------------------------------
-- 6. Stale-PROCESSING reaper (tech #6) — if the worker crashed between
--    claim and a terminal status, return the lead to the queue.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reap_stale_processing()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE n INTEGER;
BEGIN
  UPDATE public.email_automation_leads
     SET status = 'NOT_SENT',
         failure_reason = 'reaped: stuck in PROCESSING > 10 min'
   WHERE status = 'PROCESSING'
     AND last_attempt_at < now() - interval '10 minutes';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- ---------------------------------------------------------------------
-- 7. CRM promotion ((c)) — when a lead flips to GOT_RESPONSE, upsert it
--    into the sales CRM, log the reply as an activity, and notify the
--    person who added the lead. Runs in a BEFORE trigger so it can stamp
--    crm_lead_id back onto the row. Guarded so it fires exactly once.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.promote_email_lead_to_crm()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  existing_id UUID;
  note_text   TEXT;
BEGIN
  IF NEW.status = 'GOT_RESPONSE' AND OLD.status IS DISTINCT FROM 'GOT_RESPONSE' THEN
    note_text := concat_ws(E'\n',
      'Auto-promoted from Email Automation.',
      CASE WHEN NEW.industry IS NOT NULL THEN 'Industry: ' || NEW.industry END,
      CASE WHEN NEW.summary  IS NOT NULL THEN 'Summary: '  || NEW.summary  END,
      CASE WHEN NEW.reply_body IS NOT NULL THEN E'\nReply:\n' || NEW.reply_body END
    );

    SELECT id INTO existing_id
      FROM public.crm_leads
     WHERE lower(email) = lower(NEW.business_email)
     LIMIT 1;

    IF existing_id IS NULL THEN
      INSERT INTO public.crm_leads
        (name, email, company, source, stage, value, currency, probability,
         created_by, owner_user_id, notes, last_contacted_at)
      VALUES
        (NEW.business_name, NEW.business_email, NEW.business_name,
         'Email Automation', 'Contacted', 0, 'INR', 25,
         NEW.created_by, NEW.created_by, note_text, COALESCE(NEW.reply_date, now()))
      RETURNING id INTO existing_id;
    ELSE
      UPDATE public.crm_leads
         SET last_contacted_at = COALESCE(NEW.reply_date, now())
       WHERE id = existing_id;
    END IF;

    INSERT INTO public.crm_lead_activities
      (lead_id, type, title, body, actor_user_id, actor_name)
    VALUES
      (existing_id, 'email', 'Replied to outreach email',
       NEW.reply_body, NEW.created_by, 'Email Automation');

    -- Notify the lead's creator (decision: creator only).
    IF NEW.created_by IS NOT NULL AND NEW.created_by <> '' AND NEW.created_by <> 'anonymous' THEN
      INSERT INTO public.notifications (clerk_user_id, title, message, type, link)
      VALUES (NEW.created_by, 'Lead replied 🎉',
              NEW.business_name || ' replied to your outreach email.',
              'success', '/crm');
    END IF;

    NEW.crm_lead_id := existing_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_email_lead ON public.email_automation_leads;
CREATE TRIGGER trg_promote_email_lead
  BEFORE UPDATE ON public.email_automation_leads
  FOR EACH ROW EXECUTE FUNCTION public.promote_email_lead_to_crm();

-- ---------------------------------------------------------------------
-- 8. Gemini free-tier accounting — per-key daily request + token counters
--    so the client can stay UNDER the limits proactively (with a safety
--    margin) instead of only reacting to 429s. Counters reset each day.
-- ---------------------------------------------------------------------
ALTER TABLE public.gemini_key_state
  ADD COLUMN IF NOT EXISTS usage_date      DATE,
  ADD COLUMN IF NOT EXISTS req_count_day   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS token_count_day INTEGER NOT NULL DEFAULT 0;

-- Atomically add request + token usage to a key for TODAY, resetting the daily
-- counters when the date rolls over. The caller passes explicit increments so
-- a request and its (later-known) token count can be recorded separately
-- without double-counting the request.
CREATE OR REPLACE FUNCTION public.bump_gemini_usage(
  p_key_index INTEGER,
  p_requests  INTEGER,
  p_tokens    INTEGER
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  add_req INTEGER := GREATEST(COALESCE(p_requests, 0), 0);
  add_tok INTEGER := GREATEST(COALESCE(p_tokens, 0), 0);
BEGIN
  INSERT INTO public.gemini_key_state (key_index, usage_date, req_count_day, token_count_day)
  VALUES (p_key_index, current_date, add_req, add_tok)
  ON CONFLICT (key_index) DO UPDATE SET
    req_count_day = CASE WHEN public.gemini_key_state.usage_date = current_date
                         THEN public.gemini_key_state.req_count_day + add_req ELSE add_req END,
    token_count_day = CASE WHEN public.gemini_key_state.usage_date = current_date
                         THEN public.gemini_key_state.token_count_day + add_tok ELSE add_tok END,
    usage_date = current_date,
    updated_at = now();
END;
$$;

-- ---------------------------------------------------------------------
-- 9. Sending schedule — the drip worker now gates on a CONTINUOUS window
--    (08:00–15:00 IST, Mon–Sat, no Sunday) computed in the worker itself,
--    instead of three fixed arm times. paused_until lets the worker back off
--    for a while when all Gemini keys are exhausted (replaces the old
--    disarm-on-exhaustion behaviour).
-- ---------------------------------------------------------------------
ALTER TABLE public.outreach_control
  ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ;
