# Kubernetes Manifests

This directory contains the first Minikube Deployments and Services for CloudBite. The frontend has two replicas; the backend has one because it still writes orders to a local JSON file.

## Prerequisites

* A running Minikube cluster.
* `kubectl` configured to access that cluster.
* Frontend and backend images built and loaded into Minikube.
* No runtime Secret is required by the current application. The optional Grafana monitoring Deployment needs a local admin-password Secret.

## Intended resources

```text
namespace.yaml
configmap.yaml
backend-deployment.yaml
backend-service.yaml
frontend-deployment.yaml
frontend-service.yaml
```

Database manifests will be added only after the application supports a database. Prometheus, Blackbox Exporter, and Grafana are deployed separately with `kubectl apply -k monitoring/` after the application is Ready; see [the monitoring guide](../monitoring/README.md).

## Recommended application order

Apply the namespace first, then configuration and Services, then Deployments. The frontend NGINX process resolves `cloudbite-backend` when it starts, so the backend Service must already exist.

```bash
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/backend-service.yaml
kubectl apply -f kubernetes/frontend-service.yaml
kubectl apply -f kubernetes/backend-deployment.yaml
kubectl apply -f kubernetes/frontend-deployment.yaml
```

For repeat manual deployments, apply the modified files or rerun this sequence. Rebuild and reload local images after source changes, then restart the affected Deployment. Jenkins instead runs `scripts/deploy-minikube.sh`, which loads and applies its exact scanned build tags to avoid deploying the `:local` placeholders.

## Verification

```bash
kubectl get deployments,services,pods -n cloudbite
kubectl rollout status deployment/cloudbite-backend -n cloudbite
kubectl rollout status deployment/cloudbite-frontend -n cloudbite
kubectl get endpoints -n cloudbite
```

Every expected Deployment should be available, each Service should have endpoints, and logs should show normal startup.

Access the frontend through a local port forward:

```bash
kubectl port-forward -n cloudbite service/cloudbite-frontend 8080:8080
```

The health check is `http://localhost:8080/health`; the proxied backend check is `http://localhost:8080/api/health`.

## Manifest rules

* Use the `cloudbite` namespace consistently.
* Give resources stable, descriptive names and standard labels such as `app.kubernetes.io/name`.
* Use a Deployment and Service for each workload. The frontend is stateless; the backend is not yet safe to scale because order data is stored in its container.
* Define resource requests/limits and readiness probes. Add liveness probes after their endpoint behavior is confirmed.
* Keep non-sensitive settings in a ConfigMap. Add Secret references only when the application actually needs credentials.
* Use a local image strategy (`minikube image load`) or a registry strategy consistently. The image tag in each Deployment must match the chosen strategy.

## Removing CloudBite resources

After the manifests exist, delete only the project namespace and its contents:

```bash
kubectl delete namespace cloudbite
```

Do not delete the entire cluster unless you intend to remove all local Kubernetes workloads.
