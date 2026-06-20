# Email Automation — Edge Functions deploy guide

Target Supabase project: **`vrekigsesnqdhexflbcj`** (the project the app connects to).

Functions:
- **`outreach-process`** — 2-min drip worker: claim a NOT_SENT lead → Gemini research → Gemini email (romanized subject, English body) → Zoho send → status update.
- **`poll-replies`** — reply monitor: read Zoho inbox, match sender to lead, set GOT_RESPONSE.

Shared code lives in `_shared/` (gemini, zoho, prompts, supabaseAdmin).

## 1. Apply the database migration
The `email_automation_leads` migration (`supabase/migrations/20260620120000_create_email_automation_leads.sql`)
also creates `outreach_control`, `gemini_key_state`, `claim_next_email_automation_lead()`
and `arm_outreach_window()`. Easiest: paste it into the **SQL Editor of project
`vrekigsesnqdhexflbcj`** and run. (Don't `supabase db push` unless you're sure the
CLI is linked to that project.)

## 2. Set Edge secrets
The functions read the SAME variable names as `.env`. Set them on Supabase:

```bash
supabase secrets set --project-ref vrekigsesnqdhexflbcj \
  geminiapi1=... geminiapi2=... geminiapi3=... geminiapi4=... geminiapi5=... \
  geminiapi6=... geminiapi7=... geminiapi8=... geminiapi9=... geminiapi10=... \
  ZOHO_CLIENT_ID=... ZOHO_CLIENT_SECRET=... ZOHO_REFRESH_TOKEN=... ZOHO_ACCOUNT_ID=... \
  CRON_SECRET=<choose-a-long-random-string>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do not set them.

## 3. Deploy
```bash
supabase functions deploy outreach-process --project-ref vrekigsesnqdhexflbcj --no-verify-jwt
supabase functions deploy poll-replies     --project-ref vrekigsesnqdhexflbcj --no-verify-jwt
```

## 4. Schedule (pg_cron)
Run `supabase/CRON_SETUP.sql` in the SQL Editor, replacing `<CRON_SECRET>` with the
value from step 2.

## 5. Manual test (no waiting for cron)
```bash
# arm a window manually
#   SQL editor:  SELECT public.arm_outreach_window('manual test');

# then fire one drip tick:
curl -i -X POST 'https://vrekigsesnqdhexflbcj.supabase.co/functions/v1/outreach-process' \
  -H 'Content-Type: application/json' -H 'x-cron-secret: <CRON_SECRET>'

# poll replies:
curl -i -X POST 'https://vrekigsesnqdhexflbcj.supabase.co/functions/v1/poll-replies' \
  -H 'Content-Type: application/json' -H 'x-cron-secret: <CRON_SECRET>'
```
Watch the lead move PROCESSING → SENT live in the Automations tab.

## Notes / risks
- **Zoho read scope:** the send-only refresh token may not allow inbox reads. If
  `poll-replies` returns `{"status":"scope_missing"}`, re-authorize Zoho with scopes
  `ZohoMail.messages.READ,ZohoMail.messages.CREATE,ZohoMail.accounts.READ` and update
  `ZOHO_REFRESH_TOKEN`.
- **Gemini keys:** `gemini_key_state` parks dead/quota keys; check it if sends stall:
  `SELECT * FROM gemini_key_state;`. Currently keys 1 (403) and 2 (malformed) are bad —
  regenerate them in Google AI Studio.
- **Cadence:** windows arm at 03:30 / 06:35 / 09:30 UTC; the drip sends one lead per
  2-min tick until the batch drains or all keys are exhausted (then it disarms and
  resumes at the next window).
