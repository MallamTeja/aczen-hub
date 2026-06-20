import { useEffect, useState, useCallback } from "react";
import { useUser } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface AppNotification {
  id: string;
  clerk_user_id: string;
  title: string;
  message: string;
  type: "info" | "task" | "leave" | "event" | "mention" | "success" | "warning";
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from("notifications")
      .select("*")
      .eq("clerk_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) setNotifications((data || []) as AppNotification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!user) return;
    const channel = (supabase as any)
      .channel(`notifications:${user.id}-${Math.random()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `clerk_user_id=eq.${user.id}`,
        },
        () => fetchAll(),
      )
      .subscribe();
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [user, fetchAll]);

  const markAsRead = async (id: string) => {
    await (supabase as any).from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllRead = async () => {
    if (!user) return;
    await (supabase as any)
      .from("notifications")
      .update({ is_read: true })
      .eq("clerk_user_id", user.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return { notifications, loading, unreadCount, markAsRead, markAllRead, refetch: fetchAll };
}

export async function createNotification(args: {
  clerkUserId: string;
  title: string;
  message: string;
  type?: AppNotification["type"];
  link?: string;
}) {
  await (supabase as any).from("notifications").insert({
    clerk_user_id: args.clerkUserId,
    title: args.title,
    message: args.message,
    type: args.type || "info",
    link: args.link || null,
  });
}
