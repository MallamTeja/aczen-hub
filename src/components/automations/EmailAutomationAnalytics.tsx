import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AUTOMATION_LANGUAGES,
  AUTOMATION_STATUSES,
  STATUS_META,
  type AutomationStatus,
  type EmailAutomationLead,
} from "@/lib/emailAutomation";

const TABLE = "email_automation_leads";

const STATUS_COLOR: Record<AutomationStatus, string> = {
  NOT_SENT: "#94a3b8",
  PROCESSING: "#f59e0b",
  SENT: "#0ea5e9",
  GOT_RESPONSE: "#10b981",
  FOLLOWED_UP: "#8b5cf6",
  FAILED: "#f43f5e",
};

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function EmailAutomationAnalytics() {
  const [leads, setLeads] = useState<EmailAutomationLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).from(TABLE).select("*");
      setLeads((data as EmailAutomationLead[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const s of AUTOMATION_STATUSES) byStatus[s] = 0;
    for (const l of leads) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;

    const contacted = byStatus.SENT + byStatus.GOT_RESPONSE + byStatus.FOLLOWED_UP;
    const responded = byStatus.GOT_RESPONSE;
    const responseRate = contacted > 0 ? Math.round((responded / contacted) * 100) : 0;

    const statusData = AUTOMATION_STATUSES.map((s) => ({
      status: STATUS_META[s].label,
      key: s,
      count: byStatus[s],
    }));

    const langData = AUTOMATION_LANGUAGES.map((lng) => {
      const rows = leads.filter((l) => l.language === lng);
      return {
        language: lng,
        sent: rows.filter((l) => ["SENT", "GOT_RESPONSE", "FOLLOWED_UP"].includes(l.status)).length,
        responded: rows.filter((l) => l.status === "GOT_RESPONSE").length,
      };
    }).filter((d) => d.sent > 0 || d.responded > 0);

    return { byStatus, total: leads.length, contacted, responded, responseRate, statusData, langData };
  }, [leads]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
        Loading analytics…
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
        No data yet. Add leads and run a campaign to see analytics.
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total leads" value={String(stats.total)} />
        <Kpi label="Contacted" value={String(stats.contacted)} hint="Sent / followed up / replied" />
        <Kpi label="Responses" value={String(stats.responded)} />
        <Kpi label="Response rate" value={`${stats.responseRate}%`} hint="Replies ÷ contacted" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads by status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.statusData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={48} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stats.statusData.map((d) => (
                    <Cell key={d.key} fill={STATUS_COLOR[d.key as AutomationStatus]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sent vs. responded by language</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.langData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="language" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sent" name="Contacted" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="responded" name="Responded" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
