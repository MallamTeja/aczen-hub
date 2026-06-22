// Prompt builders + JSON schemas for the Gemini calls.
// Plain backend code (no AI) — STEP 5 of the flow.

// deno-lint-ignore no-explicit-any
export const RESEARCH_SCHEMA: Record<string, any> = {
  type: "OBJECT",
  properties: {
    industry: { type: "STRING" },
    summary: { type: "STRING" },
    pain_points: { type: "ARRAY", items: { type: "STRING" } },
    // How sure the model is about THIS specific business (not a generic guess).
    // Drives the personalized-vs-generic decision (#6) — protects against
    // confidently-wrong personalization.
    confidence: { type: "INTEGER" },
  },
  required: ["industry", "summary", "pain_points", "confidence"],
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

Then add a "confidence" score from 0 to 100 that reflects how sure you are that
this is genuinely accurate for THIS specific business (not a generic guess):
- 80-100: the name/email clearly identifies what they do.
- 40-79:  reasonable inference but some guessing.
- 0-39:   you are essentially guessing from the name alone.
Be honest and conservative — a low score is better than confident guessing.

{
  "industry": "",
  "summary": "",
  "pain_points": [],
  "confidence": 0
}`;
}

// Shared subject-line rule: English business gets a plain subject; regional
// languages get a romanized (Latin-letter) transliteration, not native script.
function subjectRule(language: string): string {
  const isEnglish = language.toLowerCase() === "english";
  return isEnglish
    ? `Write a natural English subject line (under 60 characters).`
    : `Write the subject line in ${language} but spelled with ENGLISH / Latin (Roman)
   letters only — i.e. transliteration / phonetic spelling, NOT the native script.
   Example style for Telugu: "Mi GST filing ayinda?" or "Mee cash flow ready ah?".
   Common business terms (GST, invoice, cash flow, Aczen Bilz) stay in English.
   The subject must read like how a local person types ${language} in English.`;
}

export interface EmailPromptInput {
  businessName: string;
  industry: string;
  summary: string;
  painPoints: string[];
  language: string;
}

// Personalized email — used when research confidence >= threshold (#6).
export function emailPrompt(input: EmailPromptInput): string {
  const { businessName, industry, summary, painPoints, language } = input;

  return `You are an Aczen Bilz sales assistant writing a cold outreach email.

Business Name: ${businessName}
Industry: ${industry}
Business Summary: ${summary}
Pain Points:
${painPoints.map((p) => "- " + p).join("\n")}

Generate, returning JSON only { "subject": "", "body": "" }:

1. SUBJECT: ${subjectRule(language)}

2. BODY: written ENTIRELY in natural English (never in ${language} or its
   transliteration). Greet as "Hi ${businessName} team,". 90-130 words, warm and
   specific to the pain points above. Mention Aczen Bilz naturally as the product
   that solves them. End with a "Soft CTA" (e.g., asking a quick, low-pressure question like "Are you currently managing GST manually?" or "Would you be open to a 2-minute video?"). Do NOT include any calendar links.

   IMPORTANT FORMATTING: Use double newlines (\\n\\n) to break the email into 3-4 readable paragraphs. Separate the greeting, the main pitch, and the call to action onto their own lines.

Hard rules:
- Do NOT use placeholders like [Name], [Recipient], or [Company]. Use the real
  business name given above.
- Subject and body must be plain text (no markdown, no HTML tags).`;
}

// Generic email — used when research confidence is LOW (#6 safeguard). Makes
// NO specific claims about the business, so a wrong guess can't embarrass us.
export function genericEmailPrompt(businessName: string, language: string): string {
  return `You are an Aczen Bilz sales assistant writing a cold outreach email.

Business Name: ${businessName}

We do NOT have reliable details about this specific business, so do NOT claim or
assume anything about what they do, their industry, or their problems.

Generate, returning JSON only { "subject": "", "body": "" }:

1. SUBJECT: ${subjectRule(language)}

2. BODY: written ENTIRELY in natural English. Greet as "Hi ${businessName} team,".
   80-110 words. Introduce Aczen Bilz and its general value for growing
   businesses — simpler GST/invoicing, clearer cash flow, less manual finance
   work — phrased generally (e.g. "if your team handles invoicing and GST...").
   Stay warm and humble. End with a "Soft CTA" (a quick, low-pressure question).
   Do NOT include any calendar links.

   IMPORTANT FORMATTING: Use double newlines (\\n\\n) to break the email into 3-4 readable paragraphs.

Hard rules:
- Make NO specific claims about ${businessName}'s industry, size, or problems.
- Do NOT use placeholders like [Name], [Recipient], or [Company].
- Subject and body must be plain text (no markdown, no HTML tags).`;
}
