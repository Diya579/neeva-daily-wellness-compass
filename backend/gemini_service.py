"""
Gemini Structured JSON & SSE Service (/backend/gemini_service.py)
- Supports BOTH Google AI Studio `AQ.` Authentication Keys and legacy `AIza` keys (>= 30 chars)
- Forces Native Google AI Studio REST endpoint (`https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`)
  with `x-goog-api-key` header (NEVER routes `AQ.` keys to Vertex AI and NEVER uses `Authorization: Bearer`)
- Strict 4-field structured JSON schema with `crisisLevel` ordered FIRST (INTEGER without integer `enum` array
  to avoid HTTP 400 INVALID_ARGUMENT on Gemini's schema validator):
    1. crisisLevel: integer 0 | 1 | 2 | 3 (validated in application code)
    2. suggestedAction: string enum "breathing" | "journal" | "soundscape"
    3. reply: empathetic, culturally grounded response mirroring the user's language/Hinglish style
    4. reframeQuestion: tailored Socratic CBT question
- Pre-flight and mid-stream Tier-3 Hard Circuit Breaker (Tele-MANAS 14416 & iCall 9152987821)
"""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, AsyncGenerator

from dotenv import load_dotenv

# Always load backend/.env regardless of current working directory
load_dotenv(Path(__file__).resolve().parent / ".env", override=True)

from safety import (  # noqa: E402
    TIER3_CIRCUIT_BREAKER_REPLY,
    TIER3_HELPLINES,
    evaluate_safety_gate,
)

logger = logging.getLogger(__name__)

GEMINI_MODEL_NAME = "gemini-3.1-flash-lite"
GEMINI_FALLBACK_MODELS: tuple[str, ...] = (
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
)
GOOGLE_AI_STUDIO_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

# Strict 4-Field JSON Schema with crisisLevel ordered FIRST.
# Note: `crisisLevel` uses type INTEGER WITHOUT an integer `enum` array (Gemini rejects integer enums with 400).
# `suggestedAction` keeps the STRING enum constraint.
GEMINI_RESPONSE_JSON_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "required": ["crisisLevel", "suggestedAction", "reply", "reframeQuestion"],
    "propertyOrdering": ["crisisLevel", "suggestedAction", "reply", "reframeQuestion"],
    "properties": {
        "crisisLevel": {
            "type": "INTEGER",
            "description": "0 for normal/casual conversation, 1 for academic/everyday stress, 2 for passive distress/burnout, 3 for acute self-harm crisis.",
        },
        "suggestedAction": {
            "type": "STRING",
            "description": "Recommended micro-tool widget to launch in the UI.",
            "enum": ["breathing", "journal", "soundscape"],
        },
        "reply": {
            "type": "STRING",
            "description": "Warm, natural, empathetic, non-clinical CBT/ACT response directly addressing the user's message in their exact language/Hinglish style.",
        },
        "reframeQuestion": {
            "type": "STRING",
            "description": "One gentle, conversational Socratic CBT question tailored specifically to what the user just said (empty string if crisisLevel == 3).",
        },
    },
}

PROHIBITED_CLINICAL_RE = re.compile(
    r"\b(you\s+(have|are\s+suffering\s+from|are\s+diagnosed\s+with)\s+"
    r"(clinical\s+depression|major\s+depressive\s+disorder|bipolar\s+disorder|schizophrenia|ptsd)|"
    r"prescribe|take\s+\d+\s*mg\s+of|start\s+taking\s+(ssri|fluoxetine|sertraline|escitalopram|alprazolam|xanax))\b",
    re.IGNORECASE,
)


def is_valid_gemini_api_key(api_key: str) -> bool:
    """Accept both new Google AI Studio `AQ.` keys and legacy `AIza` keys (length >= 30)."""
    key = (api_key or "").strip()
    return len(key) >= 30 and (key.startswith("AQ.") or key.startswith("AIza"))


def validate_gemini_schema(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Strictly enforce the 4-field schema with `crisisLevel` ordered FIRST
    and block any clinical diagnosis or medication advice.
    """
    if not isinstance(payload, dict):
        raise ValueError("Payload must be a JSON object.")

    crisis_level = payload.get("crisisLevel")
    if (
        not isinstance(crisis_level, int)
        or isinstance(crisis_level, bool)
        or crisis_level not in (0, 1, 2, 3)
    ):
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
            "Haan bolo yaar, main sun raha hoon. Jo bhi dimaag mein chal raha hai, bina kisi filter ke share karo — "
            "hum milke aaram se samjhenge."
        ),
        "reframeQuestion": "Abhi sabse zyada kya cheez tumhare mann pe bhaari lag rahi hai?",
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
        "reframeQuestion": "જો તમારો કોઈ ખાસ મિત્ર આ જ પરિસ્થિતિમાં હોત, તો તમે તેને શું સલાહ આપત?",
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
            "ముందుగా ఒకసారి ప్రశాంతంగా శ్వాస తీసుకుందాం."
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


def _call_native_google_ai_studio(
    api_key: str,
    user_text: str,
    system_instruction: str,
    history: list[dict[str, str]] | None = None,
) -> tuple[dict[str, Any], str]:
    """
    Call the native Google AI Studio REST API directly using `x-goog-api-key`.
    NEVER routes to Vertex AI and NEVER sends `Authorization: Bearer`.
    """
    preferred_model = os.getenv("GEMINI_MODEL", GEMINI_MODEL_NAME).strip() or GEMINI_MODEL_NAME
    candidate_models: list[str] = [preferred_model]
    for fallback_model in GEMINI_FALLBACK_MODELS:
        if fallback_model not in candidate_models:
            candidate_models.append(fallback_model)

    contents: list[dict[str, Any]] = []
    if history:
        for turn in history[-12:]:
            role = "model" if turn.get("role") == "assistant" else "user"
            content_text = str(turn.get("content", "")).strip()
            if content_text:
                contents.append({"role": role, "parts": [{"text": content_text}]})
    contents.append({"role": "user", "parts": [{"text": user_text}]})

    request_payload = {
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "contents": contents,
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": GEMINI_RESPONSE_JSON_SCHEMA,
            "temperature": 0.6,
            "maxOutputTokens": 600,
        },
    }
    encoded_body = json.dumps(request_payload).encode("utf-8")

    last_error: str = "No Gemini models attempted."
    for model_name in candidate_models:
        url = f"{GOOGLE_AI_STUDIO_BASE}/{model_name}:generateContent"
        req = urllib.request.Request(
            url,
            data=encoded_body,
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                body_text = resp.read().decode("utf-8")
                data = json.loads(body_text)
                candidates = data.get("candidates") or []
                if not candidates:
                    last_error = f"Model {model_name} returned empty candidates: {body_text[:300]}"
                    logger.error("[Gemini API] %s", last_error)
                    continue
                parts = candidates[0].get("content", {}).get("parts") or []
                raw_text = "".join(str(p.get("text", "")) for p in parts).strip()
                parsed = json.loads(raw_text)
                return parsed, model_name
        except urllib.error.HTTPError as http_err:
            err_body = http_err.read().decode("utf-8", errors="replace")
            last_error = f"HTTP {http_err.code} on {model_name}: {err_body[:400]}"
            logger.error("[Gemini API] %s", last_error)
            if http_err.code in (404, 429, 500, 503):
                continue
            break
        except Exception as exc:
            last_error = f"{type(exc).__name__} on {model_name}: {exc}"
            logger.error("[Gemini API] %s", last_error)
            continue

    raise RuntimeError(last_error)


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
    3. Calls native Google AI Studio REST endpoint (`x-goog-api-key`) with strict 4-field `responseSchema`.
    4. Falls back gracefully to offline-safe deterministic response only if key is missing or API fails.
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
    if is_valid_gemini_api_key(api_key):
        system_instruction = (
            f"You are {companion_name}, a warm, empathetic Indian youth mental wellness companion (vibe: {vibe}). "
            f"User language preference: '{language}', script style: '{script}'. "
            "LANGUAGE MIRRORING RULE (CRITICAL): If the user writes in Hinglish (Hindi typed in English/Roman letters, "
            "such as 'Arey sun toh', 'Yaar kal viva hai', 'bro thak gaya hoon'), you MUST reply naturally in warm, "
            "conversational Hinglish (Roman script) — like a close Indian friend — NOT stiff formal English or pure Devanagari. "
            "If they write in native Hindi/Gujarati/Marathi/Bengali/Tamil/Telugu or English, mirror their exact language and script. "
            "Tailor both `reply` and `reframeQuestion` directly to what the user just said (never give generic boilerplate). "
            "STRICT CLINICAL GUARDRAILS: Never diagnose psychiatric disorders, never recommend medications, and never provide self-harm instructions. "
            "Return ONLY a valid JSON object matching the 4-field responseSchema with crisisLevel (0, 1, 2, or 3) ordered first."
        )
        try:
            raw_json, used_model = _call_native_google_ai_studio(
                api_key=api_key,
                user_text=user_text,
                system_instruction=system_instruction,
                history=history,
            )
            validated = validate_gemini_schema(raw_json)
            if gate["crisisLevel"] == 2 and validated["crisisLevel"] < 2:
                validated["crisisLevel"] = 2
                validated["suggestedAction"] = "breathing"
            if validated["crisisLevel"] == 3:
                return {
                    **validated,
                    "haltStream": True,
                    "helplines": TIER3_HELPLINES,
                    "source": used_model,
                }
            return {
                **validated,
                "haltStream": False,
                "helplines": [],
                "source": used_model,
            }
        except Exception as exc:
            logger.error("[Gemini Service] Falling back to offline response after error: %s", exc)
    else:
        logger.warning(
            "[Gemini Service] GEMINI_API_KEY missing or unrecognized format (expected AQ.* or AIza* >= 30 chars)."
        )

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
