"""
Wellness Toolkit Activity & IST Streak API backed by Cloud Firestore
(`users/{uid}/wellness_toolkit/{id}`).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

from app.core.security import get_current_user
from app.database.firestore_db import (
    ACTIVITY_POINTS,
    IST_OFFSET,
    FirestoreOperationalRepository,
    get_firestore_repo,
)

router = APIRouter(prefix="/api/v1/wellness", tags=["wellness"])


class ActivityCreate(BaseModel):
    activity_type: Literal["meditation", "breathing", "focus", "game", "thought_record", "journal"]
    activity_id: Optional[str] = Field(default=None, max_length=128)
    duration_seconds: Optional[int] = Field(default=None, ge=1, le=14400)


@router.post("/activities", status_code=status.HTTP_201_CREATED)
async def log_wellness_activity(
    body: ActivityCreate,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    await fs.ensure_user_profile(uid, user.get("name", ""))
    now = datetime.now(timezone.utc)
    points = ACTIVITY_POINTS.get(body.activity_type, 5)
    act_id = str(uuid.uuid4())
    doc = {
        "id": act_id,
        "user_id": uid,
        "activity_type": body.activity_type,
        "activity_id": body.activity_id,
        "duration_seconds": body.duration_seconds,
        "points_earned": points,
        "completed_at": now,
    }
    await fs.set_doc(f"users/{uid}/wellness_toolkit/{act_id}", doc)

    # Update IST streak summary atomically
    today_ist = (now + IST_OFFSET).date()
    summary = await fs.get_doc(f"users/{uid}/wellness_toolkit/_streak_summary")
    if summary is None:
        summary = {
            "current_streak": 1,
            "longest_streak": 1,
            "total_points": points,
            "last_activity_date": today_ist.isoformat(),
        }
    else:
        last_date = datetime.fromisoformat(summary["last_activity_date"]).date()
        yesterday = today_ist - timedelta(days=1)
        if last_date == today_ist:
            summary["total_points"] += points
        elif last_date == yesterday:
            summary["current_streak"] += 1
            summary["total_points"] += points
            summary["longest_streak"] = max(summary["longest_streak"], summary["current_streak"])
            summary["last_activity_date"] = today_ist.isoformat()
        else:
            summary["current_streak"] = 1
            summary["total_points"] += points
            summary["last_activity_date"] = today_ist.isoformat()

    await fs.set_doc(f"users/{uid}/wellness_toolkit/_streak_summary", summary)
    return {
        "id": act_id,
        "activity_type": body.activity_type,
        "points_earned": points,
        "completed_at": now.isoformat(),
        "streak": summary,
    }


@router.get("/streak")
async def get_wellness_streak(
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    summary = await fs.get_doc(f"users/{user['uid']}/wellness_toolkit/_streak_summary")
    if summary is None:
        return {"current_streak": 0, "longest_streak": 0, "total_points": 0, "last_activity_date": None}
    return summary
