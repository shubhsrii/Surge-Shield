// frontend/types/api.ts

export type EventType = "festival" | "pollution" | "epidemic";
export type RiskLevel = "low" | "medium" | "high";

export interface Event {
  id: string;
  name: string;
  date: string; // ISO string from backend
  type: EventType;
  historical_avg_surge_pct: number;
  risk_categories: string[];
}

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

export interface DashboardCharts {
  admissions_7d: { date: string; admissions: number }[];
  aqi_7d: { date: string; aqi: number }[];
}

export interface DashboardResponse {
  surge_risk_indicator: {
    level: RiskLevel;
    score: number;
    color: string;
  };
  todays_metrics: {
    predicted_admissions: number;
    baseline_admissions: number;
    aqi: number;
    bed_occupancy_pct: number;
  };
  upcoming_events: Event[];
  charts: DashboardCharts;
}

export interface PredictionsResponse {
  horizon: number;
  daily_forecast: DailyForecast[];
  events: Event[];
  department_risk: DepartmentRisk[];
  aqi_vs_respiratory: AQIRespPoint[];
  department_forecast: DepartmentForecastPoint[];
  cause_effect_chain?: CauseEffectChain | null;
}

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
  priority: "low" | "medium" | "high";
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

export interface LoginResponse {
  token: string;
  name: string;
}

export interface AgentRunResponse {
  status: string;
  overall_risk_level: RiskLevel;
  horizon_days: number;
}

export interface Alert {
  id: string;
  created_at: string;
  level: "info" | "warning" | "critical" | string;
  message: string;
  tags: string[];
}

export interface AlertsResponse {
  alerts: Alert[];
}

// --- AI Recommendations ---

export interface RecommendationEvent {
  id: string;
  name: string;
  date: string;
  type: string;
  historical_avg_surge_pct: number;
  risk_categories: string[];
  aqi_context: number;
}

export type RecommendationStatus =
  | "pending"
  | "applied"
  | "ordered"
  | "sent"
  | string;

export interface StaffingRecommendation {
  summary: string;
  current_nurses: number;
  required_nurses: number;
  extra_nurses: number;
  current_doctors: number;
  required_doctors: number;
  extra_doctors: number;
  current_support: number;
  required_support: number;
  extra_support: number;
  status: RecommendationStatus;
}

export interface SuppliesItem {
  name: string;
  current_qty: number;
  extra_qty: number;
  required_qty: number;
}

export interface SuppliesRecommendation {
  summary: string;
  items: SuppliesItem[];
  status: RecommendationStatus;
}

export interface BedsRecommendation {
  summary: string;
  current_icu_beds: number;
  required_icu_beds: number;
  current_hdu_beds: number;
  required_hdu_beds: number;
  current_stepdown_beds: number;
  required_stepdown_beds: number;
  status: RecommendationStatus;
}

export interface AdvisoryMessage {
  audience: string;
  message: string;
}

export interface AdvisoriesRecommendation {
  summary: string;
  target_groups: string[];
  messages: AdvisoryMessage[];
  status: RecommendationStatus;
}

export interface RecommendationsResponse {
  event: RecommendationEvent;
  staffing: StaffingRecommendation;
  supplies: SuppliesRecommendation;
  beds: BedsRecommendation;
  advisories: AdvisoriesRecommendation;
}


// --- Insights / AI performance ---

export interface InsightSummary {
  avg_surge_pct: number;
  max_surge_pct: number;
  max_surge_date: string;
  avg_aqi: number;
}

export interface InsightEvent {
  event_id: string;
  name: string;
  date: string;
  type: string;
  historical_avg_surge_pct: number;
  risk_categories: string[];
}

export interface AgentActionsSummary {
  staffing_applied: number;
  supplies_ordered: number;
  bed_plans_applied: number;
  advisories_sent: number;
}

export interface AlertStats {
  total_alerts: number;
  critical: number;
  warning: number;
  info: number;
}

export interface InsightAlert {
  id: string;
  created_at: string;
  level: string;
  message: string;
  tags: string[];
}

export interface InsightsResponse {
  window_days: number;
  summary: InsightSummary;
  event_insights: InsightEvent[];
  agent_actions: AgentActionsSummary;
  alert_stats: AlertStats;
  recent_alerts: InsightAlert[];
  narrative: string;
}
