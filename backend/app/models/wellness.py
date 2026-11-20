from __future__ import annotations

import uuid

from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, Integer, String, func

from app.database.session import Base, GUID

_ACTIVITY_TYPE = Enum(
    "meditation",
    "breathing",
    "focus",
    "game",
    "thought_record",
    "journal",
    name="wellness_activity_type",
)


class WellnessActivity(Base):
    __tablename__ = "wellness_activities"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        String(128), ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    activity_type = Column(_ACTIVITY_TYPE, nullable=False)
    activity_id = Column(String(128), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    points_earned = Column(Integer, nullable=False, default=0)
    completed_at = Column(DateTime(timezone=True), nullable=False)


class WellnessStreak(Base):
    __tablename__ = "wellness_streaks"

    user_id = Column(
        String(128), ForeignKey("user_profiles.id", ondelete="CASCADE"), primary_key=True
    )
    current_streak = Column(Integer, nullable=False, default=0)
    longest_streak = Column(Integer, nullable=False, default=0)
    last_activity_date = Column(Date, nullable=False)
    total_points = Column(Integer, nullable=False, default=0)
    updated_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
