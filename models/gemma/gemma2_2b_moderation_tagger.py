"""
Gemma 2 2B-IT (`google/gemma-2-2b-it`) Lightweight Moderation & Structured Emotion Tagger.
Implements Section 8 of the Master Specification:
- Structured community post moderation (safe / needs_review / harmful)
- Structured emotion tagging (valence, primary emotions, intensity)
- Workload suitability evaluation for Cloud Run with NVIDIA L4 GPU vs Vertex AI Endpoint.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ModerationDecision = Literal["visible", "hidden", "removed"]

EMOTION_TAXONOMY = (
    "Gratitude",
    "Joy",
    "Calm",
    "Anxiety",
    "Exhaustion",
    "Sadness",
    "Frustration",
    "Reflective",
)


@dataclass
class Gemma2BWorkloadAssessment:
    model_id: str = "google/gemma-2-2b-it"
    parameter_count: str = "2.6B"
    bf16_vram_gb: float = 5.4
    int4_vram_gb: float = 2.1
    recommended_runtime: str = "Cloud Run with NVIDIA L4 GPU (24 GB VRAM) or Gemini 2.5 Flash API"
    suitability_verdict: str = (
        "SUITABLE for low-latency community moderation and structured emotion tagging (<150 ms/req on L4 GPU). "
        "However, for early-stage traffic (<10,000 DAU), routing moderation through Gemini 2.5 Flash on Google AI Studio "
        "avoids idle L4 GPU instance costs while maintaining identical structured JSON schema enforcement."
    )


GEMMA_2B_MODERATION_PROMPT = """<start_of_turn>user
You are a safety moderator for an anonymous Indian peer-support mental wellness community.
Classify the following community post and tag its primary emotions from: {taxonomy}.
Return ONLY valid JSON with keys:
- "decision": "visible" | "hidden" | "removed"
- "reason": short explanation
- "emotions": [{"name": string, "intensity": 0-100}]

Post:
{text}<end_of_turn>
<start_of_turn>model
"""


def build_gemma2b_moderation_prompt(text: str) -> str:
    return GEMMA_2B_MODERATION_PROMPT.format(
        taxonomy=", ".join(EMOTION_TAXONOMY),
        text=text.strip()[:600],
    )


def validate_moderation_output(payload: dict) -> dict:
    """Validate structured JSON output from Gemma 2 2B-IT moderation tagger."""
    decision = payload.get("decision", "visible")
    if decision not in ("visible", "hidden", "removed"):
        decision = "hidden"

    raw_emotions = payload.get("emotions", [])
    validated_emotions = []
    if isinstance(raw_emotions, list):
        for item in raw_emotions[:4]:
            if isinstance(item, dict) and item.get("name") in EMOTION_TAXONOMY:
                intensity = max(0, min(100, int(item.get("intensity", 50))))
                validated_emotions.append({"name": item["name"], "intensity": intensity})

    if not validated_emotions:
        validated_emotions = [{"name": "Reflective", "intensity": 50}]

    return {
        "decision": decision,
        "reason": str(payload.get("reason", ""))[:200],
        "emotions": validated_emotions,
    }


def get_workload_suitability_report() -> dict:
    assessment = Gemma2BWorkloadAssessment()
    return {
        "model_id": assessment.model_id,
        "parameter_count": assessment.parameter_count,
        "bf16_vram_gb": assessment.bf16_vram_gb,
        "int4_vram_gb": assessment.int4_vram_gb,
        "recommended_runtime": assessment.recommended_runtime,
        "suitability_verdict": assessment.suitability_verdict,
    }

