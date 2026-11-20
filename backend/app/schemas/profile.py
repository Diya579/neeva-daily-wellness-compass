from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

GoalType = Literal["stress", "focus", "community", "sleep"]
LangType = Literal["en", "hinglish", "hi", "gu", "mr", "bn", "ta", "te"]
ScriptType = Literal["auto", "roman", "native"]
VibeType = Literal["bestie", "coach", "sage", "hype"]
LengthType = Literal["short", "balanced", "deep"]
AvatarType = Literal["bloom", "moon", "wave", "spark"]
ApproachType = Literal["validate", "advise", "mix", "explore"]
ToneType = Literal["gentle", "honest", "playful"]


class ProfileResponse(BaseModel):
    id: str
    display_name: str
    role: str = "user"
    goal: GoalType
    preferred_language: LangType
    script_style: ScriptType
    onboarded: bool
    companion_configured: bool
    companion_name: str
    companion_vibe: VibeType
    companion_length: LengthType
    companion_avatar: AvatarType
    companion_emoji: bool
    companion_approach: ApproachType
    companion_tone: ToneType
    companion_notes: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProfilePatch(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=40)
    goal: Optional[GoalType] = None
    preferred_language: Optional[LangType] = None
    script_style: Optional[ScriptType] = None
    onboarded: Optional[bool] = None
    companion_configured: Optional[bool] = None
    companion_name: Optional[str] = Field(default=None, min_length=1, max_length=24)
    companion_vibe: Optional[VibeType] = None
    companion_length: Optional[LengthType] = None
    companion_avatar: Optional[AvatarType] = None
    companion_emoji: Optional[bool] = None
    companion_approach: Optional[ApproachType] = None
    companion_tone: Optional[ToneType] = None
    companion_notes: Optional[str] = Field(default=None, max_length=200)

