from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager

from pathlib import Path
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api import (
    auth,
    chat,
    community,
    journal,
    models_dlp,
    mood,
    payment_demo,
    privacy,
    profile,
    safety,
    thought,
    wellness,
    zk_vault_and_campus,
)
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.rate_limit import limiter
from app.database.firestore_db import get_firestore_repo

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(settings)
    settings.validate_production_readiness()
    # Initialize operational Firestore repository (fails closed in production if live Firestore is unreachable)
    fs_repo = get_firestore_repo()
    logger.info(
        "Neeva AI Backend started (env=%s, firestore_mode=%s, project=%s).",
        settings.ENVIRONMENT,
        fs_repo.mode,
        fs_repo.project_id,
    )
    yield
    logger.info("Neeva AI Backend shutdown complete.")


app = FastAPI(
    title="Neeva AI Backend",
    description=(
        "Google-Only Mental Wellness Platform Backend — Cloud Run, Firebase Cloud Firestore, "
        "Firebase Authentication, Gemini 2.5 Flash (google-genai), Google MuRIL ONNX, "
        "Vertex AI Gemma 2 (9B-IT & 2B-IT), and Google Cloud DLP."
    ),
    version="2.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.state.limiter = limiter

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.run\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-Firebase-AppCheck"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]
    if settings.ENVIRONMENT != "production"
    else ["*.run.app", "localhost", "127.0.0.1"],
)


@app.middleware("http")
async def security_and_request_id_middleware(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.MAX_REQUEST_BYTES:
        return JSONResponse(
            status_code=413,
            content={"detail": "Request payload too large."},
        )

    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    response: Response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
    return response


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please slow down."},
        headers={"Retry-After": str(getattr(exc, "retry_after", 60))},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected internal server error occurred."},
    )


# ---------------------------------------------------------------------------
# Versioned API Routers (/api/v1/*) & Frozen Frontend Compatibility (/api/chat)
# ---------------------------------------------------------------------------

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(zk_vault_and_campus.router)
app.include_router(chat.router)
app.include_router(chat.legacy_chat_router)
app.include_router(safety.router)
app.include_router(journal.router)
app.include_router(mood.router)
app.include_router(thought.router)
app.include_router(wellness.router)
app.include_router(community.router)
app.include_router(privacy.router)
app.include_router(models_dlp.router)
app.include_router(payment_demo.router)

# Mount the Payment Demo UI at /payment-demo/ when the directory exists
_PAYMENT_DEMO_DIR = Path(__file__).resolve().parents[2] / "payment-demo"
if _PAYMENT_DEMO_DIR.is_dir():
    app.mount(
        "/payment-demo",
        StaticFiles(directory=str(_PAYMENT_DEMO_DIR), html=True),
        name="payment-demo",
    )


@app.get("/health", tags=["health"])
async def health_check():
    fs = get_firestore_repo()
    return {
        "status": "ok",
        "version": "2.0.0",
        "service": "neeva-ai-backend",
        "operational_database": "cloud_firestore",
        "firestore_mode": fs.mode,
    }
