# Kubernetes Manifests

This directory will contain the Kubernetes resources that run CloudBite in Minikube. The manifests are not yet implemented; use this file as the contract for adding them.

## Prerequisites

* A running Minikube cluster.
* `kubectl` configured to access that cluster.
* Frontend and backend images built and loaded into Minikube.
* Required runtime secrets created locally; do not commit them.

## Intended resources

```text
namespace.yaml
configmap.yaml
secrets.example.yaml
backend-deployment.yaml
backend-service.yaml
frontend-deployment.yaml
frontend-service.yaml
```

Database manifests will be added only if the team decides to run the database inside Kubernetes.

## Recommended application order

Apply the namespace first. Then apply configuration and Secrets, backend resources, and frontend resources:

```bash
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmap.yaml
# Create real secrets locally; do not apply a committed real-secret manifest.
kubectl apply -f kubernetes/backend-deployment.yaml
kubectl apply -f kubernetes/backend-service.yaml
kubectl apply -f kubernetes/frontend-deployment.yaml
kubectl apply -f kubernetes/frontend-service.yaml
```

Once the resource set is stable, `kubectl apply -f kubernetes/` may be used for repeat deployment.

## Verification

```bash
kubectl get deployments,services,pods -n cloudbite
kubectl rollout status deployment/cloudbite-backend -n cloudbite
kubectl rollout status deployment/cloudbite-frontend -n cloudbite
kubectl get endpoints -n cloudbite
```

Every expected Deployment should be available, each Service should have endpoints, and logs should show normal startup.

## Manifest rules

* Use the `cloudbite` namespace consistently.
* Give resources stable, descriptive names and standard labels such as `app.kubernetes.io/name`.
* Use a Deployment for stateless frontend and backend workloads and a Service for each.
* Define resource requests/limits and readiness probes. Add liveness probes after their endpoint behavior is confirmed.
* Keep non-sensitive settings in a ConfigMap.
* Reference a Secret by name for credentials; commit only `secrets.example.yaml` with no functional credentials.
* Use a local image strategy (`minikube image load`) or a registry strategy consistently. The image tag in each Deployment must match the chosen strategy.

## Removing CloudBite resources

After the manifests exist, delete only the project namespace and its contents:

```bash
kubectl delete namespace cloudbite
```

Do not delete the entire cluster unless you intend to remove all local Kubernetes workloads.
