// Service-role Supabase client for Edge Functions. The SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are auto-injected into the Edge runtime — the
// service role bypasses RLS so the worker can update lead status freely.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export function getAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in Edge env");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
