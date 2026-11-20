"""
CBT Thought Records API backed by Cloud Firestore (`users/{uid}/cbt_exercises/{id}`).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.security import get_current_user
from app.database.firestore_db import FirestoreOperationalRepository, get_firestore_repo
from app.schemas.thought import ThoughtCreate, ThoughtPatch, ThoughtResponse

router = APIRouter(prefix="/api/v1/thought-records", tags=["thought-records"])


@router.post("", response_model=ThoughtResponse, status_code=status.HTTP_201_CREATED)
async def create_thought_record(
    body: ThoughtCreate,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    await fs.ensure_user_profile(uid, user.get("name", ""))
    now = datetime.now(timezone.utc)
    rec_id = uuid.uuid4()
    doc = {
        "id": rec_id,
        "user_id": uid,
        "created_at": now,
        "updated_at": now,
        **body.model_dump(),
    }
    await fs.set_doc(f"users/{uid}/cbt_exercises/{rec_id}", doc)
    return ThoughtResponse(**doc)


@router.get("", response_model=list[ThoughtResponse])
async def list_thought_records(
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    rows = await fs.list_collection(
        f"users/{user['uid']}/cbt_exercises",
        order_by=[("created_at", True)],
        limit=200,
    )
    return [ThoughtResponse(**r) for r in rows]


@router.patch("/{record_id}", response_model=ThoughtResponse)
async def update_thought_record(
    record_id: uuid.UUID,
    body: ThoughtPatch,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    uid = user["uid"]
    existing = await fs.get_doc(f"users/{uid}/cbt_exercises/{record_id}")
    if existing is None:
        raise HTTPException(status_code=404, detail="Thought record not found.")

    updates = body.model_dump(exclude_none=True)
    updates["updated_at"] = datetime.now(timezone.utc)
    updated = await fs.set_doc(f"users/{uid}/cbt_exercises/{record_id}", updates, merge=True)
    return ThoughtResponse(**updated)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thought_record(
    record_id: uuid.UUID,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    existed = await fs.delete_doc(f"users/{user['uid']}/cbt_exercises/{record_id}")
    if not existed:
        raise HTTPException(status_code=404, detail="Thought record not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
