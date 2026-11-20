from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, JSON, String, func

from app.database.session import Base, GUID

_CONSENT_TYPE = Enum(
    "ai_journal_analysis", "context_sharing", "analytics", name="consent_type"
)
_EXPORT_STATUS = Enum("pending", "processing", "ready", "failed", name="export_status")
_DELETION_STATUS = Enum("pending", "completed", "cancelled", name="deletion_status")


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        String(128), ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    consent_type = Column(_CONSENT_TYPE, nullable=False)
    granted = Column(Boolean, nullable=False)
    granted_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)


class DataExportRequest(Base):
    __tablename__ = "data_export_requests"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        String(128), ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status = Column(_EXPORT_STATUS, nullable=False, default="pending")
    download_url = Column(String(2048), nullable=True)
    requested_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)


class AccountDeletionRequest(Base):
    __tablename__ = "account_deletion_requests"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        String(128), ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scheduled_for = Column(DateTime(timezone=True), nullable=False)
    status = Column(_DELETION_STATUS, nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        String(128), ForeignKey("user_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type = Column(String(64), nullable=False)
    event_metadata = Column("metadata", JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
