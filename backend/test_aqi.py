from backend.services.aqi_client import fetch_current_aqi

aqi = fetch_current_aqi()
print("Live AQI =", aqi)
