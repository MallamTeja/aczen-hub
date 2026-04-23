import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, X } from "lucide-react";
import {
  DEFAULT_STAGE_PROBABILITY,
  guessField,
  normaliseStage,
  type LeadInput,
} from "@/lib/crm";

type RawRow = Record<string, unknown>;

const IMPORT_FIELDS: { key: keyof LeadInput; label: string; required?: boolean }[] = [
  { key: "name",           label: "Name", required: true },
  { key: "company",        label: "Company" },
  { key: "job_title",      label: "Job title" },
  { key: "email",          label: "Email" },
  { key: "phone",          label: "Phone" },
  { key: "source",         label: "Source" },
  { key: "stage",          label: "Stage" },
  { key: "value",          label: "Value" },
  { key: "currency",       label: "Currency" },
  { key: "probability",    label: "Probability" },
  { key: "expected_close", label: "Expected close" },
  { key: "owner_name",     label: "Owner" },
  { key: "notes",          label: "Notes" },
];

const NONE_VALUE = "__none";

interface CRMLeadImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: LeadInput[]) => Promise<number>;
}

export default function CRMLeadImport({ open, onOpenChange, onImport }: CRMLeadImportProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, keyof LeadInput | null>>({});
  const [importing, setImporting] = useState(false);

  function reset() {
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(file: File) {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });
      if (json.length === 0) {
        toast({ title: "Empty file", description: "No rows found.", variant: "destructive" });
        return;
      }
      const hdrs = Object.keys(json[0]);
      const auto: Record<string, keyof LeadInput | null> = {};
      hdrs.forEach((h) => {
        auto[h] = guessField(h);
      });
      setFileName(file.name);
      setHeaders(hdrs);
      setRows(json);
      setMapping(auto);
    } catch {
      toast({ title: "Could not read file", description: "Please upload a valid CSV or XLSX.", variant: "destructive" });
    }
  }

  function buildLeads(): LeadInput[] {
    const reverse = new Map<keyof LeadInput, string>();
    Object.entries(mapping).forEach(([header, field]) => {
      if (field && !reverse.has(field)) reverse.set(field, header);
    });

    return rows
      .map((r) => {
        const out: LeadInput = { name: "" };

        const pick = (k: keyof LeadInput) => {
          const h = reverse.get(k);
          if (!h) return undefined;
          const v = r[h];
          if (v == null || v === "") return undefined;
          return v;
        };

        const name = pick("name");
        if (name) out.name = String(name).trim();

        const email = pick("email");
        if (email) out.email = String(email).trim();

        const phone = pick("phone");
        if (phone) out.phone = String(phone).trim();

        const company = pick("company");
        if (company) out.company = String(company).trim();

        const job = pick("job_title");
        if (job) out.job_title = String(job).trim();

        const source = pick("source");
        if (source) out.source = String(source).trim();

        const owner = pick("owner_name");
        if (owner) out.owner_name = String(owner).trim();

        const notes = pick("notes");
        if (notes) out.notes = String(notes).trim();

        const currency = pick("currency");
        if (currency) out.currency = String(currency).trim();

        const value = pick("value");
        if (value !== undefined) {
          const n = Number(String(value).replace(/[^0-9.-]/g, ""));
          if (!Number.isNaN(n)) out.value = n;
        }

        const prob = pick("probability");
        if (prob !== undefined) {
          const n = Number(String(prob).replace(/[^0-9.-]/g, ""));
          if (!Number.isNaN(n)) out.probability = Math.max(0, Math.min(100, Math.round(n)));
        }

        const stage = pick("stage");
        if (stage) {
          out.stage = normaliseStage(stage);
          if (out.probability === undefined) out.probability = DEFAULT_STAGE_PROBABILITY[out.stage];
        }

        const close = pick("expected_close");
        if (close !== undefined) {
          const raw = String(close).trim();
          if (raw) {
            const parsed = new Date(raw);
            if (!Number.isNaN(parsed.getTime())) {
              out.expected_close = parsed.toISOString().slice(0, 10);
            }
          }
        }

        return out;
      })
      .filter((l) => l.name && l.name.length > 0);
  }

  async function handleImport() {
    const leads = buildLeads();
    if (leads.length === 0) {
      toast({
        title: "Nothing to import",
        description: "Map at least the Name column, and make sure rows have a name.",
        variant: "destructive",
      });
      return;
    }
    setImporting(true);
    try {
      const inserted = await onImport(leads);
      toast({ title: "Import complete", description: `${inserted} leads added.` });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
    setImporting(false);
  }

  const preview = rows.slice(0, 5);
  const nameMapped = Object.values(mapping).some((f) => f === "name");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import leads</DialogTitle>
          <DialogDescription>
            Upload a CSV or XLSX file. We'll auto-match columns — adjust the mapping below before importing.
          </DialogDescription>
        </DialogHeader>

        {headers.length === 0 ? (
          <div
            onClick={() => fileRef.current?.click()}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-10 text-center hover:border-primary/50"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Click to select a file</p>
            <p className="text-xs text-muted-foreground">CSV, XLS, XLSX · up to a few thousand rows</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-xs">
              <span className="truncate">
                <strong>{fileName}</strong> · {rows.length} rows · {headers.length} columns
              </span>
              <button type="button" onClick={reset} className="rounded-md p-1 hover:bg-background">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
                Column mapping
              </Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {headers.map((h) => (
                  <div key={h} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm" title={h}>{h}</span>
                    <span className="text-muted-foreground">→</span>
                    <Select
                      value={mapping[h] ?? NONE_VALUE}
                      onValueChange={(v) =>
                        setMapping((m) => ({ ...m, [h]: v === NONE_VALUE ? null : (v as keyof LeadInput) }))
                      }
                    >
                      <SelectTrigger className="h-8 w-40 text-xs">
                        <SelectValue placeholder="Ignore" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Ignore</SelectItem>
                        {IMPORT_FIELDS.map((f) => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.label}{f.required ? " *" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {!nameMapped && (
                <p className="mt-2 text-xs text-destructive">You must map a column to Name to import.</p>
              )}
            </div>

            <div>
              <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
                Preview (first {preview.length} rows)
              </Label>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h) => (
                        <TableHead key={h} className="text-[11px]">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((r, i) => (
                      <TableRow key={i}>
                        {headers.map((h) => (
                          <TableCell key={h} className="text-[11px]">
                            {String(r[h] ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleImport} disabled={!nameMapped || importing || rows.length === 0}>
            {importing ? "Importing…" : `Import ${rows.length || ""} leads`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
