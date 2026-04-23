import { useState, useEffect } from "react";
import { useUser } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle2, FileText, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StatusCards() {
  const { user } = useUser();
  const [punchStatus, setPunchStatus] = useState<string>("—");
  const [lastPunchTime, setLastPunchTime] = useState<string>("—");
  const [updateStatus, setUpdateStatus] = useState<string>("—");
  const [openTasks, setOpenTasks] = useState<number>(0);

  useEffect(() => {
    if (user) fetchStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function fetchStatuses() {
    const { data: punchData } = await supabase
      .from("punches")
      .select("*")
      .eq("clerk_user_id", user!.id)
      .order("timestamp", { ascending: false })
      .limit(1);

    if (punchData && punchData.length > 0) {
      setPunchStatus(punchData[0].status === "IN" ? "Punched In" : "Punched Out");
      setLastPunchTime(new Date(punchData[0].timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }

    const today = new Date().toISOString().split("T")[0];
    const { data: updateData } = await supabase
      .from("work_updates")
      .select("*")
      .eq("clerk_user_id", user!.id)
      .eq("update_date", today)
      .limit(1);
    setUpdateStatus(updateData && updateData.length > 0 ? "Submitted" : "Pending");

    const { count } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("assigned_to", user!.id)
      .neq("status", "Completed");
    setOpenTasks(count || 0);
  }

  const cards = [
    {
      label: "Today's Status",
      value: punchStatus,
      icon: CheckCircle2,
      gradient: "gradient-warm",
      accent: punchStatus === "Punched In" ? "text-success" : "text-muted-foreground",
    },
    {
      label: "Last Punch",
      value: lastPunchTime,
      icon: Clock,
      gradient: "gradient-cool",
      accent: "text-primary",
    },
    {
      label: "Work Update",
      value: updateStatus,
      icon: FileText,
      gradient: updateStatus === "Submitted" ? "gradient-warm" : "gradient-sunset",
      accent: updateStatus === "Submitted" ? "text-success" : "text-warning",
    },
    {
      label: "Open Tasks",
      value: String(openTasks),
      icon: TrendingUp,
      gradient: "gradient-sunset",
      accent: "text-primary",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {cards.map((card, idx) => (
        <Card
          key={card.label}
          className="group relative overflow-hidden border-border/60 transition-all hover:shadow-elegant hover:-translate-y-0.5 animate-in-up"
          style={{ animationDelay: `${idx * 60}ms` }}
        >
          <div className={cn("absolute inset-x-0 top-0 h-1", card.gradient)} />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground shadow-soft", card.gradient)}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{card.label}</p>
            <p className={cn("mt-1 text-lg font-bold leading-tight", card.accent)}>{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
