import { useState, useRef } from "react";
import { useUser } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface LeadUploadProps {
  onUploadSuccess: () => void;
}

export default function LeadUpload({ onUploadSuccess }: LeadUploadProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [leadSource, setLeadSource] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUpload() {
    if (!user || !selectedFile || !leadSource.trim()) {
      toast({ title: "Missing fields", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet);

      const { error } = await supabase.from("lead_uploads").insert({
        clerk_user_id: user.id,
        file_name: selectedFile.name,
        uploaded_by: user.fullName || user.emailAddresses?.[0]?.emailAddress || "Unknown",
        lead_source: leadSource.trim(),
        total_leads: rows.length,
      });

      if (error) throw error;

      toast({ title: "Upload successful", description: `${rows.length} leads uploaded from ${selectedFile.name}.` });
      setSelectedFile(null);
      setLeadSource("");
      if (fileRef.current) fileRef.current.value = "";
      onUploadSuccess();
    } catch {
      toast({ title: "Upload failed", description: "Could not process the file. Please check the format.", variant: "destructive" });
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          Upload Leads
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="leadSource">Lead Source</Label>
          <Input
            id="leadSource"
            placeholder="e.g., LinkedIn, Website, Referral"
            value={leadSource}
            onChange={(e) => setLeadSource(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>File (CSV, XLS, XLSX)</Label>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {selectedFile ? selectedFile.name : "Click to select a file"}
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            className="hidden"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          />
        </div>

        <Button onClick={handleUpload} disabled={loading || !selectedFile || !leadSource.trim()} className="w-full">
          {loading ? "Uploading..." : "Upload Leads"}
        </Button>
      </CardContent>
    </Card>
  );
}
