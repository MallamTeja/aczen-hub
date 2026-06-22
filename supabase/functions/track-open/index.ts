// track-open — open-tracking pixel.
//
// The outreach email embeds <img src=".../track-open?lead=<id>">. When the
// recipient's client loads it, we record the open (first opened_at + count) and
// return a 1×1 transparent GIF. Public (no JWT) — it's hit by mail clients.
//
// Caveat: image-blocking and privacy proxies (e.g. Apple Mail Privacy
// Protection) make opens directional, not exact — clicks are the harder signal.
import { getAdminClient } from "../_shared/supabaseAdmin.ts";

// 1×1 transparent GIF.
const PIXEL = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (c) => c.charCodeAt(0),
);

function pixelResponse(): Response {
  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

Deno.serve(async (req) => {
  const lead = new URL(req.url).searchParams.get("lead");
  if (lead) {
    try {
      await getAdminClient().rpc("record_email_open", { p_lead: lead });
    } catch (_e) {
      // Never fail the pixel — tracking must not break the image render.
    }
  }
  return pixelResponse();
});
