import { useState, useEffect, useMemo } from "react";
import { useUser } from "@clerk/clerk-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isWithinInterval } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, MapPin, Calendar as CalendarIcon, Trash2, Users } from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/admin";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CompanyEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string;
  location: string | null;
  color: string;
  created_by: string;
}

const EVENT_TYPES = [
  { value: "event", label: "Event", className: "bg-primary/15 text-primary border-primary/30" },
  { value: "holiday", label: "Holiday", className: "bg-warning/20 text-warning-foreground border-warning/40" },
  { value: "meeting", label: "Meeting", className: "bg-accent/15 text-accent border-accent/30" },
  { value: "announcement", label: "Announcement", className: "bg-info/15 text-info border-info/30" },
];

function typeStyle(t: string) {
  return EVENT_TYPES.find((e) => e.value === t) || EVENT_TYPES[0];
}

export default function CompanyCalendar() {
  const { user } = useUser();
  const isAdmin = useIsAdmin(user);
  const { toast } = useToast();
  const [events, setEvents] = useState<CompanyEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    title: "",
    description: "",
    event_type: "event",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: format(new Date(), "yyyy-MM-dd"),
    location: "",
  });

  useEffect(() => {
    fetchEvents();
  }, [currentMonth]);

  async function fetchEvents() {
    setLoading(true);
    const start = format(startOfMonth(subMonths(currentMonth, 1)), "yyyy-MM-dd");
    const end = format(endOfMonth(addMonths(currentMonth, 1)), "yyyy-MM-dd");
    const { data, error } = await (supabase as any)
      .from("company_events")
      .select("*")
      .lte("start_date", end)
      .gte("end_date", start)
      .order("start_date", { ascending: true });
    if (!error) setEvents((data || []) as CompanyEvent[]);
    setLoading(false);
  }

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 0 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
    });
  }, [currentMonth]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CompanyEvent[]>();
    days.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      const dayEvents = events.filter((e) =>
        isWithinInterval(d, { start: parseISO(e.start_date), end: parseISO(e.end_date) }),
      );
      map.set(key, dayEvents);
    });
    return map;
  }, [days, events]);

  const selectedDayEvents = eventsByDay.get(format(selectedDate, "yyyy-MM-dd")) || [];

  async function createEvent() {
    if (!form.title || !user) return;
    const { error } = await (supabase as any).from("company_events").insert({
      title: form.title,
      description: form.description || null,
      event_type: form.event_type,
      start_date: form.start_date,
      end_date: form.end_date,
      location: form.location || null,
      color: "primary",
      created_by: user.id,
    });
    if (error) {
      toast({ title: "Could not create event", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Event created", description: form.title });
    setOpen(false);
    setForm({ title: "", description: "", event_type: "event", start_date: format(new Date(), "yyyy-MM-dd"), end_date: format(new Date(), "yyyy-MM-dd"), location: "" });
    fetchEvents();
  }

  async function deleteEvent(id: string) {
    const { error } = await (supabase as any).from("company_events").delete().eq("id", id);
    if (!error) {
      toast({ title: "Event deleted" });
      fetchEvents();
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in-fade">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              <span className="text-gradient-warm">Company Calendar</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Holidays, events and team announcements at a glance.
            </p>
          </div>
          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-warm shadow-soft">
                  <Plus className="h-4 w-4" />
                  New event
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create company event</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Title</Label>
                    <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Company offsite" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select value={form.event_type} onValueChange={(v) => setForm((f) => ({ ...f, event_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>Start date</Label>
                      <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
                    </div>
                    <div className="grid gap-2">
                      <Label>End date</Label>
                      <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Location (optional)</Label>
                    <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Bangalore office / Online" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Description (optional)</Label>
                    <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button className="gradient-warm" onClick={createEvent}>Create event</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card className="overflow-hidden border-border/60 shadow-soft">
            <CardHeader className="flex-row items-center justify-between space-y-0 border-b bg-gradient-card pb-4">
              <CardTitle className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }}>
                  Today
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDay.get(key) || [];
                  const inMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = isSameDay(day, selectedDate);
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "group relative min-h-[78px] rounded-lg border border-transparent p-1.5 text-left transition-all hover:border-border hover:bg-muted/40",
                        !inMonth && "opacity-40",
                        isSelected && "border-primary/50 bg-primary/5 shadow-soft",
                        isToday && !isSelected && "bg-accent/5",
                      )}
                    >
                      <div className={cn(
                        "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                        isToday && "bg-gradient-warm text-primary-foreground shadow-glow",
                        !isToday && isSelected && "text-primary",
                      )}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((e) => {
                          const s = typeStyle(e.event_type);
                          return (
                            <div key={e.id} className={cn("truncate rounded px-1.5 py-0.5 text-[10px] font-medium border", s.className)}>
                              {e.title}
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 2} more</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardHeader className="border-b bg-gradient-card pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarIcon className="h-4 w-4 text-primary" />
                {format(selectedDate, "EEE, MMM d")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{selectedDayEvents.length} {selectedDayEvents.length === 1 ? "event" : "events"}</p>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[460px]">
                {loading ? (
                  <div className="p-4 text-sm text-muted-foreground">Loading…</div>
                ) : selectedDayEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                      <CalendarIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No events scheduled</p>
                    <p className="mt-1 text-xs text-muted-foreground">Pick a different date or create a new event.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {selectedDayEvents.map((e) => {
                      const s = typeStyle(e.event_type);
                      return (
                        <li key={e.id} className="group p-4 transition-colors hover:bg-muted/40">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <Badge variant="outline" className={cn("mb-1.5 text-[10px]", s.className)}>{s.label}</Badge>
                              <p className="text-sm font-semibold leading-tight">{e.title}</p>
                              {e.description && <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>}
                              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <CalendarIcon className="h-3 w-3" />
                                  {format(parseISO(e.start_date), "MMM d")}{e.start_date !== e.end_date && ` – ${format(parseISO(e.end_date), "MMM d")}`}
                                </span>
                                {e.location && (
                                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</span>
                                )}
                              </div>
                            </div>
                            {isAdmin && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteEvent(e.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {!isAdmin && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <Users className="h-4 w-4" />
            Only admins can create or edit company events. Contact your admin to add a new event.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
