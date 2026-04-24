import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CalendarClock,
  FileText,
  Search,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PLATFORMS,
  PLATFORM_META,
  POST_STATUSES,
  STATUS_STYLES,
  type Platform,
  type PostStatus,
  type SocialPost,
} from "@/lib/social";

interface AdminSocialViewProps {
  userNames: Record<string, string>;
}

export default function AdminSocialView({ userNames }: AdminSocialViewProps) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PostStatus | "all">("all");
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [authorFilter, setAuthorFilter] = useState<string>("all");

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("social_posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.warn("Social posts fetch warning:", error.message);
    setPosts((data as SocialPost[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const authorOptions = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => p.author_user_id && set.add(p.author_user_id));
    return Array.from(set).sort();
  }, [posts]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (platformFilter !== "all" && !p.platforms?.includes(platformFilter))
        return false;
      if (authorFilter !== "all" && p.author_user_id !== authorFilter) return false;
      if (!term) return true;
      return [p.title, p.content, p.campaign, (p.tags || []).join(" "), p.author_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [posts, search, statusFilter, platformFilter, authorFilter]);

  const stats = useMemo(() => {
    const scheduled = filtered.filter((p) => p.status === "scheduled").length;
    const drafts = filtered.filter((p) => p.status === "draft").length;
    const published = filtered.filter((p) => p.status === "published").length;
    const failed = filtered.filter((p) => p.status === "failed").length;
    const nextUp = filtered
      .filter(
        (p) =>
          p.status === "scheduled" &&
          p.scheduled_at &&
          new Date(p.scheduled_at) >= new Date(),
      )
      .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))[0];
    return { scheduled, drafts, published, failed, nextUp };
  }, [filtered]);

  const platformBreakdown = useMemo(() => {
    return PLATFORMS.map((platform) => {
      const count = filtered.filter((p) => p.platforms?.includes(platform)).length;
      return { platform, count };
    }).filter((p) => p.count > 0);
  }, [filtered]);

  const authorBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { name: string; total: number; published: number; scheduled: number; drafts: number }
    >();
    filtered.forEach((p) => {
      const key = p.author_user_id || "unknown";
      const display = userNames[key] || p.author_name || "Unknown";
      if (!map.has(key)) {
        map.set(key, { name: display, total: 0, published: 0, scheduled: 0, drafts: 0 });
      }
      const entry = map.get(key)!;
      entry.total++;
      if (p.status === "published") entry.published++;
      else if (p.status === "scheduled") entry.scheduled++;
      else if (p.status === "draft") entry.drafts++;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered, userNames]);

  const summaryCards = [
    { label: "Drafts", value: String(stats.drafts), icon: FileText, tint: "text-muted-foreground" },
    { label: "Scheduled", value: String(stats.scheduled), icon: CalendarClock, tint: "text-amber-600" },
    { label: "Published", value: String(stats.published), icon: Send, tint: "text-emerald-600" },
    {
      label: "Next up",
      value: stats.nextUp?.scheduled_at
        ? new Date(stats.nextUp.scheduled_at).toLocaleString()
        : "—",
      icon: Sparkles,
      tint: "text-violet-600",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {summaryCards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted/70 ${c.tint}`}
              >
                <c.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </p>
                <p className="truncate text-sm font-semibold">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Platform breakdown */}
      {platformBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Posts by platform</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
              {platformBreakdown.map(({ platform, count }) => {
                const meta = PLATFORM_META[platform];
                return (
                  <div key={platform} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded ${meta.tint}`}
                      >
                        <meta.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-xs font-medium">{meta.label}</span>
                    </div>
                    <p className="mt-2 text-xl font-semibold">{count}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Author breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Posts per author
          </CardTitle>
        </CardHeader>
        <CardContent>
          {authorBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No posts yet.</p>
          ) : (
            <div className="space-y-2">
              {authorBreakdown.map((a) => (
                <div
                  key={a.name}
                  className="flex items-center justify-between rounded-md border bg-card p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.total} posts · {a.published} published · {a.scheduled} scheduled · {a.drafts} drafts
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posts, authors, campaigns, tags…"
            className="h-9 pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PostStatus | "all")}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {POST_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={platformFilter} onValueChange={(v) => setPlatformFilter(v as Platform | "all")}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {PLATFORMS.map((p) => (
              <SelectItem key={p} value={p}>
                {PLATFORM_META[p].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={authorFilter} onValueChange={setAuthorFilter}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Author" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All authors</SelectItem>
            {authorOptions.map((a) => (
              <SelectItem key={a} value={a}>
                {userNames[a] || a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Posts table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All posts ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No posts match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Content</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Platforms</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 200).map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/50">
                      <TableCell className="max-w-[360px]">
                        {p.title && (
                          <p className="font-medium">{p.title}</p>
                        )}
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {p.content}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {userNames[p.author_user_id || ""] || p.author_name || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(p.platforms || []).map((pl) => {
                            const meta = PLATFORM_META[pl];
                            if (!meta) return null;
                            return (
                              <span
                                key={pl}
                                className={`inline-flex h-6 w-6 items-center justify-center rounded ${meta.tint}`}
                                title={meta.label}
                              >
                                <meta.icon className="h-3.5 w-3.5" />
                              </span>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLES[p.status]?.badge}>
                          {STATUS_STYLES[p.status]?.label ?? p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.scheduled_at
                          ? new Date(p.scheduled_at).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.campaign || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length > 200 && (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  Showing first 200 of {filtered.length} posts.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
