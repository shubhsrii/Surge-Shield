"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import { Card } from "../components/ui/Card";
import { api } from "@/lib/api";
import AreaChart from "../components/charts/AreaChart";
import {
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Area as ReArea,
  AreaChart as ReAreaChart,
} from "recharts";
import type { PredictionsResponse, Event } from "@/types/api";

interface MergedForecastPoint {
  date: string;
  admissions: number;
  baseline: number;
}

interface AQIRespChartPoint {
  date: string;
  aqi: number;
  respiratory_cases: number;
}

interface DepartmentSeriesPoint {
  date: string;
  respiratory_cases: number;
  cardiac_events: number;
  trauma_cases: number;
  maternity_cases: number;
  neuro_cases: number;
}

interface SurgeSeriesPoint {
  date: string;
  surge_pct: number;
}

interface EventExplanation {
  id: string;
  name: string;
  date: string;
  type: string;
  predictedSurgePct: number | null;
  riskCategories: string[];
  explanation: string;
}

export default function PredictionsPage() {
  const [horizon, setHorizon] = useState(14);
  const [data, setData] = useState<PredictionsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (h: number) => {
    setLoading(true);
    try {
      const res = await api.getPredictions(h);
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(horizon);
  }, [horizon]);

  const mergedForecast: MergedForecastPoint[] =
    data?.daily_forecast.map((d) => ({
      date: d.date,
      admissions: d.total_admissions,
      baseline: d.baseline_admissions,
    })) ?? [];

  const aqiRespSeries: AQIRespChartPoint[] =
    data?.aqi_vs_respiratory.map((p) => ({
      date: p.date,
      aqi: p.aqi,
      respiratory_cases: p.respiratory_cases,
    })) ?? [];

  const deptSeries: DepartmentSeriesPoint[] =
    data?.department_forecast.map((d) => ({
      date: d.date,
      respiratory_cases: d.respiratory_cases,
      cardiac_events: d.cardiac_events,
      trauma_cases: d.trauma_cases,
      maternity_cases: d.maternity_cases,
      neuro_cases: d.neuro_cases,
    })) ?? [];

  const surgeSeries: SurgeSeriesPoint[] =
    data?.daily_forecast.map((d) => ({
      date: d.date,
      surge_pct: d.surge_pct,
    })) ?? [];

  const upcomingEventsExplained: EventExplanation[] =
    data?.events.map((ev: Event) => {
      const matchingForecast = data.daily_forecast.find(
        (f) => f.date === ev.date
      );
      const predictedSurge = matchingForecast?.surge_pct ?? null;
      const aqi = matchingForecast?.aqi ?? null;

      let explanationBase = "";

      if (ev.type === "festival") {
        explanationBase =
          "Festival-linked crowding and activities typically increase emergency visits and respiratory cases.";
      } else if (ev.type === "pollution") {
        explanationBase =
          "Sustained poor air quality drives respiratory exacerbations and cardio-pulmonary stress.";
      } else {
        explanationBase =
          "Ongoing epidemiological trends increase baseline admissions across multiple departments.";
      }

      if (aqi !== null && aqi >= 300) {
        explanationBase += " AQI is in the very poor zone, amplifying risk for vulnerable patients.";
      } else if (aqi !== null && aqi >= 200) {
        explanationBase += " AQI is poor, so respiratory and cardiac units should prepare for higher load.";
      }

      if (ev.risk_categories.includes("respiratory")) {
        explanationBase +=
          " Respiratory and ICU beds become key bottlenecks for this event.";
      }
      if (ev.risk_categories.includes("burns")) {
        explanationBase +=
          " Burns and trauma teams should anticipate higher ER throughput.";
      }

      return {
        id: ev.id,
        name: ev.name,
        date: ev.date,
        type: ev.type,
        predictedSurgePct: predictedSurge,
        riskCategories: ev.risk_categories,
        explanation: explanationBase,
      };
    }) ?? [];

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-4 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold">
                Predictions & Analysis
              </h1>
              <p className="text-xs md:text-sm text-slate-400">
                Forecasted patient inflow, surge patterns, and root-cause
                analysis for upcoming surges.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Horizon:</span>
              {[7, 14, 30].map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={`px-3 py-1.5 rounded-full border text-xs ${
                    horizon === h
                      ? "bg-primary-600 border-primary-500"
                      : "border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  {h} days
                </button>
              ))}
            </div>
          </div>

          {loading && !data && (
            <p className="text-sm text-slate-400">Loading predictions...</p>
          )}

          {data && (
            <div className="space-y-4">
              {/* Row 1: Main forecast + dept risk + cause-effect */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card title="Forecasted Admissions">
                  <AreaChart data={mergedForecast} dataKey="admissions" />
                  <p className="mt-2 text-[11px] text-slate-400">
                    This curve combines baseline activity with event-driven
                    surges. Surge Shield uses it to size staffing, beds, and
                    oxygen demand over the selected horizon.
                  </p>
                </Card>

                <Card title="Department-wise Risk Summary">
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400 mb-1">
                      <span>Department</span>
                      <span>Risk Level</span>
                      <span>Risk Score</span>
                    </div>
                    {data.department_risk.map((row) => (
                      <div
                        key={row.department}
                        className="grid grid-cols-3 gap-2 items-center text-[11px] bg-slate-900/80 border border-slate-800 rounded-lg px-2 py-1.5"
                      >
                        <span className="font-semibold text-slate-100">
                          {row.department}
                        </span>
                        <span
                          className={`uppercase tracking-wide ${
                            row.risk_level === "high"
                              ? "text-red-400"
                              : row.risk_level === "medium"
                              ? "text-amber-300"
                              : "text-emerald-300"
                          }`}
                        >
                          {row.risk_level}
                        </span>
                        <span className="text-slate-200">
                          {(row.risk_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                    <p className="mt-2 text-[11px] text-slate-400">
                      Risk scores synthesise surge intensity, AQI, and event
                      type to highlight which departments need the most
                      attention.
                    </p>
                  </div>
                </Card>

                <Card
                  title="Cause–Effect Chain Visualization"
                  subtitle="Event → Environment → Case Types → Department Impact"
                >
                  {data.cause_effect_chain ? (
                    <div className="space-y-2 text-[11px]">
                      <div className="flex flex-col gap-1">
                        <div>
                          <span className="font-semibold text-slate-200">
                            Event:
                          </span>{" "}
                          {data.cause_effect_chain.event_name} (
                          {new Date(
                            data.cause_effect_chain.event_date
                          ).toLocaleDateString()}
                          )
                        </div>
                        <div>
                          <span className="font-semibold text-slate-200">
                            Environmental factors:
                          </span>{" "}
                          {data.cause_effect_chain.environmental_factors}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-200">
                            Case types:
                          </span>{" "}
                          {data.cause_effect_chain.case_types}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-200">
                            Department impact:
                          </span>{" "}
                          {data.cause_effect_chain.department_impact}
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">
                        {data.cause_effect_chain.narrative}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">
                      No high-risk event detected in the current horizon. When a
                      major event is approaching, Surge Shield explains the full
                      chain from trigger to department impact here.
                    </p>
                  )}
                </Card>
              </div>

              {/* Row 2: Baseline vs forecast + surge intensity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card
                  title="Baseline vs Forecasted Admissions"
                  subtitle="How much of the volume is seasonal baseline versus surge."
                >
                  {mergedForecast.length ? (
                    <div className="w-full h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <ReLineChart data={mergedForecast}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#1e293b"
                          />
                          <XAxis
                            dataKey="date"
                            stroke="#64748b"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                          />
                          <YAxis
                            stroke="#64748b"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#020617",
                              borderRadius: 8,
                              border: "1px solid #0f172a",
                              color: "#e2e8f0",
                              fontSize: 12,
                            }}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: 11 }}
                            verticalAlign="top"
                            height={24}
                          />
                          <Line
                            type="monotone"
                            dataKey="baseline"
                            stroke="#64748b"
                            strokeWidth={2}
                            dot={false}
                            name="Baseline"
                          />
                          <Line
                            type="monotone"
                            dataKey="admissions"
                            stroke="#60a5fa"
                            strokeWidth={2}
                            dot={false}
                            name="Forecast"
                          />
                        </ReLineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      No forecast data available.
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-slate-400">
                    Where the blue line rises far above the grey baseline is
                    where Surge Shield expects true surge. These gaps are what
                    drive extra staffing and bed conversion plans.
                  </p>
                </Card>

                <Card
                  title="Surge Intensity Over Horizon"
                  subtitle="Daily surge percentage above baseline."
                >
                  {surgeSeries.length ? (
                    <div className="w-full h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <ReLineChart data={surgeSeries}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#1e293b"
                          />
                          <XAxis
                            dataKey="date"
                            stroke="#64748b"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                          />
                            <YAxis
                              stroke="#64748b"
                              tick={{ fontSize: 10 }}
                              tickFormatter={(v: number) => `${v}%`}
                              tickLine={false}
                            />

                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#020617",
                              borderRadius: 8,
                              border: "1px solid #0f172a",
                              color: "#e2e8f0",
                              fontSize: 12,
                            }}
                            formatter={(value: unknown) => [
                              `${value as number}%`,
                              "Surge",
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey="surge_pct"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={false}
                            name="Surge %"
                          />
                        </ReLineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      No surge data available.
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-slate-400">
                    This line highlights how aggressively admissions deviate
                    from normal. Peaks on this curve indicate days when elective
                    procedures may need to be rescheduled and overflow wards
                    activated.
                  </p>
                </Card>
              </div>

              {/* Row 3: AQI vs respiratory */}
              <Card
                title="AQI vs Respiratory Admissions"
                subtitle="How deteriorating air quality drives respiratory cases."
              >
                {aqiRespSeries.length ? (
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ReLineChart data={aqiRespSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis
                          dataKey="date"
                          stroke="#64748b"
                          tick={{ fontSize: 10 }}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#64748b"
                          tick={{ fontSize: 10 }}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#020617",
                            borderRadius: 8,
                            border: "1px solid #0f172a",
                            color: "#e2e8f0",
                            fontSize: 12,
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11 }}
                          verticalAlign="top"
                          height={24}
                        />
                        <Line
                          type="monotone"
                          dataKey="aqi"
                          stroke="#60a5fa"
                          strokeWidth={2}
                          dot={false}
                          name="AQI"
                        />
                        <Line
                          type="monotone"
                          dataKey="respiratory_cases"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                          name="Respiratory cases"
                        />
                      </ReLineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    No AQI/respiratory data available.
                  </p>
                )}
                <p className="mt-2 text-[11px] text-slate-400">
                  This correlation is what drives proactive ICU and oxygen
                  planning. As AQI crosses critical thresholds, Surge Shield
                  automatically raises risk levels for respiratory and
                  high-dependency units.
                </p>
              </Card>

              {/* Row 4: Department-wise forecast over time */}
              <Card
                title="Department-wise Admissions Forecast"
                subtitle="How different service lines contribute to the overall surge."
              >
                {deptSeries.length ? (
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ReAreaChart data={deptSeries}>
                        <defs>
                          <linearGradient
                            id="respFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#60a5fa"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#0f172a"
                              stopOpacity={0.1}
                            />
                          </linearGradient>
                          <linearGradient
                            id="cardFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#f97316"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#0f172a"
                              stopOpacity={0.1}
                            />
                          </linearGradient>
                          <linearGradient
                            id="traumaFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#22c55e"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#0f172a"
                              stopOpacity={0.1}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis
                          dataKey="date"
                          stroke="#64748b"
                          tick={{ fontSize: 10 }}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#64748b"
                          tick={{ fontSize: 10 }}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#020617",
                            borderRadius: 8,
                            border: "1px solid #0f172a",
                            color: "#e2e8f0",
                            fontSize: 12,
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11 }}
                          verticalAlign="top"
                          height={24}
                        />
                        <ReArea
                          type="monotone"
                          dataKey="respiratory_cases"
                          stackId="1"
                          stroke="#60a5fa"
                          fill="url(#respFill)"
                          name="Respiratory"
                        />
                        <ReArea
                          type="monotone"
                          dataKey="cardiac_events"
                          stackId="1"
                          stroke="#f97316"
                          fill="url(#cardFill)"
                          name="Cardiac"
                        />
                        <ReArea
                          type="monotone"
                          dataKey="trauma_cases"
                          stackId="1"
                          stroke="#22c55e"
                          fill="url(#traumaFill)"
                          name="Trauma"
                        />
                      </ReAreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    No department-level forecast available.
                  </p>
                )}
                <p className="mt-2 text-[11px] text-slate-400">
                  This breakdown explains which service lines are driving the
                  surge curve. It helps operations leads align specialists,
                  beds, and supplies with the type of demand expected, not just
                  the total volume.
                </p>
              </Card>

              {/* Row 5: Upcoming surge events with explanation */}
              <Card
                title="Upcoming Surge Events"
                subtitle="Event-level view of what is driving future surges."
              >
                {upcomingEventsExplained.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No upcoming surge-linked events in the selected horizon.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {upcomingEventsExplained.map((ev) => (
                      <div
                        key={ev.id}
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
                        {ev.predictedSurgePct !== null && (
                          <p className="text-slate-300 text-[11px]">
                            Predicted surge above baseline:{" "}
                            <span className="font-semibold">
                              {ev.predictedSurgePct.toFixed(1)}%
                            </span>
                          </p>
                        )}
                        <p className="text-slate-400 text-[11px]">
                          Risk areas: {ev.riskCategories.join(", ")}
                        </p>
                        <p className="text-[11px] text-slate-300 mt-1">
                          {ev.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-slate-400">
                  Each event blends historical patterns with current AQI and
                  seasonality to explain *why* a surge is expected and which
                  clinical teams will feel it first.
                </p>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
