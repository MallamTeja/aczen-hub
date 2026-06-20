// Quota-aware Gemini client with key failover.
//
// Reads keys from env vars geminiapi1..10. Tracks per-key health in the
// gemini_key_state table so exhausted/broken keys are skipped on later ticks
// instead of being re-hit (which would keep tripping 429/400/404). Designed to
// stay inside free-tier limits: tiny prompts, bounded output, thinking disabled,
// and one lead per 2-min tick (≈1 request/min — far below RPM).
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "gemini-2.5-flash";

// Cooldown durations (minutes) by failure class.
const COOLDOWN_QUOTA_MIN = 30;     // 429 — could be RPM (clears fast) or RPD; recheck in 30m
const COOLDOWN_BROKEN_MIN = 24 * 60; // 400/403/404 — key is invalid/misconfigured; park for a day
const COOLDOWN_TRANSIENT_MIN = 5;  // 5xx — provider hiccup

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

/**
 * Calls Gemini with a JSON response schema, rotating through keys on
 * quota/broken/transient errors. Returns the parsed JSON object.
 * Throws AllKeysExhausted if every key is cooled-down or fails on quota.
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

  const { data: states } = await supabase
    .from("gemini_key_state")
    .select("key_index,cooldown_until");
  const cooldown = new Map<number, number>(
    (states ?? []).map((s: { key_index: number; cooldown_until: string | null }) => [
      s.key_index,
      s.cooldown_until ? new Date(s.cooldown_until).getTime() : 0,
    ]),
  );

  const now = Date.now();
  let skipped = 0;
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
    if ((cooldown.get(idx) ?? 0) > now) {
      skipped++;
      log(`[${tag}] geminiapi${idx} cooling down, skip`);
      continue;
    }

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

    if (res.status === 429) {
      await setKeyState(supabase, idx, "429", COOLDOWN_QUOTA_MIN);
      skipped++;
      log(`[${tag}] geminiapi${idx} 429 quota → cooldown ${COOLDOWN_QUOTA_MIN}m`);
      continue;
    }
    if (res.status === 400 || res.status === 403 || res.status === 404) {
      await setKeyState(supabase, idx, String(res.status), COOLDOWN_BROKEN_MIN);
      skipped++;
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

    if (finish === "MAX_TOKENS" || finish === "SAFETY" || !text) {
      // Don't park the key for a content-shaped problem — just try another.
      lastErr = new Error(`geminiapi${idx} bad finish (${finish ?? "empty"})`);
      log(`[${tag}] geminiapi${idx} finish=${finish ?? "empty"} → next`);
      continue;
    }

    // Success — clear any cooldown and return parsed JSON.
    await setKeyState(supabase, idx, "ok", null);
    try {
      log(`[${tag}] geminiapi${idx} OK`);
      return JSON.parse(text);
    } catch {
      lastErr = new Error(`geminiapi${idx} returned non-JSON`);
      continue;
    }
  }

  if (skipped >= keys.length) throw new AllKeysExhausted();
  throw lastErr ?? new Error("All Gemini keys failed");
}
