from datetime import date, datetime, timedelta
from typing import Dict, List

from ..models import Event, RecommendationPlan, Insight, DailyForecast, DashboardSnapshot

# pseudo-in-memory db
EVENTS: Dict[str, Event] = {}
FORECASTS: Dict[str, List[DailyForecast]] = {}
RECOMMENDATIONS: Dict[str, RecommendationPlan] = {}
INSIGHTS: List[Insight] = []
DASHBOARD_CACHE: DashboardSnapshot | None = None


def seed_fake_events():
    global EVENTS
    base_year = datetime.utcnow().year

    # mutate existing dict instead of rebinding
    EVENTS.clear()
    EVENTS.update(
        {
            "diwali": Event(
                id="diwali",
                name="Diwali",
                date=date(base_year, 10, 20),
                type="festival",
                historical_avg_surge_pct=60.0,
                risk_categories=["respiratory", "burns"],
            ),
            "post-diwali-pollution": Event(
                id="post-diwali-pollution",
                name="Post-Diwali Pollution Spike",
                date=date(base_year, 10, 21),
                type="pollution",
                historical_avg_surge_pct=50.0,
                risk_categories=["respiratory"],
            ),
            "winter-smog": Event(
                id="winter-smog",
                name="Winter Smog Wave",
                date=date(base_year, 12, 5),
                type="pollution",
                historical_avg_surge_pct=40.0,
                risk_categories=["respiratory", "cardio"],
            ),
        }
    )

def get_upcoming_events(days: int = 30) -> List[Event]:
    today = date.today()
    upcoming = []
    for ev in EVENTS.values():
        if 0 <= (ev.date - today).days <= days:
            upcoming.append(ev)
    return sorted(upcoming, key=lambda e: e.date)
    