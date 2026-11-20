"""
Mood Tracking, IST Streaks & Analytics API backed by Cloud Firestore
(`users/{uid}/mood_logs/{id}` and `users/{uid}/mood_streaks/summary`).
"""
from __future__ import annotations

import csv
import io
import json
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse

from app.core.security import get_current_user
from app.database.firestore_db import FirestoreOperationalRepository, get_firestore_repo
from app.schemas.mood import MOOD_LABELS, MOOD_SCORES, MoodAnalytics, MoodCreate, MoodResponse

router = APIRouter(prefix="/api/v1/moods", tags=["mood"])

IST_OFFSET = timedelta(hours=5, minutes=30)


def calculate_ist_streak(timestamps: list[datetime], now_utc: datetime | None = None) -> int:
    if not timestamps:
        return 0
    ref = now_utc or datetime.now(timezone.utc)
    today_ist = (ref + IST_OFFSET).date()
    dates_ist = {(ts + IST_OFFSET).date() for ts in timestamps}
    cursor = today_ist if today_ist in dates_ist else (today_ist - timedelta(days=1))
    streak = 0
    while cursor in dates_ist:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def compute_mood_trend(scores: list[int]) -> Literal["improving", "steady", "declining", "insufficient_data"]:
    if len(scores) < 2:
        return "insufficient_data"
    mid = len(scores) // 2
    first_avg = sum(scores[:mid]) / len(scores[:mid])
    second_avg = sum(scores[mid:]) / len(scores[mid:])
    diff = second_avg - first_avg
    if diff >= 0.75:
        return "improving"
    if diff <= -0.75:
        return "declining"
    return "steady"


@router.post("", response_model=MoodResponse, status_code=status.HTTP_201_CREATED)
async def create_mood(
    body: MoodCreate,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    doc = await fs.create_mood_log(
        uid=user["uid"],
        mood=body.mood,
        intensity=body.intensity,
        triggers=body.triggers,
        note=body.note,
        recorded_at=body.recorded_at,
    )
    return MoodResponse(**doc)


@router.get("", response_model=list[MoodResponse])
async def list_moods(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    rows = await fs.list_collection(
        f"users/{user['uid']}/mood_logs",
        order_by=[("recorded_at", True)],
        limit=limit,
        offset=offset,
    )
    return [MoodResponse(**r) for r in rows]


@router.get("/analytics", response_model=MoodAnalytics)
async def get_mood_analytics(
    period: Literal["week", "month"] = Query(default="week"),
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    now = datetime.now(timezone.utc)
    days = 7 if period == "week" else 30
    cutoff = now - timedelta(days=days)

    rows = await fs.list_collection(
        f"users/{user['uid']}/mood_logs",
        filters=[("recorded_at", ">=", cutoff)],
        order_by=[("recorded_at", False)],
        limit=500,
    )

    if not rows:
        return MoodAnalytics(
            period=period,
            entries_count=0,
            mood_distribution={},
            average_intensity=0.0,
            average_score=0.0,
            trend_direction="insufficient_data",
            most_common_mood=None,
            most_common_triggers=[],
            streak_days=0,
            total_points=0,
        )

    mood_counts = Counter(r["mood"] for r in rows)
    trigger_counts = Counter(t for r in rows for t in (r.get("triggers") or []))
    scores = [MOOD_SCORES[r["mood"]] for r in rows]
    streak = calculate_ist_streak([r["recorded_at"] for r in rows], now_utc=now)

    return MoodAnalytics(
        period=period,
        entries_count=len(rows),
        mood_distribution=dict(mood_counts),
        average_intensity=round(sum(r["intensity"] for r in rows) / len(rows), 2),
        average_score=round(sum(scores) / len(scores), 2),
        trend_direction=compute_mood_trend(scores),
        most_common_mood=mood_counts.most_common(1)[0][0] if mood_counts else None,
        most_common_triggers=[t for t, _ in trigger_counts.most_common(5)],
        streak_days=streak,
        total_points=len(rows) * 10,
    )


@router.get("/export")
async def export_moods(
    format: Literal["csv", "json"] = Query(default="json"),
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    rows = await fs.list_collection(
        f"users/{user['uid']}/mood_logs",
        order_by=[("recorded_at", False)],
        limit=500,
    )
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if format == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf, lineterminator="\n")
        writer.writerow(["date", "time", "mood", "mood_score", "intensity", "triggers"])
        for r in rows:
            ist_dt = r["recorded_at"] + IST_OFFSET
            writer.writerow(
                [
                    ist_dt.strftime("%Y-%m-%d"),
                    ist_dt.strftime("%H:%M"),
                    MOOD_LABELS[r["mood"]],
                    MOOD_SCORES[r["mood"]],
                    r["intensity"],
                    "; ".join(r.get("triggers") or []),
                ]
            )
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv;charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="neeva-moods-{stamp}.csv"'},
        )

    payload = {
        "app": "Neeva",
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "moods": [
            {
                "at": r["recorded_at"].isoformat(),
                "mood": r["mood"],
                "label": MOOD_LABELS[r["mood"]],
                "score": MOOD_SCORES[r["mood"]],
                "intensity": r["intensity"],
                "triggers": r.get("triggers") or [],
            }
            for r in rows
        ],
    }
    return StreamingResponse(
        iter([json.dumps(payload, indent=2)]),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="neeva-moods-{stamp}.json"'},
    )
