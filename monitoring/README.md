# CloudBite Monitoring

This setup checks whether the frontend `/health` and backend `/api/health` endpoints respond with HTTP 200. Prometheus asks Blackbox Exporter to probe both URLs every 15 seconds. Grafana displays each endpoint's availability and probe duration. In Kubernetes, a namespace-scoped kube-state-metrics instance also exposes application replica availability and container restart counts.

## Start with Docker Compose

From the repository root, make a local copy of the password template and replace its placeholder with a unique password:

```bash
cp docker/.env.example docker/.env
```

The `docker/.env` file is ignored by Git. Then start the application and monitoring services:

```bash
docker compose --env-file docker/.env \
  -f docker/compose.yaml -f docker/compose.monitoring.yaml up --build -d
```

Open `http://localhost:9090/targets` and confirm both `cloudbite_health` targets are `UP`. Open `http://localhost:3000`, sign in as `admin` using the local password, and open the provisioned **CloudBite Health** dashboard.

Stop the stack with the same Compose files:

```bash
docker compose --env-file docker/.env \
  -f docker/compose.yaml -f docker/compose.monitoring.yaml down
```

## Start in Minikube

Deploy the application first, following [the deployment guide](../docs/deployment-guide.md). Create a local Grafana admin Secret without storing it in Git:

```bash
read -rsp 'Grafana password: ' CLOUDBITE_GRAFANA_PASSWORD
printf '\n'
printf '%s' "$CLOUDBITE_GRAFANA_PASSWORD" | kubectl create secret generic cloudbite-grafana-admin \
  --namespace cloudbite --from-file=password=/dev/stdin
unset CLOUDBITE_GRAFANA_PASSWORD
```

Deploy monitoring with Kustomize, which generates ConfigMaps from the files in this directory:

```bash
kubectl apply -k monitoring/
kubectl rollout status deployment/blackbox-exporter -n cloudbite
kubectl rollout status deployment/kube-state-metrics -n cloudbite
kubectl rollout status deployment/prometheus -n cloudbite
kubectl rollout status deployment/grafana -n cloudbite
```

Port-forward the two ClusterIP Services in separate terminals:

```bash
kubectl port-forward -n cloudbite service/prometheus 9090:9090
kubectl port-forward -n cloudbite service/grafana 3000:3000
```

Check `http://localhost:9090/targets`: `cloudbite_health`, `blackbox_exporter`, and `kube_state_metrics` should be `UP`. In Grafana, open **CloudBite Health** for endpoint probes and **CloudBite Kubernetes** for replica and restart metrics. The Kubernetes-only dashboard is not mounted in the Compose stack.

## What the dashboard proves

| Metric | Meaning |
| --- | --- |
| `probe_success` | `1` when the configured endpoint returned HTTP 200; `0` otherwise. |
| `probe_duration_seconds` | Time taken by each health request. |
| `kube_deployment_status_replicas_available` / `kube_deployment_spec_replicas` | Available and desired replicas in the Kubernetes Deployment. |
| `kube_pod_container_status_restarts_total` | Kubernetes-reported container restarts. |

The last two metrics are Kubernetes-only; the Compose stack still has only endpoint probes. CPU and memory usage need a container/kubelet metric source, while request and error rates need application instrumentation. The dashboard does not pretend those metrics exist. Prometheus data is ephemeral in both local Compose and the initial Minikube Deployment; it is lost when those containers or pods are recreated.

If targets stay down, check the Blackbox Exporter logs and confirm that `cloudbite-backend` and `cloudbite-frontend` Services are reachable from the monitoring network or namespace.
