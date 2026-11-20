"""
Reflective Journal Analysis using Gemini 2.5 Flash with deterministic offline fallback.
Matches the frontend's exact `JOURNAL_ANALYSIS_SCHEMA` in `frontend/src/lib/journal-types.ts`
and `analyzeLocally` in `frontend/src/lib/journal-local.ts`.
"""
from __future__ import annotations

import logging
import re

from app.ai.gemini import generate_structured, validate_ai_response

logger = logging.getLogger(__name__)

JOURNAL_ANALYSIS_SCHEMA: dict = {
    "type": "object",
    "required": [
        "summary",
        "primaryTone",
        "valence",
        "emotions",
        "themes",
        "distortions",
        "reframes",
        "strengths",
        "nextStep",
    ],
    "properties": {
        "summary": {"type": "string"},
        "primaryTone": {"type": "string"},
        "valence": {"type": "integer"},
        "emotions": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["name", "intensity"],
                "properties": {
                    "name": {"type": "string"},
                    "intensity": {"type": "integer"},
                },
            },
        },
        "themes": {"type": "array", "items": {"type": "string"}},
        "distortions": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["name", "quote", "explanation"],
                "properties": {
                    "name": {"type": "string"},
                    "quote": {"type": "string"},
                    "explanation": {"type": "string"},
                },
            },
        },
        "reframes": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["original", "reframe"],
                "properties": {
                    "original": {"type": "string"},
                    "reframe": {"type": "string"},
                },
            },
        },
        "strengths": {"type": "array", "items": {"type": "string"}},
        "nextStep": {"type": "string"},
    },
}

JOURNAL_SYSTEM_INSTRUCTION = (
    "You are Neeva's reflective-journal analyst. Read the user's journal entry with warmth and clinical care. "
    "Detect emotional tone, themes and cognitive distortions using CBT concepts, and offer gentle, realistic reframes. "
    "Write in the same language AND the same writing style as the entry: many young Indians type Hindi, Gujarati, "
    "Tamil, Telugu, Marathi or Bengali in English letters mixed with English (e.g. 'bro thak gayi hoon', "
    "'yaar have bas thai gayu') — if so, reply in that language in English letters the casual way they type. "
    "Never diagnose or prescribe medication."
)

_LEX = [
    {"name": "Gratitude", "words": ["grateful", "thankful", "lucky", "appreciate", "blessed", "shukriya"], "valence": 1},
    {"name": "Joy", "words": ["happy", "joy", "excited", "fun", "laughed", "proud", "great", "khush"], "valence": 1},
    {"name": "Calm", "words": ["calm", "peace", "relaxed", "rest", "slow", "quiet", "sukoon"], "valence": 1},
    {"name": "Anxiety", "words": ["anxious", "worry", "worried", "nervous", "panic", "scared", "fear", "tension"], "valence": -1},
    {"name": "Exhaustion", "words": ["tired", "exhausted", "drained", "burnt", "burnout", "sleep", "thak"], "valence": -1},
    {"name": "Sadness", "words": ["sad", "lonely", "cry", "cried", "miss", "empty", "low", "udaas"], "valence": -1},
    {"name": "Frustration", "words": ["angry", "annoyed", "frustrated", "unfair", "hate", "irritated", "gussa"], "valence": -1},
]

_THEMES = [
    ("Work & career", ["work", "office", "manager", "deadline", "job", "meeting", "boss"]),
    ("Studies", ["exam", "study", "college", "class", "assignment", "marks", "placement"]),
    ("Family", ["mom", "dad", "mother", "father", "family", "parents", "sister", "brother", "ghar"]),
    ("Relationships", ["friend", "partner", "love", "relationship", "people", "dost"]),
    ("Self-care", ["walk", "sleep", "exercise", "yoga", "rest", "meditate"]),
]


def analyze_locally(text: str) -> dict:
    """Deterministic fallback matching `frontend/src/lib/journal-local.ts`."""
    t = text.lower()
    emotions_scored = []
    for item in _LEX:
        hits = sum(1 for w in item["words"] if w in t)
        if hits > 0:
            emotions_scored.append({**item, "hits": hits})
    emotions_scored.sort(key=lambda x: x["hits"], reverse=True)

    val = sum(e["valence"] * e["hits"] for e in emotions_scored)
    valence = max(-100, min(100, val * 22))
    themes = [name for name, words in _THEMES if any(w in t for w in words)]
    absolutes = re.findall(r"\b(always|never|everyone|nobody|everything|nothing|ruined|should)\b", text, flags=re.I)[:2]

    chosen_emotions = (emotions_scored if emotions_scored else [{"name": "Reflective", "hits": 1}])[:4]
    emotions_out = [
        {"name": e["name"], "intensity": max(30, 85 - idx * 15)}
        for idx, e in enumerate(chosen_emotions)
    ]

    return {
        "summary": (
            "You're noticing what's working, and that awareness is a quiet strength. There's warmth in how you describe your day."
            if valence >= 0
            else "It sounds like you've been carrying a lot. Putting it into words is already a way of setting some of it down."
        ),
        "primaryTone": "Uplifted" if valence > 30 else ("Heavy but honest" if valence < -30 else "Reflective"),
        "valence": valence,
        "emotions": emotions_out,
        "themes": themes[:4] if themes else ["Daily life", "Self-awareness"],
        "distortions": [
            {
                "name": "'Should' statements" if w.lower() == "should" else "All-or-nothing thinking",
                "quote": w,
                "explanation": "Absolute words can make a situation feel more fixed than it really is.",
            }
            for w in absolutes
        ],
        "reframes": [
            {
                "original": f"Things {absolutes[0].lower()} go wrong for me." if absolutes else "I should be doing better.",
                "reframe": "Some things are hard right now, and I'm still showing up. That counts.",
            }
        ],
        "strengths": ["Honesty with yourself", "Willingness to reflect"],
        "nextStep": (
            "Write down one thing you'd like to repeat tomorrow."
            if valence >= 0
            else "Take a 5-minute walk or try one round of 4-7-8 breathing before bed."
        ),
    }


async def analyze_journal_entry(text: str, prompt: str = "") -> tuple[dict, str]:
    """
    Analyze journal entry in Zero-Cost Mode:
    - Uses optional free-tier Gemini ONLY if `settings.ENABLE_OPTIONAL_GEMINI_FREE_TIER` and
      `settings.GEMINI_API_KEY` are explicitly configured.
    - Otherwise uses the deterministic local CBT reflection engine and honestly returns `source="offline"`.
    """
    from app.core.config import settings

    if not settings.ENABLE_OPTIONAL_GEMINI_FREE_TIER or not settings.GEMINI_API_KEY:
        return analyze_locally(text), "offline"

    try:
        user_prompt = f"Journal prompt: {prompt}\n\nEntry:\n{text}"
        raw = await generate_structured(
            prompt=user_prompt,
            system_instruction=JOURNAL_SYSTEM_INSTRUCTION,
            schema=JOURNAL_ANALYSIS_SCHEMA,
        )
        raw["summary"] = validate_ai_response(str(raw.get("summary", "")))
        return raw, "ai"
    except Exception as exc:
        logger.warning("Optional free-tier Gemini journal analysis unavailable (%s); using offline fallback.", exc)
        return analyze_locally(text), "offline"

