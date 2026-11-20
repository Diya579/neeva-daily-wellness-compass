"""
Neeva FastAPI Gatekeeper Entry Point (/backend/main.py)
Runs locally on SQLite WAL (`sqlite.db`) or in a Google Cloud Run container.
Start with:
    uvicorn main:app --host 0.0.0.0 --port 8080 --reload
"""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv

# Explicitly load backend/.env regardless of working directory
load_dotenv(Path(__file__).resolve().parent / ".env", override=True)

from app.api.zk_vault_and_campus import get_sqlite_wal_connection  # noqa: E402
from app.main import app  # noqa: E402

# Initialize local SQLite WAL database (`sqlite.db`) on import
_conn = get_sqlite_wal_connection()
_conn.close()

__all__ = ["app"]
