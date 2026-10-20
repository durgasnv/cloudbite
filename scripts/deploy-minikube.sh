#!/usr/bin/env bash
set -euo pipefail

: "${BACKEND_IMAGE:?Set BACKEND_IMAGE to the scanned backend tag}"
: "${FRONTEND_IMAGE:?Set FRONTEND_IMAGE to the scanned frontend tag}"
: "${KUBECONFIG:?Set KUBECONFIG to the Jenkins file credential}"
: "${MINIKUBE_BIN:=minikube}"
: "${MINIKUBE_CONTAINER:=minikube}"

load_image() {
  local image="$1"
  if command -v "$MINIKUBE_BIN" >/dev/null 2>&1; then
    "$MINIKUBE_BIN" image load "$image"
  else
    if [[ "$(docker inspect -f '{{.State.Running}}' "$MINIKUBE_CONTAINER")" != true ]]; then
      echo "Minikube container $MINIKUBE_CONTAINER is not running" >&2
      return 1
    fi
    docker save "$image" | docker exec -i "$MINIKUBE_CONTAINER" ctr -n k8s.io images import -
  fi
}

load_image "$BACKEND_IMAGE"
load_image "$FRONTEND_IMAGE"

kubectl apply -f kubernetes/namespace.yaml
kubectl get secret cloudbite-secrets -n cloudbite >/dev/null
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/postgres-service.yaml
kubectl apply -f kubernetes/postgres-statefulset.yaml
kubectl rollout status statefulset/cloudbite-postgres -n cloudbite --timeout=180s
kubectl apply -f kubernetes/backend-service.yaml
kubectl apply -f kubernetes/frontend-service.yaml

# Render the scanned tags locally so a redeploy never briefly selects :local.
kubectl set image -f kubernetes/backend-deployment.yaml \
  backend="$BACKEND_IMAGE" --local -o yaml | kubectl apply -f -
kubectl set image -f kubernetes/frontend-deployment.yaml \
  frontend="$FRONTEND_IMAGE" --local -o yaml | kubectl apply -f -

kubectl rollout status deployment/cloudbite-backend -n cloudbite --timeout=180s
kubectl rollout status deployment/cloudbite-frontend -n cloudbite --timeout=180s
