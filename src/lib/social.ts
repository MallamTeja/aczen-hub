import {
  Facebook,
  Instagram,
  Linkedin,
  MessageCircle,
  Music2,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";

export const PLATFORMS = [
  "twitter",
  "linkedin",
  "instagram",
  "facebook",
  "youtube",
  "tiktok",
  "threads",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const POST_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "failed",
  "cancelled",
] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

export type SocialPost = {
  id: string;
  title: string | null;
  content: string;
  platforms: Platform[];
  media_urls: string[];
  link_url: string | null;
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  campaign: string | null;
  tags: string[];
  author_user_id: string;
  author_name: string | null;
  engagement: Record<string, number>;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialAccount = {
  id: string;
  platform: Platform;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  connected_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SocialPostInput = {
  title?: string | null;
  content: string;
  platforms: Platform[];
  media_urls?: string[];
  link_url?: string | null;
  status?: PostStatus;
  scheduled_at?: string | null;
  campaign?: string | null;
  tags?: string[];
  notes?: string | null;
};

export const PLATFORM_META: Record<
  Platform,
  { label: string; icon: LucideIcon; tint: string; charLimit: number }
> = {
  twitter:   { label: "X (Twitter)", icon: Twitter,       tint: "bg-sky-100 text-sky-700",       charLimit: 280 },
  linkedin:  { label: "LinkedIn",    icon: Linkedin,      tint: "bg-blue-100 text-blue-800",     charLimit: 3000 },
  instagram: { label: "Instagram",   icon: Instagram,     tint: "bg-pink-100 text-pink-700",     charLimit: 2200 },
  facebook:  { label: "Facebook",    icon: Facebook,      tint: "bg-indigo-100 text-indigo-700", charLimit: 63206 },
  youtube:   { label: "YouTube",     icon: Youtube,       tint: "bg-red-100 text-red-700",       charLimit: 5000 },
  tiktok:    { label: "TikTok",      icon: Music2,        tint: "bg-zinc-200 text-zinc-800",     charLimit: 2200 },
  threads:   { label: "Threads",     icon: MessageCircle, tint: "bg-stone-200 text-stone-800",   charLimit: 500 },
};

export const STATUS_STYLES: Record<
  PostStatus,
  { badge: string; dot: string; label: string }
> = {
  draft:     { badge: "bg-muted text-muted-foreground",   dot: "bg-muted-foreground/60", label: "Draft" },
  scheduled: { badge: "bg-amber-100 text-amber-800",      dot: "bg-amber-500",           label: "Scheduled" },
  published: { badge: "bg-emerald-100 text-emerald-800",  dot: "bg-emerald-500",         label: "Published" },
  failed:    { badge: "bg-rose-100 text-rose-700",        dot: "bg-rose-500",            label: "Failed" },
  cancelled: { badge: "bg-zinc-200 text-zinc-600",        dot: "bg-zinc-500",            label: "Cancelled" },
};

export function effectiveCharLimit(platforms: Platform[]): number {
  if (platforms.length === 0) return Infinity;
  return Math.min(...platforms.map((p) => PLATFORM_META[p].charLimit));
}

export function postDateKey(post: SocialPost): string | null {
  const iso = post.scheduled_at ?? post.published_at ?? null;
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
