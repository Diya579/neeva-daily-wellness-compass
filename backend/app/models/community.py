from __future__ import annotations

import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)

from app.database.session import Base, GUID

_STATUS = Enum("visible", "hidden", "removed", name="post_status")
_MODERATION = Enum("ai", "local", "team", name="moderation_source")
_TARGET = Enum("post", "user", name="report_target")
_REASON = Enum(
    "harassment",
    "hate",
    "self_harm",
    "personal_info",
    "spam",
    "other",
    name="report_reason",
)


class CommunityPost(Base):
    __tablename__ = "community_posts"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    author_id = Column(
        String(128), ForeignKey("user_profiles.id", ondelete="SET NULL"), nullable=True, index=True
    )
    alias = Column(String(40), nullable=False)
    circle = Column(String(20), nullable=False, index=True)
    body = Column(String(600), nullable=False)
    status = Column(_STATUS, nullable=False, default="visible")
    is_team = Column(Boolean, nullable=False, default=False)
    moderation = Column(_MODERATION, nullable=False, default="ai")
    safety_tier = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CommunityMember(Base):
    __tablename__ = "community_members"

    user_id = Column(
        String(128), ForeignKey("user_profiles.id", ondelete="CASCADE"), primary_key=True
    )
    circle = Column(String(20), primary_key=True)
    joined_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CommunitySupport(Base):
    __tablename__ = "community_support"

    post_id = Column(
        GUID(), ForeignKey("community_posts.id", ondelete="CASCADE"), primary_key=True
    )
    user_id = Column(
        String(128), ForeignKey("user_profiles.id", ondelete="CASCADE"), primary_key=True
    )
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CommunityReport(Base):
    __tablename__ = "community_reports"
    __table_args__ = (UniqueConstraint("post_id", "reporter_id", name="uq_report_post_reporter"),)

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    post_id = Column(
        GUID(), ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reporter_id = Column(String(128), nullable=False)
    target = Column(_TARGET, nullable=False)
    reason = Column(_REASON, nullable=False)
    details = Column(String(300), nullable=False, default="")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CommunityBlock(Base):
    __tablename__ = "community_blocks"

    blocker_id = Column(
        String(128), ForeignKey("user_profiles.id", ondelete="CASCADE"), primary_key=True
    )
    blocked_id = Column(
        String(128), ForeignKey("user_profiles.id", ondelete="CASCADE"), primary_key=True
    )
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CommunityMute(Base):
    __tablename__ = "community_mutes"

    muter_id = Column(
        String(128), ForeignKey("user_profiles.id", ondelete="CASCADE"), primary_key=True
    )
    muted_id = Column(
        String(128), ForeignKey("user_profiles.id", ondelete="CASCADE"), primary_key=True
    )
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CommunityReply(Base):
    __tablename__ = "community_replies"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    post_id = Column(
        GUID(), ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id = Column(
        String(128), ForeignKey("user_profiles.id", ondelete="SET NULL"), nullable=True, index=True
    )
    alias = Column(String(40), nullable=False)
    body = Column(String(400), nullable=False)
    status = Column(_STATUS, nullable=False, default="visible")
    safety_tier = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ModerationLog(Base):
    __tablename__ = "moderation_logs"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    target_type = Column(String(20), nullable=False)
    target_id = Column(String(128), nullable=False, index=True)
    moderator_id = Column(String(128), nullable=False)
    action = Column(String(32), nullable=False)
    reason = Column(String(300), nullable=False, default="")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
