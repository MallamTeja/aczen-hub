import { useEffect, useState } from "react";
import { useUser } from "@/contexts/AuthContext";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock4,
  Plus,
  Sun,
  Stethoscope,
  Plane,
  Home,
  XCircle,
  CheckCheck,
  X,
} from "lucide-react";

import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/admin";
import { useToast } from "@/hooks/use-toast";
import { createNotification } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

interface LeaveRequest {
  id: string;
  clerk_user_id: string;
  leave_type: "casual" | "sick" | "vacation" | "wfh";
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewed_by: string | null;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const LEAVE_TYPES = [
  { value: "casual", label: "Casual", icon: Sun, className: "bg-warning/20 text-warning-foreground border-warning/40" },
  { value: "sick", label: "Sick", icon: Stethoscope, className: "bg-destructive/15 text-destructive border-destructive/30" },
  { value: "vacation", label: "Vacation", icon: Plane, className: "bg-info/15 text-info border-info/30" },
  { value: "wfh", label: "Work From Home", icon: Home, className: "bg-accent/15 text-accent border-accent/30" },
];

const STATUS_STYLE: Record<LeaveRequest["status"], string> = {
  pending: "bg-warning/15 text-warning-foreground border-warning/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

function leaveTypeStyle(t: string) {
  return LEAVE_TYPES.find((l) => l.value === t) || LEAVE_TYPES[0];
}

interface UserProfile { clerk_user_id: string; name: string }

export default function Leaves() {
  const { user } = useUser();
  const isAdmin = useIsAdmin(user);
  const { toast } = useToast();
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");
  const [form, setForm] = useState({
    leave_type: "casual" as LeaveRequest["leave_type"],
    start_date: today,
    end_date: today,
    reason: "",
  });

  useEffect(() => {
    if (user) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadAll() {
    setLoading(true);
    const [mineRes, allRes, profRes] = await Promise.all([
      (supabase as any).from("leave_requests").select("*").eq("clerk_user_id", user!.id).order("created_at", { ascending: false }),
      isAdmin ? (supabase as any).from("leave_requests").select("*").order("created_at", { ascending: false }).limit(200) : Promise.resolve({ data: [], error: null }),
      (supabase as any).from("user_profiles").select("clerk_user_id, name"),
    ]);
    if (!mineRes.error) setMyRequests((mineRes.data || []) as LeaveRequest[]);
    if (!allRes.error) setAllRequests((allRes.data || []) as LeaveRequest[]);
    if (!profRes.error) {
      const map: Record<string, string> = {};
      (profRes.data as UserProfile[] || []).forEach((p) => { map[p.clerk_user_id] = p.name; });
      setProfiles(map);
    }
    setLoading(false);
  }

  async function submit() {
    if (!form.reason.trim() || !user) {
      toast({ title: "Reason required", variant: "destructive" });
      return;
    }
    const days = Math.max(1, differenceInCalendarDays(parseISO(form.end_date), parseISO(form.start_date)) + 1);
    const { error } = await (supabase as any).from("leave_requests").insert({
      clerk_user_id: user.id,
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date: form.end_date,
      total_days: days,
      reason: form.reason.trim(),
    });
    if (error) {
      toast({ title: "Could not submit", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Leave request submitted", description: `${days} day(s) — pending approval.` });
    setOpen(false);
    setForm({ leave_type: "casual", start_date: today, end_date: today, reason: "" });
    loadAll();
  }

  async function review(req: LeaveRequest, status: "approved" | "rejected", note?: string) {
    const { error } = await (supabase as any)
      .from("leave_requests")
      .update({
        status,
        reviewed_by: user!.id,
        reviewer_note: note || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", req.id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    await createNotification({
      clerkUserId: req.clerk_user_id,
      title: `Leave ${status}`,
      message: `Your ${req.leave_type} leave on ${format(parseISO(req.start_date), "MMM d")} was ${status}.`,
      type: status === "approved" ? "success" : "warning",
      link: "/leaves",
    });
    toast({ title: `Leave ${status}` });
    loadAll();
  }

  // Aggregate balance display (last 365 days)
  const balanceByType = LEAVE_TYPES.map((t) => {
    const used = myRequests
      .filter((r) => r.leave_type === t.value && r.status === "approved")
      .reduce((sum, r) => sum + Number(r.total_days), 0);
    const allowed = t.value === "wfh" ? 24 : t.value === "vacation" ? 15 : t.value === "sick" ? 10 : 12;
    return { ...t, used, allowed, remaining: Math.max(0, allowed - used) };
  });

  const pendingForAdmin = allRequests.filter((r) => r.status === "pending");

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in-fade">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              <span className="text-gradient-warm">Leave Requests</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Request time off and track your leave balance.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-warm shadow-soft">
                <Plus className="h-4 w-4" />
                Request leave
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request leave</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Leave type</Label>
                  <Select value={form.leave_type} onValueChange={(v: LeaveRequest["leave_type"]) => setForm((f) => ({ ...f, leave_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEAVE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>From</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value, end_date: f.end_date < e.target.value ? e.target.value : f.end_date }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>To</Label>
                    <Input type="date" min={form.start_date} value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Reason</Label>
                  <Textarea rows={3} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Briefly describe the reason…" />
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                  Total days: <span className="font-semibold text-foreground">{Math.max(1, differenceInCalendarDays(parseISO(form.end_date), parseISO(form.start_date)) + 1)}</span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button className="gradient-warm" onClick={submit}>Submit request</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Balance cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {balanceByType.map((b, i) => (
            <Card key={b.value} className="overflow-hidden border-border/60 shadow-soft animate-in-up" style={{ animationDelay: `${i * 60}ms` }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg border", b.className)}>
                    <b.icon className="h-4 w-4" />
                  </div>
                  <Badge variant="outline" className="text-[10px]">{b.allowed} total</Badge>
                </div>
                <p className="mt-3 text-xs font-medium text-muted-foreground">{b.label}</p>
                <p className="mt-0.5 text-2xl font-bold leading-tight">
                  {b.remaining}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">days left</span>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full gradient-warm" style={{ width: `${Math.min(100, (b.used / b.allowed) * 100)}%` }} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="mine" className="w-full">
          <TabsList>
            <TabsTrigger value="mine">My Requests</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="gap-2">
                Pending approvals
                {pendingForAdmin.length > 0 && (
                  <Badge className="bg-gradient-warm h-4 min-w-[16px] px-1 text-[10px] text-primary-foreground">{pendingForAdmin.length}</Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="mine" className="mt-4">
            <Card className="border-border/60 shadow-soft">
              <CardHeader className="border-b bg-gradient-card pb-4">
                <CardTitle className="text-base">My leave history</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 text-sm text-muted-foreground">Loading…</div>
                ) : myRequests.length === 0 ? (
                  <EmptyState message="No leave requests yet. Click 'Request leave' to start." />
                ) : (
                  <ul className="divide-y divide-border">
                    {myRequests.map((r) => <LeaveRow key={r.id} req={r} profiles={profiles} />)}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin" className="mt-4">
              <Card className="border-border/60 shadow-soft">
                <CardHeader className="border-b bg-gradient-card pb-4">
                  <CardTitle className="text-base">Pending approvals</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {pendingForAdmin.length === 0 ? (
                    <EmptyState message="No pending leave requests. You're all caught up!" />
                  ) : (
                    <ul className="divide-y divide-border">
                      {pendingForAdmin.map((r) => (
                        <li key={r.id} className="p-4">
                          <LeaveRow req={r} profiles={profiles} />
                          <div className="mt-3 flex gap-2">
                            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => review(r, "approved")}>
                              <CheckCheck className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => review(r, "rejected")}>
                              <X className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="mt-4 border-border/60 shadow-soft">
                <CardHeader className="border-b bg-gradient-card pb-4">
                  <CardTitle className="text-base">All leave requests</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {allRequests.length === 0 ? (
                    <EmptyState message="No leave requests in the system yet." />
                  ) : (
                    <ul className="divide-y divide-border">
                      {allRequests.map((r) => <LeaveRow key={r.id} req={r} profiles={profiles} />)}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function LeaveRow({ req, profiles }: { req: LeaveRequest; profiles: Record<string, string> }) {
  const t = leaveTypeStyle(req.leave_type);
  const Icon = t.icon;
  return (
    <div className="flex items-start gap-3 p-4">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border", t.className)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{t.label} leave</p>
          <Badge variant="outline" className={cn("text-[10px] capitalize", STATUS_STYLE[req.status])}>{req.status}</Badge>
          <span className="text-xs text-muted-foreground">{Number(req.total_days)} day(s)</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {format(parseISO(req.start_date), "EEE, MMM d")}
          {req.start_date !== req.end_date && ` – ${format(parseISO(req.end_date), "EEE, MMM d")}`}
        </p>
        <p className="mt-1.5 text-xs text-foreground/80">{req.reason}</p>
        {profiles[req.clerk_user_id] && (
          <p className="mt-1 text-[11px] text-muted-foreground">Requested by <span className="font-medium text-foreground">{profiles[req.clerk_user_id]}</span></p>
        )}
        {req.reviewer_note && (
          <p className="mt-1 text-[11px] italic text-muted-foreground">Note: {req.reviewer_note}</p>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <CalendarIcon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
