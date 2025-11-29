from datetime import date, timedelta
from typing import List
import numpy as np

from ..models import DailyForecast


def forecast_patient_inflow(start_date: date, days_ahead: int) -> List[DailyForecast]:
    """
    Simple stub: generates baseline + random surge-like variations.
    Replace later with real LSTM model code.
    """
    forecasts: List[DailyForecast] = []
    rng = np.random.default_rng(seed=42)

    for i in range(days_ahead):
        d = start_date + timedelta(days=i)

        # baseline around 100 with some weekly seasonality
        baseline = 100 + 10 * np.sin(2 * np.pi * (d.timetuple().tm_yday % 7) / 7)
        noise = rng.normal(0, 5)
        baseline_admissions = int(max(60, baseline + noise))

        # fake aqi between 80 and 400
        aqi = int(rng.integers(80, 400))

        # surge % higher if AQI high
        surge_pct = 0.0
        if aqi > 300:
            surge_pct = rng.uniform(25, 60)
        elif aqi > 200:
            surge_pct = rng.uniform(10, 30)
        else:
            surge_pct = rng.uniform(0, 15)

        total_admissions = int(baseline_admissions * (1 + surge_pct / 100.0))
        event_impact = total_admissions - baseline_admissions

        if surge_pct < 10:
            risk_level = "low"
        elif surge_pct < 30:
            risk_level = "medium"
        else:
            risk_level = "high"

        forecasts.append(
            DailyForecast(
                date=d,
                baseline_admissions=baseline_admissions,
                total_admissions=total_admissions,
                surge_pct=round(surge_pct, 2),
                event_impact=event_impact,
                aqi=aqi,
                risk_level=risk_level,
            )
        )

    return forecasts
