"""
Privacy, Consents, Data Export & Full Data Purge API backed by Cloud Firestore
(`users/{uid}/preferences/main`).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.security import get_current_user
from app.database.firestore_db import FirestoreOperationalRepository, get_firestore_repo

router = APIRouter(prefix="/api/v1/privacy", tags=["privacy"])

VALID_CONSENT_TYPES = ("ai_journal_analysis", "context_sharing", "analytics")


class PrivacyPatchRequest(BaseModel):
    consents: dict[str, bool]


@router.get("/settings")
async def get_privacy_settings(
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    await fs.ensure_user_profile(uid, user.get("name", ""))
    prefs = await fs.get_doc(f"users/{uid}/preferences/main") or {}
    current = {c: False for c in VALID_CONSENT_TYPES}
    for k, v in (prefs.get("consents") or {}).items():
        if k in current:
            current[k] = bool(v)
    return {"consents": current, "available_types": list(VALID_CONSENT_TYPES)}


@router.patch("/settings")
async def update_privacy_settings(
    body: PrivacyPatchRequest,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    await fs.ensure_user_profile(uid, user.get("name", ""))
    prefs = await fs.get_doc(f"users/{uid}/preferences/main") or {}
    current = {c: False for c in VALID_CONSENT_TYPES}
    current.update(prefs.get("consents") or {})

    for consent_type, granted in body.consents.items():
        if consent_type not in VALID_CONSENT_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid consent type: {consent_type}")
        current[consent_type] = bool(granted)

    await fs.set_doc(
        f"users/{uid}/preferences/main",
        {"consents": current, "updated_at": datetime.now(timezone.utc)},
        merge=True,
    )
    return {"consents": current, "available_types": list(VALID_CONSENT_TYPES)}


@router.post("/export", status_code=status.HTTP_202_ACCEPTED)
async def export_user_data(
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    await fs.ensure_user_profile(uid, user.get("name", ""))
    now = datetime.now(timezone.utc)

    moods = await fs.list_collection(f"users/{uid}/mood_logs", limit=500)
    journals = await fs.list_collection(f"users/{uid}/journal_entries", limit=500)
    thoughts = await fs.list_collection(f"users/{uid}/cbt_exercises", limit=500)

    export_id = str(uuid.uuid4())
    return {
        "export_id": export_id,
        "status": "ready",
        "exported_at": now.isoformat(),
        "data": {
            "moods": [
                {
                    "id": str(m["id"]),
                    "mood": m["mood"],
                    "intensity": m["intensity"],
                    "triggers": m.get("triggers") or [],
                    "note": m.get("note"),
                    "recorded_at": m["recorded_at"].isoformat()
                    if hasattr(m["recorded_at"], "isoformat")
                    else str(m["recorded_at"]),
                }
                for m in moods
            ],
            "journals": [
                {
                    "id": str(j["id"]),
                    "prompt": j["prompt"],
                    "content_ciphertext": j.get("content_ciphertext"),
                    "content_iv": j.get("content_iv"),
                    "word_count": j["word_count"],
                    "analysis": j.get("analysis"),
                    "created_at": j["created_at"].isoformat()
                    if hasattr(j["created_at"], "isoformat")
                    else str(j["created_at"]),
                }
                for j in journals
            ],
            "thought_records": [
                {
                    "id": str(t["id"]),
                    "situation": t["situation"],
                    "automatic_thought": t["automatic_thought"],
                    "emotions": t.get("emotions") or [],
                    "thinking_patterns": t.get("thinking_patterns") or [],
                    "balanced_thought": t.get("balanced_thought", ""),
                    "completed": t.get("completed", False),
                    "created_at": t["created_at"].isoformat()
                    if hasattr(t["created_at"], "isoformat")
                    else str(t["created_at"]),
                }
                for t in thoughts
            ],
        },
    }


@router.delete("/data")
async def delete_all_wellness_data(
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    """Permanently purge all wellness subcollections and anonymous community posts for the caller."""
    uid = user["uid"]
    profile = await fs.get_doc(f"users/{uid}")
    await fs.delete_doc(f"users/{uid}")
    await fs.delete_doc(f"anonymous_identities/{uid}")

    # Restore bare user profile shell so account stays active
    if profile:
        await fs.set_doc(f"users/{uid}", profile)

    my_posts = await fs.list_collection("community_posts", filters=[("author_id", "==", uid)], limit=500)
    for p in my_posts:
        await fs.delete_doc(f"community_posts/{p['id']}")

    now = datetime.now(timezone.utc)
    return {"status": "deleted", "purged_at": now.isoformat(), "database": "cloud_firestore"}
