#!/bin/bash
set -e

PROJECT_ID="gen-lang-client-0695165560"
CLUSTER_NAME="titan-cluster"
ZONE="us-east1-b"
SA_NAME="ai-worker"

echo "Activating Sovereign Moat Identity..."

# Enable APIs
gcloud services enable aiplatform.googleapis.com speech.googleapis.com texttospeech.googleapis.com --project=$PROJECT_ID

# Create GCP SA if not exists
gcloud iam service-accounts create $SA_NAME --project=$PROJECT_ID || echo "SA already exists"

# Grant Roles
ROLES=("roles/aiplatform.user" "roles/texttospeech.admin" "roles/speech.admin")
for role in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" --role="$role"
done

# Bind to K8s
gcloud iam service-accounts add-iam-policy-binding $SA_NAME@$PROJECT_ID.iam.gserviceaccount.com \
    --role roles/iam.workloadIdentityUser \
    --member "serviceAccount:$PROJECT_ID.svc.id.goog[ucanjuschill/ai-worker]"
