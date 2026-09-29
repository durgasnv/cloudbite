# CloudBite Architecture

## Current application

The application can still run as one Express process on port `5000`, serving the static files in `client/`, the REST API under `/api`, and `GET /api/health`. The container setup separates static file serving into NGINX on port `8080`, which proxies `/api/` to Express. Restaurant, menu, and order data remain in `server/data/*.json`. Blackbox Exporter probes the frontend and backend health routes for Prometheus; the backend has no native Prometheus metrics endpoint yet. The current Jenkinsfile runs checkout, dependency installation, syntax checks, tests, and an npm dependency audit; see [CI/CD integration status](ci-cd-integration.md).

## Target deployment view

```text
Browser
  |
  v
Frontend Service ----> Frontend Pods
  |
  | API requests
  v
Backend Service -----> Backend Pods -----> Future Database

Prometheus -----> Blackbox Exporter -----> /health and /api/health
    |
    v
Grafana
```

The frontend NGINX server routes browser requests for `/api` to the backend Service. The backend owns restaurant, menu, and order APIs; cart state is held in browser local storage. The backend will eventually connect to the selected database. Prometheus currently scrapes Blackbox Exporter health probes; Grafana displays availability and duration. Prometheus can also scrape backend request metrics after an endpoint is implemented.

## Kubernetes resources

| Component | Kubernetes resource | Responsibility |
| --- | --- | --- |
| Frontend | Deployment and Service | Runs multiple frontend replicas and exposes a stable in-cluster endpoint. |
| Backend | Deployment and Service | Runs the REST API and health check. |
| Database | Chosen by application team | Persists application data; its deployment model is still to be agreed. |
| Configuration | ConfigMap | Holds non-sensitive runtime configuration. |
| Secrets | Secret reference | Supplies sensitive values without committing them to the repository. |
| Blackbox Exporter | Deployment and Service | Probes frontend and backend health endpoints. |
| Prometheus | Deployment and Service | Scrapes and stores probe metrics. |
| Grafana | Deployment and Service | Displays Prometheus probe data in a dashboard. |

## Naming and connectivity rules

* All CloudBite resources should use the `cloudbite` namespace.
* Pods are replaceable. Never configure one component to call another using a pod IP.
* Use the backend Service name in the frontend reverse proxy; browser JavaScript cannot resolve Kubernetes Service DNS names.
* A container must listen on `0.0.0.0`, not only `localhost`, so Kubernetes can reach it.
* Ports, service names, environment variables, health paths, and metric paths are application-contract values. Record their final values in `docs/deployment-guide.md` after agreeing them with Member 1.

## Configuration boundaries

```text
Repository
  ├── Dockerfiles: build instructions; no secrets
  ├── Kubernetes ConfigMap: public runtime values
  ├── Kubernetes Secret: runtime sensitive values; no real values committed
  └── Local .env: developer-only values; ignored by Git
```

## Request and metrics flow

1. A user opens the frontend.
2. The frontend sends an API request to the backend Service.
3. The backend reads or writes the current JSON data files; a database is planned.
4. The backend returns an API response.
5. Blackbox Exporter probes the two health routes and Prometheus collects the results.
6. Grafana queries Prometheus to draw availability and probe-duration panels.
