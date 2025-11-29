// Shared types that mirror your FastAPI backend responses

export type RiskLevel = "low" | "medium" | "high";

export type EventType = "festival" | "pollution" | "epidemic";

export interface EventDTO {
  id: string;
  name: string;
  date: string; // ISO
  type: EventType;
  historical_avg_surge_pct: number;
  risk_categories: string[];
}

/* ---------- Dashboard ---------- */

export interface DashboardCharts {
  admissions_7d: { date: string; admissions: number }[];
  aqi_7d: { date: string; aqi: number }[];
}

export interface DashboardResponse {
  surge_risk_indicator: {
    level: string;
    score: number;
    color: string;
  };
  todays_metrics: {
    predicted_admissions: number;
    baseline_admissions: number;
    aqi: number;
    bed_occupancy_pct: number;
  };
  upcoming_events: EventDTO[];
  charts: DashboardCharts;
}

/* ---------- Predictions ---------- */

export interface DailyForecast {
  date: string;
  total_admissions: number;
  surge_pct: number;
  baseline_admissions: number;
  event_impact: number;
  aqi: number;
  risk_level: RiskLevel;
}

export interface DepartmentRisk {
  department: string;
  risk_level: RiskLevel;
  risk_score: number; // 0–1
}

export interface AQIRespPoint {
  date: string;
  aqi: number;
  respiratory_cases: number;
}

export interface DepartmentForecastPoint {
  date: string;
  respiratory_cases: number;
  cardiac_events: number;
  trauma_cases: number;
  maternity_cases: number;
  neuro_cases: number;
}

export interface CauseEffectChain {
  event_name: string;
  event_date: string;
  environmental_factors: string;
  case_types: string;
  department_impact: string;
  narrative: string;
}

export interface PredictionsResponse {
  horizon: number;
  daily_forecast: DailyForecast[];
  events: EventDTO[];
  department_risk: DepartmentRisk[];
  aqi_vs_respiratory: AQIRespPoint[];
  department_forecast: DepartmentForecastPoint[];
  cause_effect_chain?: CauseEffectChain | null;
}

/* ---------- Recommendations ---------- */

export type PriorityLevel = "low" | "medium" | "high";

export interface StaffRecommendation {
  department: string;
  current_staff: number;
  required_staff: number;
  extra_staff: number;
  reasoning: string;
}

export interface SupplyRecommendation {
  item_name: string;
  current_stock: number;
  required_stock: number;
  order_quantity: number;
  priority: PriorityLevel;
  reasoning: string;
}

export interface BedRecommendation {
  ward: string;
  current_beds: number;
  required_beds: number;
  overflow_plan: string;
  reasoning: string;
}

export interface Advisory {
  target_group: string;
  message: string;
  send_timeline: string;
}

export interface RecommendationPlan {
  event_id: string;
  summary_reasoning: string;
  staff: StaffRecommendation[];
  supplies: SupplyRecommendation[];
  beds: BedRecommendation[];
  advisories: Advisory[];
  generated_at: string;
}

export interface RecommendationsResponse {
  plan: RecommendationPlan;
}

/* ---------- Insights ---------- */

export interface Insight {
  event_id: string;
  event_name: string;
  date: string;
  predicted_surge_pct: number;
  actual_surge_pct: number;
  accuracy_pct: number;
  notes: string;
}

export interface InsightsResponse {
  insights: Insight[];
}

/* ---------- Auth ---------- */

export interface LoginResponse {
  token: string;
  name: string;
}
