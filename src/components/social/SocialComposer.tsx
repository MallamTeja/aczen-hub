import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import {
  PLATFORMS,
  PLATFORM_META,
  POST_STATUSES,
  effectiveCharLimit,
  fromLocalInput,
  toLocalInput,
  type Platform,
  type PostStatus,
  type SocialPost,
  type SocialPostInput,
} from "@/lib/social";

interface SocialComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post?: SocialPost | null;
  initialDate?: string | null;
  onSave: (input: SocialPostInput, id?: string) => Promise<void>;
}

const EMPTY: SocialPostInput = {
  title: "",
  content: "",
  platforms: [],
  media_urls: [],
  link_url: "",
  status: "draft",
  scheduled_at: null,
  campaign: "",
  tags: [],
  notes: "",
};

export default function SocialComposer({ open, onOpenChange, post, initialDate, onSave }: SocialComposerProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<SocialPostInput>(EMPTY);
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [newMedia, setNewMedia] = useState("");
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (post) {
      setForm({
        title: post.title ?? "",
        content: post.content,
        platforms: post.platforms,
        media_urls: post.media_urls,
        link_url: post.link_url ?? "",
        status: post.status,
        scheduled_at: post.scheduled_at,
        campaign: post.campaign ?? "",
        tags: post.tags,
        notes: post.notes ?? "",
      });
      setScheduledLocal(toLocalInput(post.scheduled_at));
    } else {
      const presetISO = initialDate ? new Date(`${initialDate}T09:00`).toISOString() : null;
      setForm({ ...EMPTY, scheduled_at: presetISO });
      setScheduledLocal(toLocalInput(presetISO));
    }
    setNewMedia("");
    setNewTag("");
  }, [open, post, initialDate]);

  const charLimit = useMemo(() => effectiveCharLimit(form.platforms), [form.platforms]);
  const overLimit = form.content.length > charLimit;

  function togglePlatform(p: Platform) {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p],
    }));
  }

  function addMedia() {
    const v = newMedia.trim();
    if (!v) return;
    setForm((f) => ({ ...f, media_urls: [...(f.media_urls ?? []), v] }));
    setNewMedia("");
  }

  function removeMedia(idx: number) {
    setForm((f) => ({ ...f, media_urls: (f.media_urls ?? []).filter((_, i) => i !== idx) }));
  }

  function addTag() {
    const v = newTag.trim().replace(/^#/, "");
    if (!v) return;
    setForm((f) => ({ ...f, tags: Array.from(new Set([...(f.tags ?? []), v])) }));
    setNewTag("");
  }

  function removeTag(t: string) {
    setForm((f) => ({ ...f, tags: (f.tags ?? []).filter((x) => x !== t) }));
  }

  async function handleSubmit(statusOverride?: PostStatus) {
    if (!form.content.trim()) {
      toast({ title: "Content is required", variant: "destructive" });
      return;
    }
    if (form.platforms.length === 0) {
      toast({ title: "Pick at least one platform", variant: "destructive" });
      return;
    }
    const nextStatus = statusOverride ?? form.status ?? "draft";
    if (nextStatus === "scheduled" && !scheduledLocal) {
      toast({ title: "Scheduled posts need a date/time", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await onSave(
        {
          ...form,
          title: form.title?.trim() || null,
          content: form.content.trim(),
          status: nextStatus,
          scheduled_at: scheduledLocal ? fromLocalInput(scheduledLocal) : null,
          link_url: form.link_url?.trim() || null,
          campaign: form.campaign?.trim() || null,
          notes: form.notes?.trim() || null,
          media_urls: form.media_urls ?? [],
          tags: form.tags ?? [],
        },
        post?.id,
      );
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Could not save post",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{post ? "Edit post" : "New post"}</DialogTitle>
          <DialogDescription>
            Plan content across platforms, schedule delivery and track status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">Platforms *</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const meta = PLATFORM_META[p];
                const Icon = meta.icon;
                const active = form.platforms.includes(p);
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      active ? `${meta.tint} border-transparent` : "bg-background hover:bg-muted",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="post-title">Title (internal)</Label>
            <Input
              id="post-title"
              value={form.title ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Optional — helps you find this post later"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="post-content">Content *</Label>
              <span className={cn("text-[11px]", overLimit ? "text-destructive" : "text-muted-foreground")}>
                {form.content.length}{Number.isFinite(charLimit) ? ` / ${charLimit}` : ""}
              </span>
            </div>
            <Textarea
              id="post-content"
              rows={6}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="What do you want to share?"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="post-schedule">Scheduled at</Label>
              <Input
                id="post-schedule"
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status ?? "draft"}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as PostStatus }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POST_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="post-link">Link URL</Label>
              <Input
                id="post-link"
                value={form.link_url ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <div>
              <Label htmlFor="post-campaign">Campaign</Label>
              <Input
                id="post-campaign"
                value={form.campaign ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, campaign: e.target.value }))}
                placeholder="e.g., Spring launch"
              />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">Media URLs</Label>
            <div className="flex gap-2">
              <Input
                value={newMedia}
                onChange={(e) => setNewMedia(e.target.value)}
                placeholder="Paste image/video URL and press Add"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addMedia();
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" onClick={addMedia}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {(form.media_urls ?? []).length > 0 && (
              <ul className="mt-2 space-y-1">
                {(form.media_urls ?? []).map((m, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1 text-xs">
                    <span className="min-w-0 flex-1 truncate" title={m}>{m}</span>
                    <button type="button" onClick={() => removeMedia(i)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">Tags</Label>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" onClick={addTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {(form.tags ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {(form.tags ?? []).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
                    #{t}
                    <button type="button" onClick={() => removeTag(t)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="post-notes">Internal notes</Label>
            <Textarea
              id="post-notes"
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button variant="outline" onClick={() => handleSubmit("draft")} disabled={saving}>
            Save draft
          </Button>
          <Button onClick={() => handleSubmit("scheduled")} disabled={saving}>
            {saving ? "Saving…" : post ? "Save" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
