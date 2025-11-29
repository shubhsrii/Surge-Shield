# backend/db.py
import os
from datetime import datetime
from typing import Any, Dict, List

from pymongo import MongoClient

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "surge_shield")

_client: MongoClient | None = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URL)
    return _client


def get_db():
    return get_client()[DB_NAME]


# --- Helper functions for collections ---

def events_coll():
    return get_db()["events"]


def forecasts_coll():
    return get_db()["forecasts"]


def alerts_coll():
    return get_db()["alerts"]


def plans_coll():
    return get_db()["recommendation_plans"]


def seed_events_if_empty(sample_events: List[Dict[str, Any]]) -> None:
    """
    Seed events collection if it's empty.
    """
    coll = events_coll()
    if coll.count_documents({}) == 0:
        for ev in sample_events:
            coll.insert_one(ev)


def insert_alert(level: str, message: str, tags: List[str] | None = None) -> None:
    alerts_coll().insert_one(
        {
            "created_at": datetime.utcnow(),
            "level": level,
            "message": message,
            "tags": tags or [],
        }
    )
