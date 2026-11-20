#!/usr/bin/env bash
# ============================================================================
# Neeva AI — Google Cloud Infrastructure Provisioning & Deployment Script
# Strict Google-Only Stack:
#   - Cloud Run (asia-south1 Mumbai)
#   - Firebase Cloud Firestore (Native Mode — sole operational database)
#   - Firebase Authentication & Firebase App Check
#   - Google Secret Manager
#   - Google Cloud DLP
#   - Vertex AI (Gemini 2.5 Flash & Gemma 2 Endpoints)
#   - Google Artifact Registry & Cloud Build
# ============================================================================
set -euo pipefail

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-onyx-gift-514504-q0}"
REGION="${GCP_REGION:-asia-south1}"
AR_REPO="neeva-backend"
SERVICE_NAME="neeva-api"
SA_NAME="neeva-api-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "=== Neeva AI Google Cloud Deployment (Project: ${PROJECT_ID}, Region: ${REGION}) ==="

# 1. Enable Required Google Cloud APIs (Cloud Firestore replaces Cloud SQL)
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  dlp.googleapis.com \
  aiplatform.googleapis.com \
  generativelanguage.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  firebase.googleapis.com \
  identitytoolkit.googleapis.com \
  --project="${PROJECT_ID}"

# 2. Provision Cloud Firestore Native Database if not already present
if ! gcloud firestore databases describe --database="(default)" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud firestore databases create \
    --database="(default)" \
    --location="${REGION}" \
    --type=firestore-native \
    --project="${PROJECT_ID}"
fi

# 3. Create Least-Privilege Service Account for Cloud Run
if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SA_NAME}" \
    --display-name="Neeva AI Cloud Run Backend Service Account" \
    --project="${PROJECT_ID}"
fi

for ROLE in \
  "roles/datastore.user" \
  "roles/secretmanager.secretAccessor" \
  "roles/dlp.user" \
  "roles/aiplatform.user" \
  "roles/firebaseauth.admin" \
  "roles/logging.logWriter" \
  "roles/monitoring.metricWriter"; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${ROLE}" \
    --condition=None
done

# 4. Create Artifact Registry Repository
if ! gcloud artifacts repositories describe "${AR_REPO}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Neeva AI Backend container images" \
    --project="${PROJECT_ID}"
fi

# 5. Submit Cloud Build Pipeline
gcloud builds submit . \
  --config=backend/cloudbuild.yaml \
  --substitutions="_REGION=${REGION},_AR_REPO=${AR_REPO},_SERVICE_NAME=${SERVICE_NAME},_SERVICE_ACCOUNT=${SA_EMAIL}" \
  --project="${PROJECT_ID}"

echo "=== Deployment Submitted Successfully ==="
