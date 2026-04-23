import { CalendarClock, LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLATFORM_META, STATUS_STYLES, type SocialPost } from "@/lib/social";

interface SocialPostCardProps {
  post: SocialPost;
  onOpen: (post: SocialPost) => void;
}

export default function SocialPostCard({ post, onOpen }: SocialPostCardProps) {
  const status = STATUS_STYLES[post.status];
  const whenISO = post.scheduled_at ?? post.published_at;
  const when = whenISO ? new Date(whenISO) : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(post)}
      className="group flex w-full flex-col gap-2 rounded-xl border bg-card p-3 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", status.badge)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          {status.label}
        </span>
        {post.platforms.map((p) => {
          const meta = PLATFORM_META[p];
          const Icon = meta.icon;
          return (
            <span
              key={p}
              className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full", meta.tint)}
              title={meta.label}
            >
              <Icon className="h-3 w-3" />
            </span>
          );
        })}
        {post.campaign && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {post.campaign}
          </span>
        )}
      </div>

      {post.title && <p className="truncate text-sm font-semibold">{post.title}</p>}

      <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
        {post.content}
      </p>

      {post.media_urls.length > 0 && (
        <div className="flex gap-1 overflow-hidden">
          {post.media_urls.slice(0, 4).map((url, i) => (
            <div key={i} className="relative h-12 w-12 overflow-hidden rounded-md border bg-muted">
              {/\.(jpe?g|png|gif|webp|svg|avif)($|\?)/i.test(url) ? (
                <img src={url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[9px] text-muted-foreground">
                  media
                </span>
              )}
            </div>
          ))}
          {post.media_urls.length > 4 && (
            <div className="flex h-12 w-12 items-center justify-center rounded-md border bg-muted text-[10px] text-muted-foreground">
              +{post.media_urls.length - 4}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3 w-3" />
          {when ? when.toLocaleString() : "Unscheduled"}
        </span>
        {post.link_url && (
          <span className="inline-flex items-center gap-1 truncate">
            <LinkIcon className="h-3 w-3" />
            <span className="max-w-[160px] truncate">{post.link_url}</span>
          </span>
        )}
      </div>
    </button>
  );
}
