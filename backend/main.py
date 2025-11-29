# backend/main.py
from __future__ import annotations

from datetime import datetime, timedelta, date
from typing import Dict, Any, List

from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId

from backend.db import (
    events_coll,
    forecasts_coll,
    alerts_coll,
    plans_coll,
    seed_events_if_empty,
    insert_alert,
)
from backend.agent.orchestrator import run_surge_agent
from backend.ml.hybrid_model import hybrid_model

app = FastAPI(title="Surge Shield Backend")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Startup: seed events & train model once ----------

@app.on_event("startup")
def startup_event():
    sample_events = [
        {
            "name": "Diwali",
            "date": datetime.combine(
                date.today() + timedelta(days=5), datetime.min.time()
            ),
            "type": "festival",
            "historical_avg_surge_pct": 65.0,
            "risk_categories": ["respiratory", "burns", "trauma"],
        },
        {
            "name": "Winter Smog Wave",
            "date": datetime.combine(
                date.today() + timedelta(days=10), datetime.min.time()
            ),
            "type": "pollution",
            "historical_avg_surge_pct": 45.0,
            "risk_categories": ["respiratory", "cardiac"],
        },
    ]
    seed_events_if_empty(sample_events)
    events = list(events_coll().find({}))
    hybrid_model.train(events)


# ---------- Dashboard helper ----------

def _build_dashboard_response() -> Dict[str, Any]:
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())

    today_forecast = forecasts_coll().find_one(
        {"date": {"$gte": today_start, "$lte": today_end}}
    )

    predicted = today_forecast["total_admissions"] if today_forecast else 140
    baseline = today_forecast["baseline_admissions"] if today_forecast else 100
    surge_pct = (predicted - baseline) / max(baseline, 1) * 100.0
    aqi = today_forecast["aqi"] if today_forecast else 150
    bed_occ = 70 + min(25, surge_pct / 2)

    next7: List[Dict[str, Any]] = []
    aqi7: List[Dict[str, Any]] = []
    cur = forecasts_coll().find(
        {"date": {"$gte": today_start, "$lte": today_start + timedelta(days=7)}}
    ).sort("date", 1)
    for doc in cur:
        dt = doc["date"]
        next7.append(
            {
                "date": dt.strftime("%d %b"),
                "admissions": round(doc["total_admissions"]),
            }
        )
        aqi7.append({"date": dt.strftime("%d %b"), "aqi": int(doc["aqi"])})

    if not next7:
        for i in range(7):
            d = today + timedelta(days=i)
            next7.append(
                {"date": d.strftime("%d %b"), "admissions": 130 + i * 2}
            )
            aqi7.append({"date": d.strftime("%d %b"), "aqi": 140 + i * 5})

    events_cur = events_coll().find(
        {
            "date": {
                "$gte": today_start,
                "$lte": today_start + timedelta(days=14),
            }
        }
    ).sort("date", 1)
    events_data: List[Dict[str, Any]] = []
    for ev in events_cur:
        events_data.append(
            {
                "id": str(ev["_id"]),
                "name": ev["name"],
                "date": ev["date"].isoformat(),
                "type": ev["type"],
                "historical_avg_surge_pct": ev["historical_avg_surge_pct"],
                "risk_categories": ev["risk_categories"],
            }
        )

    risk_level = "low"
    if surge_pct >= 50:
        risk_level = "high"
    elif surge_pct >= 25:
        risk_level = "medium"

    return {
        "surge_risk_indicator": {
            "level": risk_level,
            "score": max(0.0, float(f"{surge_pct:.1f}")),
            "color": "#f97316",
        },
        "todays_metrics": {
            "predicted_admissions": int(round(predicted)),
            "baseline_admissions": int(round(baseline)),
            "aqi": int(aqi),
            "bed_occupancy_pct": int(round(min(100, bed_occ))),
        },
        "upcoming_events": events_data,
        "charts": {
            "admissions_7d": next7,
            "aqi_7d": aqi7,
        },
    }


# ---------- Helpers: AI recommendations & plans ----------

def _get_active_event_for_plan() -> Dict[str, Any] | None:
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())

    upcoming = list(
        events_coll()
        .find({"date": {"$gte": today_start}})
        .sort("date", 1)
        .limit(1)
    )
    if upcoming:
        return upcoming[0]

    latest = list(events_coll().find({}).sort("date", -1).limit(1))
    return latest[0] if latest else None


def _get_or_create_plan_for_event(ev: Dict[str, Any]) -> Dict[str, Any]:
    event_id = ev["_id"]
    existing = plans_coll().find_one({"event_id": event_id})
    if existing:
        return existing

    plan_doc: Dict[str, Any] = {
        "event_id": event_id,
        "event_name": ev["name"],
        "created_at": datetime.utcnow(),
        "staffing_applied": False,
        "supplies_ordered": False,
        "bed_plan_applied": False,
        "advisories_sent": False,
    }
    result = plans_coll().insert_one(plan_doc)
    plan_doc["_id"] = result.inserted_id
    return plan_doc


def _build_event_advisory_messages(ev: Dict[str, Any], aqi: int) -> List[Dict[str, str]]:
    name = ev["name"]
    ev_type = ev.get("type", "")
    risks = ev.get("risk_categories", [])

    messages: List[Dict[str, str]] = []

    if "respiratory" in risks:
        messages.append(
            {
                "audience": "Asthma / COPD / chronic respiratory patients",
                "message": (
                    f"During {name}, air quality is expected to worsen (AQI ≈ {aqi}). "
                    "Stay indoors during peak evening hours, keep rescue inhalers handy, "
                    "use N95 masks if stepping out, and avoid intense physical exertion."
                ),
            }
        )

    if "burns" in risks:
        messages.append(
            {
                "audience": "Families using firecrackers and open flames",
                "message": (
                    f"Firecracker-related burn injuries typically spike around {name}. "
                    "Use long-handled lighters, keep a bucket of water/sand nearby, "
                    "and do not allow unsupervised children to handle fireworks."
                ),
            }
        )

    if "trauma" in risks:
        messages.append(
            {
                "audience": "General public & emergency responders",
                "message": (
                    "Emergency department load from road traffic accidents and falls "
                    f"can double during {name}. Avoid drunk driving, wear helmets and "
                    "seatbelts, and follow traffic rules rigorously."
                ),
            }
        )

    if ev_type == "pollution":
        messages.append(
            {
                "audience": "Cardiac & elderly patients",
                "message": (
                    "Sustained poor air quality increases risk of cardiac events and "
                    "exacerbations. Take medications on time, monitor symptoms, and "
                    "seek care early if you experience chest pain or breathlessness."
                ),
            }
        )

    if not messages:
        messages.append(
            {
                "audience": "High-risk patients",
                "message": (
                    f"During {name}, the hospital expects a measurable surge in demand. "
                    "We advise you to keep medications stocked, avoid unnecessary exposure "
                    "to crowds, and contact the hospital helpline early if symptoms worsen."
                ),
            }
        )

    return messages


def _build_recommendations_response() -> Dict[str, Any]:
    ev = _get_active_event_for_plan()
    if not ev:
        raise HTTPException(status_code=404, detail="No events available for recommendations")

    plan = _get_or_create_plan_for_event(ev)

    ev_date: date = ev["date"].date() if isinstance(ev["date"], datetime) else ev["date"]
    start = datetime.combine(ev_date - timedelta(days=1), datetime.min.time())
    end = datetime.combine(ev_date + timedelta(days=1), datetime.max.time())

    fcast = list(
        forecasts_coll()
        .find({"date": {"$gte": start, "$lte": end}})
        .sort("date", 1)
    )

    if fcast:
        peak = max(fcast, key=lambda d: d.get("surge_pct", 0))
        peak_surge_pct = float(peak.get("surge_pct", 0))
        peak_total = float(peak.get("total_admissions", 140))
        peak_baseline = float(peak.get("baseline_admissions", 100))
        aqi = int(peak.get("aqi", 150))
    else:
        peak_surge_pct = ev.get("historical_avg_surge_pct", 40.0)
        peak_baseline = 120.0
        peak_total = peak_baseline * (1 + peak_surge_pct / 100.0)
        aqi = 160

    # Staffing: CURRENT vs REQUIRED
    current_nurses = int(round(peak_baseline * 0.35 / 10))
    current_doctors = int(round(peak_baseline * 0.12 / 15))
    current_support = int(round(peak_baseline * 0.25 / 15))

    extra_nurses = int(round((peak_total - peak_baseline) * 0.4 / 10))
    extra_doctors = max(2, int(round((peak_total - peak_baseline) * 0.18 / 18)))
    extra_support = int(round((peak_total - peak_baseline) * 0.3 / 15))

    required_nurses = current_nurses + max(0, extra_nurses)
    required_doctors = current_doctors + max(0, extra_doctors)
    required_support = current_support + max(0, extra_support)

    # Supplies: CURRENT vs REQUIRED
    base_oxygen = int(round(peak_baseline * 0.5 / 5))
    base_burn_kits = int(round(peak_baseline * 0.15 / 3))
    base_masks = int(round(peak_baseline * 1.0))
    base_vents = max(4, int(round(peak_baseline * 0.08 / 2)))

    extra_oxygen = int(round((peak_total - peak_baseline) * 0.7 / 5))
    extra_burn = int(round((peak_total - peak_baseline) * 0.25 / 3))
    extra_masks = int(round((peak_total - peak_baseline) * 1.2))
    extra_vents = max(1, int(round((peak_total - peak_baseline) * 0.12 / 2)))

    supplies_items = [
        {
            "name": "Oxygen cylinders",
            "current_qty": base_oxygen,
            "extra_qty": max(0, extra_oxygen),
            "required_qty": base_oxygen + max(0, extra_oxygen),
        },
        {
            "name": "Portable ventilators",
            "current_qty": base_vents,
            "extra_qty": max(0, extra_vents),
            "required_qty": base_vents + max(0, extra_vents),
        },
        {
            "name": "Burn dressing kits",
            "current_qty": base_burn_kits,
            "extra_qty": max(0, extra_burn),
            "required_qty": base_burn_kits + max(0, extra_burn),
        },
        {
            "name": "N95 masks",
            "current_qty": base_masks,
            "extra_qty": max(0, extra_masks),
            "required_qty": base_masks + max(0, extra_masks),
        },
    ]

    # Beds: CURRENT vs REQUIRED
    current_icu_beds = int(round(peak_baseline * 0.18))
    current_hdu_beds = int(round(peak_baseline * 0.22))
    current_stepdown_beds = int(round(peak_baseline * 0.3))

    extra_icu = int(round((peak_total - peak_baseline) * 0.22))
    extra_hdu = int(round((peak_total - peak_baseline) * 0.26))
    extra_stepdown = int(round((peak_total - peak_baseline) * 0.32))

    required_icu_beds = current_icu_beds + max(0, extra_icu)
    required_hdu_beds = current_hdu_beds + max(0, extra_hdu)
    required_stepdown_beds = current_stepdown_beds + max(0, extra_stepdown)

    # Advisories: messages only (no sending)
    advisory_messages = _build_event_advisory_messages(ev, aqi)
    target_groups = [msg["audience"] for msg in advisory_messages]

    return {
        "event": {
            "id": str(ev["_id"]),
            "name": ev["name"],
            "date": ev_date.isoformat(),
            "type": ev["type"],
            "historical_avg_surge_pct": ev["historical_avg_surge_pct"],
            "risk_categories": ev["risk_categories"],
            "aqi_context": aqi,
        },
        "staffing": {
            "summary": (
                f"Plan for {ev['name']}: increase frontline coverage from "
                f"{peak_baseline:.0f} baseline pts to ~{peak_total:.0f} surge pts "
                f"(~{peak_surge_pct:.1f}% uplift)."
            ),
            "current_nurses": current_nurses,
            "required_nurses": required_nurses,
            "extra_nurses": max(0, extra_nurses),
            "current_doctors": current_doctors,
            "required_doctors": required_doctors,
            "extra_doctors": max(0, extra_doctors),
            "current_support": current_support,
            "required_support": required_support,
            "extra_support": max(0, extra_support),
            "status": "applied" if plan.get("staffing_applied") else "pending",
        },
        "supplies": {
            "summary": (
                f"Scale up oxygen, ventilators and trauma kits to safely cover the projected "
                f"{peak_surge_pct:.1f}% surge without mid-crisis stockouts."
            ),
            "items": supplies_items,
            "status": "ordered" if plan.get("supplies_ordered") else "pending",
        },
        "beds": {
            "summary": (
                "Convert elective-capable wards into surge-ready capacity across ICU, HDU and step-down, "
                "so critical cases are not held in ER corridors."
            ),
            "current_icu_beds": current_icu_beds,
            "required_icu_beds": required_icu_beds,
            "current_hdu_beds": current_hdu_beds,
            "required_hdu_beds": required_hdu_beds,
            "current_stepdown_beds": current_stepdown_beds,
            "required_stepdown_beds": required_stepdown_beds,
            "status": "applied" if plan.get("bed_plan_applied") else "pending",
        },
        "advisories": {
            "summary": (
                f"Event-tailored public health advisories for {ev['name']} to reduce avoidable admissions."
            ),
            "target_groups": target_groups,
            "messages": advisory_messages,
            "status": "pending",
        },
    }


def _update_plan_flag(event_id: str, field: str, value: bool) -> Dict[str, Any]:
    ev_obj_id = ObjectId(event_id)
    plan = plans_coll().find_one({"event_id": ev_obj_id})
    if not plan:
        ev = events_coll().find_one({"_id": ev_obj_id})
        if not ev:
            raise HTTPException(status_code=404, detail="Event not found")
        plan = _get_or_create_plan_for_event(ev)

    plans_coll().update_one(
        {"_id": plan["_id"]},
        {"$set": {field: value}}
    )
    return plans_coll().find_one({"_id": plan["_id"]})


# ---------- Insights helper ----------

def _build_insights_response(window_days: int = 14) -> Dict[str, Any]:
    today = date.today()
    start_date = today - timedelta(days=window_days)
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(today, datetime.max.time())

    fcast_cur = (
        forecasts_coll()
        .find({"date": {"$gte": start_dt, "$lte": end_dt}})
        .sort("date", 1)
    )
    forecasts = list(fcast_cur)

    if forecasts:
        surge_values = [float(doc.get("surge_pct", 0.0)) for doc in forecasts]
        aqi_values = [int(doc.get("aqi", 0)) for doc in forecasts]
        max_doc = max(forecasts, key=lambda d: d.get("surge_pct", 0.0))

        avg_surge = sum(surge_values) / max(1, len(surge_values))
        max_surge = float(max_doc.get("surge_pct", 0.0))
        max_surge_date = max_doc["date"].date().isoformat()
        avg_aqi = sum(aqi_values) / max(1, len(aqi_values))
    else:
        avg_surge = 0.0
        max_surge = 0.0
        max_surge_date = today.isoformat()
        avg_aqi = 0.0

    events_cur = events_coll().find({}).sort("date", 1)
    event_insights: List[Dict[str, Any]] = []
    for ev in events_cur:
        ev_date = ev["date"].date() if isinstance(ev["date"], datetime) else ev["date"]
        event_insights.append(
            {
                "event_id": str(ev["_id"]),
                "name": ev["name"],
                "date": ev_date.isoformat(),
                "type": ev["type"],
                "historical_avg_surge_pct": float(ev["historical_avg_surge_pct"]),
                "risk_categories": ev["risk_categories"],
            }
        )

    plans_cur = plans_coll().find({})
    staffing_applied = 0
    supplies_ordered = 0
    bed_plans_applied = 0
    advisories_sent = 0
    for p in plans_cur:
        if p.get("staffing_applied"):
            staffing_applied += 1
        if p.get("supplies_ordered"):
            supplies_ordered += 1
        if p.get("bed_plan_applied"):
            bed_plans_applied += 1
        if p.get("advisories_sent"):
            advisories_sent += 1

    alerts_cur = alerts_coll().find({}).sort("created_at", -1)
    alerts = list(alerts_cur)
    total_alerts = len(alerts)
    crit = sum(1 for a in alerts if a.get("level") == "critical")
    warn = sum(1 for a in alerts if a.get("level") == "warning")
    info = sum(1 for a in alerts if a.get("level") == "info")

    recent_alerts: List[Dict[str, Any]] = []
    for a in alerts[:10]:
        recent_alerts.append(
            {
                "id": str(a["_id"]),
                "created_at": a["created_at"].isoformat(),
                "level": a["level"],
                "message": a["message"],
                "tags": a.get("tags", []),
            }
        )

    if max_surge >= 50:
        surge_sentence = (
            f"The AI detected at least one very high surge day (~{max_surge:.1f}% above "
            f"baseline on {max_surge_date}), prompting aggressive staffing and bed plans."
        )
    elif max_surge >= 25:
        surge_sentence = (
            f"Surge Shield expects moderate surges peaking at around {max_surge:.1f}% above "
            f"baseline on {max_surge_date}."
        )
    else:
        surge_sentence = (
            "Over the recent window, surge intensity has remained close to baseline activity."
        )

    if avg_aqi >= 300:
        aqi_sentence = (
            f"Average AQI over the analysis window is ~{avg_aqi:.0f}, firmly in the very-poor zone, "
            "which substantially increases respiratory and ICU load."
        )
    elif avg_aqi >= 200:
        aqi_sentence = (
            f"Average AQI of ~{avg_aqi:.0f} indicates poor air quality, making respiratory units a "
            "consistent bottleneck."
        )
    else:
        aqi_sentence = (
            f"Average AQI of ~{avg_aqi:.0f} suggests environment-driven respiratory surges are limited "
            "in this period."
        )

    narrative = (
        surge_sentence
        + " "
        + aqi_sentence
        + " Surge Shield continuously retrains its hybrid model on this evolving data to refine surge timing and magnitude."
    )

    return {
        "window_days": window_days,
        "summary": {
            "avg_surge_pct": avg_surge,
            "max_surge_pct": max_surge,
            "max_surge_date": max_surge_date,
            "avg_aqi": avg_aqi,
        },
        "event_insights": event_insights,
        "agent_actions": {
            "staffing_applied": staffing_applied,
            "supplies_ordered": supplies_ordered,
            "bed_plans_applied": bed_plans_applied,
            "advisories_sent": advisories_sent,
        },
        "alert_stats": {
            "total_alerts": total_alerts,
            "critical": crit,
            "warning": warn,
            "info": info,
        },
        "recent_alerts": recent_alerts,
        "narrative": narrative,
    }


# ---------- API endpoints ----------

@app.get("/api/dashboard")
def get_dashboard():
    return _build_dashboard_response()


@app.post("/api/agent/run")
def run_agent(horizon_days: int = 14):
    return run_surge_agent(horizon_days=horizon_days)


@app.get("/api/agent/run")
def run_agent_get(horizon_days: int = 14):
    return run_surge_agent(horizon_days=horizon_days)


@app.get("/api/predictions")
def get_predictions(horizon: int = 14):
    today = date.today()
    cur = forecasts_coll().find(
        {
            "date": {
                "$gte": datetime.combine(today, datetime.min.time()),
                "$lte": datetime.combine(
                    today + timedelta(days=horizon),
                    datetime.max.time(),
                ),
            }
        }
    ).sort("date", 1)
    forecasts = list(cur)
    if not forecasts:
        run_surge_agent(horizon_days=horizon)
        forecasts = list(
            forecasts_coll()
            .find(
                {
                    "date": {
                        "$gte": datetime.combine(today, datetime.min.time()),
                        "$lte": datetime.combine(
                            today + timedelta(days=horizon),
                            datetime.max.time(),
                        ),
                    }
                }
            )
            .sort("date", 1)
        )

    daily_forecast: List[Dict[str, Any]] = []
    aqi_vs_respiratory: List[Dict[str, Any]] = []
    department_forecast: List[Dict[str, Any]] = []

    for doc in forecasts:
        dt = doc["date"].date()
        total = float(doc["total_admissions"])
        baseline = float(doc["baseline_admissions"])
        surge = float(doc["surge_pct"])
        aqi = int(doc["aqi"])

        daily_forecast.append(
            {
                "date": dt.isoformat(),
                "total_admissions": total,
                "baseline_admissions": baseline,
                "surge_pct": surge,
                "event_impact": max(0.0, surge),
                "aqi": aqi,
                "risk_level": "high"
                if surge >= 50
                else "medium"
                if surge >= 25
                else "low",
            }
        )
        aqi_vs_respiratory.append(
            {
                "date": dt.isoformat(),
                "aqi": aqi,
                "respiratory_cases": int(total * 0.35),
            }
        )
        department_forecast.append(
            {
                "date": dt.isoformat(),
                "respiratory_cases": int(total * 0.35),
                "cardiac_events": int(total * 0.18),
                "trauma_cases": int(total * 0.15),
                "maternity_cases": int(total * 0.12),
                "neuro_cases": int(total * 0.08),
            }
        )

    avg_resp_load = (
        sum(df["respiratory_cases"] for df in department_forecast)
        / max(1, len(department_forecast))
    )
    avg_icu_load = avg_resp_load * 0.6
    avg_trauma_load = (
        sum(df["trauma_cases"] for df in department_forecast)
        / max(1, len(department_forecast))
    )

    department_risk = [
        {
            "department": "Respiratory & Pulmonology",
            "risk_level": "high" if avg_resp_load > 60 else "medium",
            "risk_score": min(1.0, avg_resp_load / 100.0),
        },
        {
            "department": "ICU / HDU",
            "risk_level": "medium" if avg_icu_load > 40 else "low",
            "risk_score": min(1.0, avg_icu_load / 80.0),
        },
        {
            "department": "Trauma & Emergency",
            "risk_level": "medium" if avg_trauma_load > 30 else "low",
            "risk_score": min(1.0, avg_trauma_load / 70.0),
        },
    ]

    highest = max(daily_forecast, key=lambda d: d["surge_pct"])
    cause_effect_chain = {
        "event_name": "Compound Surge Scenario",
        "event_date": highest["date"],
        "environmental_factors": f"AQI projected at {highest['aqi']} with sustained poor air quality.",
        "case_types": "Respiratory exacerbations, cardio-pulmonary stress, and trauma from seasonal activity.",
        "department_impact": "ER & Respiratory at 2x baseline, ICU/HDU occupancy under stress.",
        "narrative": (
            "The model detects that around this date, a combination of high AQI and seasonal "
            "stressors pushes respiratory and emergency cases far above baseline. Surge Shield "
            "uses this as the anchor day for staffing and bed conversion plans."
        ),
    }

    evs = list(events_coll().find({}).sort("date", 1))
    events_list: List[Dict[str, Any]] = []
    for ev in evs:
        events_list.append(
            {
                "id": str(ev["_id"]),
                "name": ev["name"],
                "date": ev["date"].date().isoformat(),
                "type": ev["type"],
                "historical_avg_surge_pct": ev["historical_avg_surge_pct"],
                "risk_categories": ev["risk_categories"],
            }
        )

    return {
        "horizon": horizon,
        "daily_forecast": daily_forecast,
        "events": events_list,
        "department_risk": department_risk,
        "aqi_vs_respiratory": aqi_vs_respiratory,
        "department_forecast": department_forecast,
        "cause_effect_chain": cause_effect_chain,
    }


@app.get("/api/alerts")
def get_alerts(limit: int = 20):
    cur = alerts_coll().find({}).sort("created_at", -1).limit(limit)
    out: List[Dict[str, Any]] = []
    for doc in cur:
        out.append(
            {
                "id": str(doc["_id"]),
                "created_at": doc["created_at"].isoformat(),
                "level": doc["level"],
                "message": doc["message"],
                "tags": doc.get("tags", []),
            }
        )
    return {"alerts": out}


@app.get("/api/insights")
def get_insights(window_days: int = 14):
    return _build_insights_response(window_days=window_days)


@app.get("/api/recommendations")
def get_recommendations():
    return _build_recommendations_response()


@app.post("/api/recommendations/staffing/apply")
def apply_staffing(event_id: str = Body(..., embed=True)):
    plan = _update_plan_flag(event_id, "staffing_applied", True)
    insert_alert(
        level="info",
        message=f"Staffing plan applied for event '{plan['event_name']}'.",
        tags=["staffing", "plan"],
    )
    return {"ok": True, "plan": plan}


@app.post("/api/recommendations/supplies/order")
def order_supplies(event_id: str = Body(..., embed=True)):
    plan = _update_plan_flag(event_id, "supplies_ordered", True)
    insert_alert(
        level="info",
        message=f"Supply order initiated for event '{plan['event_name']}'.",
        tags=["supplies", "plan"],
    )
    return {"ok": True, "plan": plan}


@app.post("/api/recommendations/beds/apply")
def apply_bed_plan(event_id: str = Body(..., embed=True)):
    plan = _update_plan_flag(event_id, "bed_plan_applied", True)
    insert_alert(
        level="info",
        message=f"Bed conversion plan applied for event '{plan['event_name']}'.",
        tags=["beds", "plan"],
    )
    return {"ok": True, "plan": plan}
