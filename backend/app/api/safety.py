"""
Safety Classification & Google Agent Skills API (Section 7, 13, 14):
- POST /api/v1/safety/classify
- GET /api/v1/safety/resources
- POST /api/v1/safety/skills/triage
- POST /api/v1/safety/skills/pii-redact
- POST /api/v1/safety/skills/cbt-tool
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.ai.skills import skill_cbt_tool_picker, skill_crisis_triage, skill_pii_redaction
from app.core.security import get_current_user
from app.safety.engine import HELPLINES, HELPLINES_VERIFIED_ON, get_safety_engine

router = APIRouter(prefix="/api/v1/safety", tags=["safety"])


class ClassifyRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)


class ClassifyResponse(BaseModel):
    tier: int
    deterministic_tier: int
    muril_tier: Optional[int] = None
    confidence: float
    should_interrupt: bool
    crisis_message: Optional[str] = None
    helplines: list[dict]
    support_guidance: Optional[dict] = None


class ToolPickerRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    mood: Optional[str] = None


@router.post("/classify", response_model=ClassifyResponse)
async def classify_content(
    body: ClassifyRequest,
    user: dict = Depends(get_current_user),
):
    engine = get_safety_engine()
    res = await engine.evaluate(body.text)
    return ClassifyResponse(
        tier=int(res.tier),
        deterministic_tier=int(res.deterministic_tier),
        muril_tier=int(res.muril_tier) if res.muril_tier is not None else None,
        confidence=res.confidence,
        should_interrupt=res.should_interrupt,
        crisis_message=res.crisis_message,
        helplines=res.helplines,
        support_guidance=res.support_guidance,
    )


@router.get("/resources")
async def get_crisis_resources(user: dict = Depends(get_current_user)):
    return {
        "helplines": HELPLINES,
        "verified_on": HELPLINES_VERIFIED_ON,
    }


@router.post("/skills/triage")
async def run_crisis_triage_skill(
    body: ClassifyRequest,
    user: dict = Depends(get_current_user),
):
    out = await skill_crisis_triage(body.text)
    return {
        "tier": out.tier,
        "action": out.action,
        "should_interrupt": out.should_interrupt,
        "helplines": out.helplines,
        "crisis_message": out.crisis_message,
        "recommended_tool": out.recommended_tool,
    }


@router.post("/skills/pii-redact")
async def run_pii_redaction_skill(
    body: ClassifyRequest,
    user: dict = Depends(get_current_user),
):
    return await skill_pii_redaction(body.text)


@router.post("/skills/cbt-tool")
async def run_cbt_tool_picker_skill(
    body: ToolPickerRequest,
    user: dict = Depends(get_current_user),
):
    return skill_cbt_tool_picker(body.text, body.mood)

