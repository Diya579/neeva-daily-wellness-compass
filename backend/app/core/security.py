from __future__ import annotations

import logging
from typing import Optional

import firebase_admin
import firebase_admin.app_check
import firebase_admin.auth
from fastapi import Depends, Header, HTTPException, status
from firebase_admin import credentials

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Firebase App singleton
# ---------------------------------------------------------------------------

_firebase_app: Optional[firebase_admin.App] = None


def _get_firebase_app() -> firebase_admin.App:
    """Return (and lazily initialise) the Firebase Admin SDK singleton."""
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

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
        {"projectId": settings.FIREBASE_PROJECT_ID},
    )
    logger.info("Firebase Admin SDK initialised (project=%s)", settings.FIREBASE_PROJECT_ID)
    return _firebase_app


# ---------------------------------------------------------------------------
# Token & App Check verification
# ---------------------------------------------------------------------------


def verify_firebase_token(id_token: str) -> dict:
    """Verify a Firebase ID token and return decoded claims including role."""
    app = _get_firebase_app()
    try:
        claims: dict = firebase_admin.auth.verify_id_token(id_token, app=app, check_revoked=True)
    except firebase_admin.auth.RevokedIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked.")
    except firebase_admin.auth.UserDisabledError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is disabled.")
    except firebase_admin.auth.InvalidIdTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid ID token: {exc}")
    except Exception as exc:
        logger.warning("Firebase token verification failed: %s", type(exc).__name__)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials.")

    role = claims.get("role", "user")
    if role not in ("user", "moderator", "admin"):
        role = "user"

    return {
        "uid": claims["uid"],
        "email": claims.get("email", ""),
        "email_verified": claims.get("email_verified", False),
        "role": role,
        **claims,
    }


def verify_app_check_token(x_firebase_appcheck: Optional[str] = Header(default=None)) -> None:
    """Verify Firebase App Check token when enforcement is active."""
    if not settings.FIREBASE_APP_CHECK_ENFORCE:
        return
    if not x_firebase_appcheck:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Firebase-AppCheck header.",
        )
    app = _get_firebase_app()
    try:
        firebase_admin.app_check.verify_token(x_firebase_appcheck, app=app)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase App Check token.",
        )


# ---------------------------------------------------------------------------
# FastAPI dependencies (Authentication + RBAC)
# ---------------------------------------------------------------------------


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
    _app_check: None = Depends(verify_app_check_token),
) -> dict:
    """Extract and verify the Firebase Bearer token. Never trusts client-supplied user IDs."""
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
    """Require community moderator or administrator role."""
    if user.get("role") not in ("moderator", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Moderator privileges required.",
        )
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Require administrator role."""
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges required.",
        )
    return user
