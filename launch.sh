#!/bin/bash
# ============================================================
# UCANJUSCHILL — Full GCP Launch Script
# Julius Cameron Hill IP
# Run once. Launches everything.
# ============================================================
set -e

PROJECT_ID="gen-lang-client-0695165560"
REGION="us-east1"
ZONE="us-east1-b"
CLUSTER="titan-cluster"
DOMAIN="ucanjuschill.com"
BILLING_ACCOUNT=$(gcloud beta billing accounts list --format="value(name)" --limit=1)

echo "🚀 UCANJUSCHILL FULL LAUNCH"
echo "================================"

# ── STEP 1: Create & configure project ──
echo "[1/8] Creating GCP project..."
gcloud projects create $PROJECT_ID --name="UcanJusChill" 2>/dev/null || echo "Project exists, continuing..."
gcloud config set project $PROJECT_ID

# Link billing (uses your credits)
echo "[2/8] Linking billing account..."
gcloud beta billing projects link $PROJECT_ID --billing-account=$BILLING_ACCOUNT

# ── STEP 2: Enable all APIs ──
echo "[3/8] Enabling APIs..."
gcloud services enable \
  container.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  aiplatform.googleapis.com \
  --project=$PROJECT_ID

# ── STEP 3: Create Artifact Registry (Docker images) ──
echo "[4/8] Creating Artifact Registry..."
gcloud artifacts repositories create juschill-repo \
  --repository-format=docker \
  --location=$REGION \
  --description="JusChill images" 2>/dev/null || echo "Registry exists."

# ── STEP 4: Create GKE Cluster ──
echo "[5/8] Creating GKE cluster..."
gcloud container clusters create $CLUSTER \
  --zone=$ZONE \
  --num-nodes=2 \
  --machine-type=e2-standard-2 \
  --enable-autoscaling \
  --min-nodes=2 \
  --max-nodes=5 \
  --workload-pool=$PROJECT_ID.svc.id.goog \
  --enable-ip-alias 2>/dev/null || echo "Cluster exists."
gcloud container clusters get-credentials $CLUSTER --zone=$ZONE

# ── STEP 5: Cloud SQL (Postgres) ──
echo "[6/8] Creating Cloud SQL Postgres..."
gcloud sql instances create juschill-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --storage-auto-increase 2>/dev/null || echo "DB exists."
gcloud sql databases create ucanjuschill --instance=juschill-db 2>/dev/null || true
gcloud sql users create appuser \
  --instance=juschill-db \
  --password=$(openssl rand -base64 24) 2>/dev/null || true

# ── STEP 6: Cloud Storage (HLS video chunks) ──
echo "[7/8] Creating storage buckets..."
gsutil mb -l $REGION gs://$PROJECT_ID-hls 2>/dev/null || true
gsutil mb -l $REGION gs://$PROJECT_ID-assets 2>/dev/null || true
gsutil iam ch allUsers:objectViewer gs://$PROJECT_ID-hls
gsutil iam ch allUsers:objectViewer gs://$PROJECT_ID-assets

# ── STEP 7: Store secrets in Secret Manager ──
echo "[8/8] Setting up secrets..."
echo "Generating secure secrets..."
JWT_SECRET=$(openssl rand -base64 48)
REDIS_PASS=$(openssl rand -base64 24)
DB_PASS=$(openssl rand -base64 24)

echo -n "$JWT_SECRET"  | gcloud secrets create jwt-secret --data-file=- 2>/dev/null || \
  echo -n "$JWT_SECRET" | gcloud secrets versions add jwt-secret --data-file=-
echo -n "$REDIS_PASS"  | gcloud secrets create redis-password --data-file=- 2>/dev/null || \
  echo -n "$REDIS_PASS" | gcloud secrets versions add redis-password --data-file=-
echo -n "$DB_PASS"     | gcloud secrets create db-password --data-file=- 2>/dev/null || \
  echo -n "$DB_PASS" | gcloud secrets versions add db-password --data-file=-

# ── STEP 8: CI/CD — Cloud Build trigger ──
echo "Setting up CI/CD pipeline..."
gcloud builds triggers create github \
  --repo-name=ucanjuschilll \
  --repo-owner=juliushill42 \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml \
  --project=$PROJECT_ID 2>/dev/null || echo "Trigger exists."

echo ""
echo "✅ INFRASTRUCTURE LIVE"
echo "================================"
echo "Project:  $PROJECT_ID"
echo "Cluster:  $CLUSTER ($ZONE)"
echo "Database: juschill-db"
echo "Storage:  gs://$PROJECT_ID-hls"
echo "Registry: $REGION-docker.pkg.dev/$PROJECT_ID/juschill-repo"
echo ""
echo "NEXT: Run titan_full_launch.sh to build and deploy containers"
