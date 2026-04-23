import { useAuth } from "@/contexts/AuthContext";

// Kept for callers that still pass the user argument; the arg is ignored —
// admin status is sourced from user_profiles.role in the database.
export function useIsAdmin(_user?: unknown) {
  const { isAdmin } = useAuth();
  return isAdmin;
}
