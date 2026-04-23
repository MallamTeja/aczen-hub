import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_STAGE_PROBABILITY,
  PIPELINE_STAGES,
  type Lead,
  type LeadInput,
  type PipelineStage,
} from "@/lib/crm";

interface CRMLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  initialStage?: PipelineStage;
  onSave: (input: LeadInput, id?: string) => Promise<void>;
}

const EMPTY: LeadInput = {
  name: "",
  email: "",
  phone: "",
  company: "",
  job_title: "",
  source: "",
  stage: "New",
  value: 0,
  currency: "INR",
  probability: DEFAULT_STAGE_PROBABILITY.New,
  expected_close: "",
  notes: "",
  owner_name: "",
};

export default function CRMLeadDialog({ open, onOpenChange, lead, initialStage, onSave }: CRMLeadDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<LeadInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (lead) {
        setForm({
          name: lead.name,
          email: lead.email ?? "",
          phone: lead.phone ?? "",
          company: lead.company ?? "",
          job_title: lead.job_title ?? "",
          source: lead.source ?? "",
          stage: lead.stage,
          value: Number(lead.value),
          currency: lead.currency,
          probability: lead.probability,
          expected_close: lead.expected_close ?? "",
          notes: lead.notes ?? "",
          owner_name: lead.owner_name ?? "",
        });
      } else {
        setForm({
          ...EMPTY,
          stage: initialStage ?? "New",
          probability: DEFAULT_STAGE_PROBABILITY[initialStage ?? "New"],
        });
      }
    }
  }, [open, lead, initialStage]);

  const update = <K extends keyof LeadInput>(key: K, val: LeadInput[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  async function handleSubmit() {
    if (!form.name?.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await onSave(
        {
          ...form,
          name: form.name!.trim(),
          email: form.email?.trim() || null,
          phone: form.phone?.trim() || null,
          company: form.company?.trim() || null,
          job_title: form.job_title?.trim() || null,
          source: form.source?.trim() || null,
          notes: form.notes?.trim() || null,
          owner_name: form.owner_name?.trim() || null,
          expected_close: form.expected_close || null,
          value: Number(form.value) || 0,
          probability: Number(form.probability) || 0,
        },
        lead?.id,
      );
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Could not save lead",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{lead ? "Edit lead" : "Add lead"}</DialogTitle>
          <DialogDescription>
            {lead ? "Update this lead's details." : "Create a new lead in the pipeline."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="lead-name">Name *</Label>
            <Input id="lead-name" value={form.name ?? ""} onChange={(e) => update("name", e.target.value)} />
          </div>

          <div>
            <Label htmlFor="lead-company">Company</Label>
            <Input id="lead-company" value={form.company ?? ""} onChange={(e) => update("company", e.target.value)} />
          </div>

          <div>
            <Label htmlFor="lead-title">Job title</Label>
            <Input id="lead-title" value={form.job_title ?? ""} onChange={(e) => update("job_title", e.target.value)} />
          </div>

          <div>
            <Label htmlFor="lead-email">Email</Label>
            <Input id="lead-email" type="email" value={form.email ?? ""} onChange={(e) => update("email", e.target.value)} />
          </div>

          <div>
            <Label htmlFor="lead-phone">Phone</Label>
            <Input id="lead-phone" value={form.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
          </div>

          <div>
            <Label>Stage</Label>
            <Select
              value={form.stage}
              onValueChange={(v: PipelineStage) => {
                update("stage", v);
                update("probability", DEFAULT_STAGE_PROBABILITY[v]);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="lead-source">Source</Label>
            <Input
              id="lead-source"
              placeholder="LinkedIn, Referral, Website…"
              value={form.source ?? ""}
              onChange={(e) => update("source", e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="lead-value">Value</Label>
            <Input
              id="lead-value"
              type="number"
              min="0"
              value={form.value ?? 0}
              onChange={(e) => update("value", Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="lead-currency">Currency</Label>
            <Input id="lead-currency" value={form.currency ?? "INR"} onChange={(e) => update("currency", e.target.value)} />
          </div>

          <div>
            <Label htmlFor="lead-probability">Probability %</Label>
            <Input
              id="lead-probability"
              type="number"
              min="0"
              max="100"
              value={form.probability ?? 0}
              onChange={(e) => update("probability", Number(e.target.value))}
            />
          </div>

          <div>
            <Label htmlFor="lead-close">Expected close</Label>
            <Input
              id="lead-close"
              type="date"
              value={form.expected_close ?? ""}
              onChange={(e) => update("expected_close", e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="lead-owner">Owner</Label>
            <Input
              id="lead-owner"
              placeholder="Assigned salesperson"
              value={form.owner_name ?? ""}
              onChange={(e) => update("owner_name", e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="lead-notes">Notes</Label>
            <Textarea
              id="lead-notes"
              rows={3}
              value={form.notes ?? ""}
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : lead ? "Save changes" : "Create lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
