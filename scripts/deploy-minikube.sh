#!/usr/bin/env bash
set -euo pipefail

: "${BACKEND_IMAGE:?Set BACKEND_IMAGE to the scanned backend tag}"
: "${FRONTEND_IMAGE:?Set FRONTEND_IMAGE to the scanned frontend tag}"
: "${KUBECONFIG:?Set KUBECONFIG to the Jenkins file credential}"
: "${MINIKUBE_BIN:=minikube}"

"$MINIKUBE_BIN" image load "$BACKEND_IMAGE"
"$MINIKUBE_BIN" image load "$FRONTEND_IMAGE"

kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/backend-service.yaml
kubectl apply -f kubernetes/frontend-service.yaml

# Render the scanned tags locally so a redeploy never briefly selects :local.
kubectl set image -f kubernetes/backend-deployment.yaml \
  backend="$BACKEND_IMAGE" --local -o yaml | kubectl apply -f -
kubectl set image -f kubernetes/frontend-deployment.yaml \
  frontend="$FRONTEND_IMAGE" --local -o yaml | kubectl apply -f -

kubectl rollout status deployment/cloudbite-backend -n cloudbite --timeout=180s
kubectl rollout status deployment/cloudbite-frontend -n cloudbite --timeout=180s
