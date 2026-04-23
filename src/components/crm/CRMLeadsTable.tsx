import { ChevronLeft, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { STAGE_STYLES, formatMoney, type Lead } from "@/lib/crm";

const PAGE_SIZE = 15;

interface CRMLeadsTableProps {
  leads: Lead[];
  page: number;
  onPageChange: (page: number) => void;
  onOpenLead: (lead: Lead) => void;
}

export default function CRMLeadsTable({ leads, page, onPageChange, onOpenLead }: CRMLeadsTableProps) {
  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const from = safePage * PAGE_SIZE;
  const rows = leads.slice(from, from + PAGE_SIZE);

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
        No leads yet. Create a lead or import a CSV to get started.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/60">
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Expected Close</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((lead) => {
              const style = STAGE_STYLES[lead.stage];
              return (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => onOpenLead(lead)}
                >
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{lead.name}</span>
                      {lead.email && (
                        <span className="text-[11px] text-muted-foreground">{lead.email}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{lead.company || "—"}</TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", style.badge)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                      {lead.stage}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {Number(lead.value) > 0 ? formatMoney(Number(lead.value), lead.currency) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{lead.owner_name || "—"}</TableCell>
                  <TableCell className="text-xs">{lead.source || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {lead.expected_close ? new Date(lead.expected_close).toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-2">
          <p className="text-xs text-muted-foreground">
            Page {safePage + 1} of {totalPages} · {leads.length} total
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onPageChange(safePage - 1)} disabled={safePage === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => onPageChange(safePage + 1)} disabled={safePage >= totalPages - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
