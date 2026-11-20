"""
Wellness Toolkit Activity & IST Streak API backed by Cloud Firestore
(`users/{uid}/wellness_toolkit/{id}` and `users/{uid}/wellness_toolkit/_streak_summary`).
Uses `fs.record_wellness_activity_transactional` so concurrent submissions never race.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from app.core.security import get_current_user
from app.database.firestore_db import FirestoreOperationalRepository, get_firestore_repo

router = APIRouter(prefix="/api/v1/wellness", tags=["wellness"])


class ActivityCreate(BaseModel):
    activity_type: Literal["meditation", "breathing", "focus", "game", "thought_record", "journal"]
    activity_id: Optional[str] = Field(default=None, max_length=128)
    duration_seconds: Optional[int] = Field(default=None, ge=1, le=14400)
    completed_at: Optional[datetime] = None


@router.post("/activities", status_code=status.HTTP_201_CREATED)
async def log_wellness_activity(
    body: ActivityCreate,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    return await fs.record_wellness_activity_transactional(
        uid=user["uid"],
        activity_type=body.activity_type,
        activity_id=body.activity_id,
        duration_seconds=body.duration_seconds,
        completed_at=body.completed_at,
    )


@router.get("/activities")
async def list_wellness_activities(
    limit: int = Query(default=100, ge=1, le=500),
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    rows = await fs.list_collection(
        f"users/{user['uid']}/wellness_toolkit",
        filters=[("id", "!=", "_streak_summary")],
        order_by=[("completed_at", True)],
        limit=limit,
    )
    return [r for r in rows if "activity_type" in r]


@router.get("/streak")
async def get_wellness_streak(
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    summary = await fs.get_doc(f"users/{user['uid']}/wellness_toolkit/_streak_summary")
    if summary is None:
        return {
            "current_streak": 0,
            "longest_streak": 0,
            "total_points": 0,
            "activities_count": 0,
            "last_activity_date": None,
        }
    return summary
