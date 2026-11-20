from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Google Cloud & Firebase Project
    GOOGLE_CLOUD_PROJECT: str = "onyx-gift-514504-q0"
    FIREBASE_PROJECT_ID: str = "onyx-gift-514504-q0"
    FIREBASE_CREDENTIALS_PATH: str = ""  # empty = ADC in production
    FIREBASE_WEB_API_KEY: str = ""
    FIREBASE_APP_CHECK_ENFORCE: bool = False

    # Cloud Firestore Operational Database
    # Modes: "live" (production default), "emulator" (when FIRESTORE_EMULATOR_HOST set), "local_persistent" (dev/test)
    FIRESTORE_DATABASE_ID: str = "(default)"
    FIRESTORE_REQUIRE_LIVE: bool = False
    LOCAL_FIRESTORE_DB_PATH: str = ".neeva_local_firestore.sqlite3"

    # Optional legacy Cloud SQL DSN (used only by the one-off migration script)
    DATABASE_URL: str = "sqlite+aiosqlite:///:memory:"

    # Gemini 2.5 Flash via Google GenAI SDK (`google-genai`)
    GEMINI_API_KEY: str = ""  # empty = use Vertex AI / ADC
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_TIMEOUT_SECONDS: float = 25.0
    GEMINI_MAX_RETRIES: int = 2

    # Google MuRIL & Vertex AI Gemma Endpoints
    MURIL_ONNX_PATH: str = "models/muril/muril_distress.onnx"
    MURIL_HF_CHECKPOINT: str = "google/muril-base-cased"
    VERTEX_AI_REGION: str = "asia-south1"
    VERTEX_GEMMA_9B_ENDPOINT: str = ""
    VERTEX_GEMMA_2B_ENDPOINT: str = ""
    VERTEX_TIMEOUT_SECONDS: float = 15.0

    # Google Cloud DLP
    DLP_REGION: str = "asia-south1"
    DLP_TIMEOUT_SECONDS: float = 8.0

    # Secret Manager
    SECRET_MANAGER_PREFIX: str = "projects/{project}/secrets"

    # App behaviour
    ENVIRONMENT: str = "development"  # "development" | "test" | "production"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    MAX_CHAT_MESSAGES: int = 40
    MAX_REQUEST_BYTES: int = 65536

    # Rate limiting
    RATE_LIMIT_CHAT: str = "20/minute"
    RATE_LIMIT_DEFAULT: str = "100/minute"

    # Logging
    LOG_LEVEL: str = "INFO"

    def validate_production_readiness(self) -> None:
        """Fail closed at startup if ENVIRONMENT=='production' and critical Google Cloud settings are invalid."""
        if self.ENVIRONMENT == "production":
            if not self.GOOGLE_CLOUD_PROJECT or self.GOOGLE_CLOUD_PROJECT == "neeva-ai-dev":
                raise RuntimeError("Production startup failed: GOOGLE_CLOUD_PROJECT must be set to a real GCP project.")
            if not self.FIREBASE_PROJECT_ID or self.FIREBASE_PROJECT_ID == "neeva-ai-dev":
                raise RuntimeError("Production startup failed: FIREBASE_PROJECT_ID must be set to a real Firebase project.")


settings = Settings()
