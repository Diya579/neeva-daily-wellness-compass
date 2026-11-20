from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

MoodKey = Literal["peaceful", "joyful", "tired", "anxious", "overwhelmed"]

MOOD_SCORES: dict[str, int] = {
    "peaceful": 8,
    "joyful": 9,
    "tired": 5,
    "anxious": 4,
    "overwhelmed": 3,
}

MOOD_LABELS: dict[str, str] = {
    "peaceful": "Peaceful",
    "joyful": "Joyful",
    "tired": "Tired",
    "anxious": "Anxious",
    "overwhelmed": "Overwhelmed",
}


class MoodCreate(BaseModel):
    mood: MoodKey
    intensity: int = Field(..., ge=1, le=10)
    triggers: list[str] = Field(default_factory=list, max_length=8)
    note: Optional[str] = Field(default=None, max_length=500)
    recorded_at: Optional[datetime] = None


class MoodResponse(BaseModel):
    id: uuid.UUID
    mood: MoodKey
    intensity: int
    triggers: list[str]
    note: Optional[str] = None
    recorded_at: datetime
    score: int

    model_config = {"from_attributes": True}


class MoodAnalytics(BaseModel):
    period: Literal["week", "month"]
    entries_count: int
    mood_distribution: dict[str, int]
    average_intensity: float
    average_score: float
    trend_direction: Literal["improving", "steady", "declining", "insufficient_data"]
    most_common_mood: Optional[str] = None
    most_common_triggers: list[str]
    streak_days: int
    total_points: int

