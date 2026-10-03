# Kubernetes Manifests

This directory contains Minikube Deployments and Services for CloudBite, plus a PostgreSQL StatefulSet with a persistent volume claim. The frontend has two replicas; the backend has one by default.

## Prerequisites

* A running Minikube cluster.
* `kubectl` configured to access that cluster.
* Frontend and backend images built and loaded into Minikube.
* Create `cloudbite-secrets` in the `cloudbite` namespace with `postgres-password` and `admin-token` before deployment. See [configuration](../docs/configuration.md). The optional Grafana monitoring Deployment needs its own admin-password Secret.

## Intended resources

```text
namespace.yaml
configmap.yaml
postgres-service.yaml
postgres-statefulset.yaml
backend-deployment.yaml
backend-service.yaml
frontend-deployment.yaml
frontend-service.yaml
```

Prometheus, Blackbox Exporter, and Grafana are deployed separately with `kubectl apply -k monitoring/` after the application is Ready; see [the monitoring guide](../monitoring/README.md).

## Recommended application order

Apply the namespace first, then configuration and Services, then Deployments. The frontend NGINX process resolves `cloudbite-backend` when it starts, so the backend Service must already exist.

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
```

For repeat manual deployments, apply the modified files or rerun this sequence. Rebuild and reload local images after source changes, then restart the affected Deployment. Jenkins instead runs `scripts/deploy-minikube.sh`, which loads and applies its exact scanned build tags to avoid deploying the `:local` placeholders. The script uses `minikube image load` when the CLI is present; otherwise it imports images through the running Minikube Docker container. Set `MINIKUBE_CONTAINER` if that container is not named `minikube`.

## Verification

```bash
kubectl get deployments,statefulsets,pvc,services,pods -n cloudbite
kubectl rollout status deployment/cloudbite-backend -n cloudbite
kubectl rollout status deployment/cloudbite-frontend -n cloudbite
kubectl get endpoints -n cloudbite
```

Every expected Deployment should be available, each Service should have endpoints, and logs should show normal startup.

Access the frontend through a local port forward:

```bash
kubectl port-forward -n cloudbite service/cloudbite-frontend 18080:8080
```

The health check is `http://localhost:18080/health`; the proxied backend check is `http://localhost:18080/api/health`. The local port avoids the existing Jenkins/Compose use of `8080`.

## Manifest rules

* Use the `cloudbite` namespace consistently.
* Give resources stable, descriptive names and standard labels such as `app.kubernetes.io/name`.
* The frontend is stateless; PostgreSQL stores orders outside the backend pods.
* Define resource requests/limits and readiness probes. Add liveness probes after their endpoint behavior is confirmed.
* Keep non-sensitive settings in a ConfigMap and supply database and staff credentials through the required Secret.
* Use a local image strategy (`minikube image load`) or a registry strategy consistently. The image tag in each Deployment must match the chosen strategy.

## Removing CloudBite resources

Back up the PostgreSQL volume before removing CloudBite. Deleting the namespace also deletes its volume claim and may delete the underlying order data. To remove only this project's resources:

```bash
kubectl delete namespace cloudbite
```

Do not delete the entire cluster unless you intend to remove all local Kubernetes workloads.
