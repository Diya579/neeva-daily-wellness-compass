# Neeva AI — Google Cloud Deployment, Infrastructure Cost Estimates & Owner Checklist

## 1. Google Cloud Architecture Overview (`asia-south1` Mumbai)

All data residency and compute for Indian users are pinned to **`asia-south1` (Mumbai)** for low latency (<35 ms across India) and Indian data locality:

1. **Google Cloud Run (`neeva-api`)**: Serverless container hosting FastAPI (`2 vCPU`, `2 GiB RAM`, `min-instances=1` for zero cold start on crisis endpoints, `max-instances=20`).
2. **Google Cloud SQL for PostgreSQL 16 (`neeva-pg-main`)**: Private IP + Cloud SQL Auth Proxy Unix socket connection, automated daily backups, encrypted at rest with Google-managed or Cloud KMS keys.
3. **Firebase Authentication & Firebase App Check**: Email/Password provider, token revocation support, custom claims (`role: user | moderator | admin`).
4. **Google AI Studio / Vertex AI (`gemini-2.5-flash`)**: Primary conversational companion and structured reflective journal analysis.
5. **Google MuRIL ONNX**: Bundled inside the Cloud Run container image for sub-15 ms CPU inference alongside the deterministic 8-language regex safety engine.
6. **Google Cloud DLP**: Inspects and redacts Aadhaar (`INDIA_AADHAAR_INDIVIDUAL`), PAN (`INDIA_PAN_INDIVIDUAL`), phone numbers, and email addresses.
7. **Google Secret Manager**: Stores `neeva-database-url` and `neeva-gemini-api-key`.
8. **Google Cloud Logging & Monitoring**: Structured JSON logs with `SensitiveDataFilter` (redacts `content`, `text`, `body`, `message`, `ciphertext` fields automatically).

---

## 2. Estimated Monthly Infrastructure Costs (USD & INR)

> **Policy Compliance:** No paid GPU or Cloud SQL instances have been provisioned without owner approval. Below are transparent cost estimates for two traffic tiers in `asia-south1` (Mumbai).

### Stage A — Early Launch / Pilot (1,000 Active Users, ~15,000 Chat Turns/mo)

| Google Cloud Service | Configuration | Estimated Monthly Cost (USD) | Estimated Monthly Cost (INR) |
|---|---|---|---|
| **Google Cloud Run (CPU API + MuRIL ONNX)** | 2 vCPU, 2 GiB RAM, `min-instances=1` | ~$38 / mo | ~₹3,200 / mo |
| **Google Cloud SQL for PostgreSQL** | `db-f1-micro` or `db-g1-small` (10 GB SSD, `asia-south1`) | ~$15 – $29 / mo | ~₹1,300 – ₹2,450 / mo |
| **Firebase Authentication** | Identity Platform Free Tier (<50,000 MAU) | $0 / mo | ₹0 / mo |
| **Gemini 2.5 Flash (Google AI Studio / Vertex AI)** | ~15M input tokens + ~5M output tokens | ~$4.50 / mo | ~₹380 / mo |
| **Google Cloud DLP** | First 1 GB inspected/redacted per month (Free Tier) | $0 – $3 / mo | ₹0 – ₹250 / mo |
| **Secret Manager, Artifact Registry, Cloud Logging** | Within free tier / minimal storage | ~$2 / mo | ~₹170 / mo |
| **Total Stage A (Recommended Launch Stack)** | **No dedicated L4 GPU required** | **~$60 – $77 / mo** | **~₹5,050 – ₹6,450 / mo** |

### Stage B — Optional Dedicated GPU Serving (Gemma 2 2B-IT / 9B-IT on L4 GPU)

| Google Cloud Service | Configuration | Estimated Monthly Cost (USD) | Notes |
|---|---|---|---|
| **Cloud Run with NVIDIA L4 GPU** (24 GB VRAM) | Scale-to-zero (`min-instances=0`), billed per second active (~$0.67/hr active) | ~$45 – $120 / mo (at 2–6 hrs/day active) | Regional note: Cloud Run GPU is available in `asia-southeast1` (Singapore) and `us-central1`; in `asia-south1` (Mumbai), use Vertex AI `g2-standard-4` (1x L4 GPU). |
| **Vertex AI Dedicated L4 Endpoint (`g2-standard-4`)** | 24×7 always-on 1x NVIDIA L4 GPU (`asia-south1`) | ~$520 / mo | **Do NOT provision until >15,000 paying subscribers**; use Gemini 2.5 Flash until then. |
| **Colab Pro / Vertex AI CustomJob (Gemma 2 9B QLoRA)** | One-off 3-epoch QLoRA training run (~4 hours on 1x L4 / A100) | ~$4 – $12 per training run | Run on-demand only when updating adapter weights. |

---

## 3. Owner Action Checklist Before Production Cutover

Because credentials and cloud billing belong to the repository owner, complete these 5 steps to deploy to production:

1. **Create / Select Google Cloud & Firebase Project**:
   - Create project (e.g., `neeva-ai-prod`) in Google Cloud Console and link it in the Firebase Console.
   - Enable Email/Password authentication in Firebase Console → Authentication → Sign-in method.
2. **Create Cloud SQL for PostgreSQL Instance (`asia-south1`)**:
   ```bash
   gcloud sql instances create neeva-pg-main \
     --database-version=POSTGRES_16 \
     --tier=db-g1-small \
     --region=asia-south1 \
     --storage-auto-increase
   gcloud sql databases create neeva_db --instance=neeva-pg-main
   ```
3. **Populate Google Secret Manager**:
   ```bash
   echo -n "postgresql+asyncpg://neeva_app:STRONG_PASSWORD@/neeva_db?host=/cloudsql/neeva-ai-prod:asia-south1:neeva-pg-main" | \
     gcloud secrets create neeva-database-url --data-file=-
   echo -n "YOUR_GOOGLE_AI_STUDIO_GEMINI_KEY" | \
     gcloud secrets create neeva-gemini-api-key --data-file=-
   ```
4. **Run Alembic Database Migrations**:
   ```bash
   cd backend
   alembic upgrade head
   ```
5. **Deploy via Cloud Build Script**:
   ```bash
   bash infrastructure/deploy-gcp.sh
   ```

