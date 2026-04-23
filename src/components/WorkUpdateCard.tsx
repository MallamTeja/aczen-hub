import { useState, useEffect } from "react";
import { useUser } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function WorkUpdateCard() {
  const { user } = useUser();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [lastUpdate, setLastUpdate] = useState<{ content: string; update_date: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) fetchLastUpdate();
  }, [user]);

  async function fetchLastUpdate() {
    const { data } = await supabase
      .from("work_updates")
      .select("*")
      .eq("clerk_user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setLastUpdate({ content: data[0].content, update_date: data[0].update_date });
    }
  }

  async function handleSubmit() {
    if (!user || !content.trim()) return;
    setLoading(true);

    const { error } = await supabase.from("work_updates").insert({
      clerk_user_id: user.id,
      content: content.trim(),
    });

    if (error) {
      toast({ title: "Error", description: "Failed to submit update.", variant: "destructive" });
    } else {
      setLastUpdate({ content: content.trim(), update_date: new Date().toISOString().split("T")[0] });
      setContent("");
      toast({ title: "Update submitted", description: "Your work update has been saved." });
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Work Update
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
          <Textarea
            placeholder="What did you work on today?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>
        <Button onClick={handleSubmit} disabled={loading || !content.trim()} className="w-full">
          <Send className="h-4 w-4 mr-2" />
          {loading ? "Submitting..." : "Submit Update"}
        </Button>

        {lastUpdate && (
          <div className="pt-3 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-1">Last Update ({lastUpdate.update_date})</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{lastUpdate.content}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
