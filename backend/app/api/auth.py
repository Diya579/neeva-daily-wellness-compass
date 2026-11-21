"""
Zero-Cost Local Authentication & Session Management Endpoints (Sections 2, 3, 6, 7).
Operates completely offline and free (₹0 budget) using durable SQLite WAL storage,
PBKDF2-HMAC-SHA256 (120,000 iterations) password hashing, and HMAC-SHA256 JWT tokens.
No Google Cloud project, Firebase project, or internet connection is required.
"""
from __future__ import annotations

import logging
import os
import secrets
import smtplib
import time
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.security import (
    create_local_jwt,
    get_current_user,
    hash_password_pbkdf2,
    verify_password_pbkdf2,
)
from app.database.firestore_db import FirestoreOperationalRepository, get_firestore_repo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)
    display_name: str = Field(default="", max_length=40)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)


class EmailActionRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)


class SendOtpRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    purpose: str = Field(default="signup", max_length=32)


class VerifyOtpRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    otp: str = Field(..., min_length=6, max_length=6)


def _send_smtp_verification_email(to_email: str, otp: str, purpose: str) -> bool:
    """Send a real verification email if SMTP_HOST/SMTP_USER/SMTP_PASS are configured."""
    host = os.getenv("SMTP_HOST", "").strip()
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASS", "").strip()
    port = int(os.getenv("SMTP_PORT", "587") or "587")
    from_addr = os.getenv("SMTP_FROM", user or "noreply@neeva.in").strip()
    if not host or not user or not password:
        return False
    try:
        msg = EmailMessage()
        msg["Subject"] = f"Your Neeva verification code: {otp}"
        msg["From"] = from_addr
        msg["To"] = to_email
        action_lbl = "Google sign-in" if purpose == "google_signin" else "sign-up"
        msg.set_content(
            f"Hi,\n\nYour 6-digit Neeva {action_lbl} verification code is: {otp}\n\n"
            "This code expires in 10 minutes. If you did not request this, you can safely ignore this email.\n\n"
            "— Neeva Daily Wellness Compass"
        )
        with smtplib.SMTP(host, port, timeout=10) as server:
            server.starttls()
            server.login(user, password)
            server.send_message(msg)
        return True
    except Exception as exc:
        logger.warning("SMTP delivery failed for %s: %s", to_email, exc)
        return False


def _normalize_email(email: str) -> str:
    return email.strip().lower()


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_user(
    body: RegisterRequest,
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    """Register a user locally in durable SQLite WAL storage and issue a zero-cost JWT."""
    norm_email = _normalize_email(body.email)
    existing = await fs.get_doc(f"auth_accounts/{norm_email}")
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    uid = f"local_uid_{uuid.uuid4().hex[:16]}"
    pw_hash, pw_salt = hash_password_pbkdf2(body.password)
    now = datetime.now(timezone.utc)

    await fs.set_doc(
        f"auth_accounts/{norm_email}",
        {
            "uid": uid,
            "email": norm_email,
            "display_name": body.display_name[:40],
            "password_hash": pw_hash,
            "password_salt": pw_salt,
            "role": "user",
            "email_verified": True,
            "created_at": now,
            "updated_at": now,
        },
    )
    profile = await fs.ensure_user_profile(uid, body.display_name, role="user")
    token = create_local_jwt(
        uid=uid,
        email=norm_email,
        display_name=profile["display_name"],
        role=profile["role"],
    )
    return {
        "uid": uid,
        "email": norm_email,
        "display_name": profile["display_name"],
        "role": profile["role"],
        "email_verified": True,
        "access_token": token,
        "token_type": "bearer",
        "auth_provider": "local_zero_cost",
        "database": "sqlite_wal",
    }


@router.post("/login")
async def login_user(
    body: LoginRequest,
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    """Authenticate email & password against durable SQLite WAL storage and return a signed JWT."""
    norm_email = _normalize_email(body.email)
    account = await fs.get_doc(f"auth_accounts/{norm_email}")
    if account is None or not verify_password_pbkdf2(
        body.password, account["password_hash"], account["password_salt"]
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    uid = account["uid"]
    profile = await fs.ensure_user_profile(
        uid, account.get("display_name", ""), role=account.get("role", "user")
    )
    token = create_local_jwt(
        uid=uid,
        email=norm_email,
        display_name=profile["display_name"],
        role=profile["role"],
    )
    return {
        "uid": uid,
        "email": norm_email,
        "display_name": profile["display_name"],
        "role": profile["role"],
        "onboarded": profile["onboarded"],
        "access_token": token,
        "token_type": "bearer",
        "auth_provider": "local_zero_cost",
    }


@router.post("/verify-session")
async def verify_session(
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    """Verify current token and ensure user profile exists in durable SQLite WAL storage."""
    profile = await fs.ensure_user_profile(
        user["uid"], user.get("name", ""), role=user.get("role", "user")
    )
    return {
        "authenticated": True,
        "uid": user["uid"],
        "email": user.get("email", ""),
        "email_verified": user.get("email_verified", True),
        "role": profile["role"],
        "onboarded": profile["onboarded"],
        "auth_provider": user.get("auth_provider", "local_zero_cost"),
        "database": "sqlite_wal",
    }


@router.post("/send-otp")
async def send_email_otp(
    body: SendOtpRequest,
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    """Generate a 6-digit email verification OTP (10-min TTL) for signup or Google email verification."""
    norm_email = _normalize_email(body.email)
    if "@" not in norm_email or "." not in norm_email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    otp = f"{secrets.randbelow(900000) + 100000}"
    otp_hash, otp_salt = hash_password_pbkdf2(otp)
    expires_at = int(time.time()) + 600
    await fs.set_doc(
        f"email_verifications/{norm_email}",
        {
            "email": norm_email,
            "purpose": body.purpose,
            "otp_hash": otp_hash,
            "otp_salt": otp_salt,
            "expires_at": expires_at,
            "attempts": 0,
            "created_at": datetime.now(timezone.utc),
        },
    )

    sent_via_smtp = _send_smtp_verification_email(norm_email, otp, body.purpose)
    response: dict = {
        "status": "otp_sent",
        "email": norm_email,
        "expires_in_seconds": 600,
        "delivery_mode": "smtp_email" if sent_via_smtp else "in_app_demo",
        "message": (
            f"We sent a 6-digit verification code to {norm_email}."
            if sent_via_smtp
            else f"Verification code generated for {norm_email} (configure SMTP_HOST/SMTP_USER/SMTP_PASS for live inbox delivery)."
        ),
    }
    if not sent_via_smtp:
        response["demo_otp"] = otp
    return response


@router.post("/verify-otp")
async def verify_email_otp(
    body: VerifyOtpRequest,
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    """Verify the 6-digit email OTP before permitting account creation or Google sign-in."""
    norm_email = _normalize_email(body.email)
    record = await fs.get_doc(f"email_verifications/{norm_email}")
    if record is None:
        raise HTTPException(status_code=400, detail="No pending verification code found. Please request a new code.")

    now_ts = int(time.time())
    if now_ts > int(record.get("expires_at", 0)):
        await fs.delete_doc(f"email_verifications/{norm_email}")
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")

    attempts = int(record.get("attempts", 0))
    if attempts >= 5:
        await fs.delete_doc(f"email_verifications/{norm_email}")
        raise HTTPException(status_code=429, detail="Too many invalid attempts. Please request a new code.")

    if not verify_password_pbkdf2(body.otp.strip(), record["otp_hash"], record["otp_salt"]):
        await fs.set_doc(
            f"email_verifications/{norm_email}",
            {**record, "attempts": attempts + 1},
            merge=True,
        )
        raise HTTPException(status_code=400, detail="Invalid verification code. Please check and try again.")

    await fs.delete_doc(f"email_verifications/{norm_email}")
    return {"verified": True, "email": norm_email}


@router.post("/send-verification")
async def send_email_verification(user: dict = Depends(get_current_user)):
    email = user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Authenticated account has no email address.")
    token = secrets.token_urlsafe(24)
    return {
        "status": "verification_link_generated",
        "email": email,
        "verification_link": f"http://localhost:5173/auth?verify_token={token}",
        "mode": "local_zero_cost",
    }


@router.post("/password-reset")
async def request_password_reset(
    body: EmailActionRequest,
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    norm_email = _normalize_email(body.email)
    account = await fs.get_doc(f"auth_accounts/{norm_email}")
    if account is not None:
        reset_token = secrets.token_urlsafe(24)
        await fs.set_doc(
            f"password_resets/{norm_email}",
            {
                "email": norm_email,
                "uid": account["uid"],
                "reset_token_hash": hash_password_pbkdf2(reset_token)[0],
                "created_at": datetime.now(timezone.utc),
            },
        )
    return {
        "status": "ok",
        "message": "If an account exists for that email, a local password reset token has been generated.",
    }


@router.post("/logout")
async def logout_user(
    user: dict = Depends(get_current_user),
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    """Durably revoke the active JWT and user tokens in SQLite WAL."""
    uid = user["uid"]
    jti = user.get("jti")
    now_ts = int(time.time())
    if jti:
        await fs.set_doc(f"revoked_tokens/{jti}", {"jti": jti, "uid": uid, "revoked_at": now_ts})
    await fs.set_doc(
        f"revoked_users/{uid}",
        {"uid": uid, "revoked_before": now_ts},
    )
    return {"status": "logged_out", "uid": uid}
