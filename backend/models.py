from datetime import date, datetime
from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field


class Event(BaseModel):
    id: str
    name: str
    date: date
    type: Literal["festival", "pollution", "epidemic"]
    historical_avg_surge_pct: float
    risk_categories: List[str]


class DailyForecast(BaseModel):
    date: date
    total_admissions: int
    surge_pct: float
    baseline_admissions: int
    event_impact: int
    aqi: int
    risk_level: Literal["low", "medium", "high"]


class DepartmentRisk(BaseModel):
    department: str
    risk_level: Literal["low", "medium", "high"]
    risk_score: float  # 0–1


class AQIRespPoint(BaseModel):
    date: date
    aqi: int
    respiratory_cases: int


class DepartmentForecastPoint(BaseModel):
    date: date
    respiratory_cases: int
    cardiac_events: int
    trauma_cases: int
    maternity_cases: int
    neuro_cases: int


class CauseEffectChain(BaseModel):
    event_name: str
    event_date: date
    environmental_factors: str
    case_types: str
    department_impact: str
    narrative: str


class StaffRecommendation(BaseModel):
    department: str
    current_staff: int
    required_staff: int
    extra_staff: int
    reasoning: str


class SupplyRecommendation(BaseModel):
    item_name: str
    current_stock: int
    required_stock: int
    order_quantity: int
    priority: Literal["low", "medium", "high"]
    reasoning: str


class BedRecommendation(BaseModel):
    ward: str
    current_beds: int
    required_beds: int
    overflow_plan: str
    reasoning: str


class Advisory(BaseModel):
    target_group: str
    message: str
    send_timeline: str


class RecommendationPlan(BaseModel):
    event_id: str
    summary_reasoning: str
    staff: List[StaffRecommendation]
    supplies: List[SupplyRecommendation]
    beds: List[BedRecommendation]
    advisories: List[Advisory]
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class Insight(BaseModel):
    event_id: str
    event_name: str
    date: date
    predicted_surge_pct: float
    actual_surge_pct: float
    accuracy_pct: float
    notes: str


class DashboardSnapshot(BaseModel):
    surge_risk_indicator: Dict[str, Any]
    todays_metrics: Dict[str, Any]
    upcoming_events: List[Event]
    charts: Dict[str, Any]


class User(BaseModel):
    id: str
    email: str
    password_hash: str  # for hackathon demo -> plain text or simple hash
    name: str
