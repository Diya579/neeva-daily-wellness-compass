# Neeva AI — IAM Permissions, Environment Variables & Model Readiness Guide

## 1. Least-Privilege Google Cloud IAM Roles (`neeva-api-sa`)

The Cloud Run service account `neeva-api-sa@${PROJECT_ID}.iam.gserviceaccount.com` requires only the following 7 IAM roles (all legacy Cloud SQL roles have been removed):

| IAM Role | Purpose |
|---|---|
| `roles/datastore.user` | Read, write, query, and run atomic transactions on Firebase Cloud Firestore `(default)` database |
| `roles/firebaseauth.admin` | Verify Firebase ID tokens, check token revocation, and generate email verification/reset links |
| `roles/secretmanager.secretAccessor` | Read `neeva-gemini-api-key` from Google Secret Manager at Cloud Run startup |
| `roles/dlp.user` | Call Google Cloud DLP `projects.locations.content:inspect` and `content:deidentify` in `asia-south1` |
| `roles/aiplatform.user` | Invoke Vertex AI Gemini 2.5 Flash and Vertex AI Gemma 2 (2B-IT / 9B-IT) prediction endpoints |
| `roles/logging.logWriter` | Write structured JSON logs (filtered by `SensitiveDataFilter`) to Google Cloud Logging |
| `roles/monitoring.metricWriter` | Emit request latency and safety tier telemetry to Google Cloud Monitoring |

---

## 2. Environment Variable Reference (`backend/.env.example`)

| Variable | Default / Example | Required in Production | Description |
|---|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | `onyx-gift-514504-q0` | **Yes** | Google Cloud project ID for Firestore, Cloud DLP, and Vertex AI |
| `FIREBASE_PROJECT_ID` | `onyx-gift-514504-q0` | **Yes** | Firebase project ID for ID token & App Check verification |
| `ENVIRONMENT` | `development` | **Yes** (`production`) | Enables production fail-closed checks and Cloud Logging |
| `FIRESTORE_REQUIRE_LIVE` | `false` (`true` in prod) | **Yes** (`true`) | Forces `FirestoreOperationalRepository` to fail closed if live Firestore is unreachable |
| `FIRESTORE_DATABASE_ID` | `(default)` | **Yes** | Cloud Firestore database identifier |
| `FIREBASE_APP_CHECK_ENFORCE` | `false` (`true` in prod) | Recommended | Enforces `X-Firebase-AppCheck` header validation |
| `GEMINI_API_KEY` | Secret Manager | Optional (uses Vertex ADC if empty) | Google AI Studio API key for `google-genai` SDK |
| `GEMINI_MODEL` | `gemini-2.5-flash` | **Yes** | Primary conversational & reflective journal model |
| `DLP_REGION` | `asia-south1` | **Yes** | Google Cloud DLP processing region (Mumbai) |
| `VERTEX_AI_REGION` | `asia-south1` | **Yes** | Vertex AI endpoint region (Mumbai) |
| `MURIL_ONNX_PATH` | `models/muril/muril_distress.onnx` | Optional | Path to exported `google/muril-base-cased` ONNX artifact |
| `VERTEX_GEMMA_2B_ENDPOINT` | `""` | Optional | Vertex AI endpoint ID/URL for Gemma 2 2B-IT moderation |
| `VERTEX_GEMMA_9B_ENDPOINT` | `""` | Optional | Vertex AI endpoint ID/URL for fine-tuned Gemma 2 9B-IT |

---

## 3. Model Readiness & Verification Commands

### Check Live Model & Database Readiness
```bash
curl -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" http://localhost:8080/api/v1/models/status
```
Returns exact truth-in-telemetry fields:
- `firestore_database_mode`: `"live"` | `"emulator"` | `"local_persistent"`
- `muril.model_loaded`: `true` only when `models/muril/muril_distress.onnx` weights are loaded in ONNX Runtime (`active_inference_backend: "muril_onnx_runtime"` vs `"deterministic_multilingual_rules"`).
- `gemma_2_2b_it.vertex_endpoint_configured`: `true` when `VERTEX_GEMMA_2B_ENDPOINT` is set; `/api/v1/models/gemma-2b/moderate` returns `inference_source: "vertex_ai_gemma_2_2b_it"` and `live_inference_performed: true` only when the actual Vertex AI `:predict` call succeeds.
- `gemma_2_9b_it.vertex_endpoint_configured`: `true` when `VERTEX_GEMMA_9B_ENDPOINT` is set; `/api/v1/models/gemma-9b/infer` enforces Tier 3 safety lockdown first and returns HTTP `503 VERTEX_ENDPOINT_NOT_PROVISIONED` when unprovisioned.
