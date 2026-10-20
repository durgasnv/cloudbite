# CloudBite Architecture

## Application and request flow

```text
Browser -> frontend Service -> NGINX frontend Pods -> backend Service -> Express backend Pod
                                  |                                      |
                                  +---- /api reverse proxy -------------+----> PostgreSQL Service
                                                                              -> PostgreSQL StatefulSet/PVC

Prometheus -> Blackbox Exporter -> frontend /health and backend /api/health
           -> kube-state-metrics -> Deployment replicas and Pod restarts
Grafana    -> Prometheus         -> health and Kubernetes dashboards
```

In Kubernetes, two frontend replicas serve the static files in `client/`. NGINX proxies `/api/` requests to the backend Service, so the browser uses same-origin API paths and does not need an internal Kubernetes address. The Express backend serves restaurants and menus from `server/data/restaurants.json` and `server/data/menu.json`. It stores orders in PostgreSQL through the `cloudbite-postgres` Service. A 1 Gi persistent volume claim keeps the database files across Pod replacement. A single-process local run can serve both frontend and API on port `5000`; without PostgreSQL configuration, local orders use `server/data/orders.json`.

## Application features

The restaurant page loads restaurant and menu records, derives its city selector from the available restaurant cities, and combines city, search, and cuisine filters. The backend also supports `GET /api/restaurants?city=...`; city matching is exact and case-insensitive. Restaurant pages request their menus from `GET /api/restaurants/:id/menu`. The cart is stored in browser `localStorage`. Checkout validates items and prices against the server menu, calculates fees on the server, and creates a simulated order. Customer order lookup requires the private token issued at checkout; staff order listing and status changes require a configured `ADMIN_TOKEN`. See [How CloudBite runs](how-cloudbite-runs.md) for the full feature walkthrough and access URLs.

## Kubernetes resources

| Component | Kubernetes resource | Responsibility |
| --- | --- | --- |
| Frontend | Deployment and ClusterIP Service | Serves the UI and forwards `/api/` to the backend. |
| Backend | Deployment and ClusterIP Service | Runs the REST API and checks order storage in `/api/health`. |
| Database | PostgreSQL StatefulSet, Service, and persistent volume claim | Stores orders independently of backend Pods. |
| Configuration | ConfigMap | Holds non-sensitive runtime settings. |
| Credentials | `cloudbite-secrets` Secret | Supplies PostgreSQL password and staff token. |
| Blackbox Exporter | Deployment and Service | Probes frontend and backend health endpoints. |
| kube-state-metrics | Deployment, Service, and namespaced RBAC | Exposes Deployment replicas and Pod restarts. |
| Prometheus | Deployment and Service | Collects health probes and Kubernetes state metrics. |
| Grafana | Deployment and Service | Displays the two CloudBite dashboards. |

All resources use the `cloudbite` namespace. Components communicate through Service names, never Pod IPs. PostgreSQL and application Services stay internal; local browser access uses `kubectl port-forward`. Readiness and liveness probes use `/health` for the frontend and `/api/health` for the backend. The backend health route checks PostgreSQL when configured.

## Delivery and monitoring

The root `Jenkinsfile` runs tests, SonarQube quality analysis, Gitleaks, npm audit, Docker builds, and Trivy image scans. A successful `main` build is configured to deploy those scanned image tags with `scripts/deploy-minikube.sh`. The local Minikube application deployment was verified, but the Jenkins release path has not been run end to end. See [CI/CD integration](ci-cd-integration.md).

Prometheus asks Blackbox Exporter to request both health URLs and scrapes kube-state-metrics for replica and restart data. Grafana reads Prometheus. Native backend request metrics, CPU/memory graphs, and durable Prometheus storage are not implemented. See [monitoring](../monitoring/README.md).

Keep secrets out of Dockerfiles, ConfigMaps, and Git. Create the required Kubernetes Secrets from private values as described in [configuration](configuration.md). Deleting the database volume claim or namespace can remove order data.
