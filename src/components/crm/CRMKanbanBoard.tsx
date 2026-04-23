import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PIPELINE_STAGES,
  STAGE_STYLES,
  formatMoney,
  type Lead,
  type PipelineStage,
} from "@/lib/crm";
import CRMLeadCard from "./CRMLeadCard";

interface CRMKanbanBoardProps {
  leads: Lead[];
  onOpenLead: (lead: Lead) => void;
  onMoveLead: (leadId: string, toStage: PipelineStage) => void;
  onAddLead: (stage: PipelineStage) => void;
}

export default function CRMKanbanBoard({ leads, onOpenLead, onMoveLead, onAddLead }: CRMKanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<PipelineStage | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<PipelineStage, Lead[]>();
    PIPELINE_STAGES.forEach((stage) => map.set(stage, []));
    leads.forEach((lead) => {
      const arr = map.get(lead.stage) ?? [];
      arr.push(lead);
      map.set(lead.stage, arr);
    });
    return map;
  }, [leads]);

  function handleDrop(stage: PipelineStage) {
    if (draggingId) {
      const lead = leads.find((l) => l.id === draggingId);
      if (lead && lead.stage !== stage) onMoveLead(draggingId, stage);
    }
    setDraggingId(null);
    setDragOver(null);
  }

  return (
    <div className="-mx-4 overflow-x-auto pb-4 sm:-mx-6 md:-mx-8">
      <div className="flex min-w-max gap-3 px-4 sm:px-6 md:px-8">
        {PIPELINE_STAGES.map((stage) => {
          const columnLeads = grouped.get(stage) ?? [];
          const totalValue = columnLeads.reduce((sum, l) => sum + Number(l.value || 0), 0);
          const style = STAGE_STYLES[stage];
          const isActive = dragOver === stage;

          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOver !== stage) setDragOver(stage);
              }}
              onDragLeave={() => setDragOver((s) => (s === stage ? null : s))}
              onDrop={() => handleDrop(stage)}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border bg-card transition-colors",
                isActive && "ring-2 ring-primary/50",
              )}
            >
              <div className={cn("rounded-t-xl border-b px-3 py-2.5", style.column)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", style.dot)} />
                    <h3 className="text-sm font-semibold">{stage}</h3>
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-background/70 px-1.5 text-[10px] font-semibold text-muted-foreground">
                      {columnLeads.length}
                    </span>
                  </div>
                  <button
                    onClick={() => onAddLead(stage)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                    aria-label={`Add lead to ${stage}`}
                    type="button"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {totalValue > 0 ? formatMoney(totalValue) : "—"}
                </p>
              </div>

              <div className="flex-1 space-y-2 p-2">
                {columnLeads.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-[11px] text-muted-foreground">
                    Drop leads here
                  </div>
                ) : (
                  columnLeads.map((lead) => (
                    <CRMLeadCard
                      key={lead.id}
                      lead={lead}
                      onOpen={onOpenLead}
                      onDragStart={(l) => setDraggingId(l.id)}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOver(null);
                      }}
                      isDragging={draggingId === lead.id}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
