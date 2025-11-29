"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import { Card } from "../components/ui/Card";
import { api } from "../../lib/api";
import type {
  RecommendationsResponse,
  RecommendationStatus,
  SuppliesItem,
  AdvisoryMessage,
} from "@/types/api";

type ActionKey = "staffing" | "supplies" | "beds";

export default function RecommendationsPage() {
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<ActionKey | null>(null);

  const loadPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getRecommendations();
      setData(res);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load AI recommendation plan.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlan();
  }, []);

  const runAction = async (key: ActionKey) => {
    if (!data) return;
    setActionLoading(key);
    setError(null);
    try {
      const eventId = data.event.id;
      if (key === "staffing") {
        await api.applyStaffingPlan(eventId);
      } else if (key === "supplies") {
        await api.orderSupplies(eventId);
      } else if (key === "beds") {
        await api.applyBedPlan(eventId);
      }
      await loadPlan();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Action failed. Please try again.");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadgeClass = (status: RecommendationStatus): string => {
    if (status === "applied" || status === "ordered" || status === "sent") {
      return "bg-emerald-900/50 text-emerald-300 border-emerald-500";
    }
    return "bg-slate-900 text-slate-300 border-slate-600";
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-4 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold">
                AI Surge Recommendations
              </h1>
              <p className="text-xs md:text-sm text-slate-400">
                Autonomous operating plan across staffing, supplies, beds, and
                advisory messages for the next surge-driving event.
              </p>
            </div>
            <button
              onClick={loadPlan}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs md:text-sm hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Refreshing plan..." : "Refresh AI Plan"}
            </button>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-950/40 border border-red-800 px-4 py-2 rounded-xl">
              {error}
            </div>
          )}

          {loading && !data && (
            <p className="text-sm text-slate-400">Loading AI plan...</p>
          )}

          {data && (
            <div className="space-y-4">
              {/* Event context */}
              <Card
                title="Event Context"
                subtitle="What the AI agent is planning for."
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-slate-400 text-[11px]">Event</p>
                    <p className="text-sm font-semibold text-slate-100">
                      {data.event.name}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Type:{" "}
                      <span className="uppercase tracking-wide">
                        {data.event.type}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[11px]">Date</p>
                    <p className="text-sm font-semibold text-slate-100">
                      {new Date(data.event.date).toLocaleDateString()}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Historical surge:{" "}
                      <span className="font-semibold">
                        {data.event.historical_avg_surge_pct.toFixed(1)}%
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[11px]">Risk Factors</p>
                    <p className="text-[11px] text-slate-300">
                      {data.event.risk_categories.join(", ")}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      AQI context:{" "}
                      <span className="font-semibold">
                        {data.event.aqi_context}
                      </span>{" "}
                      (higher AQI ⇒ more respiratory stress).
                    </p>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Staffing */}
                <Card
                  title="Staffing Optimization"
                  subtitle="CURRENT vs REQUIRED coverage for frontline teams."
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <p className="text-slate-300">{data.staffing.summary}</p>
                    <span
                      className={
                        "ml-2 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wide " +
                        statusBadgeClass(data.staffing.status)
                      }
                    >
                      {data.staffing.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3 text-[11px]">
                    <div className="bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-slate-400">Nurses</p>
                      <p className="text-sm font-semibold text-slate-100">
                        {data.staffing.current_nurses} →{" "}
                        {data.staffing.required_nurses}
                      </p>
                      <p className="text-[10px] text-emerald-300">
                        +{data.staffing.extra_nurses} needed
                      </p>
                    </div>
                    <div className="bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-slate-400">Doctors</p>
                      <p className="text-sm font-semibold text-slate-100">
                        {data.staffing.current_doctors} →{" "}
                        {data.staffing.required_doctors}
                      </p>
                      <p className="text-[10px] text-emerald-300">
                        +{data.staffing.extra_doctors} needed
                      </p>
                    </div>
                    <div className="bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-slate-400">
                        Support staff
                      </p>
                      <p className="text-sm font-semibold text-slate-100">
                        {data.staffing.current_support} →{" "}
                        {data.staffing.required_support}
                      </p>
                      <p className="text-[10px] text-emerald-300">
                        +{data.staffing.extra_support} needed
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => runAction("staffing")}
                    disabled={actionLoading === "staffing"}
                    className="mt-4 w-full inline-flex justify-center items-center px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {actionLoading === "staffing"
                      ? "Applying staffing plan..."
                      : data.staffing.status === "applied"
                      ? "Staffing plan applied"
                      : "Apply Staffing Plan"}
                  </button>
                </Card>

                {/* Supplies */}
                <Card
                  title="Supply Chain & Stock"
                  subtitle="CURRENT vs REQUIRED stock to ride out the surge safely."
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <p className="text-slate-300">{data.supplies.summary}</p>
                    <span
                      className={
                        "ml-2 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wide " +
                        statusBadgeClass(data.supplies.status)
                      }
                    >
                      {data.supplies.status}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-[11px]">
                    {(data.supplies?.items ?? []).map(
                      (item: SuppliesItem) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-1.5"
                        >
                          <div>
                            <p className="text-slate-200">{item.name}</p>
                            <p className="text-[10px] text-slate-400">
                              Current:{" "}
                              <span className="font-semibold">
                                {item.current_qty}
                              </span>{" "}
                              • Required:{" "}
                              <span className="font-semibold">
                                {item.required_qty}
                              </span>
                            </p>
                          </div>
                          <span className="text-[11px] text-emerald-300 font-semibold">
                            +{item.extra_qty}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                  <button
                    onClick={() => runAction("supplies")}
                    disabled={actionLoading === "supplies"}
                    className="mt-4 w-full inline-flex justify-center items-center px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {actionLoading === "supplies"
                      ? "Ordering supplies..."
                      : data.supplies.status === "ordered"
                      ? "Supplies ordered"
                      : "Order Medical Supplies"}
                  </button>
                </Card>

                {/* Beds */}
                <Card
                  title="Bed & Capacity Plan"
                  subtitle="CURRENT vs REQUIRED critical care capacity."
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <p className="text-slate-300">{data.beds.summary}</p>
                    <span
                      className={
                        "ml-2 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wide " +
                        statusBadgeClass(data.beds.status)
                      }
                    >
                      {data.beds.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center text-xs mt-3">
                    <div className="bg-slate-900/70 border border-slate-800 rounded-lg px-2 py-3">
                      <p className="text-[10px] text-slate-400 mb-1">
                        ICU spillover
                      </p>
                      <p className="text-sm font-semibold">
                        {data.beds.current_icu_beds} →{" "}
                        {data.beds.required_icu_beds}
                      </p>
                      <p className="text-[10px] text-emerald-300">
                        +
                        {data.beds.required_icu_beds -
                          data.beds.current_icu_beds}{" "}
                        beds
                      </p>
                    </div>
                    <div className="bg-slate-900/70 border border-slate-800 rounded-lg px-2 py-3">
                      <p className="text-[10px] text-slate-400 mb-1">
                        HDU beds
                      </p>
                      <p className="text-sm font-semibold">
                        {data.beds.current_hdu_beds} →{" "}
                        {data.beds.required_hdu_beds}
                      </p>
                      <p className="text-[10px] text-emerald-300">
                        +
                        {data.beds.required_hdu_beds -
                          data.beds.current_hdu_beds}{" "}
                        beds
                      </p>
                    </div>
                    <div className="bg-slate-900/70 border border-slate-800 rounded-lg px-2 py-3">
                      <p className="text-[10px] text-slate-400 mb-1">
                        Step-down beds
                      </p>
                      <p className="text-sm font-semibold">
                        {data.beds.current_stepdown_beds} →{" "}
                        {data.beds.required_stepdown_beds}
                      </p>
                      <p className="text-[10px] text-emerald-300">
                        +
                        {data.beds.required_stepdown_beds -
                          data.beds.current_stepdown_beds}{" "}
                        beds
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => runAction("beds")}
                    disabled={actionLoading === "beds"}
                    className="mt-4 w-full inline-flex justify-center items-center px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {actionLoading === "beds"
                      ? "Applying bed plan..."
                      : data.beds.status === "applied"
                      ? "Bed plan applied"
                      : "Apply Bed Conversion Plan"}
                  </button>
                </Card>

                {/* Advisories */}
                <Card
                  title="Patient Advisory Messages"
                  subtitle="Event-specific messages to reduce avoidable admissions (display only)."
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <p className="text-slate-300">{data.advisories.summary}</p>
                    <span
                      className={
                        "ml-2 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wide " +
                        statusBadgeClass(data.advisories.status)
                      }
                    >
                      {data.advisories.status}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-[11px]">
                    {(data.advisories?.messages ?? []).map(
                      (msg: AdvisoryMessage, idx: number) => (
                        <div
                          key={idx}
                          className="bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-2"
                        >
                          <p className="font-semibold text-slate-100 mb-1">
                            Audience: {msg.audience}
                          </p>
                          <p className="text-slate-300 leading-relaxed">
                            {msg.message}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                  <p className="mt-3 text-[10px] text-slate-400">
                    These messages are generated by the agent and can be handed
                    off to the hospital&apos;s SMS/WhatsApp gateway or call
                    center systems. No outbound sending is executed directly
                    from Surge Shield in this demo.
                  </p>
                </Card>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
