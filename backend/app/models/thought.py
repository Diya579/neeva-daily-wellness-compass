from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, func

from app.database.session import Base, GUID


class ThoughtRecord(Base):
    __tablename__ = "thought_records"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        String(128), ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    situation = Column(String(500), nullable=False)
    automatic_thought = Column(String(500), nullable=False)
    emotions = Column(JSON, nullable=False, default=list)
    emotion_intensity_before = Column(Integer, nullable=False)
    thinking_patterns = Column(JSON, nullable=False, default=list)
    evidence_for = Column(String(500), nullable=False, default="")
    evidence_against = Column(String(500), nullable=False, default="")
    balanced_thought = Column(String(500), nullable=False, default="")
    emotion_intensity_after = Column(Integer, nullable=False, default=0)
    completed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
