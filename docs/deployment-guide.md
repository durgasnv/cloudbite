# Local Deployment Guide

This guide describes the current local container and Minikube setup. Docker and Kubernetes commands still need to be executed on a machine with Docker Desktop integration, Minikube, and kubectl available.

## Prerequisites

Install and verify:

```bash
docker --version
minikube version
kubectl version --client
```

Prometheus and Grafana can run in Docker Compose or in the CloudBite namespace. The setup commands are in [the monitoring guide](../monitoring/README.md).

## Application contract to confirm

| Value | Expected value |
| --- | --- |
| Frontend image | `cloudbite-frontend:local` from `docker/frontend.Dockerfile` |
| Backend image | `cloudbite-backend:local` from `docker/backend.Dockerfile` |
| Frontend container port | `8080` |
| Backend container port | `5000` by default; configurable with `PORT` |
| Backend health endpoint | `GET /api/health` |
| Backend metrics endpoint | Not implemented yet |
| Database connection variable | None; the application currently reads and writes `server/data/*.json` |

The frontend NGINX configuration proxies `/api/` to the `cloudbite-backend` Service. Browser code calls the same-origin `/api` path, so no cluster address appears in the browser.

Orders are currently stored in a JSON file. Do not use more than one backend replica or claim durable orders until the team agrees on database or shared storage integration.

## Try the two containers first

```bash
docker compose -f docker/compose.yaml up --build -d
curl -f http://localhost:8080/health
curl -f http://localhost:8080/api/health
curl -f http://localhost:8080/api/restaurants
docker compose -f docker/compose.yaml down
```

See [the container guide](../docker/README.md) for logs and the current storage limitation.

## Start the local cluster

```bash
minikube start
kubectl cluster-info
```

## Build and load images

From the repository root, build the images and load them into Minikube:

```bash
docker build -f docker/backend.Dockerfile -t cloudbite-backend:local .
docker build -f docker/frontend.Dockerfile -t cloudbite-frontend:local .
minikube image load cloudbite-backend:local
minikube image load cloudbite-frontend:local
```

The image names and tags above match the Kubernetes Deployments. Rebuild and reload both images after source changes.

## Configure application values

The backend ConfigMap supplies `NODE_ENV=production` and `PORT=5000`. The current application has no database credentials or other required runtime secrets. Add a Kubernetes Secret only after a real sensitive setting is introduced; never commit its value.

## Deploy and verify

Apply the namespace, configuration, and Services before the Deployments. NGINX resolves the backend Service name when it starts.

```bash
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/backend-service.yaml
kubectl apply -f kubernetes/frontend-service.yaml
kubectl apply -f kubernetes/backend-deployment.yaml
kubectl apply -f kubernetes/frontend-deployment.yaml
kubectl rollout status deployment/cloudbite-backend -n cloudbite
kubectl rollout status deployment/cloudbite-frontend -n cloudbite
kubectl get pods,services -n cloudbite
```

After every pod reports `Running` and `Ready`, inspect the services and logs:

```bash
kubectl get services -n cloudbite
kubectl logs deployment/cloudbite-backend -n cloudbite
kubectl logs deployment/cloudbite-frontend -n cloudbite
```

The frontend Service is internal to the cluster. Use port forwarding to access it locally:

```bash
kubectl port-forward -n cloudbite service/cloudbite-frontend 8080:8080
```

In another terminal, check `http://localhost:8080/health`, `http://localhost:8080/api/health`, and `http://localhost:8080/api/restaurants`.

## Monitoring verification

After the application is Ready, follow [the monitoring guide](../monitoring/README.md) to create a local Grafana password and apply the monitoring Kustomization. Confirm that both `cloudbite_health` targets and the `kube_state_metrics` target are `UP` in Prometheus. The **CloudBite Health** dashboard should show two available endpoints; **CloudBite Kubernetes** should show the desired and available replicas.

The health dashboard shows endpoint availability and probe time. The Kubernetes dashboard shows available/desired replicas and container restarts. The backend still has no Prometheus-format `/metrics` endpoint, so request and resource-usage metrics are not available yet.

## Clean up

Delete only CloudBite resources:

```bash
kubectl delete namespace cloudbite
```

Delete the entire local cluster only when it is no longer needed:

```bash
minikube delete
```
