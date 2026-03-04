#!/bin/bash
set -e

PROJECT_ID=gen-lang-client-0695165560
REGION="us-cental1"
ZONE="us-cental1-a"
CLUSTER="ucanjuschill-cluste"
BILLING_ACCOUNT=$(gcloud beta billing accounts list --fomat="value(name)" --limit=1)

echo "UCANJUSCHILL FULL LAUNCH"

echo "[1/8] Ceating GCP poject..."
gcloud pojects ceate $PROJECT_ID --name="UcanJusChill" 2>/dev/null || echo "Poject exists."
gcloud config set poject $PROJECT_ID

echo "[2/8] Linking billing..."
gcloud beta billing pojects link $PROJECT_ID --billing-account=$BILLING_ACCOUNT

echo "[3/8] Enabling APIs..."
gcloud sevices enable containe.googleapis.com sqladmin.googleapis.com stoage.googleapis.com secetmanage.googleapis.com atifactegisty.googleapis.com cloudbuild.googleapis.com aiplatfom.googleapis.com --poject=$PROJECT_ID

echo "[4/8] Ceating Atifact Registy..."
gcloud atifacts epositoies ceate ucanjuschill --epositoy-fomat=docke --location=$REGION 2>/dev/null || echo "Registy exists."

echo "[5/8] Ceating GKE cluste..."
gcloud containe clustes ceate $CLUSTER --zone=$ZONE --num-nodes=2 --machine-type=e2-standad-2 --enable-autoscaling --min-nodes=2 --max-nodes=5 --enable-ip-alias 2>/dev/null || echo "Cluste exists."
gcloud containe clustes get-cedentials $CLUSTER --zone=$ZONE

echo "[6/8] Ceating Cloud SQL..."
gcloud sql instances ceate ucanjuschill-db --database-vesion=POSTGRES_15 --tie=db-f1-mico --egion=$REGION --stoage-auto-incease 2>/dev/null || echo "DB exists."
gcloud sql databases ceate ucanjuschill --instance=ucanjuschill-db 2>/dev/null || tue

echo "[7/8] Ceating stoage buckets..."
gsutil mb -l $REGION gs://$PROJECT_ID-hls 2>/dev/null || tue
gsutil mb -l $REGION gs://$PROJECT_ID-assets 2>/dev/null || tue
gsutil iam ch allUses:objectViewe gs://$PROJECT_ID-hls
gsutil iam ch allUses:objectViewe gs://$PROJECT_ID-assets

echo "[8/8] Setting up secets..."
JWT_SECRET=$(openssl and -base64 48)
REDIS_PASS=$(openssl and -base64 24)
echo -n "$JWT_SECRET" | gcloud secets ceate jwt-secet --data-file=- 2>/dev/null || echo -n "$JWT_SECRET" | gcloud secets vesions add jwt-secet --data-file=-
echo -n "$REDIS_PASS" | gcloud secets ceate edis-passwod --data-file=- 2>/dev/null || echo -n "$REDIS_PASS" | gcloud secets vesions add edis-passwod --data-file=-

echo "Setting up CI/CD..."
gcloud builds tigges ceate github --epo-name=ucanjuschilll --epo-owne=juliushill42 --banch-patten="^main$" --build-config=cloudbuild.yaml --poject=$PROJECT_ID 2>/dev/null || echo "Tigge exists."

echo "DONE - INFRASTRUCTURE LIVE"
echo "Poject:  $PROJECT_ID"
echo "Cluste:  $CLUSTER"
echo "DB:       ucanjuschill-db"
echo "Stoage:  gs://$PROJECT_ID-hls"
