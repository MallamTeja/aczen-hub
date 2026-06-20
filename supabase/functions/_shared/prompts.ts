// Prompt builders + JSON schemas for the two Gemini calls.
// Plain backend code (no AI) — STEP 5 of the flow.

// deno-lint-ignore no-explicit-any
export const RESEARCH_SCHEMA: Record<string, any> = {
  type: "OBJECT",
  properties: {
    industry: { type: "STRING" },
    summary: { type: "STRING" },
    pain_points: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["industry", "summary", "pain_points"],
};

// deno-lint-ignore no-explicit-any
export const EMAIL_SCHEMA: Record<string, any> = {
  type: "OBJECT",
  properties: {
    subject: { type: "STRING" },
    body: { type: "STRING" },
  },
  required: ["subject", "body"],
};

export function researchPrompt(businessName: string, email: string): string {
  return `Research this business. Return JSON only.

Business Name: ${businessName}
Email: ${email}

Infer the industry, a one-paragraph summary of what they likely do, and 3-5
concrete finance/operations pain points Aczen Bilz could help with.

{
  "industry": "",
  "summary": "",
  "pain_points": []
}`;
}

export interface EmailPromptInput {
  businessName: string;
  industry: string;
  summary: string;
  painPoints: string[];
  language: string;
}

export function emailPrompt(input: EmailPromptInput): string {
  const { businessName, industry, summary, painPoints, language } = input;
  const isEnglish = language.toLowerCase() === "english";

  const subjectRule = isEnglish
    ? `Write a natural English subject line (under 60 characters).`
    : `Write the subject line in ${language} but spelled with ENGLISH / Latin (Roman)
   letters only — i.e. transliteration / phonetic spelling, NOT the native script.
   Example style for Telugu: "Mi GST filing ayinda?" or "Mee cash flow ready ah?".
   Common business terms (GST, invoice, cash flow, Aczen Bilz) stay in English.
   The subject must read like how a local person types ${language} in English.`;

  return `You are an Aczen Bilz sales assistant writing a cold outreach email.

Business Name: ${businessName}
Industry: ${industry}
Business Summary: ${summary}
Pain Points:
${painPoints.map((p) => "- " + p).join("\n")}

Generate, returning JSON only { "subject": "", "body": "" }:

1. SUBJECT: ${subjectRule}

2. BODY: written ENTIRELY in natural English (never in ${language} or its
   transliteration). Greet as "Hi ${businessName} team,". 90-130 words, warm and
   specific to the pain points above. Mention Aczen Bilz naturally as the product
   that solves them. End with a short, low-pressure call to action.
   
   IMPORTANT FORMATTING: Use double newlines (\\n\\n) to break the email into 3-4 readable paragraphs. Separate the greeting, the main pitch, and the call to action onto their own lines.

Hard rules:
- Do NOT use placeholders like [Name], [Recipient], or [Company]. Use the real
  business name given above.
- Subject and body must be plain text (no markdown, no HTML tags).`;
}
