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

  async function addLead() {
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

    setSaving(true);
    const { error } = await (supabase as any).from(TABLE).insert({
      business_name: name,
      business_email: email,
      language,
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
          <p className="mt-2 text-xs text-muted-foreground">
            Subject line will be written in <span className="font-medium">{language}</span>; the email body is always
            English. New leads start as <span className="font-medium">NOT_SENT</span> and are picked up by the
            09:00 / 12:05 / 15:00 IST campaigns.
          </p>
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

      {/* Table */}
      <Card>
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

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <p>Sent: {detail.sent_at ? new Date(detail.sent_at).toLocaleString() : "—"}</p>
                  <p>Message ID: {detail.provider_message_id ?? "—"}</p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
