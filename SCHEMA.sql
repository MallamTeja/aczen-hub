-- =====================================================================
-- Aczen Connect — full database schema (consolidated)
-- Paste this into Supabase SQL Editor on a fresh project and run once.
-- Auth: Supabase Auth (auth.users). The column `clerk_user_id` is kept
-- for backwards compatibility with existing code and now stores the
-- Supabase auth.uid() as TEXT.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Shared trigger helper
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 1. user_profiles  (linked to auth.users)
-- ---------------------------------------------------------------------
CREATE TABLE public.user_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  clerk_user_id   TEXT UNIQUE NOT NULL,           -- mirrors auth_user_id::text
  name            TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  position        TEXT CHECK (position IN (
                    'CEO','CFO','CPO','Marketing Manager','Social Media','Developer'
                  )),
  blood_group     TEXT CHECK (blood_group IN (
                    'A+','A-','B+','B-','AB+','AB-','O+','O-'
                  )),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profiles_auth_user_id ON public.user_profiles(auth_user_id);
CREATE INDEX idx_user_profiles_clerk_user_id ON public.user_profiles(clerk_user_id);
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);

CREATE TRIGGER trg_user_profiles_updated
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create a profile row whenever a new auth user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    auth_user_id, clerk_user_id, name, email, role, position, blood_group
  )
  VALUES (
    NEW.id,
    NEW.id::text,
    COALESCE(NEW.raw_user_meta_data->>'name',
             split_part(NEW.email, '@', 1)),
    NEW.email,
    'user',
    NULLIF(NEW.raw_user_meta_data->>'position', ''),
    NULLIF(NEW.raw_user_meta_data->>'blood_group', '')
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Helper: is the caller an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- 2. punches
-- ---------------------------------------------------------------------
CREATE TABLE public.punches (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id      TEXT NOT NULL,
  timestamp          TIMESTAMPTZ NOT NULL DEFAULT now(),
  status             TEXT NOT NULL CHECK (status IN ('IN','OUT')),
  verification_code  VARCHAR(5),
  latitude           DOUBLE PRECISION,
  longitude          DOUBLE PRECISION,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT punches_verification_code_format
    CHECK (verification_code IS NULL OR verification_code ~ '^[A-Z0-9]{5}$')
);

CREATE INDEX idx_punches_clerk_user ON public.punches(clerk_user_id, timestamp DESC);

-- ---------------------------------------------------------------------
-- 3. work_updates
-- ---------------------------------------------------------------------
CREATE TABLE public.work_updates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id  TEXT NOT NULL,
  content        TEXT NOT NULL,
  update_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_updates_clerk_user ON public.work_updates(clerk_user_id, update_date DESC);

-- ---------------------------------------------------------------------
-- 4. lead_uploads
-- ---------------------------------------------------------------------
CREATE TABLE public.lead_uploads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id  TEXT NOT NULL,
  file_name      TEXT NOT NULL,
  uploaded_by    TEXT,
  upload_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  lead_source    TEXT,
  total_leads    INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_uploads_clerk_user ON public.lead_uploads(clerk_user_id, upload_date DESC);

-- ---------------------------------------------------------------------
-- 5. tasks  (assignments)
-- ---------------------------------------------------------------------
CREATE TABLE public.tasks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  description    TEXT,
  assigned_to    TEXT NOT NULL,
  assigned_by    TEXT NOT NULL,
  due_date       DATE NOT NULL,
  priority       TEXT NOT NULL DEFAULT 'Medium'
                 CHECK (priority IN ('Low','Medium','High','Critical')),
  status         TEXT NOT NULL DEFAULT 'Assigned'
                 CHECK (status IN ('Assigned','In Progress','Completed','On Hold')),
  remarks        TEXT,
  last_activity  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_assigned_by ON public.tasks(assigned_by);
CREATE INDEX idx_tasks_due_date    ON public.tasks(due_date);
CREATE INDEX idx_tasks_status      ON public.tasks(status);
CREATE INDEX idx_tasks_priority    ON public.tasks(priority);
CREATE INDEX idx_tasks_created_at  ON public.tasks(created_at);

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Calendar RPC: tasks for users within a date range
CREATE OR REPLACE FUNCTION public.get_user_calendar_tasks(
  user_identifiers TEXT[],
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  id UUID, title TEXT, description TEXT, assigned_to TEXT, assigned_by TEXT,
  due_date DATE, priority TEXT, status TEXT, remarks TEXT, created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT t.id, t.title, t.description, t.assigned_to, t.assigned_by,
         t.due_date, t.priority, t.status, t.remarks, t.created_at
  FROM public.tasks t
  WHERE (t.assigned_to = ANY(user_identifiers) OR t.assigned_by = ANY(user_identifiers))
    AND t.due_date BETWEEN start_date AND end_date
  ORDER BY t.due_date ASC;
$$;

-- Calendar counts aggregated per day
CREATE OR REPLACE FUNCTION public.get_calendar_counts(
  user_identifiers TEXT[],
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (task_date DATE, total BIGINT, completed BIGINT, overdue_open BIGINT)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT t.due_date AS task_date,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE t.status = 'Completed') AS completed,
         COUNT(*) FILTER (WHERE t.status != 'Completed' AND t.due_date < CURRENT_DATE) AS overdue_open
  FROM public.tasks t
  WHERE (t.assigned_to = ANY(user_identifiers) OR t.assigned_by = ANY(user_identifiers))
    AND t.due_date BETWEEN start_date AND end_date
  GROUP BY t.due_date
  ORDER BY t.due_date;
$$;

-- ---------------------------------------------------------------------
-- 6. user_emails
-- ---------------------------------------------------------------------
CREATE TABLE public.user_emails (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id             UUID,
  sender_clerk_user_id  TEXT NOT NULL,
  to_recipients         TEXT[] NOT NULL DEFAULT '{}',
  cc_recipients         TEXT[] DEFAULT '{}',
  tagged_user_ids       TEXT[] DEFAULT '{}',
  subject               TEXT NOT NULL CHECK (length(trim(subject)) > 0),
  body                  TEXT NOT NULL CHECK (length(trim(body)) > 0),
  location_label        TEXT,
  location_url          TEXT,
  reply_to_id           UUID REFERENCES public.user_emails(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT at_least_one_recipient
    CHECK (array_length(to_recipients, 1) > 0 OR array_length(cc_recipients, 1) > 0)
);

ALTER TABLE public.user_emails
  ADD CONSTRAINT fk_thread FOREIGN KEY (thread_id) REFERENCES public.user_emails(id);

CREATE INDEX idx_emails_sender  ON public.user_emails(sender_clerk_user_id);
CREATE INDEX idx_emails_to      ON public.user_emails USING GIN(to_recipients);
CREATE INDEX idx_emails_cc      ON public.user_emails USING GIN(cc_recipients);
CREATE INDEX idx_emails_tagged  ON public.user_emails USING GIN(tagged_user_ids);
CREATE INDEX idx_emails_thread  ON public.user_emails(thread_id);
CREATE INDEX idx_emails_created ON public.user_emails(created_at DESC);

-- ---------------------------------------------------------------------
-- 7. chat_messages
-- ---------------------------------------------------------------------
CREATE TABLE public.chat_messages (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_clerk_user_id     TEXT NOT NULL,
  recipient_clerk_user_id  TEXT NOT NULL,
  message                  TEXT NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_conversation ON public.chat_messages(
  LEAST(sender_clerk_user_id, recipient_clerk_user_id),
  GREATEST(sender_clerk_user_id, recipient_clerk_user_id),
  created_at DESC
);
CREATE INDEX idx_chat_sender    ON public.chat_messages(sender_clerk_user_id);
CREATE INDEX idx_chat_recipient ON public.chat_messages(recipient_clerk_user_id);

-- ---------------------------------------------------------------------
-- 8. company_events
-- ---------------------------------------------------------------------
CREATE TABLE public.company_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  event_type  TEXT NOT NULL DEFAULT 'event',
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  location    TEXT,
  color       TEXT DEFAULT 'primary',
  created_by  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_events_dates ON public.company_events(start_date, end_date);

CREATE TRIGGER trg_company_events_updated
  BEFORE UPDATE ON public.company_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- 9. leave_requests
-- ---------------------------------------------------------------------
CREATE TABLE public.leave_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id   TEXT NOT NULL,
  leave_type      TEXT NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  total_days      NUMERIC(4,1) NOT NULL DEFAULT 1,
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by     TEXT,
  reviewer_note   TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leave_requests_user ON public.leave_requests(clerk_user_id, created_at DESC);

CREATE TRIGGER trg_leave_requests_updated
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- 10. leave_balances
-- ---------------------------------------------------------------------
CREATE TABLE public.leave_balances (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id  TEXT NOT NULL,
  leave_type     TEXT NOT NULL,
  total_allowed  NUMERIC(4,1) NOT NULL DEFAULT 0,
  used           NUMERIC(4,1) NOT NULL DEFAULT 0,
  year           INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clerk_user_id, leave_type, year)
);

CREATE TRIGGER trg_leave_balances_updated
  BEFORE UPDATE ON public.leave_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- 11. notifications
-- ---------------------------------------------------------------------
CREATE TABLE public.notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id  TEXT NOT NULL,
  title          TEXT NOT NULL,
  message        TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'info',
  link           TEXT,
  is_read        BOOLEAN NOT NULL DEFAULT FALSE,
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
  ON public.notifications(clerk_user_id, is_read, created_at DESC);

-- ---------------------------------------------------------------------
-- 12. crm_leads
-- ---------------------------------------------------------------------
CREATE TABLE public.crm_leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  company           TEXT,
  job_title         TEXT,
  source            TEXT,
  stage             TEXT NOT NULL DEFAULT 'New'
                    CHECK (stage IN ('New','Contacted','Qualified','Proposal','Negotiation','Won','Lost')),
  value             NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'INR',
  probability       INTEGER NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  expected_close    DATE,
  owner_user_id     TEXT,
  owner_name        TEXT,
  created_by        TEXT NOT NULL,
  notes             TEXT,
  tags              TEXT[] NOT NULL DEFAULT '{}',
  last_contacted_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_leads_stage      ON public.crm_leads(stage);
CREATE INDEX idx_crm_leads_owner      ON public.crm_leads(owner_user_id);
CREATE INDEX idx_crm_leads_created_by ON public.crm_leads(created_by);
CREATE INDEX idx_crm_leads_created_at ON public.crm_leads(created_at DESC);
CREATE INDEX idx_crm_leads_expected   ON public.crm_leads(expected_close);

CREATE TRIGGER trg_crm_leads_updated
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- 13. crm_lead_activities
-- ---------------------------------------------------------------------
CREATE TABLE public.crm_lead_activities (
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

CREATE INDEX idx_crm_activities_lead ON public.crm_lead_activities(lead_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 14. social_accounts
-- ---------------------------------------------------------------------
CREATE TABLE public.social_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform      TEXT NOT NULL CHECK (platform IN (
                  'twitter','linkedin','instagram','facebook','youtube','tiktok','threads'
                )),
  handle        TEXT NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  connected_by  TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, handle)
);

CREATE INDEX idx_social_accounts_platform ON public.social_accounts(platform);

CREATE TRIGGER trg_social_accounts_updated
  BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- 15. social_posts
-- ---------------------------------------------------------------------
CREATE TABLE public.social_posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT,
  content        TEXT NOT NULL,
  platforms      TEXT[] NOT NULL DEFAULT '{}',
  media_urls     TEXT[] NOT NULL DEFAULT '{}',
  link_url       TEXT,
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','scheduled','published','failed','cancelled')),
  scheduled_at   TIMESTAMPTZ,
  published_at   TIMESTAMPTZ,
  campaign       TEXT,
  tags           TEXT[] NOT NULL DEFAULT '{}',
  author_user_id TEXT NOT NULL,
  author_name    TEXT,
  engagement     JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_posts_status     ON public.social_posts(status);
CREATE INDEX idx_social_posts_scheduled  ON public.social_posts(scheduled_at);
CREATE INDEX idx_social_posts_author     ON public.social_posts(author_user_id);
CREATE INDEX idx_social_posts_campaign   ON public.social_posts(campaign);
CREATE INDEX idx_social_posts_created_at ON public.social_posts(created_at DESC);

CREATE TRIGGER trg_social_posts_updated
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- ROW LEVEL SECURITY
-- Permissive while everything stabilises; tighten later by replacing
-- the policies below with auth.uid()-scoped rules.
-- =====================================================================
ALTER TABLE public.user_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_updates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_uploads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_emails          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_activities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read user_profiles"
  ON public.user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user updates own profile"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "admin manages profiles"
  ON public.user_profiles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "auth can all on punches"        ON public.punches        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth can all on work_updates"   ON public.work_updates   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth can all on lead_uploads"   ON public.lead_uploads   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth can all on tasks"          ON public.tasks          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth can all on user_emails"    ON public.user_emails    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth can all on chat_messages"  ON public.chat_messages  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth can all on company_events" ON public.company_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth can all on leave_requests" ON public.leave_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth can all on leave_balances" ON public.leave_balances FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth can all on notifications"  ON public.notifications  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth can all on crm_leads"           ON public.crm_leads           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth can all on crm_lead_activities" ON public.crm_lead_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth can all on social_accounts"     ON public.social_accounts     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth can all on social_posts"        ON public.social_posts        FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================================
-- REALTIME
-- =====================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_lead_activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_accounts;

-- =====================================================================
-- BOOTSTRAP DEFAULT ADMIN
-- Seeds a ready-to-use admin: cteam@aczen.in / Aczen@2025
--
-- Safe to re-run: ON CONFLICT guards prevent duplicates.
-- Change the email/password before running in production.
-- =====================================================================
DO $$
DECLARE
  v_admin_email    TEXT := 'cteam@aczen.in';
  v_admin_password TEXT := 'Aczen@2025';
  v_admin_name     TEXT := 'Aczen Core Team';
  v_user_id        UUID;
BEGIN
  -- Create (or fetch) the auth.users row.
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_admin_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_admin_email,
      crypt(v_admin_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', v_admin_name),
      now(), now(),
      '', '', '', ''
    );

    -- Matching auth.identities row (required by Supabase Auth).
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_admin_email),
      'email',
      v_admin_email,
      now(), now(), now()
    );
  END IF;

  -- Ensure the profile row exists and is marked admin.
  INSERT INTO public.user_profiles (auth_user_id, clerk_user_id, name, email, role)
  VALUES (v_user_id, v_user_id::text, v_admin_name, v_admin_email, 'admin')
  ON CONFLICT (auth_user_id)
    DO UPDATE SET role = 'admin', name = EXCLUDED.name;
END $$;
-- =====================================================================
