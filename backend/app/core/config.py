from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Google Cloud
    GOOGLE_CLOUD_PROJECT: str = "neeva-ai-dev"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/neeva_dev"

    # Firebase Authentication & App Check
    FIREBASE_PROJECT_ID: str = "neeva-ai-dev"
    FIREBASE_CREDENTIALS_PATH: str = ""  # empty = ADC in production
    FIREBASE_WEB_API_KEY: str = ""
    FIREBASE_APP_CHECK_ENFORCE: bool = False

    # Gemini / Vertex AI (@google/genai / google-generativeai)
    GEMINI_API_KEY: str = ""  # empty = use Vertex AI / ADC
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # Model paths & Vertex AI
    MURIL_ONNX_PATH: str = "models/muril/muril_distress.onnx"
    VERTEX_AI_REGION: str = "asia-south1"
    VERTEX_GEMMA_9B_ENDPOINT: str = ""
    VERTEX_GEMMA_2B_ENDPOINT: str = ""

    # DLP
    DLP_REGION: str = "global"

    # Secret Manager
    SECRET_MANAGER_PREFIX: str = "projects/{project}/secrets"

    # App behaviour
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    MAX_CHAT_MESSAGES: int = 40
    MAX_REQUEST_BYTES: int = 65536

    # Rate limiting
    RATE_LIMIT_CHAT: str = "20/minute"
    RATE_LIMIT_DEFAULT: str = "100/minute"

    # Logging
    LOG_LEVEL: str = "INFO"


settings = Settings()
