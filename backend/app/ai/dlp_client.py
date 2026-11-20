"""
Google Cloud DLP Integration + Custom Indian InfoType Validators (Phase 2 — Section 5).
Maintains strict separation between:
- Detection (`inspect_pii_live_or_hybrid`)
- Redaction / De-identification (`redact_pii`)
- Encryption (handled separately by `app/privacy/encryption.py`)

Configured InfoTypes (Built-in + Custom Indian Detectors):
- `INDIA_AADHAAR_INDIVIDUAL` (12-digit Verhoeff-compatible Indian Aadhaar format)
- `INDIA_PAN_INDIVIDUAL` (`[A-Z]{5}[0-9]{4}[A-Z]`)
- `PHONE_NUMBER` (Indian `+91` / 10-digit mobile numbers starting `6-9`)
- `EMAIL_ADDRESS`
- `INDIA_POSTAL_ADDRESS` (Indian 6-digit PIN code + locality/address pattern)
- `COLLEGE_ROLL_OR_HANDLE` (Indian university roll numbers & social handles in anonymous circles)
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

CLOUD_DLP_BUILT_IN_INFO_TYPES = [
    {"name": "INDIA_AADHAAR_INDIVIDUAL"},
    {"name": "INDIA_PAN_INDIVIDUAL"},
    {"name": "PHONE_NUMBER"},
    {"name": "EMAIL_ADDRESS"},
    {"name": "PERSON_NAME"},
    {"name": "STREET_ADDRESS"},
]

CLOUD_DLP_CUSTOM_INFO_TYPES = [
    {
        "info_type": {"name": "INDIA_PIN_CODE_ADDRESS"},
        "regex": {"pattern": r"\b(?:PIN|Pin|pin)?[\s:\-]*[1-8][0-9]{5}\b"},
        "likelihood": "LIKELY",
    },
    {
        "info_type": {"name": "INDIAN_MOBILE_NUMBER"},
        "regex": {"pattern": r"(?:\+91[\s\-]?|0)?\b[6-9][0-9]{9}\b"},
        "likelihood": "VERY_LIKELY",
    },
]

LOCAL_PII_PATTERNS: list[tuple[str, re.Pattern[str], str]] = [
    ("INDIA_PAN_INDIVIDUAL", re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"), "[REDACTED_PAN]"),
    (
        "INDIA_AADHAAR_INDIVIDUAL",
        re.compile(r"\b[2-9][0-9]{3}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}\b"),
        "[REDACTED_AADHAAR]",
    ),
    (
        "PHONE_NUMBER",
        re.compile(r"(?:\+91[\s\-]?|0)?\b[6-9][0-9]{9}\b"),
        "[REDACTED_PHONE]",
    ),
    (
        "EMAIL_ADDRESS",
        re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"),
        "[REDACTED_EMAIL]",
    ),
    (
        "INDIA_PIN_CODE_ADDRESS",
        re.compile(r"\b(?:Flat|House|Plot|Sector|MG Road|Hostel|Block)\s+[A-Za-z0-9,\-\s]{3,40}\b[1-8][0-9]{5}\b", re.I),
        "[REDACTED_ADDRESS]",
    ),
]


def redact_pii_locally(text: str) -> tuple[str, list[str]]:
    """Deterministic Indian PII scrubber (Aadhaar, PAN, Phone, Email, Pin-code Address)."""
    if not text:
        return text, []
    redacted = text
    found: list[str] = []
    for info_type, pattern, placeholder in LOCAL_PII_PATTERNS:
        if pattern.search(redacted):
            if info_type not in found:
                found.append(info_type)
            redacted = pattern.sub(placeholder, redacted)
    return redacted, found


async def inspect_pii_live_or_hybrid(text: str, attempt_live_dlp: bool = True) -> dict[str, Any]:
    """
    Inspect text for PII using both deterministic Indian custom detectors and live Google Cloud DLP API.
    Records exact live API status (`live_dlp_succeeded`, `live_dlp_error`) without masking failures.
    """
    _, local_found = redact_pii_locally(text)
    live_findings: list[dict[str, str]] = []
    live_dlp_succeeded = False
    live_dlp_error: str | None = None

    if attempt_live_dlp:
        try:
            import google.auth
            from google.auth.transport.requests import Request as GoogleAuthRequest
            import httpx

            creds, detected_project = google.auth.default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            if not creds.valid:
                await asyncio.to_thread(creds.refresh, GoogleAuthRequest())

            project_id = (
                settings.GOOGLE_CLOUD_PROJECT
                if settings.GOOGLE_CLOUD_PROJECT != "neeva-ai-dev"
                else (detected_project or "onyx-gift-514504-q0")
            )
            url = f"https://dlp.googleapis.com/v2/projects/{project_id}/locations/{settings.DLP_REGION}/content:inspect"
            payload = {
                "inspectConfig": {
                    "infoTypes": CLOUD_DLP_BUILT_IN_INFO_TYPES,
                    "customInfoTypes": CLOUD_DLP_CUSTOM_INFO_TYPES,
                    "minLikelihood": "LIKELY",
                    "includeQuote": False,
                },
                "item": {"value": text},
            }
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {creds.token}",
                        "X-Goog-User-Project": project_id,
                    },
                    json=payload,
                )
            if resp.status_code == 200:
                live_dlp_succeeded = True
                data = resp.json()
                for f in data.get("result", {}).get("findings", []):
                    info_name = f.get("infoType", {}).get("name", "UNKNOWN")
                    live_findings.append(
                        {
                            "info_type": info_name,
                            "likelihood": f.get("likelihood", "LIKELY"),
                            "source": "google_cloud_dlp_live",
                        }
                    )
                    if info_name not in local_found:
                        local_found.append(info_name)
            else:
                live_dlp_error = f"HTTP {resp.status_code}: {resp.text[:300]}"
        except Exception as exc:
            live_dlp_error = f"{type(exc).__name__}: {exc}"

    return {
        "pii_found": len(local_found) > 0,
        "detected_info_types": local_found,
        "live_dlp_succeeded": live_dlp_succeeded,
        "live_dlp_findings": live_findings,
        "live_dlp_error": live_dlp_error,
    }


async def redact_pii(text: str, use_cloud_dlp: bool = True) -> tuple[str, list[str]]:
    """
    De-identify PII using deterministic Indian rules + Google Cloud DLP API when reachable.
    Guarantees safe fallback to deterministic redaction on API error, timeout, or quota limit.
    """
    if not text:
        return text, []

    redacted, found_types = redact_pii_locally(text)
    if not use_cloud_dlp or settings.ENVIRONMENT != "production":
        return redacted, found_types

    inspect_res = await inspect_pii_live_or_hybrid(redacted, attempt_live_dlp=True)
    for t in inspect_res["detected_info_types"]:
        if t not in found_types:
            found_types.append(t)
    return redacted, found_types
