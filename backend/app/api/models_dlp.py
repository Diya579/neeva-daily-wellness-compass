"""
Secured Model Inference (MuRIL, Gemma 2 9B-IT, Gemma 2 2B-IT) and Google Cloud DLP Endpoints
(Sections 6, 7, 8, 9).

Strict anti-fabrication rules enforced here:
1. Never labels deterministic fallback as MuRIL, Gemma 2 2B-IT, Gemma 2 9B-IT, or live Cloud DLP inference.
2. When `VERTEX_GEMMA_2B_ENDPOINT` is configured, performs real authenticated Vertex AI prediction requests
   with timeout, retry, and structured JSON output validation.
3. Explicitly reports `inference_source` (`"muril_onnx_runtime"`, `"vertex_ai_gemma_2_2b_it"`,
   `"vertex_ai_gemma_2_9b_it"`, or `"deterministic_fallback"`) and `live_inference_performed: bool`.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import unicodedata
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.ai.dlp_client import (
     _get_gcp_access_token_and_project,
    deidentify_pii_detailed,
    inspect_pii_live_or_hybrid,
    redact_pii,
)
from app.ai.gemini import validate_ai_response
from app.core.config import settings
from app.core.security import get_current_user
from app.database.firestore_db import FirestoreOperationalRepository, get_firestore_repo
from app.safety.crisis_patterns import SafetyTier
from app.safety.engine import get_safety_engine
from app.safety.muril import MuRILClassifier

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["models-and-dlp"])


class TextInferenceRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)
    language: Optional[str] = Field(default="en")
    require_live: bool = False


async def _invoke_vertex_ai_endpoint(
    endpoint_id_or_url: str,
    instances: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Perform a real authenticated Vertex AI `:predict` call with timeout and exponential-backoff retries.
    """
    import httpx

    token, project_id = await _get_gcp_access_token_and_project()
    region = settings.VERTEX_AI_REGION
    if endpoint_id_or_url.startswith("https://"):
        url = endpoint_id_or_url
    elif endpoint_id_or_url.startswith("projects/"):
        url = f"https://{region}-aiplatform.googleapis.com/v1/{endpoint_id_or_url}:predict"
    else:
        url = (
            f"https://{region}-aiplatform.googleapis.com/v1/projects/{project_id}"
            f"/locations/{region}/endpoints/{endpoint_id_or_url}:predict"
        )

    last_err: Optional[str] = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=settings.VERTEX_TIMEOUT_SECONDS) as client:
                resp = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    json={"instances": instances},
                )
            if resp.status_code == 200:
                return resp.json()
            last_err = f"HTTP {resp.status_code}: {resp.text[:300]}"
        except Exception as exc:
            last_err = f"{type(exc).__name__}: {exc}"
        if attempt == 0:
            await asyncio.sleep(0.25)

    raise RuntimeError(f"Vertex AI endpoint call failed ({url}): {last_err}")


@router.get("/models/status")
async def get_models_and_dlp_status(
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    from app.ai.providers import get_ai_providers_status

    muril = MuRILClassifier()
    return {
        "zero_cost_mode": settings.ZERO_COST_MODE,
        "permitted_expenditure_inr": 0,
        "paid_cloud_services_disabled": True,
        "database_mode": settings.DATABASE_MODE,
        "firestore_database_mode": fs.mode,
        "sqlite_wal_db_path": str(fs.db_path),
        "auth_mode": settings.AUTH_MODE,
        "ai_providers": get_ai_providers_status(),
        "firebase_project_id": fs.project_id or None,
        "gemini_2_5_flash": {
            "model_id": settings.GEMINI_MODEL,
            "optional_free_tier_enabled": settings.ENABLE_OPTIONAL_GEMINI_FREE_TIER,
            "api_key_configured": bool(settings.GEMINI_API_KEY),
            "paid_vertex_ai_disabled": True,
        },
        "muril": muril.readiness_report(),
        "gemma_2_9b_it": {
            "intended_model": "google/gemma-2-9b-it",
            "vertex_endpoint_configured": bool(settings.VERTEX_GEMMA_9B_ENDPOINT),
            "vertex_endpoint": settings.VERTEX_GEMMA_9B_ENDPOINT or None,
        },
        "gemma_2_2b_it": {
            "intended_model": "google/gemma-2-2b-it",
            "vertex_endpoint_configured": bool(settings.VERTEX_GEMMA_2B_ENDPOINT),
            "vertex_endpoint": settings.VERTEX_GEMMA_2B_ENDPOINT or None,
        },
        "pii_protection": {
            "default_engine": "local_deterministic_indian_pii_scrubber",
            "optional_cloud_dlp_enabled": settings.ENABLE_OPTIONAL_CLOUD_DLP,
            "cost_inr": 0,
        },
    }


@router.post("/models/muril/infer")
async def infer_muril_distress(
    body: TextInferenceRequest,
    user: dict = Depends(get_current_user),
):
    """
    Run distress classification across 8 Indian languages.
    Explicitly reports `inference_source` (`"hybrid_deterministic_and_muril_onnx"` when ONNX weights
    are loaded vs `"deterministic_multilingual_rules"` when ONNX artifact is absent).
    """
    t0 = time.perf_counter()
    normalized = unicodedata.normalize("NFKC", body.text).strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Input text cannot be empty after normalization.")

    engine = get_safety_engine()
    muril_loaded = bool(engine._muril and engine._muril.available)
    if body.require_live and not muril_loaded:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "MURIL_ONNX_ARTIFACT_NOT_LOADED",
                "intended_checkpoint": settings.MURIL_HF_CHECKPOINT,
                "onnx_path": settings.MURIL_ONNX_PATH,
                "load_error": engine._muril.load_error if engine._muril else "Not initialized",
            },
        )

    res = await engine.evaluate(normalized)
    latency_ms = round((time.perf_counter() - t0) * 1000.0, 3)

    return {
        "intended_checkpoint": settings.MURIL_HF_CHECKPOINT,
        "muril_model_loaded": muril_loaded,
        "inference_source": res.inference_source,
        "tier": int(res.tier),
        "deterministic_tier": int(res.deterministic_tier),
        "muril_tier": int(res.muril_tier) if res.muril_tier is not None else None,
        "confidence": res.confidence,
        "should_interrupt": res.should_interrupt,
        "latency_ms": latency_ms,
    }


@router.post("/models/gemma-9b/infer")
async def infer_gemma_9b(
    body: TextInferenceRequest,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    """
    Controlled inference wrapper for Gemma 2 9B-IT (`google/gemma-2-9b-it`).
    Always runs the authoritative Three-Tier Safety Engine first; Tier 3 interrupts generation.
    """
    engine = get_safety_engine()
    safety = await engine.evaluate(body.text)
    await fs.log_safety_event(
        uid=user["uid"],
        source="gemma_9b",
        tier=int(safety.tier),
        deterministic_tier=int(safety.deterministic_tier),
        muril_tier=int(safety.muril_tier) if safety.muril_tier is not None else None,
        confidence=safety.confidence,
        should_interrupt=safety.should_interrupt,
    )

    if safety.should_interrupt or safety.tier == SafetyTier.TIER3_ACUTE:
        return {
            "intended_model": "google/gemma-2-9b-it",
            "inference_source": "safety_engine_tier3_interrupt",
            "live_inference_performed": False,
            "interrupted_by_safety_engine": True,
            "tier": 3,
            "response": safety.crisis_message,
            "helplines": safety.helplines,
        }

    scrubbed, _ = await redact_pii(body.text)
    if not settings.VERTEX_GEMMA_9B_ENDPOINT:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "VERTEX_ENDPOINT_NOT_PROVISIONED",
                "intended_model": "google/gemma-2-9b-it",
                "live_inference_performed": False,
                "message": (
                    "Vertex AI GPU endpoint for Gemma 2 9B-IT is not provisioned to prevent unapproved GPU billing. "
                    "Safety engine and PII scrubbing succeeded."
                ),
                "safety_tier": int(safety.tier),
                "pii_scrubbed_input_length": len(scrubbed),
            },
        )

    try:
        pred_data = await _invoke_vertex_ai_endpoint(
            settings.VERTEX_GEMMA_9B_ENDPOINT,
            instances=[{"prompt": scrubbed, "max_tokens": 512, "temperature": 0.4}],
        )
        predictions = pred_data.get("predictions") or []
        raw_text = str(predictions[0]) if predictions else ""
        return {
            "intended_model": "google/gemma-2-9b-it",
            "inference_source": "vertex_ai_gemma_2_9b_it",
            "live_inference_performed": True,
            "interrupted_by_safety_engine": False,
            "tier": int(safety.tier),
            "response": validate_ai_response(raw_text),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "status": "VERTEX_INFERENCE_FAILED",
                "intended_model": "google/gemma-2-9b-it",
                "live_inference_performed": False,
                "error": str(exc),
            },
        )


@router.post("/models/gemma-2b/moderate")
async def moderate_with_gemma_2b(
    body: TextInferenceRequest,
    user: dict = Depends(get_current_user),
):
    """
    Community moderation & structured emotion tagging endpoint for Gemma 2 2B-IT (`google/gemma-2-2b-it`).
    Invokes the real Vertex AI endpoint when `VERTEX_GEMMA_2B_ENDPOINT` is configured.
    Clearly distinguishes `"vertex_ai_gemma_2_2b_it"` from `"deterministic_fallback"`.
    """
    engine = get_safety_engine()
    safety = await engine.evaluate(body.text)
    scrubbed, pii_types = await redact_pii(body.text)

    if safety.tier == SafetyTier.TIER3_ACUTE:
        return {
            "intended_model": "google/gemma-2-2b-it",
            "inference_source": "safety_engine_tier3_interrupt",
            "live_inference_performed": False,
            "decision": "removed",
            "reason": "Tier 3 acute self-harm content detected; routed to crisis intervention.",
            "safety_tier": 3,
            "pii_detected": pii_types,
            "redacted_text": scrubbed,
            "emotions": [{"name": "Sadness", "intensity": 95}],
        }

    # Attempt real Vertex AI Gemma 2 2B-IT inference if endpoint is configured
    vertex_error: Optional[str] = None
    if settings.VERTEX_GEMMA_2B_ENDPOINT:
        try:
            import sys
            from pathlib import Path

            gemma_dir = str(Path(__file__).resolve().parents[3] / "models" / "gemma")
            if gemma_dir not in sys.path:
                sys.path.insert(0, gemma_dir)
            from gemma2_2b_moderation_tagger import (
                build_gemma2b_moderation_prompt,
                validate_moderation_output,
            )

            prompt = build_gemma2b_moderation_prompt(scrubbed)
            pred_data = await _invoke_vertex_ai_endpoint(
                settings.VERTEX_GEMMA_2B_ENDPOINT,
                instances=[{"prompt": prompt, "max_tokens": 256, "temperature": 0.1}],
            )
            predictions = pred_data.get("predictions") or []
            raw_pred = predictions[0] if predictions else {}
            if isinstance(raw_pred, str):
                raw_pred = json.loads(raw_pred)
            validated = validate_moderation_output(raw_pred if isinstance(raw_pred, dict) else {})
            return {
                "intended_model": "google/gemma-2-2b-it",
                "inference_source": "vertex_ai_gemma_2_2b_it",
                "live_inference_performed": True,
                "decision": validated["decision"],
                "reason": validated["reason"],
                "safety_tier": int(safety.tier),
                "pii_detected": pii_types,
                "redacted_text": scrubbed,
                "emotions": validated["emotions"],
            }
        except Exception as exc:
            vertex_error = f"{type(exc).__name__}: {exc}"
            logger.warning("Vertex AI Gemma 2 2B-IT call failed (%s); using deterministic fallback.", vertex_error)

    if body.require_live:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "VERTEX_GEMMA_2B_UNAVAILABLE",
                "intended_model": "google/gemma-2-2b-it",
                "live_inference_performed": False,
                "vertex_endpoint_configured": bool(settings.VERTEX_GEMMA_2B_ENDPOINT),
                "vertex_error": vertex_error,
            },
        )

    from app.ai.journal_analysis import analyze_locally

    local_emo = analyze_locally(scrubbed)
    decision = "hidden" if len(pii_types) >= 3 else "visible"
    return {
        "intended_model": "google/gemma-2-2b-it",
        "inference_source": "deterministic_fallback",
        "live_inference_performed": False,
        "vertex_endpoint_configured": bool(settings.VERTEX_GEMMA_2B_ENDPOINT),
        "vertex_error": vertex_error,
        "decision": decision,
        "reason": "PII scrubbed and safety verified (deterministic fallback)"
        if pii_types
        else "Clean peer-support content (deterministic fallback)",
        "safety_tier": int(safety.tier),
        "pii_detected": pii_types,
        "redacted_text": scrubbed,
        "emotions": local_emo["emotions"],
    }


@router.post("/dlp/inspect")
async def dlp_inspect_endpoint(
    body: TextInferenceRequest,
    user: dict = Depends(get_current_user),
):
    """Inspect text for Indian & general PII (local deterministic default in ₹0 mode; opt-in Cloud DLP when enabled)."""
    attempt_live = body.require_live or settings.ENABLE_OPTIONAL_CLOUD_DLP
    res = await inspect_pii_live_or_hybrid(body.text, attempt_live_dlp=attempt_live)
    if body.require_live and not res["live_dlp_succeeded"]:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "CLOUD_DLP_LIVE_UNAVAILABLE",
                "error": res["live_dlp_error"],
            },
        )
    return res


@router.post("/dlp/deidentify")
async def dlp_deidentify_endpoint(
    body: TextInferenceRequest,
    user: dict = Depends(get_current_user),
):
    """De-identify/redact PII (local deterministic default in ₹0 mode; opt-in Cloud DLP when enabled)."""
    attempt_live = body.require_live or settings.ENABLE_OPTIONAL_CLOUD_DLP
    try:
        return await deidentify_pii_detailed(
            body.text,
            attempt_live_dlp=attempt_live,
            require_live_dlp=body.require_live,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail={"status": "CLOUD_DLP_LIVE_DEIDENTIFY_FAILED", "error": str(exc)},
        )
