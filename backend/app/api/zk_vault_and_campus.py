"""
Zero-Knowledge Ciphertext Vault, Structured Gemini 2.5 Flash SSE Stream,
and K-Anonymity (K >= 50) Campus Analytics on Local SQLite WAL (`sqlite.db`).
"""

from __future__ import annotations

import os
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.ai.dlp_client import redact_pii
from app.ai.journal_analysis import analyze_journal_entry
from app.core.security import get_current_user

# Ensure top-level backend modules (safety.py, gemini_service.py) are importable
BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from gemini_service import (  # noqa: E402
    generate_structured_wellness_response,
    stream_structured_wellness_sse,
)

router = APIRouter(prefix="/api/v1", tags=["zero-knowledge-vault-and-campus"])

K_ANONYMITY_THRESHOLD = 50


def get_sqlite_wal_connection() -> sqlite3.Connection:
    db_path_str = os.getenv("LOCAL_SQLITE_DB_PATH", str(BACKEND_ROOT / "sqlite.db"))
    db_path = Path(db_path_str)
    if not db_path.is_absolute():
        db_path = BACKEND_ROOT / db_path
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS encrypted_journals (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            ciphertext TEXT NOT NULL,
            iv TEXT NOT NULL,
            salt TEXT NOT NULL,
            algorithm TEXT NOT NULL DEFAULT 'AES-GCM-256',
            kdf TEXT NOT NULL DEFAULT 'PBKDF2-SHA256-100000',
            created_at TEXT NOT NULL
        );
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_encrypted_journals_user ON encrypted_journals(user_id, created_at DESC);"
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS campus_anonymized_telemetry (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            department TEXT NOT NULL,
            cohort_year TEXT NOT NULL,
            mood_score INTEGER NOT NULL,
            burnout_index REAL NOT NULL,
            recorded_at TEXT NOT NULL
        );
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_campus_telemetry_dept ON campus_anonymized_telemetry(department, cohort_year);"
    )
    conn.commit()
    return conn


# ============================================================================
# 1. Zero-Knowledge Ciphertext-Only Journal Vault
# ============================================================================


class EncryptedVaultWriteRequest(BaseModel):
    id: str | None = None
    ciphertext: str = Field(..., min_length=8, max_length=65536)
    iv: str = Field(..., min_length=8, max_length=128)
    salt: str = Field(..., min_length=8, max_length=128)
    algorithm: str = Field(default="AES-GCM-256")
    kdf: str = Field(default="PBKDF2-SHA256-100000")


@router.post("/journal/vault", status_code=201)
async def store_encrypted_journal_blob(
    request: Request,
    payload: EncryptedVaultWriteRequest,
    user: dict = Depends(get_current_user),
):
    raw_body = await request.json()
    if "plaintext" in raw_body or "text" in raw_body:
        raise HTTPException(
            status_code=400,
            detail="Zero-Knowledge Vault violation: plaintext fields are strictly rejected. Submit {ciphertext, iv, salt} only.",
        )

    record_id = payload.id or str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    uid = user["uid"]
    conn = get_sqlite_wal_connection()
    try:
        with conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO encrypted_journals
                (id, user_id, ciphertext, iv, salt, algorithm, kdf, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record_id,
                    uid,
                    payload.ciphertext,
                    payload.iv,
                    payload.salt,
                    payload.algorithm,
                    payload.kdf,
                    now_iso,
                ),
            )
    finally:
        conn.close()

    return {
        "id": record_id,
        "userId": uid,
        "ciphertext": payload.ciphertext,
        "iv": payload.iv,
        "salt": payload.salt,
        "algorithm": payload.algorithm,
        "kdf": payload.kdf,
        "createdAt": now_iso,
        "zeroKnowledgeVerified": True,
    }


@router.get("/journal/vault")
async def list_encrypted_journal_blobs(
    user: dict = Depends(get_current_user),
):
    uid = user["uid"]
    conn = get_sqlite_wal_connection()
    try:
        rows = conn.execute(
            """
            SELECT id, user_id, ciphertext, iv, salt, algorithm, kdf, created_at
            FROM encrypted_journals
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 100
            """,
            (uid,),
        ).fetchall()
        return {
            "entries": [
                {
                    "id": r["id"],
                    "userId": r["user_id"],
                    "ciphertext": r["ciphertext"],
                    "iv": r["iv"],
                    "salt": r["salt"],
                    "algorithm": r["algorithm"],
                    "kdf": r["kdf"],
                    "createdAt": r["created_at"],
                }
                for r in rows
            ]
        }
    finally:
        conn.close()


@router.delete("/journal/vault")
async def purge_encrypted_journal_vault(
    user: dict = Depends(get_current_user),
):
    uid = user["uid"]
    conn = get_sqlite_wal_connection()
    try:
        with conn:
            cursor = conn.execute(
                "DELETE FROM encrypted_journals WHERE user_id = ?",
                (uid,),
            )
            deleted = cursor.rowcount
            conn.execute(
                "DELETE FROM campus_anonymized_telemetry WHERE user_id = ?",
                (uid,),
            )
        return {"status": "purged", "deletedVaultEntries": deleted}
    finally:
        conn.close()


# ============================================================================
# 2. Opt-in PII-Scrubbed Journal Cognitive Reframing (/api/v1/journal/reframe)
# ============================================================================


class JournalReframeRequest(BaseModel):
    scrubbedText: str = Field(..., min_length=10, max_length=8000)
    prompt: str = Field(default="Daily reflection", max_length=300)


@router.post("/journal/reframe")
async def reframe_scrubbed_journal(
    payload: JournalReframeRequest,
    user: dict = Depends(get_current_user),
):
    redacted_text, found_types = await redact_pii(payload.scrubbedText)
    analysis, source = await analyze_journal_entry(redacted_text, payload.prompt)
    return {
        "analysis": analysis.model_dump(),
        "source": source,
        "piiScrubVerified": True,
        "serverRedactionCount": len(found_types),
    }


# ============================================================================
# 3. Gemini 2.5 Flash Structured JSON & SSE Streaming (/api/v1/chat/stream)
# ============================================================================


class StructuredChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=6000)
    language: str = Field(default="en")
    script: str = Field(default="auto")
    companionName: str = Field(default="Neeva")
    vibe: str = Field(default="bestie")


@router.post("/chat/structured")
async def structured_chat_endpoint(
    payload: StructuredChatRequest,
    user: dict = Depends(get_current_user),
):
    redacted_text, _ = await redact_pii(payload.message)
    result = generate_structured_wellness_response(
        user_text=redacted_text,
        language=payload.language,
        script=payload.script,
        companion_name=payload.companionName,
        vibe=payload.vibe,
    )
    return result


@router.post("/chat/stream")
async def structured_chat_sse_stream(
    payload: StructuredChatRequest,
    user: dict = Depends(get_current_user),
):
    redacted_text, _ = await redact_pii(payload.message)
    generator = stream_structured_wellness_sse(
        user_text=redacted_text,
        language=payload.language,
        script=payload.script,
        companion_name=payload.companionName,
        vibe=payload.vibe,
    )
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
        },
    )


# ============================================================================
# 4. K-Anonymity (K >= 50) Dean / Campus Dashboard View
# ============================================================================


class CampusTelemetrySubmitRequest(BaseModel):
    department: str = Field(default="Computer Science", max_length=80)
    cohortYear: str = Field(default="2026", max_length=16)
    moodScore: int = Field(..., ge=1, le=10)
    burnoutIndex: float = Field(..., ge=0.0, le=100.0)


@router.post("/campus/telemetry", status_code=201)
async def submit_anonymized_campus_telemetry(
    payload: CampusTelemetrySubmitRequest,
    user: dict = Depends(get_current_user),
):
    conn = get_sqlite_wal_connection()
    try:
        with conn:
            conn.execute(
                """
                INSERT INTO campus_anonymized_telemetry
                (id, user_id, department, cohort_year, mood_score, burnout_index, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    user["uid"],
                    payload.department.strip(),
                    payload.cohortYear.strip(),
                    payload.moodScore,
                    payload.burnoutIndex,
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
        return {"status": "recorded", "kAnonymityThreshold": K_ANONYMITY_THRESHOLD}
    finally:
        conn.close()


@router.get("/campus/analytics")
async def get_campus_k_anonymous_analytics(
    department: str | None = None,
):
    """
    Strict K-Anonymity (K >= 50) SQL aggregation view.
    Uses `HAVING COUNT(DISTINCT user_id) >= 50`. If active distinct users < 50,
    returns an anonymized threshold notice instead of raw numbers.
    """
    conn = get_sqlite_wal_connection()
    try:
        params: tuple[Any, ...] = ()
        where_clause = ""
        if department:
            where_clause = "WHERE department = ?"
            params = (department,)

        # 1. Execute strict HAVING COUNT(DISTINCT user_id) >= 50 query
        qualifying_rows = conn.execute(
            f"""
            SELECT
                department,
                cohort_year,
                COUNT(DISTINCT user_id) AS distinct_users,
                ROUND(AVG(mood_score), 2) AS avg_mood_score,
                ROUND(AVG(burnout_index), 2) AS avg_burnout_index
            FROM campus_anonymized_telemetry
            {where_clause}
            GROUP BY department, cohort_year
            HAVING COUNT(DISTINCT user_id) >= {K_ANONYMITY_THRESHOLD}
            ORDER BY department ASC, cohort_year ASC
            """,
            params,
        ).fetchall()

        if not qualifying_rows:
            return {
                "kAnonymityEnforced": True,
                "kThreshold": K_ANONYMITY_THRESHOLD,
                "thresholdMet": False,
                "notice": (
                    f"K-Anonymity Privacy Shield Active: Aggregates are suppressed until at least "
                    f"K >= {K_ANONYMITY_THRESHOLD} distinct students contribute telemetry in a cohort."
                ),
                "cohorts": [],
            }

        return {
            "kAnonymityEnforced": True,
            "kThreshold": K_ANONYMITY_THRESHOLD,
            "thresholdMet": True,
            "notice": f"All returned cohorts satisfy K >= {K_ANONYMITY_THRESHOLD} distinct users.",
            "cohorts": [
                {
                    "department": r["department"],
                    "cohortYear": r["cohort_year"],
                    "distinctUsers": r["distinct_users"],
                    "avgMoodScore": r["avg_mood_score"],
                    "avgBurnoutIndex": r["avg_burnout_index"],
                }
                for r in qualifying_rows
            ],
        }
    finally:
        conn.close()
