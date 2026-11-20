"""
[PHASE 2 ROADMAP — ISOLATED SCAFFOLD]
Google Agent Skills Hooks:
1. Crisis Triage Hook
2. Aadhaar / PAN PII Redaction Hook
3. CBT Tool Picker Hook
"""

from __future__ import annotations

from typing import Any

from app.ai.agent_skills import (
    cbt_tool_picker_skill,
    crisis_triage_skill,
    indian_pii_redaction_skill,
)


async def execute_phase2_agent_skills_bundle(text: str, language: str = "en") -> dict[str, Any]:
    redacted = await indian_pii_redaction_skill(text)
    triage = crisis_triage_skill(redacted["redacted_text"], language=language)
    cbt_tool = cbt_tool_picker_skill(redacted["redacted_text"], safety_tier=triage["tier"])
    return {
        "phase": "phase_2_agent_skills",
        "redaction": redacted,
        "triage": triage,
        "cbt_tool": cbt_tool,
    }

