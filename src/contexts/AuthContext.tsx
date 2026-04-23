import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Position =
  | "CEO"
  | "CFO"
  | "CPO"
  | "Marketing Manager"
  | "Social Media"
  | "Developer";

export type BloodGroup =
  | "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

export type Profile = {
  id: string;
  auth_user_id: string;
  clerk_user_id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  position: Position | null;
  blood_group: BloodGroup | null;
};

// Clerk-compatible user shape so existing call sites keep working.
export type ClerkLikeUser = {
  id: string;
  fullName: string | null;
  firstName: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
  emailAddresses: Array<{ emailAddress: string }>;
};

type AuthContextValue = {
  session: Session | null;
  supabaseUser: SupabaseUser | null;
  user: ClerkLikeUser | null;
  profile: Profile | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toClerkLike(u: SupabaseUser | null, profile: Profile | null): ClerkLikeUser | null {
  if (!u) return null;
  const email = profile?.email || u.email || "";
  const fullName = profile?.name || (u.user_metadata?.name as string | undefined) || null;
  const firstName = fullName ? fullName.split(" ")[0] : null;
  return {
    id: u.id,
    fullName,
    firstName,
    primaryEmailAddress: email ? { emailAddress: email } : null,
    emailAddresses: email ? [{ emailAddress: email }] : [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadProfile = async (authUserId: string) => {
    const { data } = await (supabase as any)
      .from("user_profiles")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    setProfile((data as Profile) || null);
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setSupabaseUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => mounted && setIsLoaded(true));
      } else {
        setIsLoaded(true);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setSupabaseUser(newSession?.user ?? null);
      if (newSession?.user) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    session,
    supabaseUser,
    user: toClerkLike(supabaseUser, profile),
    profile,
    isLoaded,
    isSignedIn: !!supabaseUser,
    isAdmin: profile?.role === "admin",
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refreshProfile: async () => {
      if (supabaseUser) await loadProfile(supabaseUser.id);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// Drop-in replacement for Clerk's useUser().
export function useUser() {
  const { user, isLoaded, isSignedIn } = useAuth();
  return { user, isLoaded, isSignedIn };
}
