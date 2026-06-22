// poll-replies — reply monitoring (no AI).
//
// Invoked by pg_cron at 09:00 / 12:05 / 15:00 IST. Reads the Zoho inbox and, for
// each new message, decides:
//   • BOUNCE      → suppress the address (#5) so we never email it again.
//   • AUTO-REPLY  → ignore (out-of-office etc. is NOT a real response).
//   • REAL REPLY  → match to a lead (by thread first, then sender) and flip it to
//                   GOT_RESPONSE, which the DB trigger promotes into the CRM.
// A high-water cursor (outreach_control.reply_cursor) avoids reprocessing old mail.
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

// A delivery-failure / bounce message (so we can suppress the address).
function isBounce(from: string, subject: string): boolean {
  return (
    /mailer-daemon|postmaster|mail-?delivery|delivery-?status|no-?reply@.*(mail|smtp)/i.test(from) ||
    /undeliverable|delivery (status notification|has failed|failure|incomplete)|returned mail|mail delivery (failed|subsystem)|failure notice|could not be delivered/i.test(
      subject,
    )
  );
}

// An automated away-message — interest signal of zero, do not treat as a reply.
function isAutoReply(subject: string): boolean {
  return /out of (the )?office|automatic reply|auto-?reply|autoresponse|away from (my )?(desk|email)|on (vacation|leave|holiday)/i.test(
    subject,
  );
}

// Find which awaiting-lead address a bounce message refers to, by scanning text.
function findAwaitingEmail(text: string, emails: Iterable<string>): string | null {
  const t = text.toLowerCase();
  for (const e of emails) {
    if (e && t.includes(e)) return e;
  }
  return null;
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
    .select("id,business_email,sent_at,status,provider_thread_id")
    .in("status", ["SENT", "FOLLOWED_UP"]);

  if (!leads || leads.length === 0) {
    return json({ status: "ok", matched: 0, message: "no leads awaiting replies" });
  }

  type LeadRow = (typeof leads)[number];
  // Match indexes: by sender email and by Zoho thread id.
  const byEmail = new Map<string, LeadRow>();
  const byThread = new Map<string, LeadRow>();
  for (const l of leads) {
    byEmail.set(String(l.business_email).toLowerCase(), l);
    if (l.provider_thread_id) byThread.set(String(l.provider_thread_id), l);
  }
  // Stop matching a lead once handled (remove from both indexes).
  const forget = (l: LeadRow) => {
    byEmail.delete(String(l.business_email).toLowerCase());
    if (l.provider_thread_id) byThread.delete(String(l.provider_thread_id));
  };

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
  let bounced = 0;
  let ignored = 0;
  let maxSeen = cursorMs;

  for (const msg of messages) {
    if (msg.receivedTime > maxSeen) maxSeen = msg.receivedTime;
    if (msg.receivedTime <= cursorMs) continue; // already processed

    const from = extractEmail(msg.fromAddress);
    const subject = msg.subject || "";

    // 1. Bounce → suppress the affected address (#5).
    if (isBounce(from, subject)) {
      let target = findAwaitingEmail(`${subject}\n${msg.summary ?? ""}`, byEmail.keys());
      if (!target) {
        // Bounce bodies usually name the failed recipient — fetch & scan.
        try {
          const content = await getMessageContent(token, folderId, msg.messageId);
          target = findAwaitingEmail(content, byEmail.keys());
        } catch {
          target = null;
        }
      }
      if (target) {
        const lead = byEmail.get(target);
        await supabase.rpc("suppress_email", {
          p_email: target,
          p_reason: `bounce: ${subject}`.slice(0, 200),
        });
        if (lead) forget(lead);
        bounced++;
      }
      continue;
    }

    // 2. Automated away-message → not a real reply.
    if (isAutoReply(subject)) {
      ignored++;
      continue;
    }

    // 3. Real reply — match by thread first, then by sender address (#4).
    const lead =
      (msg.threadId ? byThread.get(String(msg.threadId)) : undefined) ?? byEmail.get(from);
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
        provider_thread_id: msg.threadId ?? lead.provider_thread_id ?? null,
      })
      .eq("id", lead.id);

    matched++;
    forget(lead);
  }

  // Advance the cursor.
  if (maxSeen > cursorMs) {
    await supabase
      .from("outreach_control")
      .update({ reply_cursor: new Date(maxSeen).toISOString() })
      .eq("id", 1);
  }

  return json({ status: "ok", scanned: messages.length, matched, bounced, ignored });
});
