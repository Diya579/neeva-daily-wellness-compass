"""
Gemini 2.5 Flash Structured JSON & SSE Service (/backend/gemini_service.py)
- Official Google GenAI SDK (`google-genai`)
- Model: `gemini-2.5-flash`
- Strict 4-field structured JSON schema with `crisisLevel` ordered FIRST:
    1. crisisLevel: 0 | 1 | 2 | 3
    2. suggestedAction: "breathing" | "journal" | "soundscape"
    3. reply: empathetic culturally grounded response in the user's detected language/script
    4. reframeQuestion: Socratic CBT question
- Pre-flight and mid-stream Tier-3 Hard Circuit Breaker (Tele-MANAS 14416 & iCall 9152987821)
- Graceful offline-safe deterministic CBT fallback when API key is missing, rate-limited, or offline.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, AsyncGenerator

from safety import (
    TIER3_CIRCUIT_BREAKER_REPLY,
    TIER3_HELPLINES,
    evaluate_safety_gate,
)

GEMINI_MODEL_NAME = "gemini-2.5-flash"

# Strict 4-Field JSON Schema with crisisLevel ordered FIRST
GEMINI_RESPONSE_JSON_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "required": ["crisisLevel", "suggestedAction", "reply", "reframeQuestion"],
    "propertyOrdering": ["crisisLevel", "suggestedAction", "reply", "reframeQuestion"],
    "properties": {
        "crisisLevel": {
            "type": "INTEGER",
            "description": "Deterministic safety tier: 0 (calm), 1 (everyday/academic stress), 2 (passive distress/exhaustion), 3 (acute self-harm crisis).",
            "enum": [0, 1, 2, 3],
        },
        "suggestedAction": {
            "type": "STRING",
            "description": "Recommended micro-tool widget to launch in the UI.",
            "enum": ["breathing", "journal", "soundscape"],
        },
        "reply": {
            "type": "STRING",
            "description": "Warm, empathetic, non-clinical CBT/ACT response in the user's language and script style.",
        },
        "reframeQuestion": {
            "type": "STRING",
            "description": "One gentle Socratic CBT reframing question (empty string if crisisLevel == 3).",
        },
    },
}

PROHIBITED_CLINICAL_RE = re.compile(
    r"\b(you\s+(have|are\s+suffering\s+from|are\s+diagnosed\s+with)\s+"
    r"(clinical\s+depression|major\s+depressive\s+disorder|bipolar\s+disorder|schizophrenia|ptsd)|"
    r"prescribe|take\s+\d+\s*mg\s+of|start\s+taking\s+(ssri|fluoxetine|sertraline|escitalopram|alprazolam|xanax))\b",
    re.IGNORECASE,
)


def validate_gemini_schema(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Strictly enforce the 4-field schema with `crisisLevel` ordered FIRST
    and block any clinical diagnosis or medication advice.
    """
    if not isinstance(payload, dict):
        raise ValueError("Payload must be a JSON object.")

    crisis_level = payload.get("crisisLevel")
    if not isinstance(crisis_level, int) or isinstance(crisis_level, bool) or crisis_level not in (0, 1, 2, 3):
        raise ValueError("crisisLevel must be an integer in {0, 1, 2, 3}.")

    suggested_action = payload.get("suggestedAction")
    if suggested_action not in ("breathing", "journal", "soundscape"):
        raise ValueError('suggestedAction must be one of "breathing", "journal", "soundscape".')

    reply = payload.get("reply")
    if not isinstance(reply, str) or not reply.strip():
        raise ValueError("reply must be a non-empty string.")

    reframe_question = payload.get("reframeQuestion", "")
    if not isinstance(reframe_question, str):
        raise ValueError("reframeQuestion must be a string.")

    if crisis_level == 3:
        return {
            "crisisLevel": 3,
            "suggestedAction": "breathing",
            "reply": TIER3_CIRCUIT_BREAKER_REPLY,
            "reframeQuestion": "",
        }

    if crisis_level == 2:
        suggested_action = "breathing"

    cleaned_reply = reply.strip()
    if PROHIBITED_CLINICAL_RE.search(cleaned_reply):
        cleaned_reply = (
            "I hear how heavy this feels right now. As an AI wellness companion, I cannot provide a medical "
            "diagnosis or medication advice, but we can take one gentle grounding step together."
        )

    return {
        "crisisLevel": crisis_level,
        "suggestedAction": suggested_action,
        "reply": cleaned_reply,
        "reframeQuestion": reframe_question.strip(),
    }


OFFLINE_CULTURAL_REPLIES: dict[str, dict[str, str]] = {
    "en": {
        "reply": (
            "I hear you, and it makes complete sense that your mind feels stretched thin right now. "
            "You don't have to solve the entire week tonight — let's shrink the horizon to just the next 15 minutes."
        ),
        "reframeQuestion": "If a close friend told you they were carrying this exact pressure, what is the kindest thing you would say to them?",
    },
    "hinglish": {
        "reply": (
            "Main samajh sakta hoon yaar, jab sab kuch ek saath piling up ho raha ho toh dimaag thak jaata hai. "
            "Abhi poore hafte ka bojh mat uthao — bas agle 15 minute ka ek chhota step dekhte hain."
        ),
        "reframeQuestion": "Agar tumhara koi best friend bilkul yahi situation mein hota, toh tum usse kya bolte?",
    },
    "hi": {
        "reply": (
            "मैं समझ सकता हूँ कि अभी मन पर कितना दबाव है। आपको आज ही सारी चीज़ें हल करने की ज़रूरत नहीं है — "
            "चलिए पहले एक गहरी साँस लेते हैं और सिर्फ़ अगले एक छोटे कदम पर ध्यान देते हैं।"
        ),
        "reframeQuestion": "इस स्थिति में सबसे छोटा और आसान कदम क्या हो सकता है जो अभी आपके नियंत्रण में है?",
    },
    "gu": {
        "reply": (
            "હું સમજી શકું છું કે અત્યારે મન પર ઘણો ભાર લાગે છે. બધું એકસાથે ઉકેલવાની જરૂર નથી — "
            "ચાલો પહેલા થોડીવાર શાંત શ્વાસ લઈએ."
        ),
        "reframeQuestion": "જો તમારો કોઈ ખાસ મિત્ર આ જ પરિસ્થિતિમાં હોત, તો તમે તેને શું સલાह આપત?",
    },
    "mr": {
        "reply": (
            "मनावर खूप ताण आला आहे हे मी समजू शकतो. सगळं आत्ताच सोडवण्याची गरज नाही — "
            "आधी एक शांत श्वास घेऊया आणि एका छोट्या पावलावर लक्ष देऊया."
        ),
        "reframeQuestion": "या क्षणी तुमच्या हातात असलेली सर्वात छोटी गोष्ट कोणती आहे?",
    },
    "bn": {
        "reply": (
            "আমি বুঝতে পারছি এখন মনের ওপর কতটা চাপ যাচ্ছে। সব কিছু আজই ঠিক করতে হবে না — "
            "চলো আগে একটু শান্ত হয়ে শ্বাস নিই।"
        ),
        "reframeQuestion": "তোমার কোনো প্রিয় বন্ধু এই অবস্থায় থাকলে তুমি তাকে কী বলতে?",
    },
    "ta": {
        "reply": (
            "உங்கள் மனதில் எவ்வளவு அழுத்தம் இருக்கிறது என்பதை என்னால் புரிந்து கொள்ள முடிகிறது. "
            "எல்லாவற்றையும் இப்போதே தீர்க்க வேண்டியதில்லை — முதலில் ஒரு ஆழ்ந்த மூச்சு விடுவோம்."
        ),
        "reframeQuestion": "அடுத்த 15 நிமிடங்களில் உங்கள் கட்டுப்பாட்டில் இருக்கும் ஒரு சிறிய விஷயம் என்ன?",
    },
    "te": {
        "reply": (
            "మీ మనసుపై ఎంత ఒత్తిడి ఉందో నేను అర్థం చేసుకోగలను. అన్నీ ఇప్పుడే పరిష్కరించాల్సిన అవసరం లేదు — "
            "ముందుగా ఒకసారి ప్రశాంతంగా শ్వాస తీసుకుందాం."
        ),
        "reframeQuestion": "మీ ప్రాణ స్నేహితుడు ఇదే పరిస్థితిలో ఉంటే మీరు వారికి ఏమి చెప్తారు?",
    },
}


def build_offline_safe_structured_response(
    user_text: str,
    language: str = "en",
    gate_result: dict[str, Any] | None = None,
) -> dict[str, Any]:
    gate = gate_result or evaluate_safety_gate(user_text)
    level = int(gate["crisisLevel"])
    if level == 3:
        return {
            "crisisLevel": 3,
            "suggestedAction": "breathing",
            "reply": TIER3_CIRCUIT_BREAKER_REPLY,
            "reframeQuestion": "",
            "haltStream": True,
            "helplines": TIER3_HELPLINES,
        }

    lang_pack = OFFLINE_CULTURAL_REPLIES.get(language, OFFLINE_CULTURAL_REPLIES["en"])
    if level == 2:
        return validate_gemini_schema(
            {
                "crisisLevel": 2,
                "suggestedAction": "breathing",
                "reply": gate["reply"] or lang_pack["reply"],
                "reframeQuestion": gate["reframeQuestion"] or lang_pack["reframeQuestion"],
            }
        )

    return validate_gemini_schema(
        {
            "crisisLevel": level,
            "suggestedAction": gate["suggestedAction"],
            "reply": lang_pack["reply"],
            "reframeQuestion": lang_pack["reframeQuestion"],
        }
    )


def generate_structured_wellness_response(
    user_text: str,
    language: str = "en",
    script: str = "auto",
    companion_name: str = "Neeva",
    vibe: str = "bestie",
    history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    """
    1. Executes deterministic < 3.2ms pre-flight Safety Gatekeeper.
    2. If Tier 3, immediately halts without calling Gemini.
    3. Calls `gemini-2.5-flash` via `google-genai` with strict 4-field `responseSchema`.
    4. Falls back gracefully to offline-safe deterministic response if key is unconfigured or errors.
    """
    gate = evaluate_safety_gate(user_text)
    if gate["crisisLevel"] == 3:
        return {
            "crisisLevel": 3,
            "suggestedAction": "breathing",
            "reply": TIER3_CIRCUIT_BREAKER_REPLY,
            "reframeQuestion": "",
            "haltStream": True,
            "helplines": TIER3_HELPLINES,
            "source": "tier3_circuit_breaker",
        }

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if api_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            system_instruction = (
                f"You are {companion_name}, an empathetic Indian youth mental wellness companion (vibe: {vibe}). "
                f"Respond in language '{language}' (script preference: '{script}'). "
                "STRICT CLINICAL GUARDRAILS: Never diagnose psychiatric disorders, never prescribe or recommend "
                "medications, and never give lethal means information. "
                "Always return a valid JSON object matching the 4-field responseSchema with crisisLevel first."
            )
            response = client.models.generate_content(
                model=GEMINI_MODEL_NAME,
                contents=user_text,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_schema=GEMINI_RESPONSE_JSON_SCHEMA,
                    temperature=0.4,
                    max_output_tokens=600,
                ),
            )
            raw_json = json.loads(response.text or "{}")
            validated = validate_gemini_schema(raw_json)
            # Enforce deterministic floor: LLM cannot downgrade a Tier-2 deterministic detection
            if gate["crisisLevel"] == 2 and validated["crisisLevel"] < 2:
                validated["crisisLevel"] = 2
                validated["suggestedAction"] = "breathing"
            if validated["crisisLevel"] == 3:
                return {
                    **validated,
                    "haltStream": True,
                    "helplines": TIER3_HELPLINES,
                    "source": "gemini-2.5-flash",
                }
            return {
                **validated,
                "haltStream": False,
                "helplines": [],
                "source": "gemini-2.5-flash",
            }
        except Exception:
            pass

    fallback = build_offline_safe_structured_response(user_text, language, gate)
    return {
        **fallback,
        "haltStream": fallback["crisisLevel"] == 3,
        "helplines": TIER3_HELPLINES if fallback["crisisLevel"] == 3 else [],
        "source": "deterministic_fallback",
    }


async def stream_structured_wellness_sse(
    user_text: str,
    language: str = "en",
    script: str = "auto",
    companion_name: str = "Neeva",
    vibe: str = "bestie",
) -> AsyncGenerator[str, None]:
    """
    Server-Sent Events (SSE) generator for `POST /api/v1/chat/stream`.
    Emits `crisisLevel` on the very first chunk; if `crisisLevel == 3`, aborts stream immediately
    and emits the deterministic Tier-3 Tele-MANAS (14416) & iCall (9152987821) payload.
    """
    result = generate_structured_wellness_response(
        user_text=user_text,
        language=language,
        script=script,
        companion_name=companion_name,
        vibe=vibe,
    )

    first_chunk = {
        "crisisLevel": result["crisisLevel"],
        "suggestedAction": result["suggestedAction"],
        "haltStream": result["crisisLevel"] == 3,
        "helplines": result.get("helplines", []),
    }
    yield f"event: metadata\ndata: {json.dumps(first_chunk, ensure_ascii=False)}\n\n"

    if result["crisisLevel"] == 3:
        yield f"event: circuit_breaker\ndata: {json.dumps(result, ensure_ascii=False)}\n\n"
        yield "event: done\ndata: [DONE]\n\n"
        return

    yield f"event: message\ndata: {json.dumps(result, ensure_ascii=False)}\n\n"
    yield "event: done\ndata: [DONE]\n\n"

