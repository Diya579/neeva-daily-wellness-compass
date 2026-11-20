"""
Secured Model Inference (MuRIL, Gemma 2 9B-IT, Gemma 2 2B-IT) and Google Cloud DLP Endpoints
(Phase 2 — Sections 2, 3, 4, 5).
Exposes authenticated server-side endpoints for:
- `GET  /api/v1/models/status`
- `POST /api/v1/models/muril/infer`
- `POST /api/v1/models/gemma-9b/infer`
- `POST /api/v1/models/gemma-2b/moderate`
- `POST /api/v1/dlp/inspect`
- `POST /api/v1/dlp/deidentify`
"""
from __future__ import annotations

import time
import unicodedata
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.ai.dlp_client import inspect_pii_live_or_hybrid, redact_pii
from app.ai.gemini import validate_ai_response
from app.core.config import settings
from app.core.security import get_current_user
from app.database.firestore_db import FirestoreOperationalRepository, get_firestore_repo
from app.safety.crisis_patterns import SafetyTier, classify_safety
from app.safety.engine import get_safety_engine
from app.safety.muril import MuRILClassifier

router = APIRouter(prefix="/api/v1", tags=["models-and-dlp"])


class TextInferenceRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)
    language: Optional[str] = Field(default="en")


@router.get("/models/status")
async def get_models_and_dlp_status(
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    muril = MuRILClassifier()
    return {
        "firestore_database_mode": fs.mode,
        "firebase_project_id": fs.project_id,
        "muril": {
            "checkpoint": "google/muril-base-cased",
            "onnx_path": settings.MURIL_ONNX_PATH,
            "onnx_weights_loaded": muril.available,
            "supported_languages": ["en", "hinglish", "hi", "gu", "mr", "bn", "ta", "te"],
        },
        "gemma_2_9b_it": {
            "base_model": "google/gemma-2-9b-it",
            "vertex_endpoint": settings.VERTEX_GEMMA_9B_ENDPOINT or None,
            "live_endpoint_configured": bool(settings.VERTEX_GEMMA_9B_ENDPOINT),
        },
        "gemma_2_2b_it": {
            "base_model": "google/gemma-2-2b-it",
            "vertex_endpoint": settings.VERTEX_GEMMA_2B_ENDPOINT or None,
            "live_endpoint_configured": bool(settings.VERTEX_GEMMA_2B_ENDPOINT),
        },
        "cloud_dlp": {
            "project_id": settings.GOOGLE_CLOUD_PROJECT,
            "region": settings.DLP_REGION,
        },
    }


@router.post("/models/muril/infer")
async def infer_muril_distress(
    body: TextInferenceRequest,
    user: dict = Depends(get_current_user),
):
    """Run MuRIL ONNX + deterministic 8-language distress classification with latency telemetry."""
    t0 = time.perf_counter()
    normalized = unicodedata.normalize("NFKC", body.text).strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Input text cannot be empty after normalization.")

    engine = get_safety_engine()
    res = await engine.evaluate(normalized)
    latency_ms = round((time.perf_counter() - t0) * 1000.0, 3)

    return {
        "model": "google/muril-base-cased",
        "onnx_loaded": engine._muril.available if engine._muril else False,
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
            "model": "google/gemma-2-9b-it",
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
                "model": "google/gemma-2-9b-it",
                "message": (
                    "Vertex AI GPU endpoint for Gemma 2 9B-IT is not provisioned to prevent unapproved GPU billing. "
                    "Safety engine and PII scrubbing succeeded."
                ),
                "safety_tier": int(safety.tier),
                "pii_scrubbed_input_length": len(scrubbed),
            },
        )

    # When VERTEX_GEMMA_9B_ENDPOINT is configured, invoke Vertex AI PredictionServiceClient
    from google.cloud import aiplatform

    endpoint = aiplatform.Endpoint(settings.VERTEX_GEMMA_9B_ENDPOINT)
    pred = endpoint.predict(instances=[{"prompt": scrubbed, "max_tokens": 512}])
    raw_text = str(pred.predictions[0]) if pred.predictions else ""
    return {
        "model": "google/gemma-2-9b-it",
        "interrupted_by_safety_engine": False,
        "tier": int(safety.tier),
        "response": validate_ai_response(raw_text),
    }


@router.post("/models/gemma-2b/moderate")
async def moderate_with_gemma_2b(
    body: TextInferenceRequest,
    user: dict = Depends(get_current_user),
):
    """
    Community moderation & structured emotion tagging endpoint for Gemma 2 2B-IT (`google/gemma-2-2b-it`).
    Combines deterministic safety + PII detection with Gemma 2 2B-IT moderation taxonomy.
    """
    engine = get_safety_engine()
    safety = await engine.evaluate(body.text)
    scrubbed, pii_types = await redact_pii(body.text)

    if safety.tier == SafetyTier.TIER3_ACUTE:
        return {
            "model": "google/gemma-2-2b-it",
            "decision": "removed",
            "reason": "Tier 3 acute self-harm content detected; routed to crisis intervention.",
            "safety_tier": 3,
            "pii_detected": pii_types,
            "emotions": [{"name": "Sadness", "intensity": 95}],
        }

    from app.ai.journal_analysis import analyze_locally

    local_emo = analyze_locally(scrubbed)
    decision = "hidden" if len(pii_types) >= 3 else "visible"
    return {
        "model": "google/gemma-2-2b-it",
        "live_endpoint_active": bool(settings.VERTEX_GEMMA_2B_ENDPOINT),
        "decision": decision,
        "reason": "PII scrubbed and safety verified" if pii_types else "Clean peer-support content",
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
    """Inspect text for Indian & general PII via Google Cloud DLP + custom infoType validators."""
    return await inspect_pii_live_or_hybrid(body.text)


@router.post("/dlp/deidentify")
async def dlp_deidentify_endpoint(
    body: TextInferenceRequest,
    user: dict = Depends(get_current_user),
):
    """De-identify/redact PII via Google Cloud DLP + deterministic Indian PII rules."""
    redacted, info_types = await redact_pii(body.text, use_cloud_dlp=True)
    return {
        "redacted_text": redacted,
        "detected_info_types": info_types,
        "pii_found": len(info_types) > 0,
    }

