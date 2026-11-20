from __future__ import annotations

import secrets
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


def _load_or_create_local_jwt_secret() -> str:
    """Persist a local 256-bit HMAC secret on disk so JWT sessions survive restarts without cloud config."""
    secret_path = Path(__file__).resolve().parents[2] / "data" / ".local_jwt_secret"
    try:
        if secret_path.exists():
            val = secret_path.read_text(encoding="utf-8").strip()
            if len(val) >= 32:
                return val
        secret_path.parent.mkdir(parents=True, exist_ok=True)
        generated = secrets.token_hex(32)
        secret_path.write_text(generated, encoding="utf-8")
        return generated
    except Exception:
        return "neeva-zero-cost-default-hmac-secret-key-256bit-local"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ========================================================================
    # ZERO-COST ARCHITECTURE DEFAULTS (₹0 BUDGET — NO CLOUD REQUIRED)
    # ========================================================================
    ZERO_COST_MODE: bool = True

    # Durable Local SQLite WAL Operational Database
    DATABASE_MODE: str = "sqlite_wal"  # "sqlite_wal" (default ₹0) | "firestore_opt_in"
    LOCAL_FIRESTORE_DB_PATH: str = "data/neeva_zero_cost.sqlite3"
    DATABASE_URL: str = "sqlite+aiosqlite:///:memory:"

    # Authentication Mode ("local" default ₹0 | "hybrid" | "firebase_free_opt_in")
    AUTH_MODE: str = "local"
    LOCAL_JWT_SECRET: str = _load_or_create_local_jwt_secret()
    LOCAL_JWT_EXPIRY_HOURS: int = 24

    # AI Provider Architecture (Provider A: Local Open-Source, Provider B: Opt-In Free Gemini, Provider C: Deterministic Fallback)
    ENABLE_LOCAL_OPEN_SOURCE_AI: bool = True
    LOCAL_LLM_BASE_URL: str = ""  # Optional local CPU Ollama / llama.cpp URL (e.g. http://127.0.0.1:11434)
    LOCAL_LLM_MODEL_NAME: str = "gemma2:2b"
    ENABLE_LOCAL_HF_PIPELINE: bool = False  # Opt-in local HuggingFace CPU pipeline (local_files_only=True by default)
    LOCAL_HF_MODEL_ID: str = "distilbert-base-multilingual-cased"
    LOCAL_HF_ALLOW_DOWNLOAD: bool = False  # Never download weights unless explicitly requested

    # Optional Free-Tier Gemini (Disabled by default; NEVER uses paid Vertex AI)
    ENABLE_OPTIONAL_GEMINI_FREE_TIER: bool = False
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_TIMEOUT_SECONDS: float = 15.0
    GEMINI_MAX_RETRIES: int = 1

    # Paid Google Cloud Services — Strictly Disabled by Default in Zero-Cost Mode
    ENABLE_OPTIONAL_CLOUD_DLP: bool = False
    ENABLE_OPTIONAL_VERTEX_ENDPOINTS: bool = False
    FIRESTORE_REQUIRE_LIVE: bool = False
    FIREBASE_APP_CHECK_ENFORCE: bool = False

    # Optional Legacy/Cloud Identifiers (Empty by default — not required to start or run Neeva)
    GOOGLE_CLOUD_PROJECT: str = ""
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_CREDENTIALS_PATH: str = ""
    FIREBASE_WEB_API_KEY: str = ""
    FIRESTORE_DATABASE_ID: str = "(default)"
    DLP_REGION: str = "asia-south1"
    DLP_TIMEOUT_SECONDS: float = 8.0
    VERTEX_AI_REGION: str = "asia-south1"
    VERTEX_GEMMA_9B_ENDPOINT: str = ""
    VERTEX_GEMMA_2B_ENDPOINT: str = ""
    VERTEX_TIMEOUT_SECONDS: float = 15.0
    MURIL_ONNX_PATH: str = "models/muril/muril_distress.onnx"
    MURIL_HF_CHECKPOINT: str = "google/muril-base-cased"
    SECRET_MANAGER_PREFIX: str = ""

    # Application Runtime
    ENVIRONMENT: str = "development"  # "development" | "test" | "production"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]
    MAX_CHAT_MESSAGES: int = 40
    MAX_REQUEST_BYTES: int = 65536

    # Rate limiting
    RATE_LIMIT_CHAT: str = "30/minute"
    RATE_LIMIT_DEFAULT: str = "120/minute"

    # Logging
    LOG_LEVEL: str = "INFO"

    def validate_production_readiness(self) -> None:
        """
        In Zero-Cost Mode (default), Neeva runs completely locally on durable SQLite WAL
        without requiring any Google Cloud project, billing account, or API key.
        If an operator explicitly disables ZERO_COST_MODE and sets FIRESTORE_REQUIRE_LIVE=True,
        validate that a project ID is present.
        """
        if not self.ZERO_COST_MODE and self.FIRESTORE_REQUIRE_LIVE:
            if not self.GOOGLE_CLOUD_PROJECT or self.GOOGLE_CLOUD_PROJECT == "neeva-ai-dev":
                raise RuntimeError(
                    "FIRESTORE_REQUIRE_LIVE=True requires a valid GOOGLE_CLOUD_PROJECT."
                )


settings = Settings()
