from __future__ import annotations

import uuid

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, JSON, String, func

from app.database.session import Base, GUID

_MOOD = Enum("peaceful", "joyful", "tired", "anxious", "overwhelmed", name="mood_type")


class MoodEntry(Base):
    __tablename__ = "mood_entries"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        String(128),
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mood = Column(_MOOD, nullable=False)
    intensity = Column(Integer, nullable=False)
    triggers = Column(JSON, nullable=False, default=list)
    note = Column(String(500), nullable=True)
    recorded_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
