// outreach-process — the 2-minute drip worker.
//
// Invoked by pg_cron every ~2 min. Each invocation processes AT MOST ONE lead
// (claim → research → generate → send → status), which gives the natural ~2-min
// spacing and a low, steady Gemini request rate. Sending only happens while the
// campaign window is "armed" (set by the 09:00/12:05/15:00 IST cron jobs).
import { getAdminClient } from "../_shared/supabaseAdmin.ts";
import { callGemini, AllKeysExhausted } from "../_shared/gemini.ts";
import { getAccessToken, sendEmail } from "../_shared/zoho.ts";
import {
  RESEARCH_SCHEMA,
  EMAIL_SCHEMA,
  researchPrompt,
  emailPrompt,
} from "../_shared/prompts.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // 1. Auth — internal cron only.
  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabase = getAdminClient();
  const log = (m: string) => console.log(m);

  // 2. Window must be armed.
  const { data: control } = await supabase
    .from("outreach_control")
    .select("sending_armed,window_label")
    .eq("id", 1)
    .maybeSingle();

  if (!control?.sending_armed) {
    return json({ status: "idle", reason: "window not armed" });
  }

  // 3. Atomically claim the next NOT_SENT lead (→ PROCESSING).
  const { data: lead, error: claimError } = await supabase
    .rpc("claim_next_email_automation_lead")
    .maybeSingle();

  if (claimError) return json({ status: "error", stage: "claim", error: claimError.message }, 500);

  if (!lead) {
    // Batch drained — disarm until the next window.
    await supabase
      .from("outreach_control")
      .update({ sending_armed: false, window_label: null })
      .eq("id", 1);
    return json({ status: "drained", message: "no NOT_SENT leads left; window disarmed" });
  }

  // deno-lint-ignore no-explicit-any
  const L = lead as any;
  log(`Processing lead ${L.id} — ${L.business_name} (${L.language})`);

  // Reverts a half-processed lead and stops the window (used when keys run out).
  async function revertAndDisarm(reason: string) {
    await supabase
      .from("email_automation_leads")
      .update({ status: "NOT_SENT", failure_reason: reason })
      .eq("id", L.id);
    await supabase
      .from("outreach_control")
      .update({ sending_armed: false, window_label: null })
      .eq("id", 1);
  }

  async function fail(stage: string, message: string) {
    await supabase
      .from("email_automation_leads")
      .update({ status: "FAILED", failure_reason: `${stage}: ${message}`.slice(0, 500) })
      .eq("id", L.id);
    return json({ status: "failed", lead: L.id, stage, error: message });
  }

  try {
    // 4. Research (Gemini call #1).
    const research = await callGemini(
      supabase,
      researchPrompt(L.business_name, L.business_email),
      RESEARCH_SCHEMA,
      { maxOutputTokens: 600, tag: "research", log },
    );
    await supabase
      .from("email_automation_leads")
      .update({
        industry: research.industry ?? null,
        summary: research.summary ?? null,
        pain_points: research.pain_points ?? [],
      })
      .eq("id", L.id);

    // 5. Email generation (Gemini call #2) — romanized subject, English body.
    const email = await callGemini(
      supabase,
      emailPrompt({
        businessName: L.business_name,
        industry: research.industry ?? "",
        summary: research.summary ?? "",
        painPoints: research.pain_points ?? [],
        language: L.language,
      }),
      EMAIL_SCHEMA,
      { maxOutputTokens: 900, tag: "generate", log },
    );

    if (!email.subject || !email.body) {
      return await fail("generate", "Gemini returned empty subject/body");
    }

    await supabase
      .from("email_automation_leads")
      .update({
        email_subject: email.subject,
        email_body: email.body,
        email_generated_at: new Date().toISOString(),
      })
      .eq("id", L.id);

    // 6. Format as HTML and send via Zoho.
    const token = await getAccessToken();
    
    const formattedBody = email.body
      .split(/\n+/)
      .map(p => `<p style="margin-bottom: 16px; color: #1a1a1a; line-height: 1.6; font-size: 15px;">${p.trim()}</p>`)
      .join("\n");

    const htmlContent = `
      <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <img src="https://qkjccefoqbnxfljpjpsg.supabase.co/storage/v1/object/public/email-assets/2.png" alt="Aczen Bilz" style="width: 100%; max-width: 600px; border-radius: 8px; margin-bottom: 24px;" />
        ${formattedBody}
        
        <div style="margin-top: 32px; margin-bottom: 24px;">
          <a href="https://calendly.com/aczenbilz/30min" style="background-color: #ea580c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 15px;">
            Book a Demo
          </a>
        </div>
      </div>
    `;

    const sent = await sendEmail(token, {
      to: L.business_email,
      subject: email.subject,
      content: htmlContent,
    });

    if (!sent.ok) {
      return await fail("zoho_send", JSON.stringify(sent.raw).slice(0, 400));
    }

    await supabase
      .from("email_automation_leads")
      .update({
        status: "SENT",
        provider_message_id: sent.messageId,
        provider_thread_id: sent.threadId,
        sent_at: new Date().toISOString(),
        failure_reason: null,
      })
      .eq("id", L.id);

    log(`SENT lead ${L.id} (messageId ${sent.messageId})`);
    return json({
      status: "sent",
      lead: L.id,
      business: L.business_name,
      subject: email.subject,
      messageId: sent.messageId,
    });
  } catch (e) {
    if (e instanceof AllKeysExhausted) {
      await revertAndDisarm("All Gemini keys exhausted — will resume next window");
      log(`Keys exhausted on lead ${L.id}; reverted to NOT_SENT and disarmed`);
      return json({ status: "keys_exhausted", lead: L.id, message: "reverted; resume next window" });
    }
    return await fail("worker", e instanceof Error ? e.message : String(e));
  }
});
