-- =====================================================================
-- Email Automation — pg_cron + pg_net scheduling
-- Run ONCE in the SQL Editor of project qkjccefoqbnxfljpjpsg AFTER the
-- email_automation_leads migrations are applied and the Edge Functions are
-- deployed.
--
-- Times are in UTC. Convert from IST (IST = UTC + 5:30):
--   09:00 IST = 03:30 UTC
--   12:05 IST = 06:35 UTC
--   15:00 IST = 09:30 UTC
--
-- Replace <CRON_SECRET> below with the same value you set as the CRON_SECRET
-- Edge secret (supabase secrets set CRON_SECRET=...).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------------------------------------------------------------------
-- 1. Drip tick — every 2 minutes, all day. The worker itself enforces the
--    sending window (continuous 08:00–15:00 IST, Mon–Sat, no Sunday) and the
--    ~2-min spacing: it sends ONE lead per tick while inside the window and
--    no-ops cheaply otherwise. No separate "arm" jobs are needed.
--    (Any lead added during the window is picked up on the next tick.)
-- ---------------------------------------------------------------------
SELECT cron.schedule('outreach-drip', '*/2 * * * *', $$
  SELECT net.http_post(
    url     := 'https://qkjccefoqbnxfljpjpsg.supabase.co/functions/v1/outreach-process',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', 'f9b8471da39b56c49e29a175'
               ),
    body    := '{}'::jsonb
  );
$$);

-- If you previously created the arm jobs, remove them — they're no longer used:
--   SELECT cron.unschedule('outreach-arm-0900ist');
--   SELECT cron.unschedule('outreach-arm-1205ist');
--   SELECT cron.unschedule('outreach-arm-1500ist');

-- ---------------------------------------------------------------------
-- 3. Reply monitoring — runs at the same three windows.
-- ---------------------------------------------------------------------
SELECT cron.schedule('reply-poll-0900ist', '30 3 * * *', $$
  SELECT net.http_post(
    url     := 'https://qkjccefoqbnxfljpjpsg.supabase.co/functions/v1/poll-replies',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','f9b8471da39b56c49e29a175'),
    body    := '{}'::jsonb
  );
$$);
SELECT cron.schedule('reply-poll-1205ist', '35 6 * * *', $$
  SELECT net.http_post(
    url     := 'https://qkjccefoqbnxfljpjpsg.supabase.co/functions/v1/poll-replies',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','f9b8471da39b56c49e29a175'),
    body    := '{}'::jsonb
  );
$$);
SELECT cron.schedule('reply-poll-1500ist', '30 9 * * *', $$
  SELECT net.http_post(
    url     := 'https://qkjccefoqbnxfljpjpsg.supabase.co/functions/v1/poll-replies',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','f9b8471da39b56c49e29a175'),
    body    := '{}'::jsonb
  );
$$);

-- ---------------------------------------------------------------------
-- 4. Stale-PROCESSING reaper — pure SQL (no Edge call). If the drip worker
--    crashed between claim and a terminal status, return the lead to NOT_SENT
--    so it isn't stranded. Cheap; runs every 10 minutes.
-- ---------------------------------------------------------------------
SELECT cron.schedule('outreach-reap-stale', '*/10 * * * *',
  $$ SELECT public.reap_stale_processing() $$);

-- ---------------------------------------------------------------------
-- Inspect / manage:
--   SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--   -- to remove one:  SELECT cron.unschedule('outreach-drip');
-- ---------------------------------------------------------------------
