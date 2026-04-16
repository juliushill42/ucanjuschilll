#!/bin/bash
PROJECT_ID="gen-lang-client-0695165560"
REGION="us-east1"
REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/juschill-repo"

echo "Building and Pushing Full Stack..."

# Build & Push Go API (Port 8080)
docker build -t $REGISTRY/go-api:latest ./go-api
docker push $REGISTRY/go-api:latest

# Build & Push AI Worker (Vertex AI)
docker build -t $REGISTRY/ai-worker:latest ./ai-worker
docker push $REGISTRY/ai-worker:latest
