-- =====================================================================
-- Email Automation — pg_cron + pg_net scheduling
-- Run ONCE in the SQL Editor of project vrekigsesnqdhexflbcj AFTER the
-- email_automation_leads migration is applied and the Edge Functions are
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
-- 1. Arm a sending sweep at each campaign window (sets sending_armed=true).
--    The drip worker disarms automatically when the batch drains or keys run out.
-- ---------------------------------------------------------------------
SELECT cron.schedule('outreach-arm-0900ist', '30 3 * * *',
  $$ SELECT public.arm_outreach_window('09:00 IST') $$);
SELECT cron.schedule('outreach-arm-1205ist', '35 6 * * *',
  $$ SELECT public.arm_outreach_window('12:05 IST') $$);
SELECT cron.schedule('outreach-arm-1500ist', '30 9 * * *',
  $$ SELECT public.arm_outreach_window('15:00 IST') $$);

-- ---------------------------------------------------------------------
-- 2. Drip tick — every 2 minutes. Sends ONE lead if a window is armed,
--    otherwise no-ops cheaply. This is what enforces the ~2-min spacing.
-- ---------------------------------------------------------------------
SELECT cron.schedule('outreach-drip', '*/2 * * * *', $$
  SELECT net.http_post(
    url     := 'https://qkjccefoqbnxfljpjpsg.supabase.co/functions/v1/outreach-process',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', '<CRON_SECRET>'
               ),
    body    := '{}'::jsonb
  );
$$);

-- ---------------------------------------------------------------------
-- 3. Reply monitoring — runs at the same three windows.
-- ---------------------------------------------------------------------
SELECT cron.schedule('reply-poll-0900ist', '30 3 * * *', $$
  SELECT net.http_post(
    url     := 'https://qkjccefoqbnxfljpjpsg.supabase.co/functions/v1/poll-replies',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
    body    := '{}'::jsonb
  );
$$);
SELECT cron.schedule('reply-poll-1205ist', '35 6 * * *', $$
  SELECT net.http_post(
    url     := 'https://qkjccefoqbnxfljpjpsg.supabase.co/functions/v1/poll-replies',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
    body    := '{}'::jsonb
  );
$$);
SELECT cron.schedule('reply-poll-1500ist', '30 9 * * *', $$
  SELECT net.http_post(
    url     := 'https://qkjccefoqbnxfljpjpsg.supabase.co/functions/v1/poll-replies',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
    body    := '{}'::jsonb
  );
$$);

-- ---------------------------------------------------------------------
-- Inspect / manage:
--   SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--   -- to remove one:  SELECT cron.unschedule('outreach-drip');
-- ---------------------------------------------------------------------
