// track-click — click-tracking redirect.
//
// The "Book a Demo" link points here: .../track-click?lead=<id>&url=<dest>.
// We record the click (first clicked_at + count, and imply an open), then 302
// the recipient to the real destination. Public (no JWT) — clicked by humans.
import { getAdminClient } from "../_shared/supabaseAdmin.ts";

const FALLBACK_DEST = "https://calendly.com/aczenbilz/30min";

Deno.serve(async (req) => {
  const params = new URL(req.url).searchParams;
  const lead = params.get("lead");
  const target = params.get("url");

  if (lead) {
    try {
      await getAdminClient().rpc("record_email_click", { p_lead: lead });
    } catch (_e) {
      // Never block the redirect on a tracking failure.
    }
  }

  // Only redirect to http(s) destinations to avoid open-redirect abuse.
  const dest = target && /^https?:\/\//i.test(target) ? target : FALLBACK_DEST;
  return new Response(null, { status: 302, headers: { Location: dest } });
});
