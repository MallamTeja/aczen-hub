import { useState, useEffect } from "react";
import { useUser } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Clock, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Punch {
  id: string;
  timestamp: string;
  status: "IN" | "OUT";
}

interface WorkUpdate {
  id: string;
  update_date: string;
}

export default function MyWeeklySummary() {
  const { user } = useUser();
  const [totalHours, setTotalHours] = useState(0);
  const [updates, setUpdates] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchWeeklySummary();
  }, [user]);

  const fetchWeeklySummary = async () => {
    try {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      // Fetch current week punches
      const { data: punchData, error: punchError } = await supabase
        .from("punches")
        .select("*")
        .eq("clerk_user_id", user!.id)
        .gte("timestamp", weekStart.toISOString())
        .lt("timestamp", weekEnd.toISOString())
        .order("timestamp", { ascending: true });

      if (punchError) console.warn("Punch error:", punchError);

      // Calculate hours
      let hours = 0;
      if (punchData) {
        for (let i = 0; i < punchData.length - 1; i++) {
          if (
            punchData[i].status === "IN" &&
            punchData[i + 1].status === "OUT"
          ) {
            const inTime = new Date(punchData[i].timestamp).getTime();
            const outTime = new Date(punchData[i + 1].timestamp).getTime();
            hours += (outTime - inTime) / (1000 * 60 * 60);
          }
        }
      }
      setTotalHours(Math.round(hours * 10) / 10);

      // Fetch current week work updates
      const { data: updateData, error: updateError } = await supabase
        .from("work_updates")
        .select("*")
        .eq("clerk_user_id", user!.id)
        .gte("update_date", weekStart.toISOString().split("T")[0])
        .lt("update_date", weekEnd.toISOString().split("T")[0]);

      if (updateError) console.warn("Update error:", updateError);
      setUpdates((updateData || []).length);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Hours This Week</p>
              <p className="text-xl font-bold">{totalHours}h</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Updates This Week</p>
              <p className="text-xl font-bold">{updates}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
