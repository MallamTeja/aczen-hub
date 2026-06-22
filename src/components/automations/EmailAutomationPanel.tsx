import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Search, Trash2, Eye, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AUTOMATION_LANGUAGES,
  AUTOMATION_STATUSES,
  STATUS_META,
  isValidEmail,
  type AutomationLanguage,
  type AutomationStatus,
  type EmailAutomationLead,
} from "@/lib/emailAutomation";

const TABLE = "email_automation_leads";

function StatusBadge({ status }: { status: AutomationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export default function EmailAutomationPanel() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const actorUserId = user?.id || "anonymous";

  const [leads, setLeads] = useState<EmailAutomationLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [language, setLanguage] = useState<AutomationLanguage>("English");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AutomationStatus | "all">("all");
  const [detail, setDetail] = useState<EmailAutomationLead | null>(null);

  // Duplicate-email confirm (#9). Email is the dedup key; names may repeat.
  const [dupPrompt, setDupPrompt] = useState<{
    name: string;
    email: string;
    language: AutomationLanguage;
    matches: EmailAutomationLead[];
  } | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({
        title: "Could not load automation leads",
        description: error.message.includes(TABLE)
          ? "Run the email_automation_leads migration on Supabase first."
          : error.message,
        variant: "destructive",
      });
    }
    setLeads((data as EmailAutomationLead[]) ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Live status updates as the cron worker progresses leads through the pipeline.
  useEffect(() => {
    const channel = (supabase as any)
      .channel("email_automation_leads_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE },
        () => fetchLeads(),
      )
      .subscribe();
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [fetchLeads]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    for (const s of AUTOMATION_STATUSES) counts[s] = 0;
    for (const l of leads) counts[l.status] = (counts[l.status] ?? 0) + 1;
    return counts;
  }, [leads]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!term) return true;
      return (
        l.business_name.toLowerCase().includes(term) ||
        l.business_email.toLowerCase().includes(term) ||
        (l.industry ?? "").toLowerCase().includes(term)
      );
    });
  }, [leads, search, statusFilter]);

  function addLead() {
    const name = businessName.trim();
    const email = businessEmail.trim();
    if (!name) {
      toast({ title: "Business name is required", variant: "destructive" });
      return;
    }
    if (!isValidEmail(email)) {
      toast({ title: "Enter a valid business email", variant: "destructive" });
      return;
    }

    // Dedup on email only (names may legitimately repeat). If this email is
    // already in the list, confirm before adding a duplicate.
    const matches = leads.filter(
      (l) => l.business_email.toLowerCase() === email.toLowerCase(),
    );
    if (matches.length > 0) {
      setDupPrompt({ name, email, language, matches });
      return;
    }

    insertLead(name, email, language);
  }

  async function insertLead(name: string, email: string, lang: AutomationLanguage) {
    setSaving(true);
    const { error } = await (supabase as any).from(TABLE).insert({
      business_name: name,
      business_email: email,
      language: lang,
      status: "NOT_SENT",
      created_by: actorUserId,
    });
    setSaving(false);

    if (error) {
      toast({ title: "Could not add lead", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Lead added", description: `${name} queued for outreach.` });
    setBusinessName("");
    setBusinessEmail("");
    setLanguage("English");
    fetchLeads();
  }

  async function deleteLead(lead: EmailAutomationLead) {
    const { error } = await (supabase as any).from(TABLE).delete().eq("id", lead.id);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Lead removed" });
    if (detail?.id === lead.id) setDetail(null);
    fetchLeads();
  }

  const creatorLabel = profile?.name || user?.fullName || "you";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Entry form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" />
            Add a business lead
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_180px_auto] lg:items-end">
            <div>
              <Label htmlFor="biz-name">Business name</Label>
              <Input
                id="biz-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Sri Sai Constructions"
              />
            </div>
            <div>
              <Label htmlFor="biz-email">Business email</Label>
              <Input
                id="biz-email"
                type="email"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                placeholder="contact@ssconstructions.com"
              />
            </div>
            <div>
              <Label>Language</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as AutomationLanguage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTOMATION_LANGUAGES.map((lng) => (
                    <SelectItem key={lng} value={lng}>
                      {lng}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addLead} disabled={saving} className="w-full lg:w-auto">
              <Plus className="mr-1.5 h-4 w-4" />
              {saving ? "Adding…" : "Add lead"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setStatusFilter("all")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            statusFilter === "all" ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted/50"
          }`}
        >
          All · {statusCounts.all}
        </button>
        {AUTOMATION_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted/50"
            }`}
          >
            {STATUS_META[s].label} · {statusCounts[s] ?? 0}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business, email, industry…"
            className="h-9 pl-8"
          />
        </div>
        <Button variant="outline" size="sm" onClick={fetchLeads}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading leads…</CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No leads yet. Add a business above to start outreach.
            </CardContent>
          </Card>
        ) : (
          filtered.map((lead) => (
            <Card key={lead.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{lead.business_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{lead.business_email}</p>
                  </div>
                  <StatusBadge status={lead.status} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p>
                    <span className="text-muted-foreground">Language:</span> {lead.language}
                  </p>
                  <p className="truncate">
                    <span className="text-muted-foreground">Industry:</span> {lead.industry ?? "—"}
                  </p>
                  <p className="col-span-2">
                    <span className="text-muted-foreground">Added:</span>{" "}
                    {new Date(lead.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex justify-end gap-1 border-t pt-2">
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => setDetail(lead)}>
                    <Eye className="mr-1.5 h-4 w-4" />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive hover:text-destructive"
                    onClick={() => deleteLead(lead)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Loading leads…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No leads yet. Add a business above to start outreach.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.business_name}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.business_email}</TableCell>
                      <TableCell>{lead.language}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.industry ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={lead.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(lead.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetail(lead)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deleteLead(lead)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Added by {creatorLabel}. Research, email generation, sending and reply detection are handled automatically by the
        scheduled campaigns.
      </p>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.business_name}
                  <StatusBadge status={detail.status} />
                </DialogTitle>
                <DialogDescription>{detail.business_email} · {detail.language}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                {detail.failure_reason && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-destructive">
                    <p className="font-medium">Last failure</p>
                    <p className="text-xs">{detail.failure_reason}</p>
                  </div>
                )}

                <section>
                  <h4 className="mb-1 font-semibold">Research</h4>
                  {detail.industry || detail.summary || detail.pain_points?.length ? (
                    <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
                      <p><span className="text-muted-foreground">Industry:</span> {detail.industry ?? "—"}</p>
                      <p><span className="text-muted-foreground">Summary:</span> {detail.summary ?? "—"}</p>
                      {detail.pain_points && detail.pain_points.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">Pain points:</span>
                          <ul className="ml-4 list-disc">
                            {detail.pain_points.map((p, i) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not researched yet.</p>
                  )}
                </section>

                <section>
                  <h4 className="mb-1 font-semibold">Generated email</h4>
                  {detail.email_subject || detail.email_body ? (
                    <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
                      <p><span className="text-muted-foreground">Subject:</span> {detail.email_subject ?? "—"}</p>
                      <p className="whitespace-pre-wrap">{detail.email_body ?? "—"}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not generated yet.</p>
                  )}
                </section>

                {detail.status === "GOT_RESPONSE" && (
                  <section>
                    <h4 className="mb-1 font-semibold">Reply</h4>
                    <div className="space-y-1.5 rounded-lg border bg-emerald-50 p-3">
                      <p className="text-xs text-muted-foreground">
                        {detail.reply_date ? new Date(detail.reply_date).toLocaleString() : ""}
                      </p>
                      <p className="whitespace-pre-wrap">{detail.reply_body ?? "—"}</p>
                    </div>
                  </section>
                )}

                <section>
                  <h4 className="mb-1 font-semibold">Engagement</h4>
                  <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-xs">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span><span className="text-muted-foreground">Opens:</span> {detail.open_count ?? 0}</span>
                      <span><span className="text-muted-foreground">Clicks:</span> {detail.click_count ?? 0}</span>
                      {detail.confidence != null && (
                        <span><span className="text-muted-foreground">Confidence:</span> {detail.confidence}/100</span>
                      )}
                      {detail.personalization_mode && (
                        <span><span className="text-muted-foreground">Email:</span> {detail.personalization_mode}</span>
                      )}
                    </div>
                    <p><span className="text-muted-foreground">Delivered:</span> {detail.delivered_at ? new Date(detail.delivered_at).toLocaleString() : "—"}</p>
                    <p><span className="text-muted-foreground">Opened:</span> {detail.opened_at ? new Date(detail.opened_at).toLocaleString() : "—"}</p>
                    <p><span className="text-muted-foreground">Clicked:</span> {detail.clicked_at ? new Date(detail.clicked_at).toLocaleString() : "—"}</p>
                    {detail.bounced_at && (
                      <p className="text-rose-600"><span className="text-muted-foreground">Bounced:</span> {new Date(detail.bounced_at).toLocaleString()}</p>
                    )}
                  </div>
                </section>

                <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>Sent: {detail.sent_at ? new Date(detail.sent_at).toLocaleString() : "—"}</p>
                  <p className="break-all">Message ID: {detail.provider_message_id ?? "—"}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate-email confirm (#9): email already exists — confirm re-add. */}
      <AlertDialog open={!!dupPrompt} onOpenChange={(o) => !o && setDupPrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This email is already added</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <span className="font-medium">{dupPrompt?.email}</span> is already in the list
                  {dupPrompt && dupPrompt.matches.length > 1 ? ` (${dupPrompt.matches.length} times)` : ""}:
                </p>
                <ul className="space-y-1 rounded-md border bg-muted/30 p-2 text-xs">
                  {dupPrompt?.matches.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2">
                      <span className="font-medium">{m.business_name}</span>
                      <span>{STATUS_META[m.status].label}</span>
                    </li>
                  ))}
                </ul>
                <p>Add it again anyway?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (dupPrompt) insertLead(dupPrompt.name, dupPrompt.email, dupPrompt.language);
                setDupPrompt(null);
              }}
            >
              Add anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
