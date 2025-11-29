"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import { Card } from "../components/ui/Card";
import { api } from "@/lib/api";
import type {
  InsightsResponse,
  InsightAlert,
} from "@/types/api";

export default function InsightsPage() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [alerts, setAlerts] = useState<InsightAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ins, al] = await Promise.all([
        api.getInsights(),
        api.getAlerts(), // this returns { alerts: Alert[] }
      ]);
      setData(ins);
      // api.getAlerts() type is AlertsResponse; we only need alerts array
      setAlerts(al.alerts as unknown as InsightAlert[]);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load insights.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-4 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold">
                Insights & AI Performance
              </h1>
              <p className="text-xs md:text-sm text-slate-400">
                How well Surge Shield is anticipating surges, what&apos;s driving
                risk, and how the agent is acting on it.
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs md:text-sm hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh Insights"}
            </button>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-950/40 border border-red-800 px-4 py-2 rounded-xl">
              {error}
            </div>
          )}

          {loading && !data && (
            <p className="text-sm text-slate-400">Loading insights...</p>
          )}

          {data && (
            <div className="space-y-4">
              {/* Summary row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card
                  title="Average Surge Intensity"
                  subtitle={`Last ${data.window_days} days`}
                >
                  <p className="text-2xl font-semibold">
                    {data.summary.avg_surge_pct.toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Mean uplift above baseline admissions over the analysis
                    window.
                  </p>
                </Card>

                <Card title="Peak Surge Day">
                  <p className="text-sm font-semibold">
                    {new Date(
                      data.summary.max_surge_date
                    ).toLocaleDateString()}
                  </p>
                  <p className="text-2xl font-semibold mt-1">
                    {data.summary.max_surge_pct.toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Highest forecasted surge in the recent period, used as the
                    anchor day for plans.
                  </p>
                </Card>

                <Card title="Average AQI (Context)">
                  <p className="text-2xl font-semibold">
                    {data.summary.avg_aqi.toFixed(0)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Environmental stress level driving respiratory and cardiac
                    load.
                  </p>
                </Card>

                <Card title="Total Alerts Raised">
                  <p className="text-2xl font-semibold">
                    {data.alert_stats.total_alerts}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Critical: {data.alert_stats.critical} · Warning:{" "}
                    {data.alert_stats.warning} · Info: {data.alert_stats.info}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Reflects how actively the agent is flagging operational
                    risk.
                  </p>
                </Card>
              </div>

              {/* Event insights + agent actions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card
                  title="Surge Drivers & Events"
                  subtitle="What the model believes is behind upcoming surges."
                >
                  {data.event_insights.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No events configured. Seed festivals, pollution episodes
                      and other triggers in the data layer.
                    </p>
                  ) : (
                    <div className="space-y-2 text-xs max-h-72 overflow-auto pr-1">
                      {data.event_insights.map((ev) => (
                        <div
                          key={ev.event_id}
                          className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-slate-100">
                              {ev.name}
                            </p>
                            <span className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-700 text-[10px] uppercase tracking-wide">
                              {ev.type}
                            </span>
                          </div>
                          <p className="text-slate-400">
                            {new Date(ev.date).toLocaleDateString()}
                          </p>
                          <p className="text-[11px] text-slate-300">
                            Historical surge:{" "}
                            <span className="font-semibold">
                              {ev.historical_avg_surge_pct.toFixed(1)}%
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Risk areas: {ev.risk_categories.join(", ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card
                  title="Agent Actions Taken"
                  subtitle="How often the agent’s plans have been applied."
                >
                  <div className="grid grid-cols-2 gap-3 text-xs mt-2">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2">
                      <p className="text-2xl font-semibold">
                        {data.agent_actions.staffing_applied}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Staffing plans applied
                      </p>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2">
                      <p className="text-2xl font-semibold">
                        {data.agent_actions.supplies_ordered}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Supply orders triggered
                      </p>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2">
                      <p className="text-2xl font-semibold">
                        {data.agent_actions.bed_plans_applied}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Bed plans applied
                      </p>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2">
                      <p className="text-2xl font-semibold">
                        {data.agent_actions.advisories_sent}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Advisory campaigns sent
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-slate-400">
                    These counters show how often hospital leadership has
                    accepted and executed the agent&apos;s recommendations.
                  </p>
                </Card>

                <Card
                  title="Narrative Insight"
                  subtitle="Plain-language explanation for leadership."
                >
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {data.narrative}
                  </p>
                </Card>
              </div>

              {/* Agent log (alerts) */}
              <Card
                title="Agent Log"
                subtitle="Recent alerts and notifications raised by the AI agent."
              >
                {alerts.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No alerts yet. Run the AI agent from the dashboard to
                    populate this log.
                  </p>
                ) : (
                  <div className="space-y-2 text-xs max-h-72 overflow-auto pr-1">
                    {alerts.map((a) => (
                      <div
                        key={a.id}
                        className={`px-3 py-2 rounded-lg border text-[11px] ${
                          a.level === "critical"
                            ? "border-red-700 bg-red-950/40 text-red-100"
                            : a.level === "warning"
                            ? "border-amber-600 bg-amber-950/40 text-amber-100"
                            : "border-slate-700 bg-slate-900/60 text-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">
                            {a.level.toUpperCase()}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(a.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1">{a.message}</p>
                        {a.tags && a.tags.length > 0 && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            Tags: {a.tags.join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
