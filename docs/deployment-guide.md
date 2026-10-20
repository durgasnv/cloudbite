# Local Deployment Guide

This guide describes the local container and Minikube setup. Monitoring was verified in a local Minikube Docker-driver cluster on 2026-10-02. On 2026-10-03, the PostgreSQL-backed application was verified through checkout and a backend pod restart. The Jenkins release stage has not been run end to end.

## Prerequisites

Install and verify:

```bash
docker --version
kubectl version --client
```

The `minikube` CLI is needed to create a new cluster. On a host with an existing Minikube Docker container, the deployment script can load images through Docker when the CLI is unavailable.

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
| Database connection variables | `DATABASE_URL` or `PGHOST` and other `PG*` values; Kubernetes supplies `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD` |

The frontend NGINX configuration proxies `/api/` to the `cloudbite-backend` Service. Browser code calls the same-origin `/api` path, so no cluster address appears in the browser.

Orders use PostgreSQL in Kubernetes and a persistent volume claim holds the database files. Create the `cloudbite-secrets` Secret before deploying; see [configuration](configuration.md). The public demo staff key is removed. Use synthetic customer data because production customer accounts and identity checks are not implemented.

## Try the two containers first

```bash
docker compose -f docker/compose.yaml up --build -d
curl -f http://localhost:8080/health
curl -f http://localhost:8080/api/health
curl -f http://localhost:8080/api/restaurants
docker compose -f docker/compose.yaml down
```

See [the container guide](../docker/README.md) for logs and the PostgreSQL Compose overlay.

## Start the local cluster

```bash
minikube start --driver=docker
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

For a build-specific tag, set `BACKEND_IMAGE`, `FRONTEND_IMAGE`, and `KUBECONFIG`, then run `bash scripts/deploy-minikube.sh`. This renders the scanned tags into the manifests without briefly applying the `:local` placeholders. The script uses `minikube image load` when available, or the running Minikube Docker container otherwise; set `MINIKUBE_CONTAINER` if its name differs.

## Configure application values

The backend ConfigMap supplies `NODE_ENV=production` and `PORT=5000`. Create the required `cloudbite-secrets` Secret before deployment; it supplies the PostgreSQL password and staff token. The [configuration guide](configuration.md) gives its keys and creation command. Keep its values out of Git.

## Deploy and verify

Apply the namespace, configuration, and Services before the Deployments. NGINX resolves the backend Service name when it starts.

```bash
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/postgres-service.yaml
kubectl apply -f kubernetes/postgres-statefulset.yaml
kubectl rollout status statefulset/cloudbite-postgres -n cloudbite
kubectl apply -f kubernetes/backend-service.yaml
kubectl apply -f kubernetes/frontend-service.yaml
kubectl apply -f kubernetes/backend-deployment.yaml
kubectl apply -f kubernetes/frontend-deployment.yaml
kubectl rollout status deployment/cloudbite-backend -n cloudbite
kubectl rollout status deployment/cloudbite-frontend -n cloudbite
kubectl get pods,services,pvc -n cloudbite
```

After every pod reports `Running` and `Ready`, inspect the services and logs:

```bash
kubectl get services -n cloudbite
kubectl logs deployment/cloudbite-backend -n cloudbite
kubectl logs deployment/cloudbite-frontend -n cloudbite
```

The frontend Service is internal to the cluster. Use port forwarding to access it locally:

```bash
kubectl port-forward -n cloudbite service/cloudbite-frontend 18080:8080
```

In another terminal, check `http://localhost:18080/health`, `http://localhost:18080/api/health`, and `http://localhost:18080/api/restaurants`. The local port is `18080` to avoid the existing Jenkins/Compose use of `8080`.

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
