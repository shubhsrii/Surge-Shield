# backend/agent/orchestrator.py
"""
Agent orchestrator for Surge Shield.

Responsibilities:
- Call the hybrid ML model to forecast horizon_days into the future.
- Persist forecasts into MongoDB.
- Raise alerts for high-surge days and dangerous AQI.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Dict, Any, List

from backend.db import (
    events_coll,
    forecasts_coll,
    insert_alert,
)
from backend.ml.hybrid_model import hybrid_model, ForecastPoint


def _as_datetime(d: date) -> datetime:
    return datetime.combine(d, datetime.min.time())


def _upsert_forecast(fp: ForecastPoint) -> None:
    """
    Ensure a forecast document exists for this date with the latest values.
    """
    dt = _as_datetime(fp.date)
    forecasts_coll().update_one(
        {"date": dt},
        {
            "$set": {
                "date": dt,
                "baseline_admissions": float(fp.baseline_admissions),
                "total_admissions": float(fp.total_admissions),
                "surge_pct": float(fp.surge_pct),
                "aqi": float(fp.aqi),
            }
        },
        upsert=True,
    )


def _generate_alerts_for_forecast(
    fp: ForecastPoint,
    events: List[Dict[str, Any]],
) -> None:
    """
    Generate alerts based on surge_pct and AQI.

    - Critical if surge >= 60% or AQI >= 350
    - Warning if surge >= 30% or AQI >= 200
    """
    tags: List[str] = ["forecast"]
    level = None
    message = None

    surge = fp.surge_pct
    aqi = fp.aqi

    # Find event around this date for better messaging (±1 day)
    event_label = None
    for ev in events:
        ev_date = hybrid_model._as_date(ev["date"])  # type: ignore[attr-defined]
        if abs((ev_date - fp.date).days) <= 1:
            event_label = ev["name"]
            break

    if surge >= 60.0 or aqi >= 350.0:
        level = "critical"
        tags.append("high-surge")
        if event_label:
            message = (
                f"Critical surge risk (~{surge:.1f}% above baseline) near event "
                f"'{event_label}' on {fp.date.isoformat()} with AQI ≈ {aqi:.0f}."
            )
        else:
            message = (
                f"Critical surge risk (~{surge:.1f}% above baseline) detected on "
                f"{fp.date.isoformat()} with AQI ≈ {aqi:.0f}."
            )
    elif surge >= 30.0 or aqi >= 200.0:
        level = "warning"
        tags.append("surge-warning")
        if event_label:
            message = (
                f"Moderate surge risk (~{surge:.1f}% above baseline) around event "
                f"'{event_label}' on {fp.date.isoformat()} (AQI ≈ {aqi:.0f})."
            )
        else:
            message = (
                f"Moderate surge risk (~{surge:.1f}% above baseline) on "
                f"{fp.date.isoformat()} (AQI ≈ {aqi:.0f})."
            )

    if level and message:
        insert_alert(level=level, message=message, tags=tags)


def run_surge_agent(horizon_days: int = 14) -> Dict[str, Any]:
    """
    Main entry point used by /api/agent/run and startup.

    Steps:
    1. Load events from DB.
    2. Call hybrid_model.forecast_horizon() for the requested horizon.
    3. Upsert forecasts into Mongo.
    4. Generate alerts for high-risk days.
    5. Return summary for the API / frontend.
    """
    today = date.today()
    evs = list(events_coll().find({}))

    # Forecast horizon_days starting today
    fc_points: List[ForecastPoint] = hybrid_model.forecast_horizon(
        start_date=today,
        horizon_days=horizon_days,
        events=evs,
    )

    generated = 0
    alerts_created = 0
    max_surge = -999.0

    for fp in fc_points:
        _upsert_forecast(fp)
        generated += 1
        max_surge = max(max_surge, fp.surge_pct)

        prev_alert_count = alerts_created
        _generate_alerts_for_forecast(fp, evs)
        # We don't get alert count directly from DB, so we estimate via level logic:
        if fp.surge_pct >= 30.0 or fp.aqi >= 200.0:
            alerts_created += 1 if prev_alert_count == alerts_created else 0

    return {
        "horizon_days": horizon_days,
        "generated_forecasts": generated,
        "max_surge_pct": max_surge if max_surge > -999.0 else 0.0,
        "message": (
            "Hybrid LSTM-like + boosted-tree model ran successfully, "
            "forecasting surge risk and updating Mongo-backed forecasts."
        ),
    }
