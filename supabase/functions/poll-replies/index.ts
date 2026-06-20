// poll-replies — reply monitoring (no AI).
//
// Invoked by pg_cron at 09:00 / 12:05 / 15:00 IST. Reads the Zoho inbox, matches
// each message's sender against leads we have emailed, and flips matched leads to
// GOT_RESPONSE with the reply body/date/thread. Uses a high-water cursor stored
// in outreach_control.reply_cursor so old mail isn't reprocessed.
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import {
  getAccessToken,
  getInboxFolderId,
  listInboxMessages,
  getMessageContent,
} from "../_shared/zoho.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractEmail(addr: string): string {
  const m = addr.match(/<([^>]+)>/);
  return (m ? m[1] : addr).trim().toLowerCase();
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabase = getAdminClient();

  // Leads we are waiting on (already emailed, not yet replied).
  const { data: leads } = await supabase
    .from("email_automation_leads")
    .select("id,business_email,sent_at,status")
    .in("status", ["SENT", "FOLLOWED_UP"]);

  if (!leads || leads.length === 0) {
    return json({ status: "ok", matched: 0, message: "no leads awaiting replies" });
  }

  // email -> lead (lowercased)
  const byEmail = new Map<string, (typeof leads)[number]>();
  for (const l of leads) byEmail.set(String(l.business_email).toLowerCase(), l);

  // Cursor (high-water mark) so we only look at new mail.
  const { data: control } = await supabase
    .from("outreach_control")
    .select("reply_cursor")
    .eq("id", 1)
    .maybeSingle();
  const cursorMs = control?.reply_cursor ? new Date(control.reply_cursor).getTime() : 0;

  let token: string;
  let folderId: string;
  try {
    token = await getAccessToken();
    folderId = await getInboxFolderId(token);
  } catch (e) {
    // deno-lint-ignore no-explicit-any
    if ((e as any).scopeIssue) {
      return json(
        { status: "scope_missing", message: "Zoho token lacks ZohoMail.messages.READ — re-auth required" },
        200,
      );
    }
    return json({ status: "error", stage: "zoho_init", error: String(e) }, 500);
  }

  const messages = await listInboxMessages(token, folderId, 50);

  let matched = 0;
  let maxSeen = cursorMs;

  for (const msg of messages) {
    if (msg.receivedTime > maxSeen) maxSeen = msg.receivedTime;
    if (msg.receivedTime <= cursorMs) continue; // already processed

    const from = extractEmail(msg.fromAddress);
    const lead = byEmail.get(from);
    if (!lead) continue;

    // Reply must arrive after we sent (guards against pre-existing mail).
    const sentMs = lead.sent_at ? new Date(lead.sent_at).getTime() : 0;
    if (msg.receivedTime < sentMs) continue;

    let body = msg.summary;
    if (!body) {
      try {
        body = await getMessageContent(token, folderId, msg.messageId);
      } catch {
        body = "";
      }
    }

    await supabase
      .from("email_automation_leads")
      .update({
        status: "GOT_RESPONSE",
        reply_body: (body || "(reply received)").slice(0, 4000),
        reply_date: new Date(msg.receivedTime).toISOString(),
        provider_thread_id: msg.threadId ?? null,
      })
      .eq("id", lead.id);

    matched++;
    // Don't match this lead again in the same run.
    byEmail.delete(from);
  }

  // Advance the cursor.
  if (maxSeen > cursorMs) {
    await supabase
      .from("outreach_control")
      .update({ reply_cursor: new Date(maxSeen).toISOString() })
      .eq("id", 1);
  }

  return json({ status: "ok", scanned: messages.length, matched });
});
