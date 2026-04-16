#!/bin/bash

# Set up GCP Service Account and Workload Identity for GKE

# Variables
PROJECT_ID="your-project-id"
CLUSTER_NAME="your-cluster-name"
ZONE="your-zone"
SERVICE_ACCOUNT_NAME="your-service-account-name"

# Enable Workload Identity on the GKE cluster
gcloud container clusters update $CLUSTER_NAME \
  --workload-pool=$PROJECT_ID.svc.id.goog

# Create a service account
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
  --project=$PROJECT_ID

# Grant permissions to the service account
# Specify the roles your workload will need
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/your.role"

# Create a Kubernetes service account
kubectl create serviceaccount $SERVICE_ACCOUNT_NAME

# Bind the Kubernetes service account to the GCP service account
kubectl annotate serviceaccount $SERVICE_ACCOUNT_NAME \
  iam.gke.io/gcp-service-account=$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com

echo "Workload Identity setup complete!"