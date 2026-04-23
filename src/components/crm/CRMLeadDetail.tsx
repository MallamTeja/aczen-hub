import { useCallback, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  Mail,
  Phone,
  StickyNote,
  Trash2,
  Pencil,
  ArrowRightLeft,
} from "lucide-react";
import {
  PIPELINE_STAGES,
  STAGE_STYLES,
  formatMoney,
  type Lead,
  type LeadActivity,
  type LeadActivityType,
  type PipelineStage,
} from "@/lib/crm";

interface CRMLeadDetailProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actorUserId: string;
  actorName: string;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => Promise<void>;
  onStageChange: (leadId: string, stage: PipelineStage) => Promise<void>;
}

const TYPE_META: Record<LeadActivityType, { icon: typeof Mail; label: string; badge: string }> = {
  call:         { icon: Phone,        label: "Call",          badge: "bg-sky-100 text-sky-700" },
  email:        { icon: Mail,         label: "Email",         badge: "bg-indigo-100 text-indigo-700" },
  meeting:      { icon: CalendarClock, label: "Meeting",      badge: "bg-violet-100 text-violet-700" },
  note:         { icon: StickyNote,   label: "Note",          badge: "bg-amber-100 text-amber-800" },
  stage_change: { icon: ArrowRightLeft, label: "Stage change", badge: "bg-muted text-muted-foreground" },
};

export default function CRMLeadDetail({
  lead,
  open,
  onOpenChange,
  actorUserId,
  actorName,
  onEdit,
  onDelete,
  onStageChange,
}: CRMLeadDetailProps) {
  const { toast } = useToast();
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [newType, setNewType] = useState<LeadActivityType>("note");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!lead) return;
    const { data } = await (supabase as any)
      .from("crm_lead_activities")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false });
    setActivities((data as LeadActivity[]) ?? []);
  }, [lead]);

  useEffect(() => {
    if (open && lead) refresh();
  }, [open, lead, refresh]);

  async function addActivity() {
    if (!lead || !newTitle.trim()) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("crm_lead_activities").insert({
        lead_id: lead.id,
        type: newType,
        title: newTitle.trim(),
        body: newBody.trim() || null,
        actor_user_id: actorUserId,
        actor_name: actorName,
      });
      if (error) throw error;

      if (newType === "call" || newType === "email" || newType === "meeting") {
        await (supabase as any)
          .from("crm_leads")
          .update({ last_contacted_at: new Date().toISOString() })
          .eq("id", lead.id);
      }

      setNewTitle("");
      setNewBody("");
      refresh();
    } catch (err) {
      toast({
        title: "Could not save activity",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
    setSaving(false);
  }

  if (!lead) return null;
  const style = STAGE_STYLES[lead.stage];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
        <div className={cn("border-b border-l-4 px-5 py-4", style.accent)}>
          <SheetHeader>
            <SheetTitle className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{lead.name}</p>
                {lead.company && (
                  <p className="truncate text-sm font-normal text-muted-foreground">
                    {lead.job_title ? `${lead.job_title}, ` : ""}{lead.company}
                  </p>
                )}
              </div>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select value={lead.stage} onValueChange={(v) => onStageChange(lead.id, v as PipelineStage)}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => onEdit(lead)} className="h-8">
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-destructive hover:bg-destructive/10"
              onClick={async () => {
                if (confirm(`Delete lead "${lead.name}"?`)) await onDelete(lead);
              }}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="Email" value={lead.email} />
            <InfoRow label="Phone" value={lead.phone} />
            <InfoRow
              label="Value"
              value={Number(lead.value) > 0 ? formatMoney(Number(lead.value), lead.currency) : null}
            />
            <InfoRow label="Probability" value={`${lead.probability}%`} />
            <InfoRow label="Source" value={lead.source} />
            <InfoRow label="Owner" value={lead.owner_name} />
            <InfoRow
              label="Expected close"
              value={lead.expected_close ? new Date(lead.expected_close).toLocaleDateString() : null}
            />
            <InfoRow
              label="Last contact"
              value={lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleDateString() : null}
            />
          </div>

          {lead.notes && (
            <div>
              <Label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Notes</Label>
              <p className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm">{lead.notes}</p>
            </div>
          )}

          <div className="rounded-xl border p-3">
            <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
              Log activity
            </Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Select value={newType} onValueChange={(v) => setNewType(v as LeadActivityType)}>
                  <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Title / subject"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <Textarea
                rows={2}
                placeholder="Details (optional)"
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={addActivity} disabled={saving || !newTitle.trim()}>
                  {saving ? "Saving…" : "Add"}
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
              Activity timeline
            </Label>
            {activities.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                No activities yet. Log a call, meeting, or note above.
              </p>
            ) : (
              <ol className="space-y-3">
                {activities.map((a) => {
                  const meta = TYPE_META[a.type];
                  const Icon = meta.icon;
                  return (
                    <li key={a.id} className="rounded-lg border p-3">
                      <div className="flex items-start gap-3">
                        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", meta.badge)}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium">
                              {a.type === "stage_change"
                                ? `Moved from ${a.from_stage || "—"} to ${a.to_stage || "—"}`
                                : a.title}
                            </p>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(a.created_at).toLocaleString()}
                            </span>
                          </div>
                          {a.body && (
                            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{a.body}</p>
                          )}
                          {a.actor_name && (
                            <p className="mt-1 text-[11px] text-muted-foreground">by {a.actor_name}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm">{value || "—"}</p>
    </div>
  );
}
