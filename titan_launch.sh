#!/bin/bash
set -e
P="gen-lang-client-0695165560"
B="019697-F85F3F-20C51B"
R="us-east1"
Z="us-east1-b"

echo "--- PHASE 1: PROJECT AND BILLING ---"
gcloud config set project $P
gcloud beta billing projects link $P --billing-account=$B || echo "Linked"

echo "--- PHASE 2: ENABLING APIS ---"
gcloud services enable compute.googleapis.com container.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com servicenetworking.googleapis.com --project=$P

echo "--- PHASE 3: INFRASTRUCTURE (REDUCED DISK) ---"
gcloud artifacts repositories describe titan-repo --location=$R --project=$P >/dev/null 2>&1 || \
gcloud artifacts repositories create titan-repo --repository-format=docker --location=$R --project=$P

# Creating cluster with 50GB disks to fit within 250GB SSD quota
gcloud container clusters describe titan-cluster --zone=$Z --project=$P >/dev/null 2>&1 || \
gcloud container clusters create titan-cluster --zone=$Z --num-nodes=3 \
    --disk-size=50 --disk-type=pd-ssd \
    --enable-autoscaling --min-nodes=1 --max-nodes=5 --project=$P

echo "--- PHASE 4: DATABASE ---"
gcloud sql instances describe titan-db --project=$P >/dev/null 2>&1 || \
gcloud sql instances create titan-db --database-version=POSTGRES_15 --tier=db-f1-micro --region=$R --project=$P

echo "--- PHASE 5: CREDENTIALS ---"
gcloud container clusters get-credentials titan-cluster --zone $Z --project=$P
echo "TITAN IS LIVE"