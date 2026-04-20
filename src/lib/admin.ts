// Simple admin check based on Clerk email allowlist (no auth.users table needed).
// Edit the env var or add emails here. Admins can manage company events and approve leaves.
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "")
  .toString()
  .split(",")
  .map((s: string) => s.trim().toLowerCase())
  .filter(Boolean);

// Fallback hardcoded admins (replace with your team's emails).
const FALLBACK_ADMINS = ["admin@aczen.com"];

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  if (ADMIN_EMAILS.includes(e)) return true;
  if (FALLBACK_ADMINS.includes(e)) return true;
  return false;
}

export function useIsAdmin(user: { primaryEmailAddress?: { emailAddress?: string } | null; emailAddresses?: Array<{ emailAddress: string }> } | null | undefined) {
  const email =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress;
  return isAdminEmail(email);
}
