import { Card, CardContent } from "@/components/ui/card";
import { Gauge, IndianRupee, Target, Trophy } from "lucide-react";
import { formatMoney, type Lead } from "@/lib/crm";

const LOST_STAGES = new Set(["Lost"]);
const WON_STAGES = new Set(["Won"]);

interface CRMStatsBarProps {
  leads: Lead[];
}

export default function CRMStatsBar({ leads }: CRMStatsBarProps) {
  const open = leads.filter((l) => !WON_STAGES.has(l.stage) && !LOST_STAGES.has(l.stage));
  const won = leads.filter((l) => WON_STAGES.has(l.stage));
  const pipelineValue = open.reduce((s, l) => s + Number(l.value || 0), 0);
  const wonValue = won.reduce((s, l) => s + Number(l.value || 0), 0);
  const weighted = open.reduce(
    (s, l) => s + Number(l.value || 0) * (Number(l.probability || 0) / 100),
    0,
  );

  const stats = [
    { label: "Open leads",      value: String(open.length),           icon: Target,       tint: "text-sky-600" },
    { label: "Pipeline value",  value: formatMoney(pipelineValue),    icon: IndianRupee,  tint: "text-violet-600" },
    { label: "Weighted value",  value: formatMoney(weighted),         icon: Gauge,        tint: "text-amber-600" },
    { label: "Won",             value: `${won.length} · ${formatMoney(wonValue)}`, icon: Trophy, tint: "text-emerald-600" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted/70 ${s.tint}`}>
              <s.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="truncate text-sm font-semibold">{s.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
