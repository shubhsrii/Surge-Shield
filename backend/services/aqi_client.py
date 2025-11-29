# backend/services/aqi_client.py
import os
from typing import Optional

import requests

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
# Default coords: Delhi (example); change to your target city
DEFAULT_LAT = float(os.getenv("HOSPITAL_LAT", "28.6139"))
DEFAULT_LON = float(os.getenv("HOSPITAL_LON", "77.2090"))


def fetch_current_aqi(lat: float | None = None, lon: float | None = None) -> Optional[int]:
    """
    Fetch current AQI from OpenWeather Air Pollution API.
    Returns integer AQI (1–5 scale from API) converted to approximate index like 0–500,
    or None on failure.
    """
    if not OPENWEATHER_API_KEY:
        return None

    lat = lat or DEFAULT_LAT
    lon = lon or DEFAULT_LON

    try:
        url = (
            "http://api.openweathermap.org/data/2.5/air_pollution"
            f"?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}"
        )
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        aqi_level = data["list"][0]["main"]["aqi"]  # 1..5
        # Rough mapping to 0–500-like AQI
        mapping = {1: 50, 2: 100, 3: 200, 4: 300, 5: 400}
        return mapping.get(aqi_level, 100)
    except Exception:
        return None
