import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarClock,
  FileText,
  LayoutGrid,
  Plus,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import SocialComposer from "@/components/social/SocialComposer";
import SocialCalendar from "@/components/social/SocialCalendar";
import SocialPostList from "@/components/social/SocialPostList";
import {
  PLATFORMS,
  PLATFORM_META,
  POST_STATUSES,
  type Platform,
  type PostStatus,
  type SocialPost,
  type SocialPostInput,
} from "@/lib/social";

type ViewMode = "calendar" | "list";

export default function Social() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const actorUserId = user?.id || "anonymous";
  const actorName = profile?.name || user?.fullName || user?.primaryEmailAddress?.emailAddress || "Unknown";

  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("calendar");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PostStatus | "all">("all");
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");

  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<SocialPost | null>(null);
  const [initialDate, setInitialDate] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("social_posts")
      .select("*")
      .order("scheduled_at", { ascending: true, nullsFirst: false });
    if (error) {
      toast({ title: "Could not load posts", description: error.message, variant: "destructive" });
    }
    setPosts((data as SocialPost[]) ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (platformFilter !== "all" && !p.platforms.includes(platformFilter)) return false;
      if (!term) return true;
      return [p.title, p.content, p.campaign, p.tags.join(" ")]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [posts, search, statusFilter, platformFilter]);

  const stats = useMemo(() => {
    const scheduled = posts.filter((p) => p.status === "scheduled").length;
    const drafts = posts.filter((p) => p.status === "draft").length;
    const published = posts.filter((p) => p.status === "published").length;
    const nextUp = posts
      .filter((p) => p.status === "scheduled" && p.scheduled_at && new Date(p.scheduled_at) >= new Date())
      .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))[0];
    return { scheduled, drafts, published, nextUp };
  }, [posts]);

  async function savePost(input: SocialPostInput, id?: string) {
    if (id) {
      const { error } = await (supabase as any)
        .from("social_posts")
        .update({
          title: input.title ?? null,
          content: input.content,
          platforms: input.platforms,
          media_urls: input.media_urls ?? [],
          link_url: input.link_url ?? null,
          status: input.status ?? "draft",
          scheduled_at: input.scheduled_at ?? null,
          published_at: input.status === "published" ? new Date().toISOString() : null,
          campaign: input.campaign ?? null,
          tags: input.tags ?? [],
          notes: input.notes ?? null,
        })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Post updated" });
    } else {
      const { error } = await (supabase as any).from("social_posts").insert({
        title: input.title ?? null,
        content: input.content,
        platforms: input.platforms,
        media_urls: input.media_urls ?? [],
        link_url: input.link_url ?? null,
        status: input.status ?? "draft",
        scheduled_at: input.scheduled_at ?? null,
        published_at: input.status === "published" ? new Date().toISOString() : null,
        campaign: input.campaign ?? null,
        tags: input.tags ?? [],
        notes: input.notes ?? null,
        author_user_id: actorUserId,
        author_name: actorName,
      });
      if (error) throw error;
      toast({ title: "Post saved" });
    }
    fetchPosts();
  }

  async function deletePost(post: SocialPost) {
    const { error } = await (supabase as any).from("social_posts").delete().eq("id", post.id);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Post deleted" });
    fetchPosts();
  }

  async function markPublished(post: SocialPost) {
    const { error } = await (supabase as any)
      .from("social_posts")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", post.id);
    if (error) {
      toast({ title: "Could not update", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Marked as published" });
    fetchPosts();
  }

  function openNew(dateKey?: string | null) {
    setEditing(null);
    setInitialDate(dateKey ?? null);
    setComposerOpen(true);
  }

  function openEdit(post: SocialPost) {
    setEditing(post);
    setInitialDate(null);
    setComposerOpen(true);
  }

  const cards = [
    { label: "Drafts",    value: String(stats.drafts),    icon: FileText,      tint: "text-muted-foreground" },
    { label: "Scheduled", value: String(stats.scheduled), icon: CalendarClock, tint: "text-amber-600" },
    { label: "Published", value: String(stats.published), icon: Send,          tint: "text-emerald-600" },
    {
      label: "Next up",
      value: stats.nextUp?.scheduled_at ? new Date(stats.nextUp.scheduled_at).toLocaleString() : "—",
      icon: Sparkles,
      tint: "text-violet-600",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Social Media</h1>
            <p className="text-sm text-muted-foreground">Plan, schedule, and track posts across platforms.</p>
          </div>
          <Button size="sm" onClick={() => openNew()}>
            <Plus className="mr-1.5 h-4 w-4" />
            New post
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted/70 ${c.tint}`}>
                  <c.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
                  <p className="truncate text-sm font-semibold">{c.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search posts, campaigns, tags…"
                className="h-9 pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PostStatus | "all")}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {POST_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={platformFilter} onValueChange={(v) => setPlatformFilter(v as Platform | "all")}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Platform" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All platforms</SelectItem>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>{PLATFORM_META[p].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList className="h-9">
              <TabsTrigger value="calendar" className="gap-1.5 text-xs">
                <CalendarClock className="h-3.5 w-3.5" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5 text-xs">
                <LayoutGrid className="h-3.5 w-3.5" />
                Posts
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
            Loading posts…
          </div>
        ) : view === "calendar" ? (
          <SocialCalendar posts={filtered} onOpenPost={openEdit} onAddOnDate={openNew} />
        ) : (
          <SocialPostList posts={filtered} onOpenPost={openEdit} />
        )}

        {editing && (
          <div className="rounded-xl border bg-card p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Quick actions for selected post:</span>
              <Button size="sm" variant="outline" onClick={() => markPublished(editing)}>Mark published</Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  if (confirm("Delete this post?")) {
                    await deletePost(editing);
                    setEditing(null);
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>

      <SocialComposer
        open={composerOpen}
        onOpenChange={(o) => {
          setComposerOpen(o);
          if (!o) setEditing(null);
        }}
        post={editing}
        initialDate={initialDate}
        onSave={savePost}
      />
    </DashboardLayout>
  );
}
