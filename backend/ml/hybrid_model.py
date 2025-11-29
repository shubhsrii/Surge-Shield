# backend/ml/hybrid_model.py
"""
Hybrid surge prediction model for Surge Shield.

Conceptual architecture:
- "LSTM-like" part: a simple time-series baseline (moving-average with weekly/seasonal pattern).
- "XGBoost-like" part: a Gradient Boosting model that learns surge_pct from
  event type, days-to-event, AQI, seasonality, etc.

This is lightweight enough for a hackathon, while still being honest about:
- learning from data
- combining temporal + event/context signals.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor


@dataclass
class ForecastPoint:
    date: date
    baseline_admissions: float
    total_admissions: float
    surge_pct: float
    aqi: float


class HybridSurgeModel:
    def __init__(self) -> None:
        # Tree-based "XGBoost-like" model for surge_pct
        self._gb: Optional[GradientBoostingRegressor] = None
        # Store synthetic training history (for baseline seeding)
        self._history: List[ForecastPoint] = []
        self._trained: bool = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def train(self, events: List[Dict[str, Any]]) -> None:
        """
        Train the hybrid model on 365 days of synthetic history.

        In a real deployment:
        - you would load historical admissions + AQI + events from DB.
        - LSTM would be a proper recurrent model.

        For hackathon:
        - we generate a realistic synthetic series that reacts to events & AQI
          and train a boosted tree model on it.
        """
        start_date = date.today() - timedelta(days=365)
        history = self._generate_synthetic_history(start_date, 365, events)
        self._history = history

        X: List[List[float]] = []
        y: List[float] = []
        for fp in history:
            feats = self._build_features(fp.date, fp.aqi, events)
            X.append(feats)
            y.append(fp.surge_pct)

        X_arr = np.array(X, dtype=float)
        y_arr = np.array(y, dtype=float)

        # Simple boosted trees (XGBoost-like behaviour)
        gb = GradientBoostingRegressor(
            n_estimators=150,
            max_depth=3,
            learning_rate=0.08,
            random_state=42,
        )
        gb.fit(X_arr, y_arr)

        self._gb = gb
        self._trained = True

    def forecast_horizon(
        self,
        start_date: date,
        horizon_days: int,
        events: List[Dict[str, Any]],
    ) -> List[ForecastPoint]:
        """
        Generate horizon_days of forecasts from start_date (inclusive).

        Uses:
        - a simple moving-average + seasonal pattern for baseline admissions
        - the learned boosted-tree model to estimate surge_pct given
          AQI + event context
        """
        if not self._trained or self._gb is None:
            self.train(events)

        # Use last 30 days of history to seed baseline
        if len(self._history) < 30:
            # As a fallback, regenerate some synthetic history
            hist = self._generate_synthetic_history(
                start_date - timedelta(days=365), 365, events
            )
            self._history = hist

        baseline_window = [
            fp.total_admissions for fp in self._history[-30:]
        ]

        current_date = start_date
        out: List[ForecastPoint] = []

        for _ in range(horizon_days):
            # "LSTM-like" baseline: moving average with weekly seasonality
            baseline = self._compute_baseline_from_window(
                current_date, baseline_window
            )

            # Simulated AQI (with bumps around pollution/festival events)
            aqi = self._simulate_aqi(current_date, events)

            # Tree model predicts surge_pct based on features
            feats = self._build_features(current_date, aqi, events)
            surge_pct = float(
                self._gb.predict(np.array(feats, dtype=float).reshape(1, -1))[0]
            )

            # Clamp surge_pct to a reasonable range
            surge_pct = max(-20.0, min(120.0, surge_pct))

            total = baseline * (1.0 + surge_pct / 100.0)

            fp = ForecastPoint(
                date=current_date,
                baseline_admissions=float(baseline),
                total_admissions=float(total),
                surge_pct=float(surge_pct),
                aqi=float(aqi),
            )
            out.append(fp)

            # Append to window for next step
            baseline_window.append(total)
            current_date += timedelta(days=1)

        return out

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _generate_synthetic_history(
        self,
        start_date: date,
        days: int,
        events: List[Dict[str, Any]],
    ) -> List[ForecastPoint]:
        """
        Generate synthetic but realistic daily series for training.

        Patterns:
        - Base level ~120–160 admissions with weekly & yearly seasonality.
        - AQI fluctuates 80–250, higher near pollution/festival events.
        - Surge % spikes near events and high AQI.
        """
        out: List[ForecastPoint] = []
        current_date = start_date

        # Preprocess events for quick lookup
        events_by_date = {
            self._as_date(ev["date"]): ev
            for ev in events
        }

        for i in range(days):
            doy = current_date.timetuple().tm_yday
            dow = current_date.weekday()

            # Base admissions: yearly + weekly sinusoidal pattern
            base_level = 130.0
            seasonal = 15.0 * np.sin(2 * np.pi * doy / 365.0)
            weekly = 10.0 * np.sin(2 * np.pi * dow / 7.0)
            noise = np.random.normal(0.0, 5.0)

            baseline = base_level + seasonal + weekly + noise

            # AQI base with some seasonal and random noise
            aqi_base = 110.0 + 30.0 * np.sin(2 * np.pi * doy / 365.0)
            aqi_noise = np.random.normal(0.0, 15.0)
            aqi = aqi_base + aqi_noise

            surge_pct = 0.0

            # Event-driven bumps
            ev = events_by_date.get(current_date)
            if ev is not None:
                hist_surge = float(ev.get("historical_avg_surge_pct", 40.0))
                ev_type = ev.get("type", "")
                if ev_type == "festival":
                    aqi += 80.0
                    surge_pct += hist_surge + np.random.normal(0.0, 5.0)
                elif ev_type == "pollution":
                    aqi += 60.0
                    surge_pct += hist_surge * 0.8 + np.random.normal(0.0, 5.0)
                else:
                    surge_pct += hist_surge * 0.5 + np.random.normal(0.0, 5.0)

            # AQI-driven respiratory surge
            if aqi >= 300:
                surge_pct += 35.0
            elif aqi >= 200:
                surge_pct += 18.0
            elif aqi >= 150:
                surge_pct += 8.0

            # Noise
            surge_pct += np.random.normal(0.0, 3.0)
            surge_pct = max(-10.0, min(120.0, surge_pct))

            total = baseline * (1.0 + surge_pct / 100.0)

            out.append(
                ForecastPoint(
                    date=current_date,
                    baseline_admissions=float(baseline),
                    total_admissions=float(total),
                    surge_pct=float(surge_pct),
                    aqi=float(aqi),
                )
            )
            current_date += timedelta(days=1)

        return out

    def _compute_baseline_from_window(
        self,
        current_date: date,
        window: List[float],
    ) -> float:
        """
        "LSTM-like" baseline: moving average of recent days + small weekly effect.
        """
        if not window:
            return 130.0

        recent = window[-7:] if len(window) >= 7 else window
        base = float(np.mean(recent))

        dow = current_date.weekday()
        weekly = 6.0 * np.sin(2 * np.pi * dow / 7.0)

        baseline = base + weekly
        return max(60.0, baseline)

    def _simulate_aqi(
        self,
        current_date: date,
        events: List[Dict[str, Any]],
    ) -> float:
        """
        Simulate AQI for a future day, with bumps near pollution/festival events.
        """
        doy = current_date.timetuple().tm_yday
        base = 120.0 + 25.0 * np.sin(2 * np.pi * doy / 365.0)
        noise = np.random.normal(0.0, 10.0)

        aqi = base + noise

        # If a pollution/festival event is close, bump AQI
        nearest_ev = self._nearest_event(current_date, events)
        if nearest_ev is not None:
            ev_date = self._as_date(nearest_ev["date"])
            delta_days = abs((ev_date - current_date).days)
            ev_type = nearest_ev.get("type", "")

            if delta_days <= 2:
                if ev_type == "festival":
                    aqi += 90.0
                elif ev_type == "pollution":
                    aqi += 70.0
            elif delta_days <= 5:
                if ev_type == "festival":
                    aqi += 40.0
                elif ev_type == "pollution":
                    aqi += 30.0

        return max(50.0, min(500.0, aqi))

    def _build_features(
        self,
        d: date,
        aqi: float,
        events: List[Dict[str, Any]],
    ) -> List[float]:
        """
        Build feature vector for the boosted-tree model.

        Features:
        - day_of_week (0-6)
        - month (1-12)
        - is_festival
        - is_pollution
        - days_to_next_event (clamped)
        - aqi
        - hist_surge_at_day (if event exists on that day, else 0)
        """
        dow = d.weekday()
        month = d.month

        # Identify event on this date (if any)
        ev_today = None
        for ev in events:
            if self._as_date(ev["date"]) == d:
                ev_today = ev
                break

        ev_type_today = ev_today["type"] if ev_today is not None else ""
        hist_surge_today = float(ev_today.get("historical_avg_surge_pct", 0.0)) if ev_today else 0.0

        is_festival = 1.0 if ev_type_today == "festival" else 0.0
        is_pollution = 1.0 if ev_type_today == "pollution" else 0.0

        # Nearest future event within 30 days
        nearest_future = self._nearest_event(d, events, future_only=True)
        if nearest_future is not None:
            delta = (self._as_date(nearest_future["date"]) - d).days
            days_to_next_event = float(max(0, min(30, delta)))
        else:
            days_to_next_event = 30.0

        return [
            float(dow),
            float(month),
            is_festival,
            is_pollution,
            days_to_next_event,
            float(aqi),
            hist_surge_today,
        ]

    @staticmethod
    def _as_date(x: Any) -> date:
        if isinstance(x, datetime):
            return x.date()
        if isinstance(x, date):
            return x
        # assume ISO string
        return datetime.fromisoformat(str(x)).date()

    @staticmethod
    def _nearest_event(
        current_date: date,
        events: List[Dict[str, Any]],
        future_only: bool = False,
    ) -> Optional[Dict[str, Any]]:
        nearest = None
        best_delta: Optional[int] = None

        for ev in events:
            ev_date = HybridSurgeModel._as_date(ev["date"])
            delta = (ev_date - current_date).days
            if future_only and delta < 0:
                continue
            abs_delta = abs(delta)
            if best_delta is None or abs_delta < best_delta:
                best_delta = abs_delta
                nearest = ev

        return nearest


# Global instance imported in main/orchestrator
hybrid_model = HybridSurgeModel()
