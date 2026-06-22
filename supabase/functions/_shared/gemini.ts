// Quota-aware Gemini client with key failover + PROACTIVE free-tier limits.
//
// Reads keys from env vars geminiapi1..10. Two layers of protection keep us
// safely inside the free tier:
//   1. PROACTIVE — per-key daily request/token counters (gemini_key_state,
//      reset each day) let us skip a key BEFORE it reaches its limit, leaving
//      a small safety gap. This is the real guard at volume (RPD is binding).
//   2. REACTIVE — on a 429/4xx/5xx the key is cooled down so we don't re-hit it.
// Plus: a small spacing delay before every request (never burst), tiny prompts,
// bounded output, and thinking disabled — so RPM/TPM/TPD stay far below ceilings.
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "gemini-2.5-flash";

// ── Free-tier limits for gemini-2.5-flash (per key/project). These can drift on
//    Google's side and vary by plan — adjust here if your tier changes. We stop
//    BEFORE the limit by the SAFETY_GAP so we never actually trip the boundary.
const RPD_LIMIT = 250;          // requests per day
const RPD_SAFETY_GAP = 5;       // stop using a key once this close to the limit
const SAFE_RPD = RPD_LIMIT - RPD_SAFETY_GAP;

const TPD_LIMIT = 1_000_000;    // tokens per day (generous; effectively non-binding here)
const TPD_SAFETY_GAP = 20_000;
const SAFE_TPD = TPD_LIMIT - TPD_SAFETY_GAP;

// Small spacing before every request so two back-to-back calls (research+email)
// never burst against the per-minute limit. At 1 lead / 2 min this is ample.
const REQUEST_GAP_MS = 1200;

// Cooldown durations (minutes) by failure class.
const COOLDOWN_QUOTA_MIN = 30;       // 429 — could be RPM (clears fast) or RPD; recheck in 30m
const COOLDOWN_BROKEN_MIN = 24 * 60; // 400/403/404 — key is invalid/misconfigured; park for a day
const COOLDOWN_TRANSIENT_MIN = 5;    // 5xx — provider hiccup

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class AllKeysExhausted extends Error {
  constructor() {
    super("ALL_KEYS_EXHAUSTED");
    this.name = "AllKeysExhausted";
  }
}

type KeyRef = { idx: number; key: string };

function loadKeys(): KeyRef[] {
  const keys: KeyRef[] = [];
  for (let i = 1; i <= 10; i++) {
    const k = Deno.env.get("geminiapi" + i);
    if (k && k.trim()) keys.push({ idx: i, key: k.trim() });
  }
  return keys;
}

function endpoint(key: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
}

async function setKeyState(
  supabase: SupabaseClient,
  keyIndex: number,
  status: string,
  cooldownMinutes: number | null,
) {
  const cooldown_until =
    cooldownMinutes == null ? null : new Date(Date.now() + cooldownMinutes * 60_000).toISOString();
  await supabase
    .from("gemini_key_state")
    .upsert({ key_index: keyIndex, last_status: status, cooldown_until }, { onConflict: "key_index" });
}

export interface GeminiOptions {
  maxOutputTokens?: number;
  tag?: string;
  log?: (msg: string) => void;
}

// deno-lint-ignore no-explicit-any
type JsonSchema = Record<string, any>;

interface KeyDayUsage {
  cooldownUntil: number; // epoch ms (0 = none)
  reqToday: number;      // requests counted today (0 if usage_date != today)
  tokensToday: number;   // tokens counted today
}

/**
 * Calls Gemini with a JSON response schema. Skips keys that are cooling down OR
 * that are within the daily safety gap of their request/token limit, rotating
 * through the rest. Returns the parsed JSON object.
 * Throws AllKeysExhausted if every key is unavailable (cooled or at-limit).
 */
export async function callGemini(
  supabase: SupabaseClient,
  prompt: string,
  schema: JsonSchema,
  opts: GeminiOptions = {},
  // deno-lint-ignore no-explicit-any
): Promise<any> {
  const maxOutputTokens = opts.maxOutputTokens ?? 800;
  const tag = opts.tag ?? "gemini";
  const log = opts.log ?? (() => {});
  const keys = loadKeys();
  if (keys.length === 0) throw new Error("No Gemini keys configured (geminiapi1..10)");

  // Pull cooldown + today's usage for every key in one read.
  const { data: states } = await supabase
    .from("gemini_key_state")
    .select("key_index,cooldown_until,usage_date,req_count_day,token_count_day");

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const usage = new Map<number, KeyDayUsage>(
    (states ?? []).map((s: {
      key_index: number;
      cooldown_until: string | null;
      usage_date: string | null;
      req_count_day: number | null;
      token_count_day: number | null;
    }) => {
      const sameDay = s.usage_date === today;
      return [s.key_index, {
        cooldownUntil: s.cooldown_until ? new Date(s.cooldown_until).getTime() : 0,
        reqToday: sameDay ? (s.req_count_day ?? 0) : 0,
        tokensToday: sameDay ? (s.token_count_day ?? 0) : 0,
      }];
    }),
  );

  const now = Date.now();
  let unavailable = 0; // keys skipped because cooling down or at daily limit
  let lastErr: Error | null = null;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens,
      responseMimeType: "application/json",
      responseSchema: schema,
      // Disable "thinking" — these are simple structured tasks; saves tokens,
      // latency and TPM pressure, and avoids burning the output budget.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  for (const { idx, key } of keys) {
    const u = usage.get(idx) ?? { cooldownUntil: 0, reqToday: 0, tokensToday: 0 };

    // Skip cooled-down keys.
    if (u.cooldownUntil > now) {
      unavailable++;
      log(`[${tag}] geminiapi${idx} cooling down, skip`);
      continue;
    }
    // PROACTIVE: skip keys at/near their daily request or token ceiling.
    if (u.reqToday >= SAFE_RPD) {
      unavailable++;
      log(`[${tag}] geminiapi${idx} at daily request cap (${u.reqToday}/${RPD_LIMIT}), skip`);
      continue;
    }
    if (u.tokensToday >= SAFE_TPD) {
      unavailable++;
      log(`[${tag}] geminiapi${idx} at daily token cap (${u.tokensToday}/${TPD_LIMIT}), skip`);
      continue;
    }

    // Small spacing so we never burst against per-minute limits.
    await sleep(REQUEST_GAP_MS);

    let res: Response;
    try {
      res = await fetch(endpoint(key), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch (e) {
      lastErr = e as Error;
      await setKeyState(supabase, idx, "5xx", COOLDOWN_TRANSIENT_MIN);
      log(`[${tag}] geminiapi${idx} network error → next`);
      continue;
    }

    // Count this request against the key's daily budget (it reached Google).
    // Tokens are added separately on success, once usageMetadata is known.
    await supabase.rpc("bump_gemini_usage", { p_key_index: idx, p_requests: 1, p_tokens: 0 });

    if (res.status === 429) {
      await setKeyState(supabase, idx, "429", COOLDOWN_QUOTA_MIN);
      unavailable++;
      log(`[${tag}] geminiapi${idx} 429 quota → cooldown ${COOLDOWN_QUOTA_MIN}m`);
      continue;
    }
    if (res.status === 400 || res.status === 403 || res.status === 404) {
      await setKeyState(supabase, idx, String(res.status), COOLDOWN_BROKEN_MIN);
      unavailable++;
      log(`[${tag}] geminiapi${idx} ${res.status} broken → park 24h`);
      continue;
    }
    if (res.status >= 500) {
      await setKeyState(supabase, idx, "5xx", COOLDOWN_TRANSIENT_MIN);
      lastErr = new Error(`geminiapi${idx} HTTP ${res.status}`);
      log(`[${tag}] geminiapi${idx} ${res.status} transient → next`);
      continue;
    }
    if (!res.ok) {
      lastErr = new Error(`geminiapi${idx} HTTP ${res.status}`);
      continue;
    }

    const data = await res.json();
    const cand = data?.candidates?.[0];
    const finish = cand?.finishReason;
    const text = cand?.content?.parts?.[0]?.text;
    const usedTokens = Number(data?.usageMetadata?.totalTokenCount ?? 0);

    // Add token usage for the day WITHOUT re-counting the request (0 requests).
    if (usedTokens > 0) {
      await supabase.rpc("bump_gemini_usage", { p_key_index: idx, p_requests: 0, p_tokens: usedTokens });
    }

    if (finish === "MAX_TOKENS" || finish === "SAFETY" || !text) {
      // Don't park the key for a content-shaped problem — just try another.
      lastErr = new Error(`geminiapi${idx} bad finish (${finish ?? "empty"})`);
      log(`[${tag}] geminiapi${idx} finish=${finish ?? "empty"} → next`);
      continue;
    }

    // Success — clear any cooldown and return parsed JSON.
    await setKeyState(supabase, idx, "ok", null);
    try {
      log(`[${tag}] geminiapi${idx} OK (${u.reqToday + 1}/${RPD_LIMIT} today)`);
      return JSON.parse(text);
    } catch {
      lastErr = new Error(`geminiapi${idx} returned non-JSON`);
      continue;
    }
  }

  if (unavailable >= keys.length) throw new AllKeysExhausted();
  throw lastErr ?? new Error("All Gemini keys failed");
}
