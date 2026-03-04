#!/bin/bash
set -e
P="gen-lang-client-0695165560"
R="us-east1"
IMAGE_PATH="${R}-docker.pkg.dev/${P}/titan-repo/titan-api:v1"

echo "--- BOOTSTRAP: BUILDING IMAGE VIA CLOUD BUILD ---"
gcloud builds submit --tag $IMAGE_PATH . --project=$P

echo "--- BOOTSTRAP: APPLYING DEPLOYMENT ---"
cat << EOF > deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: titan-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: titan-api
  template:
    metadata:
      labels:
        app: titan-api
    spec:
      containers:
      - name: titan-api
        image: $IMAGE_PATH
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: titan-service
spec:
  type: LoadBalancer
  selector:
    app: titan-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
EOF

kubectl apply -f deployment.yaml
echo " TITAN DEPLOYED TO CLUSTER"