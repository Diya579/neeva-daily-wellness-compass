from __future__ import annotations

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, LargeBinary, String, func

from app.database.session import Base, GUID


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        String(128), ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    prompt = Column(String(300), nullable=False)
    content_ciphertext = Column(LargeBinary, nullable=True)
    content_iv = Column(LargeBinary, nullable=True)
    analysis_json = Column(JSON, nullable=True)
    analysis_source = Column(String(16), nullable=True)
    word_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class JournalDraft(Base):
    __tablename__ = "journal_drafts"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        String(128), ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    prompt = Column(String(300), nullable=False)
    content_ciphertext = Column(LargeBinary, nullable=False)
    content_iv = Column(LargeBinary, nullable=False)
    saved_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
