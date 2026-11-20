"""
Three-Tier Safety Engine for Neeva AI (Section 5).
Combines:
1. Deterministic 8-language regex classification (with negation & figurative slang guards).
2. Google MuRIL ONNX inference (when model artifact is loaded).
3. Multi-turn contextual escalation (detects repeated/escalating Tier 2 passive distress across turns).
4. Authoritative Tier 3 interruption (Gemini/Gemma are NEVER called on Tier 3).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from app.safety.crisis_patterns import SafetyTier, classify_safety
from app.safety.muril import MuRILClassifier

HELPLINES_VERIFIED_ON = "19 Nov 2026"

HELPLINES: list[dict] = [
    {
        "id": "telemanas",
        "name": "Tele-MANAS (Govt. of India)",
        "number": "14416",
        "tel": "14416",
        "hours": "24×7 · free · 20 languages · also 1-800-891-4416",
        "alwaysOpen": True,
    },
    {
        "id": "icall",
        "name": "iCall (TISS)",
        "number": "9152987821",
        "tel": "+919152987821",
        "hours": "Mon–Sat · 8am–9pm · free counselling",
        "alwaysOpen": False,
    },
    {
        "id": "112",
        "name": "Emergency services",
        "number": "112",
        "tel": "112",
        "hours": "24×7 · if you're in immediate danger",
        "alwaysOpen": True,
    },
    {
        "id": "vandrevala",
        "name": "Vandrevala Foundation",
        "number": "+91 9999 666 555",
        "tel": "+919999666555",
        "hours": "24×7 · call or WhatsApp",
        "alwaysOpen": True,
    },
]

TIER3_CRISIS_MESSAGE = """I hear you, and I'm really glad you told me. You don't have to carry this alone right now.

Please connect with trained crisis support immediately — these services are free and confidential across India:

- **Tele-MANAS (Govt. of India):** Call **14416** or **1-800-891-4416** (24×7, free, 20 languages)
- **iCall (TISS):** Call **9152987821** (Mon–Sat, 8am–9pm IST)
- **Emergency Services:** Call **112** (24×7, if you are in immediate danger)
- **Vandrevala Foundation:** Call or WhatsApp **+91 9999 666 555** (24×7)

**Right now:**
1. Please reach out to a trusted person nearby — a friend, family member, roommate, or neighbour — and let them sit with you.
2. Put any harmful objects out of reach.
3. Let's take one slow grounding breath together: inhale gently for 4 seconds, hold for 7 seconds, and exhale slowly for 8 seconds. Look around and name 5 things you can see in the room."""

TIER2_SUPPORT_GUIDANCE = {
    "breathing_exercise": "4-7-8 Breathing: Inhale quietly through your nose for 4 seconds, hold for 7 seconds, and exhale slowly through your mouth for 8 seconds.",
    "grounding_exercise": "5-4-3-2-1 Grounding: Notice 5 things you can see, 4 things you can touch, 3 things you can hear, 2 things you can smell, and 1 thing you appreciate right now.",
    "trusted_contact_prompt": "Consider texting or calling one trusted friend or family member to let them know today feels heavy.",
    "recommended_tool": "breathing_478",
}


@dataclass
class SafetyResult:
    tier: SafetyTier
    deterministic_tier: SafetyTier
    muril_tier: Optional[SafetyTier]
    confidence: float
    should_interrupt: bool
    inference_source: str = "deterministic_multilingual_rules"
    contextual_escalation: bool = False
    helplines: list[dict] = field(default_factory=list)
    crisis_message: Optional[str] = None
    support_guidance: Optional[dict] = None


class SafetyEngine:
    """Layered deterministic + MuRIL + multi-turn context safety classification engine."""

    def __init__(self, muril_classifier: Optional[MuRILClassifier] = None) -> None:
        self._muril = muril_classifier

    async def evaluate(
        self,
        text: str,
        prior_user_messages: Optional[list[str]] = None,
    ) -> SafetyResult:
        det_tier = classify_safety(text)
        muril_tier: Optional[SafetyTier] = None
        inference_source = "deterministic_multilingual_rules"
        confidence = 1.0 if det_tier == SafetyTier.TIER3_ACUTE else 0.85

        if self._muril is not None and self._muril.available and det_tier != SafetyTier.TIER3_ACUTE:
            try:
                muril_tier, muril_conf = await self._muril.classify(text)
                confidence = max(confidence, muril_conf)
                inference_source = "hybrid_deterministic_and_muril_onnx"
            except Exception:
                muril_tier = None

        final_tier = det_tier
        if muril_tier is not None and muril_tier > final_tier:
            final_tier = muril_tier

        # Contextual multi-turn evaluation: if the current message AND 2+ recent user messages
        # show Tier 2 passive distress, flag contextual_escalation=True.
        contextual_escalation = False
        if prior_user_messages and final_tier == SafetyTier.TIER2_PASSIVE_DISTRESS:
            prior_distress_count = sum(
                1
                for msg in prior_user_messages[-4:]
                if classify_safety(msg) >= SafetyTier.TIER2_PASSIVE_DISTRESS
            )
            if prior_distress_count >= 2:
                contextual_escalation = True

        should_interrupt = final_tier == SafetyTier.TIER3_ACUTE
        support_guidance = (
            TIER2_SUPPORT_GUIDANCE
            if final_tier in (SafetyTier.TIER2_PASSIVE_DISTRESS, SafetyTier.TIER3_ACUTE)
            else None
        )
        helplines = (
            HELPLINES
            if final_tier in (SafetyTier.TIER2_PASSIVE_DISTRESS, SafetyTier.TIER3_ACUTE)
            else []
        )

        return SafetyResult(
            tier=final_tier,
            deterministic_tier=det_tier,
            muril_tier=muril_tier,
            confidence=confidence,
            should_interrupt=should_interrupt,
            inference_source=inference_source,
            contextual_escalation=contextual_escalation,
            helplines=helplines,
            crisis_message=TIER3_CRISIS_MESSAGE if should_interrupt else None,
            support_guidance=support_guidance,
        )


_engine: Optional[SafetyEngine] = None


def get_safety_engine() -> SafetyEngine:
    global _engine
    if _engine is None:
        _engine = SafetyEngine(muril_classifier=MuRILClassifier())
    return _engine


def init_safety_engine(muril_classifier: Optional[MuRILClassifier] = None) -> SafetyEngine:
    global _engine
    _engine = SafetyEngine(muril_classifier=muril_classifier)
    return _engine
