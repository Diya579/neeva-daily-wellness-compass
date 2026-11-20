"""
Wellness Activity & Streak Service.
Calculates genuine streaks and points using Indian Standard Time (IST, UTC+05:30) day boundaries.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.wellness import WellnessActivity, WellnessStreak

IST_OFFSET = timedelta(hours=5, minutes=30)

ACTIVITY_POINTS: dict[str, int] = {
    "meditation": 20,
    "breathing": 10,
    "focus": 15,
    "game": 5,
    "thought_record": 25,
    "journal": 15,
}


async def record_activity(
    user_id: str,
    activity_type: str,
    activity_id: str | None,
    duration_seconds: int | None,
    db: AsyncSession,
) -> WellnessActivity:
    points = ACTIVITY_POINTS.get(activity_type, 5)
    now = datetime.now(timezone.utc)
    activity = WellnessActivity(
        id=uuid.uuid4(),
        user_id=user_id,
        activity_type=activity_type,
        activity_id=activity_id,
        duration_seconds=duration_seconds,
        points_earned=points,
        completed_at=now,
    )
    db.add(activity)

    today_ist = (now + IST_OFFSET).date()
    result = await db.execute(select(WellnessStreak).where(WellnessStreak.user_id == user_id))
    streak = result.scalar_one_or_none()

    if streak is None:
        streak = WellnessStreak(
            user_id=user_id,
            current_streak=1,
            longest_streak=1,
            last_activity_date=today_ist,
            total_points=points,
            updated_at=now,
        )
        db.add(streak)
    else:
        yesterday_ist = today_ist - timedelta(days=1)
        if streak.last_activity_date == today_ist:
            streak.total_points += points
        elif streak.last_activity_date == yesterday_ist:
            streak.current_streak += 1
            streak.total_points += points
            if streak.current_streak > streak.longest_streak:
                streak.longest_streak = streak.current_streak
            streak.last_activity_date = today_ist
        else:
            streak.current_streak = 1
            streak.total_points += points
            streak.last_activity_date = today_ist
        streak.updated_at = now

    await db.commit()
    await db.refresh(activity)
    return activity


async def get_streak_summary(user_id: str, db: AsyncSession) -> dict:
    result = await db.execute(select(WellnessStreak).where(WellnessStreak.user_id == user_id))
    streak = result.scalar_one_or_none()
    if streak is None:
        return {"current_streak": 0, "longest_streak": 0, "total_points": 0, "last_activity_date": None}
    return {
        "current_streak": streak.current_streak,
        "longest_streak": streak.longest_streak,
        "total_points": streak.total_points,
        "last_activity_date": streak.last_activity_date.isoformat(),
    }

