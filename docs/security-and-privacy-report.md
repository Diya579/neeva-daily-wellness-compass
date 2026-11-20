# Neeva AI — Local Security, Encryption & Privacy Report

## 1. Encryption & Key Derivation Architecture

Implemented in `backend/app/privacy/encryption.py` and verified in `backend/tests/test_encryption_dlp_skills.py`:
- **Cipher:** **AES-GCM-256** (256-bit key, 96-bit / 12-byte cryptographic random IV via `os.urandom(12)`, 128-bit / 16-byte authentication tag).
- **Key Derivation:** **PBKDF2-HMAC-SHA256** with `100,000` iterations and a 16-byte random salt (`derive_key_pbkdf2`).
- **Ciphertext Validation:** `decode_client_ciphertext()` validates base64 encoding, enforces a 12–16 byte IV length, and enforces a minimum 16-byte authentication tag length before persisting `content_ciphertext` and `content_iv` to SQLite WAL.

---

## 2. Exact Data Flow & Honest Privacy Guarantees

We strictly distinguish between encrypted storage at rest and plaintext processing required for analysis:

1. **Journal Entries & Encrypted Chat Messages at Rest (`users/{uid}/journal_entries/{id}`):**
   - Stored in the local SQLite WAL database (`data/neeva_zero_cost.sqlite3`) as base64-encoded AES-GCM-256 `content_ciphertext` and `content_iv`.
   - Raw journal plaintext is **never** written to the database.
2. **Reflective Analysis & Companion Chat Processing:**
   - When a user requests reflective analysis (`POST /api/v1/journal/{id}/analyze`) or sends a chat message (`POST /api/chat`), the text is processed in memory by:
     1. The local **Three-Tier Safety Engine** (`backend/app/safety/engine.py`),
     2. The local **Deterministic Indian PII Scrubber** (`redact_pii_locally` in `backend/app/ai/dlp_client.py`), which redacts Aadhaar numbers, PAN numbers, +91 mobile numbers, email addresses, and 6-digit PIN codes.
   - In default **Zero-Cost Mode (`ZERO_COST_MODE=True`)**, zero journal or chat data ever leaves the local machine.
   - Because the backend processes plaintext in memory during chat and analysis requests, **Neeva does not claim absolute zero-knowledge or end-to-end encryption for AI-analyzed turns**.

---

## 3. Authentication, Password Security & User Isolation

- **Password Hashing (`backend/app/core/security.py`):** User passwords in Zero-Cost Local Auth (`auth_accounts/{email}`) are hashed with **PBKDF2-HMAC-SHA256** (`120,000` iterations + unique 16-byte salt) and verified using constant-time `hmac.compare_digest`. Raw passwords are never stored or logged.
- **Session Tokens & Revocation:** Local sessions use HMAC-SHA256 signed JWTs (`iss: "neeva-local-auth"`) with strict expiration (`exp`) and durable SQLite WAL revocation (`revoked_tokens/{jti}` and `revoked_users/{uid}`). Calling `POST /api/v1/auth/logout` immediately invalidates the token across restarts.
- **User Isolation & IDOR Prevention:** Every database path is scoped to the authenticated token's `uid` (`users/{uid}/...`). Cross-user read, update, and delete attempts return `404` or `403`, and attempts to overwrite `id` or escalate `role` via `PATCH /api/v1/profile` are stripped server-side.
- **Complete Account & Data Deletion:** `DELETE /api/v1/account` and `DELETE /api/v1/privacy/data` recursively purge the user's profile and all 12 nested subcollections from SQLite WAL (`DELETE FROM firestore_documents WHERE doc_path = ? OR doc_path LIKE ?`).
- **Log Redaction (`backend/app/core/logging.py`):** `SensitiveDataFilter` redacts any log record attributes named `content`, `text`, `body`, `message`, or `ciphertext` to `[REDACTED]`.

