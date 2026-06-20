// Email Automation module — types, constants, and display helpers.
// Backs the Automations → Email Automation tab and the outreach Edge Functions.

export const AUTOMATION_LANGUAGES = [
  "English",
  "Telugu",
  "Hindi",
  "Marathi",
  "Kannada",
  "Tamil",
] as const;

export type AutomationLanguage = (typeof AUTOMATION_LANGUAGES)[number];

export const AUTOMATION_STATUSES = [
  "NOT_SENT",
  "PROCESSING",
  "SENT",
  "GOT_RESPONSE",
  "FOLLOWED_UP",
  "FAILED",
] as const;

export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

export type EmailAutomationLead = {
  id: string;
  business_name: string;
  business_email: string;
  language: AutomationLanguage;
  status: AutomationStatus;

  industry: string | null;
  summary: string | null;
  pain_points: string[] | null;

  email_subject: string | null;
  email_body: string | null;
  email_generated_at: string | null;

  provider_message_id: string | null;
  provider_thread_id: string | null;
  sent_at: string | null;
  last_attempt_at: string | null;
  failure_reason: string | null;

  reply_body: string | null;
  reply_date: string | null;

  created_by: string;
  created_at: string;
  updated_at: string;
};

export type EmailAutomationLeadInput = {
  business_name: string;
  business_email: string;
  language: AutomationLanguage;
};

export const STATUS_META: Record<
  AutomationStatus,
  { label: string; badge: string; dot: string }
> = {
  NOT_SENT:     { label: "Not sent",     badge: "bg-slate-100 text-slate-700",     dot: "bg-slate-400" },
  PROCESSING:   { label: "Processing",   badge: "bg-amber-100 text-amber-800",     dot: "bg-amber-500" },
  SENT:         { label: "Sent",         badge: "bg-sky-100 text-sky-700",         dot: "bg-sky-500" },
  GOT_RESPONSE: { label: "Got response", badge: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  FOLLOWED_UP:  { label: "Followed up",  badge: "bg-violet-100 text-violet-700",   dot: "bg-violet-500" },
  FAILED:       { label: "Failed",       badge: "bg-rose-100 text-rose-700",       dot: "bg-rose-500" },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}
