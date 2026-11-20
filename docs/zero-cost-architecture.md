# Neeva AI — Zero-Cost (₹0 Budget) Architecture Specification

## 1. Architectural Overview

Neeva AI has been architected to operate as a complete, durable, end-to-end mental wellness platform with a **strict ₹0 expenditure requirement** and **zero mandatory cloud or billing dependencies**, while preserving all **169 existing frontend files** byte-for-byte.

| Component | Zero-Cost Implementation (`₹0` Default Mode) | Source File(s) | Cost & External Prerequisites |
|---|---|---|---|
| **Frontend** | Frozen React 19 + TanStack Start frontend (169 untouched files) | `frontend/**` | ₹0 · Local Node/Bun runtime |
| **Backend API** | Python FastAPI (`v2.0.0`), mounting both `/api/v1/*` and `/api/chat` | `backend/app/main.py`, `backend/app/api/*.py` | ₹0 · Local Uvicorn / Docker |
| **Operational Database** | Durable **SQLite with WAL mode** (`PRAGMA journal_mode=WAL`, `BEGIN IMMEDIATE` cross-process locking, indexes, cursor pagination, recursive tree deletion) | `backend/app/database/firestore_db.py` (`data/neeva_zero_cost.sqlite3`) | ₹0 · Zero cloud DB required |
| **Authentication** | Local PBKDF2-HMAC-SHA256 (`120,000` iterations) password storage + HMAC-SHA256 JWT issuance & durable SQLite WAL token revocation (`AUTH_MODE=local`) | `backend/app/core/security.py`, `backend/app/api/auth.py` | ₹0 · Zero Firebase project required |
| **AI Companion & Journal** | Three-Provider Honest AI Architecture: **Provider A** (Local CPU Ollama / quantized open-source LLM), **Provider B** (Opt-in free-tier Gemini, disabled by default), **Provider C** (Empathetic 8-language CBT/ACT deterministic engine) | `backend/app/ai/providers.py`, `backend/app/ai/journal_analysis.py` | ₹0 · Works 100% offline out-of-the-box |
| **Three-Tier Safety Engine** | Local deterministic 8-language regex engine (`en`, `hinglish`, `hi`, `gu`, `mr`, `bn`, `ta`, `te`) with negation/slang guards, multi-turn escalation, and optional local ONNX MuRIL | `backend/app/safety/crisis_patterns.py`, `backend/app/safety/engine.py`, `backend/app/safety/muril.py` | ₹0 · Sub-millisecond local CPU execution |
| **Indian PII Redaction** | Local deterministic Indian PII scrubber (Aadhaar, PAN, +91 Phone, Email, 6-digit PIN code, street address) | `backend/app/ai/dlp_client.py` | ₹0 · Paid Cloud DLP disabled by default |
| **Privacy & Encryption** | AES-GCM-256 + PBKDF2-HMAC-SHA256 (`100,000` iterations, 12-byte random IV, 16-byte auth tag) | `backend/app/privacy/encryption.py` | ₹0 · Standard `cryptography` library |
| **Payment Demo** | Standalone local simulation in `/payment-demo/` | `payment-demo/**` | ₹0 · Zero payment gateways |

---

## 2. Durable SQLite WAL Database Architecture

Rather than using SQLite as a throwaway cache, `FirestoreOperationalRepository` in `backend/app/database/firestore_db.py` configures SQLite as the durable operational database (`data/neeva_zero_cost.sqlite3`):
- **Write-Ahead Logging (`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;`)**: Allows concurrent readers and serialized cross-process writers.
- **Cross-Process Locking (`BEGIN IMMEDIATE`)**: Every write, merge, recursive account deletion, and wellness streak update runs inside an explicit `BEGIN IMMEDIATE` transaction.
- **Zero In-Memory `_docs` Cache**: All reads and collection queries read directly from the SQLite WAL file on disk, guaranteeing multi-instance consistency and 100% survival across restarts.
- **Indexed Collection Hierarchy**: Indexed on `(collection_path, depth)` and primary key `doc_path` (`users/{uid}`, `users/{uid}/mood_logs/{id}`, `users/{uid}/journal_entries/{id}`, `users/{uid}/cbt_exercises/{id}`, `users/{uid}/wellness_toolkit/{id}`, `users/{uid}/conversations/{id}/messages/{id}`, `users/{uid}/trusted_contacts/{id}`, `users/{uid}/safety_events/{id}`, `users/{uid}/crisis_interventions/{id}`, `community_posts/{id}`, `auth_accounts/{email}`, `revoked_tokens/{jti}`).

