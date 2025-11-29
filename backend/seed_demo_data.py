# backend/seed_demo_data.py
from __future__ import annotations

import math
import random
from datetime import date, datetime, timedelta
from typing import List, Dict, Any

from backend.db import events_coll, forecasts_coll


def _load_events() -> List[Dict[str, Any]]:
    return list(events_coll().find({}))


def seed_demo_forecasts(days_past: int = 30, days_future: int = 30) -> None:
    """
    Generate synthetic but rich forecast data for:
      - last `days_past` days
      - next `days_future` days
    with clear surges around configured events.
    """
    today = date.today()
    start_day = today - timedelta(days=days_past)
    end_day = today + timedelta(days=days_future)

    events = _load_events()
    events_by_date: Dict[date, Dict[str, Any]] = {}
    for ev in events:
        ev_dt = ev["date"]
        if isinstance(ev_dt, datetime):
            ev_dt = ev_dt.date()
        events_by_date[ev_dt] = ev

    docs = []
    cur_day = start_day
    while cur_day <= end_day:
        # Baseline with weekly + slight seasonal pattern
        day_index = (cur_day - start_day).days
        base = 120.0
        weekly = 10.0 * math.sin(2 * math.pi * (day_index % 7) / 7.0)
        seasonal = 15.0 * math.sin(2 * math.pi * (day_index % 30) / 30.0)
        noise = random.gauss(0, 5)

        baseline_adm = max(60.0, base + weekly + seasonal + noise)

        # Default AQI
        aqi = random.randint(90, 150)

        # Look for events +/- 1 day
        ev = None
        for ed, e in events_by_date.items():
            if abs((ed - cur_day).days) <= 1:
                ev = e
                break

        surge_mult = 0.0

        if ev:
            if ev["type"] == "festival":
                # Strong Diwali-like surge
                surge_mult = 0.65
                aqi = random.randint(280, 400)
            elif ev["type"] == "pollution":
                surge_mult = 0.45
                aqi = random.randint(250, 360)

        # If no specific event but AQI is high from noise, add mild uplift
        if not ev and aqi >= 220:
            surge_mult = max(surge_mult, 0.25)

        # Add a little random surge on normal days so it's not flat
        if surge_mult == 0.0:
            random_uplift = random.uniform(-0.05, 0.15)  # -5% to +15%
            surge_mult = max(0.0, random_uplift)

        total_adm = baseline_adm * (1.0 + surge_mult)
        surge_pct = surge_mult * 100.0

        docs.append(
            {
                "date": datetime.combine(cur_day, datetime.min.time()),
                "baseline_admissions": baseline_adm,
                "total_admissions": total_adm,
                "surge_pct": surge_pct,
                "aqi": aqi,
            }
        )

        cur_day += timedelta(days=1)

    # Remove old overlapping forecasts and insert new ones
    start_dt = datetime.combine(start_day, datetime.min.time())
    end_dt = datetime.combine(end_day, datetime.max.time())
    forecasts_coll().delete_many(
        {"date": {"$gte": start_dt, "$lte": end_dt}}
    )

    if docs:
        forecasts_coll().insert_many(docs)

    print(
        f"Seeded demo forecasts for {len(docs)} days "
        f"({start_day.isoformat()} to {end_day.isoformat()})"
    )


if __name__ == "__main__":
    seed_demo_forecasts()
