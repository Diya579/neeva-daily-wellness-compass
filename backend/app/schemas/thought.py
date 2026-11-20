from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ThoughtCreate(BaseModel):
    situation: str = Field(..., min_length=1, max_length=500)
    automatic_thought: str = Field(..., min_length=1, max_length=500)
    emotions: list[str] = Field(default_factory=list)
    emotion_intensity_before: int = Field(..., ge=0, le=100)
    thinking_patterns: list[str] = Field(default_factory=list)
    evidence_for: str = Field(default="", max_length=500)
    evidence_against: str = Field(default="", max_length=500)
    balanced_thought: str = Field(default="", max_length=500)
    emotion_intensity_after: int = Field(default=0, ge=0, le=100)
    completed: bool = False


class ThoughtPatch(BaseModel):
    situation: Optional[str] = Field(default=None, max_length=500)
    automatic_thought: Optional[str] = Field(default=None, max_length=500)
    emotions: Optional[list[str]] = None
    emotion_intensity_before: Optional[int] = Field(default=None, ge=0, le=100)
    thinking_patterns: Optional[list[str]] = None
    evidence_for: Optional[str] = Field(default=None, max_length=500)
    evidence_against: Optional[str] = Field(default=None, max_length=500)
    balanced_thought: Optional[str] = Field(default=None, max_length=500)
    emotion_intensity_after: Optional[int] = Field(default=None, ge=0, le=100)
    completed: Optional[bool] = None


class ThoughtResponse(BaseModel):
    id: uuid.UUID
    situation: str
    automatic_thought: str
    emotions: list[str]
    emotion_intensity_before: int
    thinking_patterns: list[str]
    evidence_for: str
    evidence_against: str
    balanced_thought: str
    emotion_intensity_after: int
    completed: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

