# Neeva AI — Google-Only Backend Service

Independent Python FastAPI backend for **Neeva AI**, built exclusively on Google Cloud and Google AI technologies while preserving the frozen frontend byte-for-byte.

## Google Technology Stack

- **API Runtime:** Python 3.11 + FastAPI on **Google Cloud Run** (`asia-south1` Mumbai)
- **Primary Database:** **Google Cloud SQL for PostgreSQL** (SQLAlchemy 2.0 Async + Alembic)
- **Authentication:** **Firebase Authentication** + **Firebase App Check** (`firebase-admin` SDK)
- **Primary Conversational & Reflective AI:** **Gemini 2.5 Flash** via **Google AI Studio** / Vertex AI
- **Multilingual Safety & Distress Classifier:** **Google MuRIL** (`google/muril-base-cased`) via ONNX Runtime + Deterministic 8-Language Regex Engine
- **Fine-Tuned & Lightweight Open Models:** **Gemma 2 9B-IT** (QLoRA pipeline on BharatGen MHQA + Vaani) & **Gemma 2 2B-IT** (moderation & emotion tagger)
- **PII Detection & Redaction:** **Google Cloud DLP** (`google-cloud-dlp`) + deterministic Indian PII rules (Aadhaar, PAN, Phone, Email)
- **Secrets & Observability:** **Google Secret Manager**, **Google Cloud Logging** (with sensitive content redaction filter), **Google Cloud Monitoring**

## Directory Structure

```text
backend/
├── app/
│   ├── ai/                  # Gemini 2.5 Flash, Companion Prompts, Journal Analyst, Cloud DLP, Agent Skills
│   ├── api/                 # Versioned REST routers (/api/v1/*)
│   ├── core/                # Settings, Firebase Auth/RBAC, Rate Limiting, Cloud Logging Filter
│   ├── database/            # Async SQLAlchemy engine & session factory
│   ├── models/              # PostgreSQL ORM models (user, mood, journal, thought, chat, wellness, community, privacy)
│   ├── privacy/             # AES-GCM-256 & PBKDF2-SHA256 encryption helpers
│   ├── safety/              # Three-tier safety engine, 8-language crisis patterns, MuRIL ONNX classifier
│   ├── schemas/             # Pydantic v2 request/response contracts
│   ├── services/            # IST-aware streak and wellness activity services
│   └── main.py              # FastAPI application entrypoint
├── migrations/              # Alembic migrations for Cloud SQL PostgreSQL
├── tests/                   # Automated pytest test suite
├── Dockerfile               # Multi-stage non-root production Dockerfile
├── cloudbuild.yaml          # Google Cloud Build CI/CD pipeline
├── requirements.txt         # Pinned dependencies
└── .env.example             # Environment variable template
```

## Local Development

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Copy and configure environment variables
cp .env.example .env

# Run database migrations against Cloud SQL Auth Proxy or local PostgreSQL
alembic upgrade head

# Start local development server
uvicorn app.main:app --reload --port 8080
```

## Running Automated Tests

```bash
cd backend
pytest -v
```

