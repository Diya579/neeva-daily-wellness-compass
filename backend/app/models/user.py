from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Enum, String, func

from app.database.session import Base

_GOAL = Enum("stress", "focus", "community", "sleep", name="user_goal")
_ROLE = Enum("user", "moderator", "admin", name="user_role")
_LANG = Enum("en", "hinglish", "hi", "gu", "mr", "bn", "ta", "te", name="preferred_language")
_SCRIPT = Enum("auto", "roman", "native", name="script_style")
_VIBE = Enum("bestie", "coach", "sage", "hype", name="companion_vibe")
_LENGTH = Enum("short", "balanced", "deep", name="companion_length")
_AVATAR = Enum("bloom", "moon", "wave", "spark", name="companion_avatar")
_APPROACH = Enum("validate", "advise", "mix", "explore", name="companion_approach")
_TONE = Enum("gentle", "honest", "playful", name="companion_tone")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(String(128), primary_key=True)
    display_name = Column(String(40), nullable=False, default="")
    role = Column(_ROLE, nullable=False, default="user")
    goal = Column(_GOAL, nullable=False, default="stress")

    preferred_language = Column(_LANG, nullable=False, default="en")
    script_style = Column(_SCRIPT, nullable=False, default="auto")

    onboarded = Column(Boolean, nullable=False, default=False)
    companion_configured = Column(Boolean, nullable=False, default=False)

    companion_name = Column(String(24), nullable=False, default="Neeva")
    companion_vibe = Column(_VIBE, nullable=False, default="bestie")
    companion_length = Column(_LENGTH, nullable=False, default="balanced")
    companion_avatar = Column(_AVATAR, nullable=False, default="bloom")
    companion_emoji = Column(Boolean, nullable=False, default=True)
    companion_approach = Column(_APPROACH, nullable=False, default="mix")
    companion_tone = Column(_TONE, nullable=False, default="gentle")
    companion_notes = Column(String(200), nullable=False, default="")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
