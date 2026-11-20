from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, JSON, LargeBinary, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID

# noqa — ensure all models are imported so metadata is complete when used by Alembic
from app.models.user import UserProfile  # noqa: F401
from app.models.mood import MoodEntry  # noqa: F401
from app.models.journal import JournalEntry, JournalDraft  # noqa: F401
from app.models.thought import ThoughtRecord  # noqa: F401
from app.models.chat import Conversation, ChatMessage  # noqa: F401
from app.models.wellness import WellnessActivity, WellnessStreak  # noqa: F401
from app.models.community import (  # noqa: F401
    CommunityPost,
    CommunityMember,
    CommunitySupport,
    CommunityReport,
    CommunityBlock,
    CommunityMute,
    CommunityReply,
    ModerationLog,
)
from app.models.privacy import (  # noqa: F401
    ConsentRecord,
    DataExportRequest,
    AccountDeletionRequest,
    AuditEvent,
)
