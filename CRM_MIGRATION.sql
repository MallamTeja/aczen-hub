-- =====================================================================
-- CRM module — leads + activities
-- Apply once against an existing Aczen Connect database.
-- =====================================================================

-- ---------------------------------------------------------------------
-- crm_leads
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  company          TEXT,
  job_title        TEXT,
  source           TEXT,
  stage            TEXT NOT NULL DEFAULT 'New'
                   CHECK (stage IN ('New','Contacted','Qualified','Proposal','Negotiation','Won','Lost')),
  value            NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'INR',
  probability      INTEGER NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  expected_close   DATE,
  owner_user_id    TEXT,
  owner_name       TEXT,
  created_by       TEXT NOT NULL,
  notes            TEXT,
  tags             TEXT[] NOT NULL DEFAULT '{}',
  last_contacted_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_stage        ON public.crm_leads(stage);
CREATE INDEX IF NOT EXISTS idx_crm_leads_owner        ON public.crm_leads(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_created_by   ON public.crm_leads(created_by);
CREATE INDEX IF NOT EXISTS idx_crm_leads_created_at   ON public.crm_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_expected     ON public.crm_leads(expected_close);

CREATE TRIGGER trg_crm_leads_updated
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- crm_lead_activities  (call / email / note / meeting / stage_change)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_lead_activities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('call','email','note','meeting','stage_change')),
  title          TEXT NOT NULL,
  body           TEXT,
  from_stage     TEXT,
  to_stage       TEXT,
  actor_user_id  TEXT NOT NULL,
  actor_name     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_lead    ON public.crm_lead_activities(lead_id, created_at DESC);

-- ---------------------------------------------------------------------
-- RLS (permissive while stabilising, matches existing pattern)
-- ---------------------------------------------------------------------
ALTER TABLE public.crm_leads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth can all on crm_leads"           ON public.crm_leads;
DROP POLICY IF EXISTS "auth can all on crm_lead_activities" ON public.crm_lead_activities;

CREATE POLICY "auth can all on crm_leads"
  ON public.crm_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth can all on crm_lead_activities"
  ON public.crm_lead_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_leads';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_lead_activities';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
