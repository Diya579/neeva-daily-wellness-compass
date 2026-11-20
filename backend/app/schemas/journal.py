from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class JournalCreate(BaseModel):
    prompt: str = Field(..., max_length=300)
    content_ciphertext: str = Field(..., min_length=16, description="Base64 AES-GCM-256 ciphertext")
    content_iv: str = Field(..., min_length=16, description="Base64 12-byte IV")
    word_count: int = Field(default=0, ge=0)
    is_draft: bool = False


class JournalPatch(BaseModel):
    prompt: Optional[str] = Field(default=None, max_length=300)
    content_ciphertext: Optional[str] = None
    content_iv: Optional[str] = None
    word_count: Optional[int] = Field(default=None, ge=0)


class JournalResponse(BaseModel):
    id: uuid.UUID
    prompt: str
    content_ciphertext: Optional[str] = None
    content_iv: Optional[str] = None
    word_count: int
    has_analysis: bool
    analysis: Optional[dict] = None
    analysis_source: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class JournalAnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=8000)
    prompt: str = Field(default="", max_length=300)
    persist_analysis: bool = True


class JournalAnalysisResponse(BaseModel):
    analysis: dict
    source: Literal["ai", "offline"]

