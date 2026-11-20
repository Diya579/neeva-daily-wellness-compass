# Neeva AI — Zero-Cost Verification Report (Section 10 Answers)

**Verification Date:** 20 November 2026  
**Branch:** `full-code-1`  
**Total Permitted Expenditure:** **₹0**  
**Automated Test Suite Result:** **72 / 72 tests passed**

---

## Explicit Answers to the 10 Mandatory Zero-Cost Questions

### 1. Can Neeva start without a Google Cloud project?
**Yes.** `GOOGLE_CLOUD_PROJECT` and `FIREBASE_PROJECT_ID` default to `""` (empty string) in `backend/app/core/config.py`. The FastAPI application starts, initializes the durable SQLite WAL database (`data/neeva_zero_cost.sqlite3`), and serves all endpoints without any Google Cloud project.

### 2. Can Neeva start without a billing account?
**Yes.** Zero billing-enabled services are required or contacted. All paid cloud integrations (`ENABLE_OPTIONAL_CLOUD_DLP`, `ENABLE_OPTIONAL_VERTEX_ENDPOINTS`, `FIRESTORE_REQUIRE_LIVE`) default to `False`.

### 3. Can Neeva start without any API key?
**Yes.** `GEMINI_API_KEY` defaults to `""` and `ENABLE_OPTIONAL_GEMINI_FREE_TIER` defaults to `False`. Local JWT authentication automatically generates and persists its own 256-bit HMAC secret (`backend/data/.local_jwt_secret`).

### 4. Can Neeva persist data after a restart?
**Yes.** All user accounts, profiles, companion settings, mood logs, IST streaks, encrypted journal entries, journal analyses, CBT thought records, conversations, trusted contacts, safety events, and community posts are persisted to disk in SQLite WAL mode (`data/neeva_zero_cost.sqlite3`). Verified in `test_multi_instance_and_cross_process_firestore_persistence` (across separate Python OS subprocesses) and `test_zero_cost_real_local_auth_and_full_product_journey_without_cloud_or_mocks`.

### 5. Can all core features be demonstrated without internet access after dependencies and any optional model weights have been obtained?
**Yes.** Once Python dependencies (and Node/Bun packages for the frontend) are installed locally, 100% of Neeva's core features—local registration/login, profile & companion setup, 8-language AI companion chat, encrypted journaling & reflective analysis, mood check-ins & CSV/JSON export, CBT thought records, wellness streaks, trusted contacts, 3-tier crisis safety intervention, community circles, Indian PII redaction, account deletion, and the standalone `/payment-demo/`—run completely offline on `127.0.0.1`.

### 6. Which features use genuine AI inference?
- **Provider A (`local_open_source`)**: When a local CPU inference server (such as Ollama or `llama.cpp` serving quantized `gemma2:2b` or `qwen2.5:1.5b` on localhost) is configured via `LOCAL_LLM_BASE_URL`, `/api/chat` and `/api/v1/chat` perform genuine local open-source LLM inference (`X-Neeva-AI-Provider: local_open_source`, `X-Neeva-Is-Generative-LLM: true`).
- **Local ONNX MuRIL (`models/muril/muril_distress.onnx`)**: When the exported ONNX artifact is present locally, `MuRILClassifier` runs genuine ONNX Runtime neural inference on CPU (`inference_source: "hybrid_deterministic_and_muril_onnx"`).
- **Provider B (`gemini_free_tier_opt_in`)**: Only if an operator explicitly sets `ENABLE_OPTIONAL_GEMINI_FREE_TIER=true` and supplies a free-tier Google AI Studio `GEMINI_API_KEY`.

### 7. Which features use deterministic fallback logic?
When no local LLM server (`LOCAL_LLM_BASE_URL`) or opt-in Gemini key is active, the following features use transparent deterministic logic and explicitly declare it in their response headers/fields:
- **Companion Chat (`Provider C`)**: Uses `build_deterministic_companion_reply()` in `backend/app/ai/providers.py` and returns headers `X-Neeva-AI-Provider: deterministic_fallback` and `X-Neeva-Is-Generative-LLM: false`.
- **Journal Analysis (`analyze_locally`)**: Uses the lexical CBT emotion/distortion/reframe analyzer in `backend/app/ai/journal_analysis.py` and returns `"source": "offline"`.
- **Three-Tier Safety Engine**: Always runs deterministic 8-language regex classification (`backend/app/safety/crisis_patterns.py`) with negation and slang guards (`inference_source: "deterministic_multilingual_rules"` when MuRIL ONNX is not loaded).
- **Indian PII Protection**: Uses deterministic regex rules (`redact_pii_locally` in `backend/app/ai/dlp_client.py`) for Aadhaar, PAN, +91 mobile numbers, email addresses, and 6-digit PIN codes (`deidentification_source: "local_custom_fallback"`).
- **Community Moderation (`/api/v1/models/gemma-2b/moderate`)**: Uses deterministic safety + PII + lexical emotion tagging (`inference_source: "deterministic_fallback"`, `live_inference_performed: false`).

### 8. Does any code path make a paid external request?
**No.** In default Zero-Cost Mode (`ZERO_COST_MODE=True`), zero code paths make outbound calls to Vertex AI, Cloud DLP, Cloud Firestore, or Google AI Studio.

### 9. Are there any hidden costs or external prerequisites?
**No hidden costs (₹0).** The only external prerequisite is initial internet access to install open-source Python/Node dependencies (or optional open-source model weights if the user chooses to run Ollama or export MuRIL ONNX).

### 10. What are the hardware and storage requirements?
- **Default Zero-Cost Mode (FastAPI + SQLite WAL + Deterministic Engine + Safety + PII + Encryption):**
  - **CPU:** Any modern dual-core x86_64 or ARM64 CPU (no GPU required)
  - **RAM:** ~250 MB free RAM
  - **Disk:** ~150 MB for Python dependencies + `<10 MB` for SQLite WAL database
- **Optional Local CPU Open-Source LLM (`gemma2:2b-instruct-q4_K_M` via Ollama / llama.cpp):**
  - **CPU:** 4+ cores recommended (no GPU required)
  - **RAM:** ~2.5 GB available RAM
  - **Disk:** ~1.6 GB for 4-bit quantized model weights

