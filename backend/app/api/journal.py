"""
Encrypted Journal & Reflective Analysis API backed by Cloud Firestore
(`users/{uid}/journal_entries/{id}` and `users/{uid}/journal_analysis/{id}`).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.ai.dlp_client import redact_pii
from app.ai.journal_analysis import analyze_journal_entry
from app.core.security import get_current_user
from app.database.firestore_db import FirestoreOperationalRepository, get_firestore_repo
from app.privacy.encryption import decode_client_ciphertext
from app.safety.crisis_patterns import SafetyTier
from app.safety.engine import get_safety_engine
from app.schemas.journal import (
    JournalAnalysisResponse,
    JournalAnalyzeRequest,
    JournalCreate,
    JournalPatch,
    JournalResponse,
)

router = APIRouter(prefix="/api/v1/journal", tags=["journal"])


@router.post("", response_model=JournalResponse, status_code=status.HTTP_201_CREATED)
async def create_journal(
    body: JournalCreate,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    await fs.ensure_user_profile(uid, user.get("name", ""))
    try:
        decode_client_ciphertext(body.content_ciphertext, body.content_iv)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    now = datetime.now(timezone.utc)
    entry_id = uuid.uuid4()
    doc = {
        "id": entry_id,
        "user_id": uid,
        "prompt": body.prompt,
        "content_ciphertext": body.content_ciphertext,
        "content_iv": body.content_iv,
        "word_count": body.word_count,
        "is_draft": body.is_draft,
        "has_analysis": False,
        "analysis": None,
        "analysis_source": None,
        "created_at": now,
        "updated_at": now,
    }
    await fs.set_doc(f"users/{uid}/journal_entries/{entry_id}", doc)
    return JournalResponse(**doc)


@router.get("", response_model=list[JournalResponse])
async def list_journal(
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    rows = await fs.list_collection(
        f"users/{user['uid']}/journal_entries",
        filters=[("is_draft", "==", False)],
        order_by=[("created_at", True)],
        limit=200,
    )
    return [JournalResponse(**r) for r in rows]


@router.get("/drafts")
async def list_drafts(
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    return await fs.list_collection(
        f"users/{user['uid']}/journal_entries",
        filters=[("is_draft", "==", True)],
        order_by=[("updated_at", True)],
        limit=50,
    )


@router.get("/{entry_id}", response_model=JournalResponse)
async def get_journal(
    entry_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    doc = await fs.get_doc(f"users/{user['uid']}/journal_entries/{entry_id}")
    if doc is None:
        raise HTTPException(status_code=404, detail="Journal entry not found.")
    return JournalResponse(**doc)


@router.patch("/{entry_id}", response_model=JournalResponse)
async def update_journal(
    entry_id: uuid.UUID,
    body: JournalPatch,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    doc = await fs.get_doc(f"users/{uid}/journal_entries/{entry_id}")
    if doc is None:
        raise HTTPException(status_code=404, detail="Journal entry not found.")

    updates: dict = {"updated_at": datetime.now(timezone.utc)}
    if body.content_ciphertext is not None and body.content_iv is not None:
        try:
            decode_client_ciphertext(body.content_ciphertext, body.content_iv)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        updates["content_ciphertext"] = body.content_ciphertext
        updates["content_iv"] = body.content_iv

    if body.prompt is not None:
        updates["prompt"] = body.prompt
    if body.word_count is not None:
        updates["word_count"] = body.word_count

    updated = await fs.set_doc(f"users/{uid}/journal_entries/{entry_id}", updates, merge=True)
    return JournalResponse(**updated)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_journal(
    entry_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    existed = await fs.delete_doc(f"users/{uid}/journal_entries/{entry_id}")
    if not existed:
        raise HTTPException(status_code=404, detail="Journal entry not found.")
    await fs.delete_doc(f"users/{uid}/journal_analysis/{entry_id}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{entry_id}/analyze", response_model=JournalAnalysisResponse)
async def analyze_journal(
    entry_id: uuid.UUID,
    body: JournalAnalyzeRequest,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    doc = await fs.get_doc(f"users/{uid}/journal_entries/{entry_id}")
    if doc is None:
        raise HTTPException(status_code=404, detail="Journal entry not found.")

    # 1. Three-Tier Safety Check + Firestore safety event log
    engine = get_safety_engine()
    safety = await engine.evaluate(body.text)
    await fs.log_safety_event(
        uid=uid,
        source="journal",
        tier=int(safety.tier),
        deterministic_tier=int(safety.deterministic_tier),
        muril_tier=int(safety.muril_tier) if safety.muril_tier is not None else None,
        confidence=safety.confidence,
        should_interrupt=safety.should_interrupt,
    )
    if safety.tier == SafetyTier.TIER3_ACUTE:
        raise HTTPException(
            status_code=422,
            detail={
                "crisis": True,
                "tier": 3,
                "message": safety.crisis_message,
                "helplines": safety.helplines,
            },
        )

    # 2. Cloud DLP PII Redaction before sending to AI inference
    scrubbed_text, _ = await redact_pii(body.text)

    # 3. Reflective analysis
    analysis, source = await analyze_journal_entry(scrubbed_text, body.prompt or doc["prompt"])

    if body.persist_analysis:
        now = datetime.now(timezone.utc)
        await fs.set_doc(
            f"users/{uid}/journal_analysis/{entry_id}",
            {
                "entry_id": str(entry_id),
                "user_id": uid,
                "analysis": analysis,
                "source": source,
                "updated_at": now,
            },
        )
        await fs.set_doc(
            f"users/{uid}/journal_entries/{entry_id}",
            {
                "has_analysis": True,
                "analysis": analysis,
                "analysis_source": source,
                "updated_at": now,
            },
            merge=True,
        )

    return JournalAnalysisResponse(analysis=analysis, source=source)
