"""
Profile, Trusted Contacts & Account Management API backed by Cloud Firestore (`users/{uid}`).
Performs complete recursive subcollection deletion on `DELETE /api/v1/account`.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

from app.ai.companion_prompt import sanitize_companion_name, sanitize_notes
from app.core.security import get_current_user
from app.database.firestore_db import FirestoreOperationalRepository, get_firestore_repo
from app.schemas.profile import ProfilePatch, ProfileResponse

router = APIRouter(prefix="/api/v1", tags=["profile"])


class TrustedContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    relationship: str = Field(..., min_length=1, max_length=40)
    phone: str = Field(..., min_length=5, max_length=20)


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    profile = await fs.ensure_user_profile(
        user["uid"], user.get("name", ""), role=user.get("role", "user")
    )
    return profile


@router.patch("/profile", response_model=ProfileResponse)
async def update_profile(
    body: ProfilePatch,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    updates = body.model_dump(exclude_none=True)
    if "companion_name" in updates:
        updates["companion_name"] = sanitize_companion_name(updates["companion_name"])
    if "companion_notes" in updates:
        updates["companion_notes"] = sanitize_notes(updates["companion_notes"])

    profile = await fs.update_user_profile(user["uid"], updates)
    return profile


@router.post("/profile/trusted-contacts", status_code=status.HTTP_201_CREATED)
async def create_trusted_contact(
    body: TrustedContactCreate,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    return await fs.add_trusted_contact(
        uid=user["uid"],
        name=body.name,
        relationship=body.relationship,
        phone=body.phone,
    )


@router.get("/profile/trusted-contacts")
async def get_trusted_contacts(
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    return await fs.list_trusted_contacts(user["uid"])


@router.delete("/profile/trusted-contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_trusted_contact(
    contact_id: str,
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    existed = await fs.delete_doc(f"users/{user['uid']}/trusted_contacts/{contact_id}")
    if not existed:
        raise HTTPException(status_code=404, detail="Trusted contact not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    """
    Recursively delete the entire user-owned document tree in Cloud Firestore
    (profile, preferences, settings, mood logs, streaks, journals, analyses, conversations,
    messages, CBT exercises, wellness toolkit, trusted contacts, safety events, and community data).
    """
    await fs.delete_user_account_completely(user["uid"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)
