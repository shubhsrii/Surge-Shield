from typing import Dict, Any
import numpy as np

from ..models import Event


def predict_event_surge(event: Event, context: Dict[str, Any]) -> float:
    """
    Stub for XGBoost-based prediction. For hackathon you can train
    an actual XGBoost model; here we use heuristics:
    - base is historical_avg_surge_pct
    - adjust with AQI and season
    """
    base = event.historical_avg_surge_pct
    aqi = context.get("aqi", 150)
    month = context.get("month", 10)

    # simple adjustments
    if aqi > 300:
        base += 10
    elif aqi > 200:
        base += 5

    if event.type == "epidemic":
        base += 15

    if month in (12, 1):  # winter
        base += 5

    rng = np.random.default_rng(seed=7)
    jitter = rng.normal(0, 3)
    return max(0.0, min(90.0, base + jitter))
