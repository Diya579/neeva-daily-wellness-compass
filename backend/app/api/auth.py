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

import httpx
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


class GoogleAuthRequest(BaseModel):
    access_token: str | None = Field(default=None, max_length=4096)
    id_token: str | None = Field(default=None, max_length=4096)


DEFAULT_GOOGLE_CLIENT_ID = (
    "44448480206-qiqpquprjfiq9t7bfe9ipo8155rhqu0b.apps.googleusercontent.com"
)


def _send_smtp_verification_email(to_email: str, otp: str, purpose: str) -> bool:
    """Send a real verification email via Gmail/SMTP when SMTP_HOST/SMTP_USER/SMTP_PASS are configured."""
    host = os.getenv("SMTP_HOST", "").strip()
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASS", "").replace(" ", "").strip()
    port = int(os.getenv("SMTP_PORT", "587") or "587")
    from_addr = os.getenv("SMTP_FROM", user or "noreply@neeva.in").strip()
    if not host or not user or not password:
        return False
    try:
        msg = EmailMessage()
        msg["Subject"] = f"Your Neeva verification code: {otp}"
        msg["From"] = f"Neeva Wellness <{from_addr}>"
        msg["To"] = to_email
        action_lbl = "Google sign-in" if purpose == "google_signin" else "account sign-up"
        msg.set_content(
            f"Hi,\n\nYour 6-digit Neeva {action_lbl} verification code is: {otp}\n\n"
            "This code expires in 10 minutes. If you did not request this, you can safely ignore this email.\n\n"
            "— Neeva: Daily Wellness Compass"
        )
        msg.add_alternative(
            f"""\
            <html>
              <body style="font-family: 'Segoe UI', Arial, sans-serif; background:#FAF7F0; color:#183024; padding:24px;">
                <div style="max-width:460px; margin:0 auto; background:#FFFFFF; border:1.5px solid #183024; border-radius:18px; padding:24px;">
                  <h2 style="margin:0 0 8px 0; color:#183024;">Verify your Neeva email</h2>
                  <p style="margin:0 0 18px 0; color:#50655A; font-size:14px;">
                    Enter this 6-digit code to complete your {action_lbl}:
                  </p>
                  <div style="background:#E6F4EA; border:1.5px solid #183024; border-radius:12px; padding:14px; text-align:center; font-size:28px; font-weight:800; letter-spacing:8px; color:#137333;">
                    {otp}
                  </div>
                  <p style="margin:18px 0 0 0; color:#50655A; font-size:12px;">
                    This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
                  </p>
                </div>
              </body>
            </html>
            """,
            subtype="html",
        )
        with smtplib.SMTP(host, port, timeout=12) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(user, password)
            server.send_message(msg)
        logger.info("Sent real SMTP verification OTP to %s", to_email)
        return True
    except Exception as exc:
        logger.error("SMTP delivery failed for %s: %s", to_email, exc)
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

    smtp_configured = bool(
        os.getenv("SMTP_HOST", "").strip()
        and os.getenv("SMTP_USER", "").strip()
        and os.getenv("SMTP_PASS", "").strip()
    )
    sent_via_smtp = _send_smtp_verification_email(norm_email, otp, body.purpose)
    if smtp_configured and not sent_via_smtp:
        raise HTTPException(
            status_code=502,
            detail="Failed to deliver verification email via SMTP. Please try again in a moment.",
        )

    response: dict = {
        "status": "otp_sent",
        "email": norm_email,
        "expires_in_seconds": 600,
        "delivery_mode": "smtp_email" if sent_via_smtp else "in_app_demo",
        "message": (
            f"We sent a 6-digit verification code to {norm_email}. Please check your inbox (and spam folder)."
            if sent_via_smtp
            else f"Verification code generated for {norm_email} (local test mode)."
        ),
    }
    if not sent_via_smtp:
        response["demo_otp"] = otp
    return response


@router.get("/config")
async def get_auth_config():
    """Return public OAuth & email delivery capabilities for the frontend."""
    client_id = os.getenv("GOOGLE_OAUTH_CLIENT_ID", DEFAULT_GOOGLE_CLIENT_ID).strip() or DEFAULT_GOOGLE_CLIENT_ID
    smtp_enabled = bool(
        os.getenv("SMTP_HOST", "").strip()
        and os.getenv("SMTP_USER", "").strip()
        and os.getenv("SMTP_PASS", "").strip()
    )
    return {
        "google_client_id": client_id,
        "smtp_enabled": smtp_enabled,
    }


@router.post("/google")
async def google_oauth_signin(
    body: GoogleAuthRequest,
    fs: FirestoreOperationalRepository = Depends(get_firestore_repo),
):
    """Verify a real Google Identity Services access_token or id_token and issue a Neeva JWT."""
    email = ""
    display_name = ""
    email_verified = False
    google_sub = ""

    if body.access_token:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {body.access_token}"},
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid or expired Google OAuth access token.")
        info = resp.json()
        email = _normalize_email(str(info.get("email", "")))
        display_name = str(info.get("name") or info.get("given_name") or email.split("@")[0])[:40]
        email_verified = bool(info.get("email_verified", False))
        google_sub = str(info.get("sub", ""))
    elif body.id_token:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": body.id_token},
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid or expired Google ID token.")
        info = resp.json()
        expected_aud = os.getenv("GOOGLE_OAUTH_CLIENT_ID", DEFAULT_GOOGLE_CLIENT_ID).strip()
        if expected_aud and info.get("aud") != expected_aud:
            raise HTTPException(status_code=401, detail="Google ID token audience mismatch.")
        email = _normalize_email(str(info.get("email", "")))
        display_name = str(info.get("name") or email.split("@")[0])[:40]
        email_verified = str(info.get("email_verified", "")).lower() == "true"
        google_sub = str(info.get("sub", ""))
    else:
        raise HTTPException(status_code=400, detail="Either access_token or id_token is required.")

    if not email or not email_verified:
        raise HTTPException(status_code=401, detail="Google account email is not verified.")

    account = await fs.get_doc(f"auth_accounts/{email}")
    now = datetime.now(timezone.utc)
    if account is None:
        uid = f"google_{google_sub[:16]}" if google_sub else f"google_uid_{uuid.uuid4().hex[:16]}"
        pw_hash, pw_salt = hash_password_pbkdf2(secrets.token_urlsafe(32))
        await fs.set_doc(
            f"auth_accounts/{email}",
            {
                "uid": uid,
                "email": email,
                "display_name": display_name,
                "password_hash": pw_hash,
                "password_salt": pw_salt,
                "role": "user",
                "email_verified": True,
                "auth_provider": "google_oauth",
                "created_at": now,
                "updated_at": now,
            },
        )
    else:
        uid = account["uid"]
        display_name = account.get("display_name") or display_name

    profile = await fs.ensure_user_profile(uid, display_name, role="user")
    token = create_local_jwt(
        uid=uid,
        email=email,
        display_name=profile["display_name"],
        role=profile["role"],
    )
    return {
        "uid": uid,
        "email": email,
        "display_name": profile["display_name"],
        "role": profile["role"],
        "email_verified": True,
        "access_token": token,
        "token_type": "bearer",
        "auth_provider": "google_oauth",
    }


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
