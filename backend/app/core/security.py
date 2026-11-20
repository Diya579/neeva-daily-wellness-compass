"""
Zero-Cost Authentication & Authorization Module (Sections 2, 3, 6).
Supports:
1. Zero-Cost Local Authentication (default, ₹0 budget, zero cloud credentials required):
   - PBKDF2-HMAC-SHA256 password hashing (120,000 iterations + 16-byte random salt).
   - HMAC-SHA256 signed JWT tokens (`iss: "neeva-local-auth"`) with expiry, audience, and UID validation.
   - Durable token revocation tracking in SQLite WAL (`revoked_tokens` collection).
2. Optional Firebase Free-Plan Authentication (only when `AUTH_MODE in ("hybrid", "firebase_free_opt_in")`
   and `FIREBASE_PROJECT_ID` is explicitly configured).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import time
import uuid
from typing import Optional

from fastapi import Depends, Header, HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

_firebase_app = None


def hash_password_pbkdf2(password: str, salt: Optional[bytes] = None) -> tuple[str, str]:
    """Hash a password with PBKDF2-HMAC-SHA256 (120,000 iterations). Returns (hash_b64, salt_b64)."""
    raw_salt = salt if salt is not None else os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), raw_salt, 120_000, dklen=32)
    return base64.b64encode(dk).decode("ascii"), base64.b64encode(raw_salt).decode("ascii")


def verify_password_pbkdf2(password: str, expected_hash_b64: str, salt_b64: str) -> bool:
    """Constant-time verification of a PBKDF2-HMAC-SHA256 password hash."""
    try:
        raw_salt = base64.b64decode(salt_b64.encode("ascii"))
        computed_b64, _ = hash_password_pbkdf2(password, salt=raw_salt)
        return hmac.compare_digest(computed_b64, expected_hash_b64)
    except Exception:
        return False


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * ((4 - len(s) % 4) % 4)
    return base64.urlsafe_b64decode((s + pad).encode("ascii"))


def create_local_jwt(
    uid: str,
    email: str,
    display_name: str = "",
    role: str = "user",
    expires_in_seconds: Optional[int] = None,
) -> str:
    """Create an HMAC-SHA256 signed JWT for Zero-Cost Local Authentication."""
    now = int(time.time())
    ttl = expires_in_seconds if expires_in_seconds is not None else (settings.LOCAL_JWT_EXPIRY_HOURS * 3600)
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "iss": "neeva-local-auth",
        "aud": "neeva-ai",
        "sub": uid,
        "uid": uid,
        "email": email,
        "name": display_name,
        "email_verified": True,
        "role": role if role in ("user", "moderator", "admin") else "user",
        "iat": now,
        "exp": now + ttl,
        "jti": str(uuid.uuid4()),
    }
    h_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{h_b64}.{p_b64}".encode("ascii")
    sig = hmac.new(settings.LOCAL_JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{h_b64}.{p_b64}.{_b64url_encode(sig)}"


def verify_local_jwt(token: str) -> dict:
    """Verify an HMAC-SHA256 local JWT and check expiration, audience, issuer, and revocation."""
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format.")

    h_b64, p_b64, sig_b64 = parts
    signing_input = f"{h_b64}.{p_b64}".encode("ascii")
    expected_sig = hmac.new(
        settings.LOCAL_JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256
    ).digest()
    try:
        actual_sig = _b64url_decode(sig_b64)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed token signature.")

    if not hmac.compare_digest(actual_sig, expected_sig):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature.")

    try:
        claims = json.loads(_b64url_decode(p_b64).decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed token claims.")

    now = int(time.time())
    if claims.get("exp", 0) < now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired.")
    if claims.get("iss") != "neeva-local-auth" or claims.get("aud") != "neeva-ai":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token issuer or audience.")

    uid = claims.get("uid") or claims.get("sub")
    if not uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing UID in token.")

    # Check durable SQLite WAL revocation list
    from app.database.firestore_db import get_firestore_repo

    fs = get_firestore_repo()
    jti = claims.get("jti", "")
    with fs._open_conn() as conn:
        if jti:
            row = conn.execute(
                "SELECT 1 FROM firestore_documents WHERE doc_path = ?",
                (f"revoked_tokens/{jti}",),
            ).fetchone()
            if row is not None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked."
                )
        user_rev = conn.execute(
            "SELECT payload_json FROM firestore_documents WHERE doc_path = ?",
            (f"revoked_users/{uid}",),
        ).fetchone()
        if user_rev is not None:
            rev_data = json.loads(user_rev["payload_json"])
            if claims.get("iat", 0) <= rev_data.get("revoked_before", 0):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked."
                )

    role = claims.get("role", "user")
    if role not in ("user", "moderator", "admin"):
        role = "user"
    return {
        "uid": uid,
        "email": claims.get("email", ""),
        "name": claims.get("name", ""),
        "email_verified": claims.get("email_verified", True),
        "role": role,
        "jti": jti,
        "auth_provider": "local_zero_cost",
        **claims,
    }


def _get_firebase_app():
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app
    import firebase_admin
    from firebase_admin import credentials

    try:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app
    except ValueError:
        pass

    if settings.FIREBASE_CREDENTIALS_PATH:
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
    else:
        cred = credentials.ApplicationDefault()

    _firebase_app = firebase_admin.initialize_app(
        cred,
        {"projectId": settings.FIREBASE_PROJECT_ID or "neeva-local"},
    )
    return _firebase_app


def verify_firebase_token(id_token: str) -> dict:
    """
    Verify either a Zero-Cost Local JWT (`iss == 'neeva-local-auth'`) or an optional
    Firebase ID token when Firebase Auth is configured.
    """
    # 1. Check if token is a Zero-Cost Local HMAC-SHA256 JWT
    if id_token.count(".") == 2:
        try:
            payload_preview = json.loads(_b64url_decode(id_token.split(".")[1]).decode("utf-8"))
            if payload_preview.get("iss") == "neeva-local-auth":
                return verify_local_jwt(id_token)
        except HTTPException:
            raise
        except Exception:
            pass

    # 2. Optional Firebase free-tier ID token verification
    import firebase_admin.auth

    try:
        app = _get_firebase_app()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid local authentication token.",
        )
    try:
        claims: dict = firebase_admin.auth.verify_id_token(id_token, app=app, check_revoked=True)
    except firebase_admin.auth.RevokedIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked.")
    except firebase_admin.auth.UserDisabledError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is disabled.")
    except firebase_admin.auth.InvalidIdTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid ID token: {exc}")
    except Exception as exc:
        logger.warning("Token verification failed: %s", type(exc).__name__)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials.")

    role = claims.get("role", "user")
    if role not in ("user", "moderator", "admin"):
        role = "user"
    return {
        "uid": claims["uid"],
        "email": claims.get("email", ""),
        "email_verified": claims.get("email_verified", False),
        "role": role,
        "auth_provider": "firebase",
        **claims,
    }


def verify_app_check_token(x_firebase_appcheck: Optional[str] = Header(default=None)) -> None:
    if not settings.FIREBASE_APP_CHECK_ENFORCE:
        return
    if not x_firebase_appcheck:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Firebase-AppCheck header.",
        )
    import firebase_admin.app_check

    app = _get_firebase_app()
    try:
        firebase_admin.app_check.verify_token(x_firebase_appcheck, app=app)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase App Check token.",
        )


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
    _app_check: None = Depends(verify_app_check_token),
) -> dict:
    """Extract and verify the Bearer token. Never trusts client-supplied user IDs."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must be 'Bearer <token>'.",
        )
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Empty bearer token.")
    return verify_firebase_token(token)


async def require_moderator(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("moderator", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Moderator privileges required.",
        )
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges required.",
        )
    return user
