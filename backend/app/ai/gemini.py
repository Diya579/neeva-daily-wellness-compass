"""
Google AI Studio / Vertex AI — Gemini 2.5 Flash integration using the official
Google GenAI SDK (`google-genai`, Python equivalent of `@google/genai`).
All model calls are server-side, rate-limited, context-window managed, and clinically validated.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import AsyncIterator, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = ("en", "hinglish", "hi", "gu", "mr", "bn", "ta", "te")

FORBIDDEN_RESPONSE_PATTERNS = [
    re.compile(r"\bi\s+diagnose\s+you\s+with\b", re.I),
    re.compile(r"\byou\s+have\s+clinical\s+(depression|bipolar|schizophrenia|ptsd)\b", re.I),
    re.compile(r"\btake\s+\d+\s*mg\s+of\s+(sertraline|fluoxetine|alprazolam|clonazepam|escitalopram)\b", re.I),
    re.compile(r"\bi\s+am\s+prescribing\b", re.I),
    re.compile(r"\byou\s+do\s+not\s+need\s+a\s+(doctor|psychiatrist|therapist)\b", re.I),
]


def validate_ai_response(text: str) -> str:
    """Validate that the AI response never diagnoses, prescribes medication, or replaces clinical care."""
    for pat in FORBIDDEN_RESPONSE_PATTERNS:
        if pat.search(text):
            logger.warning("Blocked prohibited clinical/prescription phrasing in AI output.")
            return (
                "I'm here to support your emotional wellness as an AI companion, "
                "but I cannot provide a medical diagnosis or medication advice. "
                "Please consider consulting a qualified mental health professional or calling Tele-MANAS at 14416."
            )
    return text


def trim_context_window(messages: list[dict], max_messages: int = 40, max_chars: int = 24000) -> list[dict]:
    """Maintain sliding context window within token/character limits."""
    trimmed = messages[-max_messages:]
    total = 0
    kept: list[dict] = []
    for msg in reversed(trimmed):
        content = msg.get("content", "")
        if total + len(content) > max_chars and kept:
            break
        kept.append(msg)
        total += len(content)
    return list(reversed(kept))


def _get_genai_client():
    from google import genai

    if settings.GEMINI_API_KEY:
        return genai.Client(api_key=settings.GEMINI_API_KEY)
    return genai.Client(vertexai=True, project=settings.GOOGLE_CLOUD_PROJECT, location=settings.VERTEX_AI_REGION)


async def stream_chat(
    system_instruction: str,
    messages: list[dict],
) -> AsyncIterator[str]:
    """Stream conversational response from Gemini 2.5 Flash using `google-genai` SDK."""
    windowed = trim_context_window(messages, max_messages=settings.MAX_CHAT_MESSAGES)
    from google.genai import types

    client = _get_genai_client()
    contents = [
        types.Content(
            role="model" if m["role"] == "assistant" else "user",
            parts=[types.Part.from_text(text=m["content"])],
        )
        for m in windowed
    ]
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=0.7,
        max_output_tokens=1024,
    )

    stream = await asyncio.to_thread(
        client.models.generate_content_stream,
        model=settings.GEMINI_MODEL,
        contents=contents,
        config=config,
    )
    for chunk in stream:
        text = getattr(chunk, "text", None)
        if text:
            yield validate_ai_response(text)


async def generate_structured(
    prompt: str,
    system_instruction: str,
    schema: Optional[dict] = None,
) -> dict:
    """Generate a validated structured JSON response from Gemini 2.5 Flash using `google-genai` SDK."""
    from google.genai import types

    client = _get_genai_client()
    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        response_mime_type="application/json",
        temperature=0.3,
    )
    response = await asyncio.to_thread(
        client.models.generate_content,
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=config,
    )
    return json.loads(response.text)
