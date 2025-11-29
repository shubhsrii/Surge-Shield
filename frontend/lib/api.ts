// frontend/lib/api.ts
import {
  AgentRunResponse,
  DashboardResponse,
  LoginResponse,
  PredictionsResponse,
  RecommendationsResponse,
  InsightsResponse,
  AlertsResponse, 
} from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }

  const json = (await res.json()) as T;
  return json;
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  getDashboard: () => request<DashboardResponse>("/api/dashboard"),

  runAgent: (horizonDays: number) =>
    request<AgentRunResponse>("/api/agent/run", {
      method: "POST",
      body: JSON.stringify({ horizon_days: horizonDays }),
    }),

  getPredictions: (horizon: number) =>
    request<PredictionsResponse>(`/api/predictions?horizon=${horizon}`),

  getInsights: () => request<InsightsResponse>("/api/insights"),
  
   getRecommendations: () => request<RecommendationsResponse>("/api/recommendations"),

  applyStaffingPlan: (eventId: string) =>
    request<{ ok: boolean }>("/api/recommendations/staffing/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId }),
    }),

  orderSupplies: (eventId: string) =>
    request<{ ok: boolean }>("/api/recommendations/supplies/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId }),
    }),

  applyBedPlan: (eventId: string) =>
    request<{ ok: boolean }>("/api/recommendations/beds/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId }),
    }),

  sendAdvisories: (eventId: string) =>
    request<{ ok: boolean }>("/api/recommendations/advisories/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId }),
    }),

  getAlerts: () => request<AlertsResponse>("/api/alerts"),
    stopRecommendations: (eventId: string) =>
    request<{ ok: boolean }>("/api/recommendations/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId }),
    }),

};
