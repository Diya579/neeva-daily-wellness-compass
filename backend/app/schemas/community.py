from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

ReportReason = Literal["harassment", "hate", "self_harm", "personal_info", "spam", "other"]
ReportTarget = Literal["post", "user"]


class PostCreate(BaseModel):
    alias: str = Field(..., min_length=2, max_length=40)
    circle: str = Field(..., pattern=r"^[a-z]{2,20}$")
    body: str = Field(..., min_length=5, max_length=600)


class PostResponse(BaseModel):
    id: uuid.UUID
    alias: str
    circle: str
    body: str
    created_at: datetime
    is_team: bool
    is_mine: bool
    support_count: int
    supported_by_me: bool
    reply_count: int = 0
    pii_redacted: bool = False


class ReplyCreate(BaseModel):
    alias: str = Field(..., min_length=2, max_length=40)
    body: str = Field(..., min_length=2, max_length=400)


class ReplyResponse(BaseModel):
    id: uuid.UUID
    post_id: uuid.UUID
    alias: str
    body: str
    is_mine: bool
    created_at: datetime


class ReportCreate(BaseModel):
    target: ReportTarget = "post"
    reason: ReportReason
    details: str = Field(default="", max_length=300)


class ModerationActionRequest(BaseModel):
    action: Literal["hide", "remove", "restore"]
    reason: str = Field(default="", max_length=300)

