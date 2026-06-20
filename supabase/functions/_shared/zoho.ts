// Zoho Mail client (India DC). Send is ported from
// automations/email_automation_agents/zoho-mail.js; inbox-read is new and used
// by reply monitoring. All secrets come from env (ZOHO_* — same names as .env).
const ACCOUNTS_BASE = "https://accounts.zoho.in";
const MAIL_BASE = "https://mail.zoho.in";
const FROM_ADDRESS = "team@aczen.in";

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} missing in Edge env`);
  return v;
}

export async function getAccessToken(): Promise<string> {
  const url =
    `${ACCOUNTS_BASE}/oauth/v2/token?grant_type=refresh_token` +
    `&client_id=${env("ZOHO_CLIENT_ID")}` +
    `&client_secret=${env("ZOHO_CLIENT_SECRET")}` +
    `&refresh_token=${env("ZOHO_REFRESH_TOKEN")}`;
  const res = await fetch(url, { method: "POST" });
  const data = await res.json();
  if (data.error) throw new Error(`Zoho token refresh failed: ${data.error}`);
  return data.access_token;
}

export interface SendResult {
  ok: boolean;
  messageId: string | null;
  threadId: string | null;
  raw: unknown;
}

export async function sendEmail(
  accessToken: string,
  { to, subject, content }: { to: string; subject: string; content: string },
): Promise<SendResult> {
  const url = `${MAIL_BASE}/api/accounts/${env("ZOHO_ACCOUNT_ID")}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fromAddress: FROM_ADDRESS,
      toAddress: to,
      subject,
      content,
    }),
  });
  const raw = await res.json();
  const ok = raw?.status?.code === 200 || !!raw?.data?.messageId;
  return {
    ok,
    messageId: raw?.data?.messageId ?? null,
    threadId: raw?.data?.threadId ?? null,
    raw,
  };
}

// ---- Inbox read (reply monitoring) ----------------------------------------

export interface InboxMessage {
  messageId: string;
  threadId: string | null;
  fromAddress: string;
  subject: string;
  receivedTime: number; // epoch ms
  summary: string;
  folderId: string;
}

interface ZohoScopeError extends Error {
  scopeIssue?: boolean;
}

/** Returns the Inbox folderId, or throws a scopeIssue error if read scope is missing. */
export async function getInboxFolderId(accessToken: string): Promise<string> {
  const url = `${MAIL_BASE}/api/accounts/${env("ZOHO_ACCOUNT_ID")}/folders`;
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  if (res.status === 401 || res.status === 403) {
    const err: ZohoScopeError = new Error("Zoho inbox-read scope missing (re-auth with ZohoMail.messages.READ)");
    err.scopeIssue = true;
    throw err;
  }
  const data = await res.json();
  const folders: Array<{ folderId: string; folderName?: string; path?: string }> = data?.data ?? [];
  const inbox = folders.find(
    (f) => (f.folderName ?? "").toLowerCase() === "inbox" || (f.path ?? "").toLowerCase() === "/inbox",
  );
  if (!inbox) throw new Error("Inbox folder not found in Zoho account");
  return inbox.folderId;
}

/** Lists recent inbox message summaries (newest first). */
export async function listInboxMessages(
  accessToken: string,
  folderId: string,
  limit = 50,
): Promise<InboxMessage[]> {
  const url =
    `${MAIL_BASE}/api/accounts/${env("ZOHO_ACCOUNT_ID")}/messages/view` +
    `?folderId=${folderId}&limit=${limit}&sortBy=date&sortorder=false`;
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  if (res.status === 401 || res.status === 403) {
    const err: ZohoScopeError = new Error("Zoho inbox-read scope missing (re-auth with ZohoMail.messages.READ)");
    err.scopeIssue = true;
    throw err;
  }
  const data = await res.json();
  // deno-lint-ignore no-explicit-any
  const rows: any[] = data?.data ?? [];
  return rows.map((m) => ({
    messageId: String(m.messageId),
    threadId: m.threadId ? String(m.threadId) : null,
    fromAddress: String(m.fromAddress ?? m.sender ?? "").toLowerCase(),
    subject: String(m.subject ?? ""),
    receivedTime: Number(m.receivedTime ?? m.sentDateInGMT ?? 0),
    summary: String(m.summary ?? ""),
    folderId,
  }));
}

/** Fetches the plain-text content of a single message (best-effort). */
export async function getMessageContent(
  accessToken: string,
  folderId: string,
  messageId: string,
): Promise<string> {
  const url =
    `${MAIL_BASE}/api/accounts/${env("ZOHO_ACCOUNT_ID")}/folders/${folderId}/messages/${messageId}/content`;
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  if (!res.ok) return "";
  const data = await res.json();
  return String(data?.data?.content ?? "");
}
