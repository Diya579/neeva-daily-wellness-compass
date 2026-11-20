# Neeva AI — Zero-Cost Local Setup & Execution Guide

Run the entire Neeva AI platform locally on your machine with **₹0 expenditure**, **no Google Cloud account**, **no billing account**, and **no API keys**.

---

## 1. Prerequisites

- **Python 3.11 or 3.12**
- **Node.js 20+ or Bun 1.1+** (only if running the frozen frontend dev server)

---

## 2. Start the Zero-Cost FastAPI Backend (No `.env` or API Keys Needed)

Open a terminal in the repository root (`C:\neeva ai`):

```powershell
cd backend
pip install -r requirements.txt

# Start the backend on port 8080 (automatically creates data/neeva_zero_cost.sqlite3 in WAL mode)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
```

Verify the backend is live and running in Zero-Cost SQLite WAL mode:

```powershell
curl http://127.0.0.1:8080/health
```
Expected output:
```json
{
  "status": "ok",
  "version": "2.0.0",
  "service": "neeva-ai-backend",
  "operational_database": "cloud_firestore",
  "firestore_mode": "local_persistent"
}
```

Open the interactive OpenAPI Swagger UI at:
- `http://127.0.0.1:8080/docs`

---

## 3. Run the Automated Verification Suite (72 Tests)

From the repository root (`C:\neeva ai`):

```powershell
$env:PYTHONPATH="C:\neeva ai\backend"
python -m pytest backend/tests -v
```

---

## 4. Start the Standalone Payment Demonstration (`/payment-demo/`)

In a separate terminal from the repository root:

```powershell
python payment-demo/server.py --port 4173
```

Open `http://127.0.0.1:4173` in your browser to walk through all 5 states (Plan Selection, Coupon `NEEVA50` Checkout, Simulated Processing, Success Receipt, and Declined/Retry flow).

---

## 5. (Optional) Connect a Local CPU Open-Source LLM (Provider A — ₹0)

If you have [Ollama](https://ollama.com) installed locally and want generative LLM replies on CPU at ₹0 cost:

```powershell
ollama pull gemma2:2b
$env:LOCAL_LLM_BASE_URL="http://127.0.0.1:11434"
$env:LOCAL_LLM_MODEL_NAME="gemma2:2b"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8080
```
If Ollama is not running, Neeva automatically uses **Provider C (`deterministic_fallback`)** with zero errors.

