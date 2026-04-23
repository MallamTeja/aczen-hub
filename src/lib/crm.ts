export const PIPELINE_STAGES = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  source: string | null;
  stage: PipelineStage;
  value: number;
  currency: string;
  probability: number;
  expected_close: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  created_by: string;
  notes: string | null;
  tags: string[];
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadActivityType = "call" | "email" | "note" | "meeting" | "stage_change";

export type LeadActivity = {
  id: string;
  lead_id: string;
  type: LeadActivityType;
  title: string;
  body: string | null;
  from_stage: string | null;
  to_stage: string | null;
  actor_user_id: string;
  actor_name: string | null;
  created_at: string;
};

export type LeadInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  job_title?: string | null;
  source?: string | null;
  stage?: PipelineStage;
  value?: number;
  currency?: string;
  probability?: number;
  expected_close?: string | null;
  owner_user_id?: string | null;
  owner_name?: string | null;
  notes?: string | null;
  tags?: string[];
};

export const STAGE_STYLES: Record<
  PipelineStage,
  { accent: string; badge: string; column: string; dot: string }
> = {
  New:         { accent: "border-l-sky-500",     badge: "bg-sky-100 text-sky-700",       column: "bg-sky-50/40",       dot: "bg-sky-500" },
  Contacted:   { accent: "border-l-indigo-500",  badge: "bg-indigo-100 text-indigo-700", column: "bg-indigo-50/40",    dot: "bg-indigo-500" },
  Qualified:   { accent: "border-l-violet-500",  badge: "bg-violet-100 text-violet-700", column: "bg-violet-50/40",    dot: "bg-violet-500" },
  Proposal:    { accent: "border-l-amber-500",   badge: "bg-amber-100 text-amber-800",   column: "bg-amber-50/40",     dot: "bg-amber-500" },
  Negotiation: { accent: "border-l-orange-500",  badge: "bg-orange-100 text-orange-800", column: "bg-orange-50/40",    dot: "bg-orange-500" },
  Won:         { accent: "border-l-emerald-500", badge: "bg-emerald-100 text-emerald-800", column: "bg-emerald-50/40", dot: "bg-emerald-500" },
  Lost:        { accent: "border-l-rose-500",    badge: "bg-rose-100 text-rose-700",     column: "bg-rose-50/40",      dot: "bg-rose-500" },
};

export const DEFAULT_STAGE_PROBABILITY: Record<PipelineStage, number> = {
  New: 10,
  Contacted: 25,
  Qualified: 40,
  Proposal: 60,
  Negotiation: 80,
  Won: 100,
  Lost: 0,
};

export function formatMoney(amount: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

export function initialsOf(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

// Best-effort mapping from a free-text header ("Full Name", "e-mail", etc.)
// to one of our known lead fields. Returns null if no confident match.
const HEADER_ALIASES: Record<keyof LeadInput, string[]> = {
  name:          ["name", "full name", "contact name", "lead", "lead name", "person"],
  email:         ["email", "e-mail", "email address", "mail"],
  phone:         ["phone", "mobile", "contact", "contact number", "phone number", "tel"],
  company:       ["company", "organisation", "organization", "account", "business"],
  job_title:     ["title", "job", "job title", "role", "position", "designation"],
  source:        ["source", "lead source", "channel"],
  stage:         ["stage", "status", "pipeline", "pipeline stage"],
  value:         ["value", "amount", "deal value", "deal size", "revenue", "estimated value"],
  currency:      ["currency"],
  probability:   ["probability", "probability %", "win probability"],
  expected_close:["expected close", "close date", "expected close date", "target date"],
  owner_user_id: [],
  owner_name:    ["owner", "assigned to", "assignee", "sales rep", "rep"],
  notes:         ["notes", "description", "comments", "remarks"],
  tags:          ["tags", "labels"],
};

export function guessField(header: string): keyof LeadInput | null {
  const key = header.trim().toLowerCase();
  if (!key) return null;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
    keyof LeadInput,
    string[]
  ][]) {
    if (aliases.some((a) => a === key)) return field;
  }
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
    keyof LeadInput,
    string[]
  ][]) {
    if (aliases.some((a) => key.includes(a))) return field;
  }
  return null;
}

export function normaliseStage(raw: unknown): PipelineStage {
  const s = String(raw ?? "").trim().toLowerCase();
  const match = PIPELINE_STAGES.find((stage) => stage.toLowerCase() === s);
  return match ?? "New";
}
