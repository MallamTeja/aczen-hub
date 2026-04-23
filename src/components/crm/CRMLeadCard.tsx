import { Calendar, IndianRupee, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, initialsOf, STAGE_STYLES, type Lead } from "@/lib/crm";

interface CRMLeadCardProps {
  lead: Lead;
  onOpen: (lead: Lead) => void;
  onDragStart: (lead: Lead) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

export default function CRMLeadCard({ lead, onOpen, onDragStart, onDragEnd, isDragging }: CRMLeadCardProps) {
  const style = STAGE_STYLES[lead.stage];

  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", lead.id);
        onDragStart(lead);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(lead)}
      className={cn(
        "group w-full rounded-lg border bg-card text-left shadow-soft transition-all",
        "border-l-4 hover:shadow-md hover:-translate-y-0.5",
        style.accent,
        isDragging && "opacity-40",
      )}
    >
      <div className="space-y-2 p-3">
        <div className="flex items-start gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
            {initialsOf(lead.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{lead.name}</p>
            {lead.company && (
              <p className="truncate text-[11px] text-muted-foreground">{lead.company}</p>
            )}
          </div>
        </div>

        {lead.value > 0 && (
          <div className="flex items-center gap-1 text-xs font-medium text-foreground">
            <IndianRupee className="h-3 w-3 text-muted-foreground" />
            {formatMoney(Number(lead.value), lead.currency)}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {lead.email && (
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span className="max-w-[120px] truncate">{lead.email}</span>
            </span>
          )}
          {lead.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {lead.phone}
            </span>
          )}
          {lead.expected_close && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(lead.expected_close).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", style.badge)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
            {lead.probability}%
          </span>
          {lead.owner_name && (
            <span className="truncate text-[10px] text-muted-foreground">{lead.owner_name}</span>
          )}
        </div>
      </div>
    </button>
  );
}
