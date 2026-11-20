"""
Firebase Authentication & Identity Management Endpoints (Phase 2 — Section 1.4).
Uses Firebase Admin SDK for token verification and Cloud Firestore (`users/{uid}`) as the operational store.
"""
from __future__ import annotations

import logging

import firebase_admin.auth
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.security import _get_firebase_app, get_current_user
from app.database.firestore_db import FirestoreOperationalRepository, get_firestore_repo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)
    display_name: str = Field(default="", max_length=40)


class EmailActionRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(
    body: RegisterRequest,
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    """Create a Firebase Auth user and initialize their Cloud Firestore profile & subcollections."""
    app = _get_firebase_app()
    try:
        fb_user = firebase_admin.auth.create_user(
            email=body.email,
            password=body.password,
            display_name=body.display_name or None,
            email_verified=False,
            app=app,
        )
    except firebase_admin.auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    except Exception as exc:
        logger.warning("Firebase user registration error: %s", type(exc).__name__)
        raise HTTPException(status_code=400, detail="Unable to register user account.")

    profile = await fs.ensure_user_profile(fb_user.uid, body.display_name)
    return {
        "uid": profile["id"],
        "email": body.email,
        "display_name": profile["display_name"],
        "email_verified": False,
        "database": "cloud_firestore",
    }


@router.post("/verify-session")
async def verify_session(
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    """Verify current Firebase ID token and ensure user document exists in Cloud Firestore."""
    profile = await fs.ensure_user_profile(
        user["uid"], user.get("name", ""), role=user.get("role", "user")
    )
    return {
        "authenticated": True,
        "uid": user["uid"],
        "email": user.get("email", ""),
        "email_verified": user.get("email_verified", False),
        "role": profile["role"],
        "onboarded": profile["onboarded"],
        "database": "cloud_firestore",
    }


@router.post("/send-verification")
async def send_email_verification(user: dict = Depends(get_current_user)):
    email = user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Authenticated account has no email address.")
    app = _get_firebase_app()
    try:
        link = firebase_admin.auth.generate_email_verification_link(email, app=app)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not generate verification link.")
    return {"status": "verification_link_generated", "email": email, "verification_link": link}


@router.post("/password-reset")
async def request_password_reset(body: EmailActionRequest):
    app = _get_firebase_app()
    try:
        firebase_admin.auth.generate_password_reset_link(body.email, app=app)
    except Exception:
        pass
    return {
        "status": "ok",
        "message": "If an account exists for that email, a password reset link has been generated.",
    }


@router.post("/logout")
async def logout_user(user: dict = Depends(get_current_user)):
    app = _get_firebase_app()
    try:
        firebase_admin.auth.revoke_refresh_tokens(user["uid"], app=app)
    except Exception as exc:
        logger.warning("Token revocation failed: %s", type(exc).__name__)
    return {"status": "logged_out", "uid": user["uid"]}
