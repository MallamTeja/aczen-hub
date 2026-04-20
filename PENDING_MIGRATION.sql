-- Schema needed for Company Calendar, Leave Requests, and Notifications.
-- Apply via Lovable Cloud → run the migration on next assistant turn (it will request approval).

-- 1. company_events
CREATE TABLE IF NOT EXISTS public.company_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'event',
  start_date date NOT NULL,
  end_date date NOT NULL,
  location text,
  color text DEFAULT 'primary',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on company_events" ON public.company_events FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_company_events_dates ON public.company_events(start_date, end_date);

-- 2. leave_requests
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  leave_type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_days numeric(4,1) NOT NULL DEFAULT 1,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by text,
  reviewer_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on leave_requests" ON public.leave_requests FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON public.leave_requests(clerk_user_id, created_at DESC);

-- 3. leave_balances
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  leave_type text NOT NULL,
  total_allowed numeric(4,1) NOT NULL DEFAULT 0,
  used numeric(4,1) NOT NULL DEFAULT 0,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clerk_user_id, leave_type, year)
);
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on leave_balances" ON public.leave_balances FOR ALL USING (true) WITH CHECK (true);

-- 4. notifications + realtime
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  link text,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(clerk_user_id, is_read, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests;

-- 5. updated_at triggers
CREATE TRIGGER trg_company_events_updated BEFORE UPDATE ON public.company_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_leave_requests_updated BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_leave_balances_updated BEFORE UPDATE ON public.leave_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
