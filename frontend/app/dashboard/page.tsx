"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import { Card } from "../components/ui/Card";
import { api } from "@/lib/api";
import LineChart from "../components/charts/LineChart";
import type {
  DashboardResponse,
  PredictionsResponse,
  DepartmentRisk,
} from "@/types/api";

type AlertSeverity = "info" | "warning" | "critical";

interface Alert {
  id: string;
  message: string;
  severity: AlertSeverity;
}

type LoadStatus = "low" | "medium" | "high" | "critical";

interface DepartmentLoad {
  department: string;
  load_pct: number;
  status: LoadStatus;
}

interface PeakOutlook {
  date: string;
  surge_pct: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [predictions, setPredictions] = useState<PredictionsResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [runningAgent, setRunningAgent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [dashRes, predRes] = await Promise.all([
        api.getDashboard(),
        api.getPredictions(14),
      ]);
      setDashboard(dashRes);
      setPredictions(predRes);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load dashboard");
      }
    } finally {
      setLoading(false);
    }
  };
  const [autoMode, setAutoMode] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  const runAgent = async () => {
    try {
      setRunningAgent(true);
      await api.runAgent(14);
      await load();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Agent run failed");
      }
    } finally {
      setRunningAgent(false);
    }
  };
  useEffect(() => {
  if (!autoMode) return;
  const id = setInterval(() => {
    api.runAgent(14).then(() => load()).catch(() => {});
  }, 15000); // every 15s
  return () => clearInterval(id);
}, [autoMode]);

  // --- Derived: department load snapshot from predictions.department_risk ---
  const departmentLoad: DepartmentLoad[] = (() => {
    if (!predictions) return [];
    return predictions.department_risk.map((r: DepartmentRisk) => {
      // base load ~ 50–100% depending on risk_score
      const baseLoad = 50 + r.risk_score * 50; // 0–1 -> 50–100
      let status: LoadStatus;
      if (baseLoad >= 90) status = "critical";
      else if (baseLoad >= 75) status = "high";
      else if (baseLoad >= 60) status = "medium";
      else status = "low";

      return {
        department: r.department,
        load_pct: Math.round(baseLoad),
        status,
      };
    });
  })();

  // --- Derived: surge peak outlook from predictions.daily_forecast ---
  const peakOutlook: PeakOutlook | null = (() => {
    if (!predictions || predictions.daily_forecast.length === 0) return null;
    const peak = predictions.daily_forecast.reduce((max, curr) =>
      curr.surge_pct > max.surge_pct ? curr : max
    );
    return {
      date: peak.date,
      surge_pct: peak.surge_pct,
    };
  })();

  // --- Derived: AI readiness score (simple composite metric) ---
  const readinessScore: number | null = (() => {
    if (!dashboard || !predictions) return null;

    const surgeScore = dashboard.surge_risk_indicator.score; // 0–100+
    const bedOcc = dashboard.todays_metrics.bed_occupancy_pct; // 0–100
    const highRiskDepts = predictions.department_risk.filter(
      (d) => d.risk_level === "high"
    ).length;

    // Start from 100, subtract penalties
    const surgePenalty = Math.min(40, surgeScore * 0.4);
    const bedPenalty = Math.min(30, (bedOcc - 70) * 1.0); // only >70% hurts
    const deptPenalty = Math.min(20, highRiskDepts * 5);

    const raw = 100 - surgePenalty - Math.max(0, bedPenalty) - deptPenalty;
    return Math.max(0, Math.min(100, Math.round(raw)));
  })();

  const readinessLevel: "low" | "medium" | "high" | null = (() => {
    if (readinessScore === null) return null;
    if (readinessScore >= 75) return "high";
    if (readinessScore >= 45) return "medium";
    return "low";
  })();

  // --- Derived: alerts based on current metrics & risks ---
  const alerts: Alert[] = (() => {
    const list: Alert[] = [];
    if (!dashboard) return list;

    const surge = dashboard.surge_risk_indicator;
    const metrics = dashboard.todays_metrics;
    const respDept = departmentLoad.find((d) =>
      d.department.toLowerCase().includes("respiratory")
    );

    if (surge.score >= 30) {
      list.push({
        id: "surge-high",
        message: `High surge risk today: ~${surge.score.toFixed(
          1
        )}% above baseline.`,
        severity: "critical",
      });
    } else if (surge.score >= 15) {
      list.push({
        id: "surge-medium",
        message: `Medium surge risk today: ~${surge.score.toFixed(
          1
        )}% above baseline.`,
        severity: "warning",
      });
    }

    if (metrics.aqi >= 300) {
      list.push({
        id: "aqi-critical",
        message: `AQI is ${metrics.aqi} (very poor) – respiratory surge expected.`,
        severity: "critical",
      });
    } else if (metrics.aqi >= 200) {
      list.push({
        id: "aqi-bad",
        message: `AQI is ${metrics.aqi} (poor) – monitor respiratory load.`,
        severity: "warning",
      });
    }

    if (metrics.bed_occupancy_pct >= 90) {
      list.push({
        id: "beds-critical",
        message: `Bed occupancy at ${metrics.bed_occupancy_pct}% – overflow plans must be active.`,
        severity: "critical",
      });
    } else if (metrics.bed_occupancy_pct >= 80) {
      list.push({
        id: "beds-high",
        message: `Bed occupancy at ${metrics.bed_occupancy_pct}% – ICU/HDU getting tight.`,
        severity: "warning",
      });
    }

    if (respDept && respDept.status !== "low") {
      list.push({
        id: "resp-dept",
        message: `Respiratory department projected load: ${respDept.load_pct}% (${respDept.status}).`,
        severity: respDept.status === "critical" ? "critical" : "warning",
      });
    }

    if (list.length === 0) {
      list.push({
        id: "all-good",
        message:
          "No critical alerts detected. Surge Shield is tracking for early risk signals.",
        severity: "info",
      });
    }

    return list;
  })();

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-4 md:p-6 space-y-4">
          {/* Header + actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold">
                Surge Operations Dashboard
              </h1>
              <p className="text-xs md:text-sm text-slate-400">
                Real-time view of current load, surge risk, and upcoming stress
                days.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => router.push("/predictions")}
                className="px-3 py-1.5 rounded-full border border-slate-700 text-[11px] hover:bg-slate-900"
              >
                View Predictions
              </button>
              <button
                onClick={() => router.push("/recommendations")}
                className="px-3 py-1.5 rounded-full border border-slate-700 text-[11px] hover:bg-slate-900"
              >
                Open AI Plan
              </button>
              <button
                onClick={() => router.push("/insights")}
                className="px-3 py-1.5 rounded-full border border-slate-700 text-[11px] hover:bg-slate-900"
              >
                View Insights
              </button>
              <button
                onClick={runAgent}
                disabled={runningAgent}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {runningAgent ? "Running AI Agent..." : "Run AI Agent"}
              </button>
              <button
                onClick={() => setAutoMode((v) => !v)}
                className={`px-3 py-1.5 rounded-full border text-[11px] ${
                  autoMode
                    ? "border-emerald-500 text-emerald-300 bg-emerald-950/40"
                    : "border-slate-700 hover:bg-slate-900"
                }`}
              >
                {autoMode ? "Auto Mode: ON" : "Auto Mode: OFF"}
              </button>

            </div>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-950/40 border border-red-800 px-4 py-2 rounded-xl">
              {error}
            </div>
          )}

          {loading && !dashboard && (
            <p className="text-sm text-slate-400">Loading dashboard...</p>
          )}

          {dashboard && (
            <div className="space-y-4">
              {/* Top summary row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card title="Surge Risk Indicator">
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-semibold">
                        {dashboard.surge_risk_indicator.score.toFixed(1)}%
                      </span>
                      <span className="px-2 py-1 rounded-full text-xs bg-slate-900 border border-slate-700 uppercase tracking-wide">
                        {dashboard.surge_risk_indicator.level}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Estimated increase over baseline admissions for today.
                    </p>
                  </div>
                </Card>

                <Card title="Predicted Admissions (Today)">
                  <p className="text-2xl font-semibold">
                    {dashboard.todays_metrics.predicted_admissions}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Baseline: {dashboard.todays_metrics.baseline_admissions}
                  </p>
                </Card>

                <Card title="Current AQI (City)">
                  <p className="text-2xl font-semibold">
                    {dashboard.todays_metrics.aqi}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Higher AQI ⇒ higher respiratory surge risk.
                  </p>
                </Card>

                <Card title="Bed Occupancy">
                  <p className="text-2xl font-semibold">
                    {dashboard.todays_metrics.bed_occupancy_pct}%
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Across critical wards (ER, ICU, General).
                  </p>
                </Card>
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Admissions – Next 7 Days">
                  <LineChart
                    data={dashboard.charts.admissions_7d}
                    dataKey="admissions"
                  />
                  <p className="mt-2 text-[11px] text-slate-400">
                    Short-term forecast used for daily staffing and bed
                    planning. For 14/30-day horizon and deeper analysis, switch
                    to the Predictions & Analysis view.
                  </p>
                </Card>
                <Card title="AQI Trend – Next 7 Days">
                  <LineChart data={dashboard.charts.aqi_7d} dataKey="aqi" />
                  <p className="mt-2 text-[11px] text-slate-400">
                    Rising AQI levels are a red flag for respiratory department
                    load and oxygen demand.
                  </p>
                </Card>
              </div>

              {/* New: Department load + surge peak + readiness & alerts */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card
                  title="Department Load Snapshot"
                  subtitle="Estimated load based on current surge and event mix."
                >
                  {departmentLoad.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      Department risk data not available yet.
                    </p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {departmentLoad.map((d) => (
                        <div
                          key={d.department}
                          className="space-y-1 bg-slate-900/60 rounded-lg px-2 py-1.5 border border-slate-800"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-100">
                              {d.department}
                            </span>
                            <span
                              className={`text-[11px] uppercase tracking-wide ${
                                d.status === "critical"
                                  ? "text-red-400"
                                  : d.status === "high"
                                  ? "text-orange-300"
                                  : d.status === "medium"
                                  ? "text-amber-300"
                                  : "text-emerald-300"
                              }`}
                            >
                              {d.status}
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full ${
                                d.status === "critical"
                                  ? "bg-red-500"
                                  : d.status === "high"
                                  ? "bg-orange-400"
                                  : d.status === "medium"
                                  ? "bg-amber-300"
                                  : "bg-emerald-400"
                              }`}
                              style={{ width: `${d.load_pct}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Projected load: {d.load_pct}% of safe capacity.
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card
                  title="Surge Peak Outlook"
                  subtitle="When the incoming wave is expected to hit hardest."
                >
                  {peakOutlook ? (
                    <div className="space-y-2 text-xs">
                      <p className="text-slate-300">
                        Peak projected around{" "}
                        <span className="font-semibold">
                          {new Date(
                            peakOutlook.date
                          ).toLocaleDateString()}
                        </span>
                        .
                      </p>
                      <p className="text-slate-300">
                        Surge above baseline on that day:
                        <span className="font-semibold text-emerald-300 ml-1">
                          {peakOutlook.surge_pct.toFixed(1)}%
                        </span>
                        .
                      </p>
                      <p className="text-[11px] text-slate-400">
                        This is the primary anchor day for staffing, elective
                        surgery deferrals, and temporary bed conversions.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      No surge horizon data available. Re-run the AI agent to
                      refresh forecasts.
                    </p>
                  )}
                </Card>

                <Card
                  title="AI Readiness & Alerts"
                  subtitle="How prepared the hospital is if the surge hits today."
                >
                  <div className="space-y-3 text-xs">
                    {readinessScore !== null && readinessLevel && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-[11px]">
                            Surge readiness score
                          </span>
                          <span className="text-sm font-semibold">
                            {readinessScore} / 100
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full ${
                              readinessLevel === "high"
                                ? "bg-emerald-400"
                                : readinessLevel === "medium"
                                ? "bg-amber-300"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${readinessScore}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Combines surge intensity, bed occupancy, and
                          department risk into one readiness indicator.
                        </p>
                      </div>
                    )}

                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-slate-200">
                        Live alerts
                      </p>
                      <div className="space-y-1 max-h-40 overflow-auto pr-1">
                        {alerts.map((a) => (
                          <div
                            key={a.id}
                            className={`text-[11px] px-2 py-1.5 rounded-lg border ${
                              a.severity === "critical"
                                ? "border-red-700 bg-red-950/40 text-red-200"
                                : a.severity === "warning"
                                ? "border-amber-600 bg-amber-950/40 text-amber-100"
                                : "border-slate-700 bg-slate-900/60 text-slate-200"
                            }`}
                          >
                            {a.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Upcoming events */}
              <Card
                title="Upcoming Surge Drivers"
                subtitle="Festivals, pollution spikes, and other events with projected impact."
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {dashboard.upcoming_events.length === 0 && (
                    <p className="text-xs text-slate-400">
                      No high-risk events detected in the next 14 days.
                    </p>
                  )}
                  {dashboard.upcoming_events.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-slate-100">
                          {ev.name}
                        </p>
                        <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[10px] uppercase tracking-wide">
                          {ev.type}
                        </span>
                      </div>
                      <p className="text-slate-400">
                        {new Date(ev.date).toLocaleDateString()}
                      </p>
                      <p className="text-slate-300 text-[11px]">
                        Typical surge:{" "}
                        <span className="font-semibold">
                          {ev.historical_avg_surge_pct.toFixed(1)}%
                        </span>
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        Risk areas: {ev.risk_categories.join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
