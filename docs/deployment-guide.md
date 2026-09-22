# Local Deployment Guide

This guide will become the reproducible procedure for running CloudBite on a local Minikube cluster. Complete the values marked **To be confirmed** with Member 1 before relying on this guide for a demo.

## Prerequisites

Install and verify:

```bash
docker --version
minikube version
kubectl version --client
```

Prometheus and Grafana can run in Kubernetes or outside the cluster. Use the approach documented by the monitoring configuration once it is added.

## Application contract to confirm

| Value | Expected value |
| --- | --- |
| Frontend image | **To be confirmed** |
| Backend image | **To be confirmed** |
| Frontend container port | **To be confirmed** |
| Backend container port | **To be confirmed** |
| Backend health endpoint | **To be confirmed** |
| Backend metrics endpoint | **To be confirmed** |
| Database connection variable | **To be confirmed** |

## Start the local cluster

```bash
minikube start
kubectl cluster-info
```

## Build and load images

From the repository root, build the images using the final Dockerfiles and load them into Minikube:

```bash
docker build -f docker/backend.Dockerfile -t cloudbite-backend:local .
docker build -f docker/frontend.Dockerfile -t cloudbite-frontend:local .
minikube image load cloudbite-backend:local
minikube image load cloudbite-frontend:local
```

Use image names and tags that match the Kubernetes Deployment manifests.

## Configure application values

Copy the repository's environment template if one exists, then supply values locally. Never commit the resulting `.env` file or real Secret YAML.

Create runtime Kubernetes secrets from local values only after the expected keys are confirmed:

```bash
kubectl create namespace cloudbite
kubectl create secret generic cloudbite-secrets \
  --namespace cloudbite \
  --from-literal=EXAMPLE_SECRET='replace-with-local-value'
```

The final secret name and key must match the manifests. Do not run this example unchanged in a finished setup.

## Deploy and verify

```bash
kubectl apply -f kubernetes/
kubectl get all -n cloudbite
kubectl get pods -n cloudbite -w
```

After every pod reports `Running` and `Ready`, inspect the services:

```bash
kubectl get services -n cloudbite
kubectl logs deployment/cloudbite-backend -n cloudbite
kubectl logs deployment/cloudbite-frontend -n cloudbite
```

To access a NodePort service locally after the service name is confirmed:

```bash
minikube service SERVICE_NAME -n cloudbite
```

## Monitoring verification

1. Deploy the documented Prometheus and Grafana configuration.
2. Open Prometheus and confirm the CloudBite backend target reports `UP`.
3. Open Grafana, add or select the Prometheus data source, and import `monitoring/grafana/cloudbite-dashboard.json`.
4. Generate a few application requests and confirm the dashboard changes.

## Clean up

Delete only CloudBite resources:

```bash
kubectl delete -f kubernetes/
```

Delete the entire local cluster only when it is no longer needed:

```bash
minikube delete
```
