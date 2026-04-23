import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLATFORM_META, STATUS_STYLES, postDateKey, type SocialPost } from "@/lib/social";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthDays(monthStart: Date): Date[] {
  const firstDay = new Date(monthStart);
  const jsDay = firstDay.getDay(); // 0 = Sun
  const offset = (jsDay + 6) % 7; // shift so Monday is 0
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - offset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

interface SocialCalendarProps {
  posts: SocialPost[];
  onOpenPost: (post: SocialPost) => void;
  onAddOnDate: (dateKey: string) => void;
}

export default function SocialCalendar({ posts, onOpenPost, onAddOnDate }: SocialCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => startOfMonth(today));

  const days = useMemo(() => monthDays(cursor), [cursor]);

  const byDate = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    posts.forEach((p) => {
      const key = postDateKey(p);
      if (!key) return;
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    });
    for (const [, list] of map) {
      list.sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
    }
    return map;
  }, [posts]);

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const todayKey = today.toISOString().slice(0, 10);

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b text-[10px] uppercase tracking-wide text-muted-foreground">
        {DAY_LABELS.map((d) => (
          <div key={d} className="px-2 py-1 text-center">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const key = d.toISOString().slice(0, 10);
          const inMonth = d.getMonth() === cursor.getMonth();
          const list = byDate.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div
              key={i}
              className={cn(
                "group min-h-[120px] border-b border-r p-1.5 last:border-r-0",
                !inMonth && "bg-muted/30 text-muted-foreground/60",
                isToday && "bg-primary/5",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={cn("text-[11px] font-medium", isToday && "text-primary")}>
                  {d.getDate()}
                </span>
                <button
                  type="button"
                  onClick={() => onAddOnDate(key)}
                  className="rounded-md p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100"
                  aria-label="Add post"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              <div className="space-y-1">
                {list.slice(0, 3).map((p) => {
                  const status = STATUS_STYLES[p.status];
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => onOpenPost(p)}
                      className={cn(
                        "flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-[10px] leading-tight",
                        status.badge,
                      )}
                      title={p.content}
                    >
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status.dot)} />
                      <span className="flex -space-x-1">
                        {p.platforms.slice(0, 3).map((pl) => {
                          const Icon = PLATFORM_META[pl].icon;
                          return (
                            <span key={pl} className="flex h-3 w-3 items-center justify-center">
                              <Icon className="h-2.5 w-2.5" />
                            </span>
                          );
                        })}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {p.title || p.content}
                      </span>
                    </button>
                  );
                })}
                {list.length > 3 && (
                  <p className="px-1 text-[10px] text-muted-foreground">
                    +{list.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
