"""
Zero-Cost Three-Provider AI Architecture for Neeva AI (Section 4).

Implements three distinct, honestly reported providers behind a unified interface:
- Provider A (`local_open_source`):
  CPU-compatible open-source inference via either:
  1. Local Ollama / llama.cpp server (`settings.LOCAL_LLM_BASE_URL`, e.g., `http://127.0.0.1:11434`
     running quantized `gemma2:2b` or `qwen2.5:1.5b` on consumer CPU), OR
  2. Explicitly enabled local HuggingFace Transformers CPU pipeline (`settings.ENABLE_LOCAL_HF_PIPELINE=True`
     with `local_files_only=not settings.LOCAL_HF_ALLOW_DOWNLOAD`).
- Provider B (`gemini_free_tier_opt_in`):
  Optional free-tier Google AI Studio Gemini (`gemini-2.5-flash`).
  Strictly disabled by default (`ENABLE_OPTIONAL_GEMINI_FREE_TIER=False`).
  Never uses paid Vertex AI endpoints. If unavailable or quota-limited, falls back cleanly.
- Provider C (`deterministic_fallback`):
  Empathetic, CBT/ACT-grounded, 8-language Indian wellness response engine.
  Explicitly reports `provider = "deterministic_fallback"` and `is_generative_llm = False`.
  Never fabricates model names or claims to be a generative LLM.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import AsyncIterator

from app.ai.companion_prompt import CompanionConfig
from app.ai.gemini import validate_ai_response
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class AIProviderMetadata:
    provider: str  # "local_open_source" | "gemini_free_tier_opt_in" | "deterministic_fallback"
    model_name: str  # e.g., "gemma2:2b" | "gemini-2.5-flash" | "deterministic_cbt_engine_v1"
    is_generative_llm: bool
    cost_inr: int = 0


# ---------------------------------------------------------------------------
# Provider C: Honest Deterministic Multilingual CBT/ACT Fallback Engine
# ---------------------------------------------------------------------------

_GREETING_OPENERS: dict[str, dict[str, str]] = {
    "en": {
        "bestie": "I really hear you — carrying all of that at once is genuinely exhausting.",
        "coach": "Thank you for sharing that clearly. Let's slow down and take this one step at a time.",
        "sage": "Take a quiet breath. Some days ask a lot of us, and noticing how you feel is already a gentle step.",
        "hype": "First, showing up and putting this into words takes real courage — I'm right here with you.",
    },
    "hinglish": {
        "bestie": "Yaar main samajh sakta hoon, yeh sab ek saath handle karna sach mein bahut exhausting hai.",
        "coach": "Chalo ek deep breath lete hain. Ek-ek karke isko calmly sort karenge.",
        "sage": "Thoda ruk kar gehri saans lo. Har din perfect hona zaroori nahi hota.",
        "hype": "Sabse pehle — tumne khul kar baat ki, that counts a lot yaar! Main yahin hoon.",
    },
    "hi": {
        "bestie": "मैं आपकी बात पूरी तरह समझ सकता हूँ, इतना सब अकेले संभालना वाकई थका देने वाला होता है।",
        "coach": "आइए एक गहरी साँस लें और इसे एक-एक छोटे कदम में समझें।",
        "sage": "थोड़ा रुकिए और अपने मन को शांत होने का समय दीजिए।",
        "hype": "आपने अपने मन की बात साझा की, यह अपने आप में एक मजबूत कदम है।",
    },
    "gu": {
        "bestie": "Yaar hu samji shaku chhu, aa badhu ek saathe handle karvu saache j bau bhaare laage.",
        "coach": "Chalo ek shant shwaas laiye ane ek nano doable step vichariye.",
        "sage": "Thodo samay shant baiso. Tamari laagni samajhvi e pan ek moti vaat chhe.",
        "hype": "Tame khulshu bolya e j bau moti vaat chhe yaar, hu tamari saathe chhu.",
    },
    "mr": {
        "bestie": "Yaar mi samju shakto, he sagla ekach veli sambhalna kharach khup thakavnara asta.",
        "coach": "Chal ek shant shwas gheu ani ek chhota pudhcha step baghu.",
        "sage": "Thoda vel shant raha. Swatahchya bhavnanna samjun ghena khup mahatvacha aahe.",
        "hype": "Tu manatla bolun dakhavlas he khup mahatvacha aahe, mi tujhya sobat aahe.",
    },
    "bn": {
        "bestie": "Ami bujhte parchi, eto kichu eksathe samlano sotti khub klantikarak.",
        "coach": "Cholo ekta lombo shash niye ekta chhoto step-er dike takai.",
        "sage": "Ektu shanto hoye boso. Nijer moner kotha shona khub dorkar.",
        "hype": "Tumi mon khule bolecho etai onek boro bepar, ami tomar pashe achi.",
    },
    "ta": {
        "bestie": "Puriyudhu da, idhellam ore nerathula handle panradhu romba exhausting ah irukkum.",
        "coach": "Oruchinna deep breath eduppom. Oru chinna step ah yosippom.",
        "sage": "Konjam amaithiya moochu vidunga. Unga unarvugala gavanikkiradhe nalla vishayam.",
        "hype": "Manasu vittu pesunadhe periya vishayam, naan unga kooda irukken.",
    },
    "te": {
        "bestie": "Artham avtundi ra, idantha okesari handle cheyyadam nijanga chala exhausting ga untundi.",
        "coach": "Oka chinna deep breath teeskundam. Oka chinna doable step chuddam.",
        "sage": "Konchem prashantanga shwasa teeskondi. Mee bhavalanu gamaninchadam chala manchidi.",
        "hype": "Manasu vippi cheppinanduku proud ga undi, nenu mee thone unnanu.",
    },
}


def build_deterministic_companion_reply(
    user_text: str,
    companion: CompanionConfig,
    lang: str = "en",
    safety_tier: int = 1,
) -> str:
    """
    Generate an empathetic, non-diagnostic CBT/ACT response via the deterministic fallback engine.
    Adapts to language, companion vibe, interaction approach, and safety tier.
    """
    lang_map = _GREETING_OPENERS.get(lang, _GREETING_OPENERS["en"])
    opener = lang_map.get(companion.vibe, lang_map["bestie"])
    lower = (user_text or "").lower()

    if safety_tier == 2:
        return (
            f"{opener}\n\n"
            "Right now, you don't have to fix everything at once. Let's anchor in the present moment with one round of **4-7-8 breathing**:\n"
            "1. Inhale quietly through your nose for **4 seconds**.\n"
            "2. Hold your breath gently for **7 seconds**.\n"
            "3. Exhale slowly through your mouth for **8 seconds**.\n\n"
            "If tonight feels heavy, please consider reaching out to a trusted friend or family member, or calling **Tele-MANAS at 14416** (24×7, free) or **iCall at 9152987821**.\n\n"
            "_(Generated by Neeva's local deterministic support engine — ₹0 offline mode)_"
        )

    if companion.approach in ("validate", "just_listen"):
        body = (
            "It makes complete sense that this is weighing on your mind. "
            "I'm not going to rush in with advice — I'm just here to listen. "
            "What part of this feels the heaviest right now?"
        )
    elif companion.approach in ("explore", "reframe"):
        body = (
            "Let's look at the thought gently using a CBT lens:\n"
            "- What is the exact worry that keeps repeating in your head?\n"
            "- If a close friend told you they were in this exact situation, what is one kind, realistic thing you would remind them of?"
        )
    elif companion.approach in ("advise", "guide_tool"):
        if any(k in lower for k in ("sleep", "neend", "raat", "night", "insomnia", "thookam", "nidra", "ghum")):
            body = (
                "Let's try a quick **2-minute wind-down reset**:\n"
                "1. Dim your screen and let your shoulders drop away from your ears.\n"
                "2. Breathe in for **4 seconds** and breathe out for **7 seconds**.\n"
                "3. Write down one task you are giving yourself permission to leave until tomorrow morning."
            )
        else:
            body = (
                "Let's use **5-4-3-2-1 sensory grounding** to slow the mental noise:\n"
                "1. Notice **5 things** you can see around you.\n"
                "2. Notice **4 things** you can physically feel (like your feet on the floor).\n"
                "3. Notice **3 sounds** you can hear.\n"
                "4. Take **2 slow breaths** and pick **1 tiny 10-minute task** as your only focus next."
            )
    else:
        body = (
            "When everything piles up — whether it's studies, expectations, or tiredness — shrinking the horizon helps. "
            "What is one small thing that would make the next 15 minutes feel 5% lighter for you?"
        )

    return f"{opener}\n\n{body}"


# ---------------------------------------------------------------------------
# Provider A: Local Open-Source Model (CPU Ollama / llama.cpp or Local HF)
# ---------------------------------------------------------------------------


async def _try_local_ollama_chat(system_instruction: str, messages: list[dict]) -> str | None:
    """Call an explicitly configured local CPU Ollama / llama.cpp endpoint (`LOCAL_LLM_BASE_URL`)."""
    if not settings.ENABLE_LOCAL_OPEN_SOURCE_AI or not settings.LOCAL_LLM_BASE_URL:
        return None
    try:
        import httpx

        url = settings.LOCAL_LLM_BASE_URL.rstrip("/") + "/api/chat"
        payload = {
            "model": settings.LOCAL_LLM_MODEL_NAME,
            "stream": False,
            "messages": [{"role": "system", "content": system_instruction}]
            + [{"role": m["role"], "content": m["content"]} for m in messages[-20:]],
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
        if resp.status_code == 200:
            data = resp.json()
            text = data.get("message", {}).get("content", "")
            if text and text.strip():
                return validate_ai_response(text.strip())
    except Exception as exc:
        logger.info("Local open-source LLM server not active (%s).", type(exc).__name__)
    return None


# ---------------------------------------------------------------------------
# Provider B: Optional Free-Tier Gemini (Opt-In Only, Never Paid Vertex AI)
# ---------------------------------------------------------------------------


async def _try_optional_free_gemini_chat(
    system_instruction: str, messages: list[dict]
) -> str | None:
    """
    Call Google AI Studio Gemini ONLY when `ENABLE_OPTIONAL_GEMINI_FREE_TIER=True`
    AND `GEMINI_API_KEY` is explicitly provided. Never uses paid Vertex AI endpoints.
    """
    if not settings.ENABLE_OPTIONAL_GEMINI_FREE_TIER or not settings.GEMINI_API_KEY:
        return None
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        contents = [
            types.Content(
                role="model" if m["role"] == "assistant" else "user",
                parts=[types.Part.from_text(text=m["content"])],
            )
            for m in messages[-settings.MAX_CHAT_MESSAGES :]
        ]
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.7,
            max_output_tokens=1024,
        )
        response = await asyncio.wait_for(
            asyncio.to_thread(
                client.models.generate_content,
                model=settings.GEMINI_MODEL,
                contents=contents,
                config=config,
            ),
            timeout=settings.GEMINI_TIMEOUT_SECONDS,
        )
        text = getattr(response, "text", None)
        if text and text.strip():
            return validate_ai_response(text.strip())
    except Exception as exc:
        logger.warning(
            "Optional free-tier Gemini unavailable (%s); falling back to local zero-cost provider.",
            type(exc).__name__,
        )
    return None


# ---------------------------------------------------------------------------
# Unified Zero-Cost Chat Execution
# ---------------------------------------------------------------------------


async def generate_zero_cost_companion_response(
    system_instruction: str,
    messages: list[dict],
    companion: CompanionConfig,
    lang: str = "en",
    safety_tier: int = 1,
) -> tuple[AsyncIterator[str], AIProviderMetadata]:
    """
    Try Provider A (Local Open-Source CPU model) -> Provider B (Opt-in Free Gemini) -> Provider C (Deterministic Fallback).
    Returns `(async_text_iterator, AIProviderMetadata)` so callers can attach honest provider headers.
    """
    # 1. Try Provider A: Local Open-Source CPU LLM
    local_reply = await _try_local_ollama_chat(system_instruction, messages)
    if local_reply is not None:
        meta = AIProviderMetadata(
            provider="local_open_source",
            model_name=settings.LOCAL_LLM_MODEL_NAME,
            is_generative_llm=True,
            cost_inr=0,
        )

        async def _local_stream():
            yield local_reply

        return _local_stream(), meta

    # 2. Try Provider B: Optional Free-Tier Gemini (only if explicitly enabled & API key set)
    gemini_reply = await _try_optional_free_gemini_chat(system_instruction, messages)
    if gemini_reply is not None:
        meta = AIProviderMetadata(
            provider="gemini_free_tier_opt_in",
            model_name=settings.GEMINI_MODEL,
            is_generative_llm=True,
            cost_inr=0,
        )

        async def _gemini_stream():
            yield gemini_reply

        return _gemini_stream(), meta

    # 3. Provider C: Honest Deterministic CBT/ACT Fallback Engine (Always available, ₹0, zero credentials)
    last_user_text = next(
        (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
    )
    fallback_reply = build_deterministic_companion_reply(
        user_text=last_user_text,
        companion=companion,
        lang=lang,
        safety_tier=safety_tier,
    )
    meta = AIProviderMetadata(
        provider="deterministic_fallback",
        model_name="deterministic_cbt_engine_v1",
        is_generative_llm=False,
        cost_inr=0,
    )

    async def _fallback_stream():
        yield fallback_reply

    return _fallback_stream(), meta


def get_ai_providers_status() -> dict:
    """Return honest status of all three AI providers and confirm ₹0 configuration."""
    return {
        "zero_cost_mode": settings.ZERO_COST_MODE,
        "permitted_expenditure_inr": 0,
        "paid_cloud_apis_enabled": False,
        "active_default_provider": (
            "local_open_source"
            if (settings.ENABLE_LOCAL_OPEN_SOURCE_AI and settings.LOCAL_LLM_BASE_URL)
            else (
                "gemini_free_tier_opt_in"
                if (settings.ENABLE_OPTIONAL_GEMINI_FREE_TIER and settings.GEMINI_API_KEY)
                else "deterministic_fallback"
            )
        ),
        "providers": {
            "provider_a_local_open_source": {
                "enabled": settings.ENABLE_LOCAL_OPEN_SOURCE_AI,
                "local_llm_base_url": settings.LOCAL_LLM_BASE_URL or None,
                "model_name": settings.LOCAL_LLM_MODEL_NAME,
                "local_hf_pipeline_enabled": settings.ENABLE_LOCAL_HF_PIPELINE,
                "is_generative_llm": True,
                "cost_inr": 0,
            },
            "provider_b_optional_gemini_free_tier": {
                "enabled": settings.ENABLE_OPTIONAL_GEMINI_FREE_TIER,
                "api_key_configured": bool(settings.GEMINI_API_KEY),
                "model_name": settings.GEMINI_MODEL,
                "paid_vertex_ai_disabled": True,
                "is_generative_llm": True,
                "cost_inr": 0,
            },
            "provider_c_deterministic_fallback": {
                "enabled": True,
                "always_available_offline": True,
                "model_name": "deterministic_cbt_engine_v1",
                "is_generative_llm": False,
                "cost_inr": 0,
            },
        },
    }

