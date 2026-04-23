import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, LayoutGrid, Plus, Search, Upload } from "lucide-react";
import CRMKanbanBoard from "@/components/crm/CRMKanbanBoard";
import CRMLeadsTable from "@/components/crm/CRMLeadsTable";
import CRMLeadDialog from "@/components/crm/CRMLeadDialog";
import CRMLeadImport from "@/components/crm/CRMLeadImport";
import CRMLeadDetail from "@/components/crm/CRMLeadDetail";
import CRMStatsBar from "@/components/crm/CRMStatsBar";
import {
  DEFAULT_STAGE_PROBABILITY,
  PIPELINE_STAGES,
  type Lead,
  type LeadInput,
  type PipelineStage,
} from "@/lib/crm";

type ViewMode = "kanban" | "table";

export default function CRM() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const actorUserId = user?.id || "anonymous";
  const actorName = profile?.name || user?.fullName || user?.primaryEmailAddress?.emailAddress || "Unknown";

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("kanban");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<PipelineStage | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [initialStage, setInitialStage] = useState<PipelineStage>("New");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("crm_leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Could not load leads", description: error.message, variant: "destructive" });
    }
    setLeads((data as Lead[]) ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const ownerOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.owner_name && set.add(l.owner_name));
    return Array.from(set).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (stageFilter !== "all" && l.stage !== stageFilter) return false;
      if (ownerFilter !== "all" && (l.owner_name ?? "") !== ownerFilter) return false;
      if (!term) return true;
      return [l.name, l.company, l.email, l.phone, l.source]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [leads, search, stageFilter, ownerFilter]);

  async function saveLead(input: LeadInput, id?: string) {
    if (id) {
      const { error } = await (supabase as any)
        .from("crm_leads")
        .update({
          name: input.name,
          email: input.email,
          phone: input.phone,
          company: input.company,
          job_title: input.job_title,
          source: input.source,
          stage: input.stage,
          value: input.value ?? 0,
          currency: input.currency ?? "INR",
          probability: input.probability ?? 0,
          expected_close: input.expected_close,
          owner_name: input.owner_name,
          notes: input.notes,
        })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Lead updated" });
    } else {
      const { data, error } = await (supabase as any)
        .from("crm_leads")
        .insert({
          name: input.name,
          email: input.email,
          phone: input.phone,
          company: input.company,
          job_title: input.job_title,
          source: input.source,
          stage: input.stage ?? "New",
          value: input.value ?? 0,
          currency: input.currency ?? "INR",
          probability: input.probability ?? DEFAULT_STAGE_PROBABILITY[input.stage ?? "New"],
          expected_close: input.expected_close,
          owner_name: input.owner_name,
          owner_user_id: input.owner_user_id ?? null,
          notes: input.notes,
          created_by: actorUserId,
        })
        .select()
        .single();
      if (error) throw error;
      toast({ title: "Lead created" });
      if (data) setActiveLead(data as Lead);
    }
    fetchLeads();
  }

  async function deleteLead(lead: Lead) {
    const { error } = await (supabase as any).from("crm_leads").delete().eq("id", lead.id);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Lead deleted" });
    setDetailOpen(false);
    setActiveLead(null);
    fetchLeads();
  }

  async function moveStage(leadId: string, stage: PipelineStage) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    const fromStage = lead.stage;
    if (fromStage === stage) return;

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage, probability: DEFAULT_STAGE_PROBABILITY[stage] } : l)),
    );

    const { error } = await (supabase as any)
      .from("crm_leads")
      .update({ stage, probability: DEFAULT_STAGE_PROBABILITY[stage] })
      .eq("id", leadId);

    if (error) {
      toast({ title: "Could not update stage", description: error.message, variant: "destructive" });
      fetchLeads();
      return;
    }

    await (supabase as any).from("crm_lead_activities").insert({
      lead_id: leadId,
      type: "stage_change",
      title: `Moved from ${fromStage} to ${stage}`,
      from_stage: fromStage,
      to_stage: stage,
      actor_user_id: actorUserId,
      actor_name: actorName,
    });

    if (activeLead?.id === leadId) {
      setActiveLead({ ...activeLead, stage, probability: DEFAULT_STAGE_PROBABILITY[stage] });
    }
  }

  async function importLeads(rows: LeadInput[]): Promise<number> {
    const payload = rows.map((r) => ({
      name: r.name,
      email: r.email ?? null,
      phone: r.phone ?? null,
      company: r.company ?? null,
      job_title: r.job_title ?? null,
      source: r.source ?? null,
      stage: r.stage ?? "New",
      value: r.value ?? 0,
      currency: r.currency ?? "INR",
      probability: r.probability ?? DEFAULT_STAGE_PROBABILITY[r.stage ?? "New"],
      expected_close: r.expected_close ?? null,
      owner_name: r.owner_name ?? null,
      owner_user_id: null,
      notes: r.notes ?? null,
      created_by: actorUserId,
    }));

    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < payload.length; i += CHUNK) {
      const chunk = payload.slice(i, i + CHUNK);
      const { error, data } = await (supabase as any).from("crm_leads").insert(chunk).select("id");
      if (error) throw error;
      inserted += (data?.length as number) ?? chunk.length;
    }
    fetchLeads();
    return inserted;
  }

  function openNewLead(stage: PipelineStage = "New") {
    setEditingLead(null);
    setInitialStage(stage);
    setDialogOpen(true);
  }

  function openLead(lead: Lead) {
    setActiveLead(lead);
    setDetailOpen(true);
  }

  function exportCsv() {
    if (filtered.length === 0) {
      toast({ title: "Nothing to export" });
      return;
    }
    const header = [
      "Name","Company","Job Title","Email","Phone","Stage","Value","Currency",
      "Probability","Expected Close","Owner","Source","Notes","Created"
    ];
    const rows = filtered.map((l) => [
      l.name, l.company ?? "", l.job_title ?? "", l.email ?? "", l.phone ?? "",
      l.stage, l.value, l.currency, l.probability, l.expected_close ?? "",
      l.owner_name ?? "", l.source ?? "", (l.notes ?? "").replace(/\n/g, " "),
      new Date(l.created_at).toISOString().slice(0, 10),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">CRM · Sales Pipeline</h1>
            <p className="text-sm text-muted-foreground">Track leads through your sales pipeline.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1.5 h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-1.5 h-4 w-4" />
              Export
            </Button>
            <Button size="sm" onClick={() => openNewLead()}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add lead
            </Button>
          </div>
        </div>

        <CRMStatsBar leads={filtered} />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Search name, company, email…"
                className="h-9 pl-8"
              />
            </div>
            <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v as PipelineStage | "all"); setPage(0); }}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ownerFilter} onValueChange={(v) => { setOwnerFilter(v); setPage(0); }}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All owners</SelectItem>
                {ownerOptions.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList className="h-9">
              <TabsTrigger value="kanban" className="gap-1.5 text-xs">
                <LayoutGrid className="h-3.5 w-3.5" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-1.5 text-xs">
                Table
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
            Loading leads…
          </div>
        ) : view === "kanban" ? (
          <CRMKanbanBoard
            leads={filtered}
            onOpenLead={openLead}
            onMoveLead={moveStage}
            onAddLead={(stage) => openNewLead(stage)}
          />
        ) : (
          <CRMLeadsTable leads={filtered} page={page} onPageChange={setPage} onOpenLead={openLead} />
        )}
      </div>

      <CRMLeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        lead={editingLead}
        initialStage={initialStage}
        onSave={saveLead}
      />

      <CRMLeadImport
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={importLeads}
      />

      <CRMLeadDetail
        lead={activeLead}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        actorUserId={actorUserId}
        actorName={actorName}
        onEdit={(l) => {
          setEditingLead(l);
          setInitialStage(l.stage);
          setDetailOpen(false);
          setDialogOpen(true);
        }}
        onDelete={deleteLead}
        onStageChange={moveStage}
      />
    </DashboardLayout>
  );
}
