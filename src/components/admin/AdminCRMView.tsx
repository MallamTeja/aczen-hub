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
import { Gauge, IndianRupee, Search, Target, Trophy, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PIPELINE_STAGES,
  STAGE_STYLES,
  formatMoney,
  type Lead,
  type PipelineStage,
} from "@/lib/crm";

interface AdminCRMViewProps {
  userNames: Record<string, string>;
}

export default function AdminCRMView({ userNames }: AdminCRMViewProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<PipelineStage | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("crm_leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.warn("CRM leads fetch warning:", error.message);
    setLeads((data as Lead[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const ownerOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      const key = l.owner_user_id || l.owner_name || "";
      if (key) set.add(key);
    });
    return Array.from(set).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (stageFilter !== "all" && l.stage !== stageFilter) return false;
      if (ownerFilter !== "all") {
        const key = l.owner_user_id || l.owner_name || "";
        if (key !== ownerFilter) return false;
      }
      if (!term) return true;
      return [l.name, l.company, l.email, l.phone, l.source, l.owner_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [leads, search, stageFilter, ownerFilter]);

  const stats = useMemo(() => {
    const open = filtered.filter((l) => l.stage !== "Won" && l.stage !== "Lost");
    const won = filtered.filter((l) => l.stage === "Won");
    const pipelineValue = open.reduce((s, l) => s + Number(l.value || 0), 0);
    const weighted = open.reduce(
      (s, l) => s + Number(l.value || 0) * (Number(l.probability || 0) / 100),
      0,
    );
    const wonValue = won.reduce((s, l) => s + Number(l.value || 0), 0);
    const uniqueOwners = new Set(
      filtered.map((l) => l.owner_user_id || l.owner_name || "").filter(Boolean),
    );
    return {
      open: open.length,
      total: filtered.length,
      pipelineValue,
      weighted,
      wonCount: won.length,
      wonValue,
      uniqueOwners: uniqueOwners.size,
    };
  }, [filtered]);

  const stageBreakdown = useMemo(() => {
    return PIPELINE_STAGES.map((stage) => {
      const stageLeads = filtered.filter((l) => l.stage === stage);
      const value = stageLeads.reduce((s, l) => s + Number(l.value || 0), 0);
      return { stage, count: stageLeads.length, value };
    });
  }, [filtered]);

  const ownerBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; total: number; won: number; value: number }>();
    filtered.forEach((l) => {
      const key = l.owner_user_id || l.owner_name || "Unassigned";
      const display = userNames[key] || l.owner_name || "Unassigned";
      if (!map.has(key)) {
        map.set(key, { name: display, total: 0, won: 0, value: 0 });
      }
      const entry = map.get(key)!;
      entry.total++;
      if (l.stage === "Won") {
        entry.won++;
        entry.value += Number(l.value || 0);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered, userNames]);

  const summaryCards = [
    { label: "Total leads", value: String(stats.total), icon: Target, tint: "text-sky-600" },
    { label: "Open pipeline", value: formatMoney(stats.pipelineValue), icon: IndianRupee, tint: "text-violet-600" },
    { label: "Weighted value", value: formatMoney(stats.weighted), icon: Gauge, tint: "text-amber-600" },
    {
      label: "Won",
      value: `${stats.wonCount} · ${formatMoney(stats.wonValue)}`,
      icon: Trophy,
      tint: "text-emerald-600",
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

      {/* Stage breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline by stage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {stageBreakdown.map((s) => (
              <div
                key={s.stage}
                className="rounded-lg border bg-card p-3"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${STAGE_STYLES[s.stage].dot}`} />
                  <span className="text-xs font-medium text-foreground">{s.stage}</span>
                </div>
                <p className="mt-2 text-xl font-semibold">{s.count}</p>
                <p className="text-[11px] text-muted-foreground">{formatMoney(s.value)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Owner breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Leads per owner
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ownerBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leads yet.</p>
          ) : (
            <div className="space-y-2">
              {ownerBreakdown.map((o) => (
                <div
                  key={o.name}
                  className="flex items-center justify-between rounded-md border bg-card p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{o.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.total} leads · {o.won} won
                    </p>
                  </div>
                  <span className="text-xs font-medium text-emerald-600">
                    {formatMoney(o.value)}
                  </span>
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
            placeholder="Search name, company, email, owner…"
            className="h-9 pl-8"
          />
        </div>
        <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as PipelineStage | "all")}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {PIPELINE_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {ownerOptions.map((o) => (
              <SelectItem key={o} value={o}>
                {userNames[o] || o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Leads table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All leads ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No leads match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Expected close</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 200).map((l) => (
                    <TableRow key={l.id} className="hover:bg-muted/50">
                      <TableCell>
                        <p className="font-medium">{l.name}</p>
                        {l.email && (
                          <p className="text-xs text-muted-foreground">{l.email}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {l.company || "—"}
                        {l.job_title && (
                          <p className="text-xs text-muted-foreground">{l.job_title}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={STAGE_STYLES[l.stage].badge}>
                          {l.stage}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {formatMoney(Number(l.value || 0), l.currency || "INR")}
                        <p className="text-xs text-muted-foreground">
                          {l.probability}% prob.
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {userNames[l.owner_user_id || ""] || l.owner_name || "—"}
                      </TableCell>
                      <TableCell className="text-sm">{l.source || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {l.expected_close
                          ? new Date(l.expected_close).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(l.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length > 200 && (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  Showing first 200 of {filtered.length} leads.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
