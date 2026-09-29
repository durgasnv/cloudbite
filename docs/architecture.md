# CloudBite Architecture

## Current application

Today, one Express process on port `5000` serves the static files in `client/`, the REST API under `/api`, and `GET /api/health`. Restaurant, menu, and order data are stored in `server/data/*.json`. There is no database service or Prometheus metrics endpoint yet. The current Jenkinsfile runs checkout, dependency installation, syntax checks, tests, and an npm dependency audit; see [CI/CD integration status](ci-cd-integration.md).

## Target deployment view

```text
Browser
  |
  v
Frontend Service ----> Frontend Pods
  |
  | API requests
  v
Backend Service -----> Backend Pods -----> Database
  |
  | /metrics
  v
Prometheus -----------> Grafana
```

The frontend will be the user-facing web application. If deployed separately, its server must route browser requests for `/api` to the backend Service. The backend currently owns restaurant, menu, and order APIs; cart state is held in browser local storage. The backend will eventually connect to the selected database. Prometheus can scrape backend metrics after the endpoint is implemented; Grafana will visualize those metrics.

## Kubernetes resources

| Component | Kubernetes resource | Responsibility |
| --- | --- | --- |
| Frontend | Deployment and Service | Runs multiple frontend replicas and exposes a stable in-cluster endpoint. |
| Backend | Deployment and Service | Runs the REST API, health checks, and metrics endpoint. |
| Database | Chosen by application team | Persists application data; its deployment model is still to be agreed. |
| Configuration | ConfigMap | Holds non-sensitive runtime configuration. |
| Secrets | Secret reference | Supplies sensitive values without committing them to the repository. |
| Prometheus | Deployment/Helm release or local installation | Scrapes and stores metrics. |
| Grafana | Deployment/Helm release or local installation | Displays Prometheus data in dashboards. |

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
3. The backend reads or writes application data through the database connection.
4. The backend returns an API response.
5. Prometheus periodically reads backend metrics.
6. Grafana queries Prometheus to draw health and performance panels.
