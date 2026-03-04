#!/bin/bash
set -e
P="gen-lang-client-0695165560"
Z="us-east1-b"

echo "--- STARTING FRESH REBUILD ---"
gcloud config set project $P

# Create with 50GB disks to stay under your 250GB SSD quota
gcloud container clusters create titan-cluster --zone=$Z --num-nodes=3 \
    --disk-size=50 --disk-type=pd-ssd \
    --enable-autoscaling --min-nodes=1 --max-nodes=5 --project=$P

gcloud container clusters get-credentials titan-cluster --zone $Z --project=$P
echo "TITAN IS LIVE"