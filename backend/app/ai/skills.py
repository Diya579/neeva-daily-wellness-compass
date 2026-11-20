"""
Google Agent Skills for Neeva AI (Section 13 of Master Specification):
1. Crisis Triage Skill — processes structured safety classifications and routes crisis cases without overriding Tier 3.
2. PII Redaction Skill — detects and redacts Aadhaar, PAN, Phone, and Email identifiers while preserving safe context.
3. CBT Tool Picker Skill — selects appropriate validated wellness tools (breathing, grounding, thought reframing, journal reflection, meditation).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.ai.dlp_client import redact_pii
from app.safety.crisis_patterns import SafetyTier
from app.safety.engine import HELPLINES, get_safety_engine

CBTToolId = Literal[
    "breathing_478",
    "grounding_54321",
    "thought_record",
    "journal_reflection",
    "meditation_arrive",
    "meditation_exam",
    "meditation_workday",
    "meditation_sleep",
]

VALID_TOOLS: dict[str, dict] = {
    "breathing_478": {
        "tool_id": "breathing_478",
        "category": "breathing",
        "title": "4-7-8 Calming Breath",
        "duration_minutes": 2,
        "steps": [
            "Exhale completely through your mouth.",
            "Inhale quietly through your nose for 4 seconds.",
            "Hold your breath gently for 7 seconds.",
            "Exhale slowly through your mouth for 8 seconds.",
            "Repeat for 4 cycles.",
        ],
    },
    "grounding_54321": {
        "tool_id": "grounding_54321",
        "category": "grounding",
        "title": "5-4-3-2-1 Sensory Grounding",
        "duration_minutes": 3,
        "steps": [
            "Name 5 things you can see around you.",
            "Name 4 things you can physically feel or touch.",
            "Name 3 sounds you can hear right now.",
            "Name 2 scents you can smell.",
            "Name 1 thing you appreciate in this moment.",
        ],
    },
    "thought_record": {
        "tool_id": "thought_record",
        "category": "thought_reframing",
        "title": "CBT Thought Record & Reframe",
        "duration_minutes": 5,
        "steps": [
            "Write down the situation that triggered the feeling.",
            "Capture the automatic negative thought.",
            "Spot any cognitive distortion (catastrophising, mind-reading, all-or-nothing).",
            "List one piece of evidence against that automatic thought.",
            "Write a balanced, realistic alternative perspective.",
        ],
    },
    "journal_reflection": {
        "tool_id": "journal_reflection",
        "category": "journal_reflection",
        "title": "Guided Reflective Journaling",
        "duration_minutes": 5,
        "steps": [
            "Write freely for 3 minutes about what is taking up the most space in your mind.",
            "Notice what emotion feels strongest without judging it.",
            "Write one compassionate sentence you would say to a close friend in your shoes.",
        ],
    },
    "meditation_exam": {
        "tool_id": "meditation_exam",
        "category": "meditation",
        "title": "Body Scan for Exam Stress",
        "duration_minutes": 10,
        "steps": [
            "Set your study material aside for 10 minutes.",
            "Soften your forehead, jaw, and shoulders.",
            "Label anxious thoughts as 'worry' and return attention to your breath.",
        ],
    },
    "meditation_sleep": {
        "tool_id": "meditation_sleep",
        "category": "meditation",
        "title": "Sleep Descent Meditation",
        "duration_minutes": 15,
        "steps": [
            "Lie down comfortably and dim your screen.",
            "Breathe in for 4 seconds and out for 7 seconds.",
            "Count slow breaths backwards from 10.",
        ],
    },
}


@dataclass
class CrisisTriageOutput:
    tier: int
    action: Literal["allow_chat", "empathetic_grounding", "crisis_interrupt"]
    should_interrupt: bool
    helplines: list[dict]
    crisis_message: str | None
    recommended_tool: dict | None


async def skill_crisis_triage(text: str) -> CrisisTriageOutput:
    """
    Google Agent Skill 1: Crisis Triage.
    Never overrides deterministic Tier 3 decisions.
    """
    engine = get_safety_engine()
    res = await engine.evaluate(text)
    if res.tier == SafetyTier.TIER3_ACUTE:
        return CrisisTriageOutput(
            tier=int(res.tier),
            action="crisis_interrupt",
            should_interrupt=True,
            helplines=HELPLINES,
            crisis_message=res.crisis_message,
            recommended_tool=VALID_TOOLS["breathing_478"],
        )
    if res.tier == SafetyTier.TIER2_PASSIVE_DISTRESS:
        return CrisisTriageOutput(
            tier=int(res.tier),
            action="empathetic_grounding",
            should_interrupt=False,
            helplines=HELPLINES,
            crisis_message=None,
            recommended_tool=VALID_TOOLS["breathing_478"],
        )
    return CrisisTriageOutput(
        tier=int(res.tier),
        action="allow_chat",
        should_interrupt=False,
        helplines=[],
        crisis_message=None,
        recommended_tool=None,
    )


async def skill_pii_redaction(text: str) -> dict:
    """
    Google Agent Skill 2: PII Redaction.
    Redacts Aadhaar, PAN, Phone numbers, and Emails while preserving wellness context.
    """
    redacted, detected_types = await redact_pii(text)
    return {
        "redacted_text": redacted,
        "detected_info_types": detected_types,
        "pii_found": len(detected_types) > 0,
    }


def skill_cbt_tool_picker(text: str, mood: str | None = None) -> dict:
    """
    Google Agent Skill 3: CBT Tool Picker.
    Returns strictly validated structured output from the approved wellness tool catalog.
    Never executes unvalidated AI instructions.
    """
    lower = (text or "").lower()
    if any(k in lower for k in ("sleep", "insomnia", "neend", "raat", "night", "thookam", "nidra", "ghum")):
        tool = VALID_TOOLS["meditation_sleep"]
        rationale = "Selected wind-down sleep meditation for nighttime restlessness."
    elif any(k in lower for k in ("exam", "study", "placement", "padhai", "college", "marks")):
        tool = VALID_TOOLS["meditation_exam"]
        rationale = "Selected exam stress body-scan meditation for academic pressure."
    elif any(k in lower for k in ("panic", "breath", "heart racing", "ghabrahat", "4-7-8", "overwhelmed")) or mood == "overwhelmed":
        tool = VALID_TOOLS["breathing_478"]
        rationale = "Selected 4-7-8 breathing to activate the parasympathetic nervous system."
    elif any(k in lower for k in ("anxious", "nervous", "spinning", "ground", "restless")) or mood == "anxious":
        tool = VALID_TOOLS["grounding_54321"]
        rationale = "Selected 5-4-3-2-1 sensory grounding to anchor attention in the present moment."
    elif any(k in lower for k in ("always", "never", "failure", "ruined", "should", "reframe", "thought")):
        tool = VALID_TOOLS["thought_record"]
        rationale = "Selected CBT thought record to gently examine and reframe cognitive distortions."
    else:
        tool = VALID_TOOLS["journal_reflection"]
        rationale = "Selected guided reflective journaling to unpack emotions safely."

    return {
        "selected_tool": tool,
        "rationale": rationale,
        "validated": True,
    }

