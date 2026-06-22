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
  genericEmailPrompt,
} from "../_shared/prompts.ts";

// Below this research-confidence score we send a GENERIC, claim-nothing email
// instead of a personalized one — protects against confidently-wrong outreach.
const CONFIDENCE_THRESHOLD = 50;

// Where "Book a Demo" points. TODO: replace with the final booking destination
// (CRM scheduler / Calendly / etc.) — the click is tracked regardless of target.
const DEMO_LINK = "https://calendly.com/aczenbilz/30min";

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

  // Base URL for the tracking endpoints (open pixel + click redirect).
  const fnBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;

  // 2. Sending window: continuous 08:00–15:00 IST, Monday–Saturday (no Sunday).
  //    Edge runs in UTC; shift by +5:30 and read the wall clock in IST.
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const istDay = istNow.getUTCDay();   // 0 = Sunday
  const istHour = istNow.getUTCHours();
  if (istDay === 0) {
    return json({ status: "idle", reason: "Sunday — sending paused" });
  }
  if (istHour < 8 || istHour >= 15) {
    return json({ status: "idle", reason: "outside 08:00–15:00 IST window" });
  }

  // Back-off after Gemini keys were exhausted (replaces the old disarm).
  const { data: control } = await supabase
    .from("outreach_control")
    .select("paused_until")
    .eq("id", 1)
    .maybeSingle();
  if (control?.paused_until && new Date(control.paused_until).getTime() > Date.now()) {
    return json({ status: "idle", reason: `paused until ${control.paused_until}` });
  }

  // 3. Atomically claim the next NOT_SENT lead (→ PROCESSING). The claim RPC
  //    already skips suppressed addresses.
  const { data: lead, error: claimError } = await supabase
    .rpc("claim_next_email_automation_lead")
    .maybeSingle();

  if (claimError) return json({ status: "error", stage: "claim", error: claimError.message }, 500);

  if (!lead) {
    // Nothing to send right now. The next tick re-checks the window and will
    // pick up any lead added later in the day automatically.
    return json({ status: "idle", message: "no NOT_SENT leads in queue" });
  }

  // deno-lint-ignore no-explicit-any
  const L = lead as any;
  log(`Processing lead ${L.id} — ${L.business_name} (${L.language})`);

  // Reverts a half-processed lead and pauses sending for a while (used when all
  // Gemini keys are exhausted, so we don't churn the queue every 2 min).
  async function revertAndPause(reason: string) {
    await supabase
      .from("email_automation_leads")
      .update({ status: "NOT_SENT", failure_reason: reason })
      .eq("id", L.id);
    await supabase
      .from("outreach_control")
      .update({ paused_until: new Date(Date.now() + 30 * 60 * 1000).toISOString() })
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
    // 4. Research (Gemini call #1) — now also returns a confidence score.
    const research = await callGemini(
      supabase,
      researchPrompt(L.business_name, L.business_email),
      RESEARCH_SCHEMA,
      { maxOutputTokens: 600, tag: "research", log },
    );

    const confidence = Number.isFinite(research.confidence) ? Number(research.confidence) : 0;
    // #6 — confidently-wrong personalization is worse than generic. Below the
    // threshold we deliberately fall back to a generic, claim-nothing email.
    const mode = confidence >= CONFIDENCE_THRESHOLD ? "personalized" : "generic";

    await supabase
      .from("email_automation_leads")
      .update({
        industry: research.industry ?? null,
        summary: research.summary ?? null,
        pain_points: research.pain_points ?? [],
        confidence,
        personalization_mode: mode,
      })
      .eq("id", L.id);

    log(`lead ${L.id} confidence=${confidence} → ${mode}`);

    // 5. Email generation (Gemini call #2) — personalized or generic.
    const email = await callGemini(
      supabase,
      mode === "personalized"
        ? emailPrompt({
            businessName: L.business_name,
            industry: research.industry ?? "",
            summary: research.summary ?? "",
            painPoints: research.pain_points ?? [],
            language: L.language,
          })
        : genericEmailPrompt(L.business_name, L.language),
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

    // 6. Format as HTML and send via Zoho. Plain, text-like email (no banner)
    //    for deliverability; the "Book a Demo" link is routed through the
    //    click-tracking endpoint and a 1×1 pixel tracks opens.
    const token = await getAccessToken();

    const formattedBody = email.body
      .split(/\n+/)
      .map((p: string) => `<p style="margin-bottom: 16px; color: #1a1a1a; line-height: 1.6; font-size: 15px;">${p.trim()}</p>`)
      .join("\n");

    const clickUrl = `${fnBase}/track-click?lead=${L.id}&url=${encodeURIComponent(DEMO_LINK)}`;
    const openPixel = `${fnBase}/track-open?lead=${L.id}`;

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
        ${formattedBody}

        <div style="margin-top: 28px; margin-bottom: 20px;">
          <a href="${clickUrl}" style="background-color: #ea580c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 15px;">
            Book a Demo
          </a>
        </div>
        <img src="${openPixel}" alt="" width="1" height="1" style="display:none" />
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

    const nowIso = new Date().toISOString();
    await supabase
      .from("email_automation_leads")
      .update({
        status: "SENT",
        provider_message_id: sent.messageId,
        provider_thread_id: sent.threadId,
        sent_at: nowIso,
        delivered_at: nowIso, // accepted by Zoho; cleared later if it bounces
        failure_reason: null,
      })
      .eq("id", L.id);

    log(`SENT lead ${L.id} (messageId ${sent.messageId})`);
    return json({
      status: "sent",
      lead: L.id,
      business: L.business_name,
      mode,
      confidence,
      subject: email.subject,
      messageId: sent.messageId,
    });
  } catch (e) {
    if (e instanceof AllKeysExhausted) {
      await revertAndPause("All Gemini keys exhausted — paused ~30 min");
      log(`Keys exhausted on lead ${L.id}; reverted to NOT_SENT and paused ~30m`);
      return json({ status: "keys_exhausted", lead: L.id, message: "reverted; paused ~30m" });
    }
    return await fail("worker", e instanceof Error ? e.message : String(e));
  }
});
