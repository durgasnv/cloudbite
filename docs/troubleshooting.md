# Deployment Troubleshooting

Run these commands in the `cloudbite` namespace unless the final manifests use another namespace:

```bash
kubectl get pods -n cloudbite
kubectl get events -n cloudbite --sort-by=.lastTimestamp
kubectl describe pod POD_NAME -n cloudbite
kubectl logs POD_NAME -n cloudbite
```

## `ImagePullBackOff` or `ErrImagePull`

**Likely cause:** the image name/tag in the Deployment is wrong, the image is not available to Minikube, or a private registry needs credentials.

**Fix:**

1. Compare the Deployment image field with the image built locally.
2. For local images, load the exact tag into Minikube:

   ```bash
   minikube image load cloudbite-backend:local
   ```

3. Reapply the manifest and inspect the latest events.
4. For a registry image, confirm the image exists and configure image-pull credentials without committing them.

## Pod is `Pending`

**Likely cause:** insufficient CPU or memory, an unsatisfied volume claim, or a scheduling restriction.

**Fix:** inspect `kubectl describe pod`. On a small local cluster, lower resource requests only after confirming they are reasonable, or restart Minikube with more resources. Do not remove resource limits merely to silence the issue.

## Readiness or liveness probe fails

**Likely cause:** wrong port/path, the application starts too slowly, the endpoint needs authentication, or it depends on an unavailable database.

**Fix:**

1. Check application logs.
2. Confirm the container port and probe path match the backend contract.
3. Use a lightweight, unauthenticated health endpoint.
4. Add or adjust a startup probe or initial delay only after the endpoint is known to work.

## Service cannot reach the backend

**Likely cause:** Service selector labels do not match pod labels, wrong target port, or the frontend calls `localhost`.

**Fix:**

```bash
kubectl get service -n cloudbite
kubectl get endpoints -n cloudbite
kubectl get pods --show-labels -n cloudbite
```

The Service should have endpoints. Inside Kubernetes, call the backend using its Service name, not `localhost` or a pod IP.

## Application runs locally but not in Kubernetes

**Likely cause:** the process binds only to `127.0.0.1`, required environment variables are absent, or the production start command differs.

**Fix:** bind the application to `0.0.0.0`; compare local and Deployment environment values; then inspect container logs and test the container image locally with the same environment.

## Prometheus target is down

**Likely cause:** Prometheus has the wrong target address or metrics path, the Service is unavailable, or the backend does not expose Prometheus-format metrics.

**Fix:** verify the backend metrics endpoint first, then inspect Prometheus targets and scrape configuration. A target should display as `UP` before creating Grafana panels.

## Grafana panels have no data

**Likely cause:** the Prometheus data source is misconfigured, the query names do not match exposed metrics, or no traffic has occurred.

**Fix:** query the metric directly in Prometheus, correct the Grafana data source/query, and send application requests to generate data. Do not treat an empty panel as proof that monitoring is working.

## Container restarts repeatedly

Check the previous container logs:

```bash
kubectl logs POD_NAME -n cloudbite --previous
```

Then inspect the pod description for exit codes and probe events. Fix the application startup failure rather than disabling the probes permanently.
