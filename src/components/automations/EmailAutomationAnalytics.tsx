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

// A lead counts as "sent" once it has a send timestamp or a post-send status.
function hasSent(l: EmailAutomationLead): boolean {
  return !!l.sent_at || ["SENT", "GOT_RESPONSE", "FOLLOWED_UP"].includes(l.status);
}

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

// One funnel row: a labelled bar whose width is relative to the top of funnel,
// plus the count and conversion-from-sent percentage.
function FunnelRow({
  label,
  value,
  top,
  color,
}: {
  label: string;
  value: number;
  top: number;
  color: string;
}) {
  const widthPct = top > 0 ? Math.max((value / top) * 100, value > 0 ? 4 : 0) : 0;
  const convPct = top > 0 ? Math.round((value / top) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 shrink-0 text-sm font-medium">{label}</div>
      <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-muted/40">
        <div
          className="flex h-full items-center rounded-md px-2 text-xs font-semibold text-white transition-all"
          style={{ width: `${widthPct}%`, backgroundColor: color }}
        >
          {value > 0 && value}
        </div>
      </div>
      <div className="w-12 shrink-0 text-right text-xs text-muted-foreground">{convPct}%</div>
    </div>
  );
}

const FUNNEL_COLORS = ["#0ea5e9", "#38bdf8", "#22c55e", "#10b981", "#8b5cf6", "#ea580c"];

export default function EmailAutomationAnalytics() {
  const [leads, setLeads] = useState<EmailAutomationLead[]>([]);
  const [closedWon, setClosedWon] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).from(TABLE).select("*");
      setLeads((data as EmailAutomationLead[]) ?? []);

      // Closed-won lives in the CRM: leads promoted from outreach that reached "Won".
      const { count } = await (supabase as any)
        .from("crm_leads")
        .select("id", { count: "exact", head: true })
        .eq("source", "Email Automation")
        .eq("stage", "Won");
      setClosedWon(count ?? 0);

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

    // Full funnel: sent → delivered → opened → clicked → replied → closed-won.
    const sent = leads.filter(hasSent).length;
    const delivered = leads.filter((l) => hasSent(l) && !l.bounced_at).length;
    const opened = leads.filter((l) => !!l.opened_at).length;
    const clicked = leads.filter((l) => !!l.clicked_at).length;
    const funnel = [
      { label: "Sent", value: sent },
      { label: "Delivered", value: delivered },
      { label: "Opened", value: opened },
      { label: "Clicked", value: clicked },
      { label: "Replied", value: responded },
      { label: "Closed-won", value: closedWon },
    ];

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

    // Personalized vs generic (#6) — does personalization actually convert better?
    const modeData = (["personalized", "generic"] as const)
      .map((m) => {
        const rows = leads.filter((l) => l.personalization_mode === m);
        const s = rows.filter(hasSent).length;
        const responded2 = rows.filter((l) => l.status === "GOT_RESPONSE").length;
        return {
          mode: m === "personalized" ? "Personalized" : "Generic",
          sent: s,
          opened: rows.filter((l) => !!l.opened_at).length,
          clicked: rows.filter((l) => !!l.clicked_at).length,
          responded: responded2,
          replyRate: s > 0 ? Math.round((responded2 / s) * 100) : 0,
        };
      })
      .filter((d) => d.sent > 0);

    return {
      byStatus,
      total: leads.length,
      contacted,
      responded,
      responseRate,
      funnel,
      statusData,
      langData,
      modeData,
      opened,
      clicked,
    };
  }, [leads, closedWon]);

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

      {/* Full funnel (BMP #3 / #8) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversion funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {stats.funnel.map((f, i) => (
              <FunnelRow
                key={f.label}
                label={f.label}
                value={f.value}
                top={stats.funnel[0].value}
                color={FUNNEL_COLORS[i]}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            % is conversion from <span className="font-medium">Sent</span>. Delivered = sent and not
            bounced. Opens are directional (image-blocking inflates them); clicks are the harder
            signal. Closed-won is pulled from the CRM (leads promoted on reply that reached “Won”).
          </p>
        </CardContent>
      </Card>

      {/* Personalized vs generic (#6) */}
      {stats.modeData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personalized vs. generic</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 grid grid-cols-2 gap-3">
              {stats.modeData.map((m) => (
                <div key={m.mode} className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-sm font-semibold">{m.mode}</p>
                  <p className="text-2xl font-bold">{m.replyRate}%</p>
                  <p className="text-xs text-muted-foreground">
                    {m.responded} replies ÷ {m.sent} sent · {m.opened} opens · {m.clicked} clicks
                  </p>
                </div>
              ))}
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.modeData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mode" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sent" name="Sent" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="opened" name="Opened" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="clicked" name="Clicked" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="responded" name="Replied" fill="#ea580c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

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
