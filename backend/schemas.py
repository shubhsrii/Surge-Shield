from datetime import date
from typing import List, Optional
from pydantic import BaseModel, EmailStr

from .models import (
    DailyForecast,
    RecommendationPlan,
    DashboardSnapshot,
    Insight,
    Event,
    DepartmentRisk,
    AQIRespPoint,
    DepartmentForecastPoint,
    CauseEffectChain,
)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    token: str
    name: str


class AgentRunRequest(BaseModel):
    horizon_days: int = 14


class AgentRunResponse(BaseModel):
    status: str
    overall_risk_level: str
    horizon_days: int


class PredictionsResponse(BaseModel):
    horizon: int
    daily_forecast: List[DailyForecast]
    events: List[Event]
    department_risk: List[DepartmentRisk]
    aqi_vs_respiratory: List[AQIRespPoint]
    department_forecast: List[DepartmentForecastPoint]
    cause_effect_chain: Optional[CauseEffectChain] = None


class RecommendationsResponse(BaseModel):
    plan: RecommendationPlan


class InsightsResponse(BaseModel):
    insights: List[Insight]


class DashboardResponse(DashboardSnapshot):
    pass
