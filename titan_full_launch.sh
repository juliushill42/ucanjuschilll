#!/bin/bash
# ============================================================
# TITAN FULL LAUNCH — UCANJUSCHILL Platform
# Julius Cameron Hill IP
# Single command: bash titan_full_launch.sh
# Builds all images, pushes to registry, deploys to GKE
# ============================================================
set -e

# ── Configuration ──
PROJECT_ID="gen-lang-client-0695165560"
BILLING_ACCOUNT="019697-F85F3F-20C51B"
REGION="us-east1"
ZONE="us-east1-b"
CLUSTER="titan-cluster"
REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/juschill-repo"
NAMESPACE="ucanjuschill"

echo "🚀 TITAN FULL LAUNCH — UCANJUSCHILL"
echo "======================================"
echo "Project:   $PROJECT_ID"
echo "Cluster:   $CLUSTER ($ZONE)"
echo "Registry:  $REGISTRY"
echo "Namespace: $NAMESPACE"
echo ""

# ── PHASE 1: Authenticate & configure GCP ──
echo "[Phase 1/6] Configuring GCP..."
gcloud config set project $PROJECT_ID
gcloud config set compute/zone $ZONE
gcloud config set compute/region $REGION

# Configure Docker auth for Artifact Registry
gcloud auth configure-docker $REGION-docker.pkg.dev --quiet

# ── PHASE 2: Ensure Artifact Registry exists ──
echo "[Phase 2/6] Ensuring Artifact Registry..."
gcloud artifacts repositories describe juschill-repo \
  --location=$REGION --project=$PROJECT_ID 2>/dev/null || \
gcloud artifacts repositories create juschill-repo \
  --repository-format=docker \
  --location=$REGION \
  --description="JusChill platform images" \
  --project=$PROJECT_ID

# ── PHASE 3: Build all Docker images ──
echo "[Phase 3/6] Building Docker images..."

echo "  → Building go-api..."
docker build -t "$REGISTRY/go-api:latest" -t "$REGISTRY/go-api:$(git rev-parse --short HEAD)" ./go-api

echo "  → Building rust-ingest..."
docker build -t "$REGISTRY/ingest:latest" -t "$REGISTRY/ingest:$(git rev-parse --short HEAD)" ./rust-ingest

echo "  → Building ai-worker..."
docker build -t "$REGISTRY/ai-worker:latest" -t "$REGISTRY/ai-worker:$(git rev-parse --short HEAD)" ./ai-worker

echo "  → Building frontend..."
docker build \
  -t "$REGISTRY/frontend:latest" \
  -t "$REGISTRY/frontend:$(git rev-parse --short HEAD)" \
  -f ./frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-}" \
  --build-arg NEXT_PUBLIC_HLS_BASE_URL="${HLS_BASE_URL:-}" \
  --build-arg NEXT_PUBLIC_RTMP_URL="${RTMP_URL:-}" \
  .

# ── PHASE 4: Push all images to registry ──
echo "[Phase 4/6] Pushing images to $REGISTRY..."
docker push "$REGISTRY/go-api:latest"
docker push "$REGISTRY/go-api:$(git rev-parse --short HEAD)"
docker push "$REGISTRY/ingest:latest"
docker push "$REGISTRY/ingest:$(git rev-parse --short HEAD)"
docker push "$REGISTRY/ai-worker:latest"
docker push "$REGISTRY/ai-worker:$(git rev-parse --short HEAD)"
docker push "$REGISTRY/frontend:latest"
docker push "$REGISTRY/frontend:$(git rev-parse --short HEAD)"

# ── PHASE 5: Connect to GKE cluster & apply manifests ──
echo "[Phase 5/6] Connecting to GKE cluster $CLUSTER..."
gcloud container clusters get-credentials $CLUSTER --zone=$ZONE --project=$PROJECT_ID

echo "  → Applying Kubernetes manifests..."
kubectl apply -f k8s.yaml

echo "  → Waiting for deployments to roll out..."
kubectl rollout status deployment/go-api -n $NAMESPACE --timeout=120s
kubectl rollout status deployment/ingest -n $NAMESPACE --timeout=120s
kubectl rollout status deployment/ai-worker -n $NAMESPACE --timeout=120s

# ── PHASE 6: Update running deployments with new images ──
echo "[Phase 6/6] Rolling out new images..."
COMMIT_SHA=$(git rev-parse --short HEAD)

kubectl set image deployment/go-api \
  go-api=$REGISTRY/go-api:$COMMIT_SHA \
  -n $NAMESPACE

kubectl set image deployment/ingest \
  ingest=$REGISTRY/ingest:$COMMIT_SHA \
  -n $NAMESPACE

kubectl set image deployment/ai-worker \
  ai-worker=$REGISTRY/ai-worker:$COMMIT_SHA \
  -n $NAMESPACE

echo ""
echo "✅ TITAN LAUNCH COMPLETE"
echo "======================================"
echo "All services deployed to $CLUSTER"
echo ""
echo "Cluster status:"
kubectl get pods -n $NAMESPACE
echo ""
echo "Services:"
kubectl get services -n $NAMESPACE
