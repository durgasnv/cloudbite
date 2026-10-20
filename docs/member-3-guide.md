# Member 3 Guide: Containerization, Deployment, and Monitoring

## Your mission

You own the path from application source code to a running, observable local Kubernetes deployment. Your work begins after the frontend and backend can run locally and ends when the application can be deployed, checked for health, and monitored.

Your main areas are:

* Docker configuration for the frontend and backend.
* Kubernetes deployments, services, configuration, health checks, and scaling.
* Prometheus metric collection.
* Grafana dashboards.
* Clear local setup and verification documentation.

Do not add application features, credentials, real secrets, or cloud infrastructure unless the team agrees to expand the scope.

Current branch status: the Docker images, local Compose stack, PostgreSQL-backed Minikube workloads, and health-probe monitoring were verified locally. The Jenkins release path still needs an operational release agent and end-to-end validation. Request and resource metrics need more instrumentation or cluster metric sources.

## Concepts you need first

| Tool | What it does | What you will create |
| --- | --- | --- |
| Docker | Packages an application and its runtime dependencies into an image. | Dockerfiles and, optionally, Docker Compose for local development. |
| Docker Compose | Starts multiple local containers together. | A development-only `compose.yaml`, if it helps the team run frontend, backend, and database together. |
| Kubernetes | Runs and manages containers as workloads. | Deployments, Services, ConfigMaps, Secrets references, and health checks. |
| Minikube | A local Kubernetes cluster for development. | The local environment used to test the manifests. |
| kubectl | Command-line client for Kubernetes. | Commands to apply, inspect, debug, and remove resources. |
| Prometheus | Collects and stores metrics exposed by applications or Kubernetes. | Scrape configuration and a way to discover backend metrics. |
| Grafana | Visualizes Prometheus metrics. | An importable dashboard definition and setup notes. |

## Expected repository ownership

Create and maintain only the directories below unless a small supporting change elsewhere is necessary:

```text
docker/
  frontend.Dockerfile
  backend.Dockerfile
  compose.yaml                 # optional; local development only

kubernetes/
  namespace.yaml
  frontend-deployment.yaml
  frontend-service.yaml
  backend-deployment.yaml
  backend-service.yaml
  database-*.yaml              # only if the database is deployed in Kubernetes
  configmap.yaml
  secrets.example.yaml         # template only; never real values

monitoring/
  prometheus/
    prometheus.yml
  grafana/
    cloudbite-dashboard.json

docs/
  deployment-guide.md
```

The current values are recorded in `docs/deployment-guide.md`. Keep those values synchronized with Docker and Kubernetes configuration when the application changes.

## Work in this order

### 1. Agree on the application contract

The merged application provides these confirmed details:

* Root `npm start` runs the Express backend and serves the static `client/` frontend.
* The backend uses port `5000` by default and has a lightweight `GET /api/health` endpoint.
* API requests use `/api`; browser cart state is in local storage.
* Restaurants and menus are JSON files under `server/data/`. Orders use PostgreSQL when configured and local JSON otherwise.
* The backend does not yet expose Prometheus metrics. It reads `DATABASE_URL` or standard `PG*` connection variables for PostgreSQL.

The first deployment uses a separate NGINX frontend image that proxies `/api/` to the backend Service. Agree on these remaining details with Member 1 before adding database or metrics resources:

* The future Prometheus metrics endpoint and database integration plan.
* Any new environment variables and their safe example values.
* The database type and whether it will run locally, in Docker Compose, or in Kubernetes.

Record the agreed values in `docs/deployment-guide.md`. Do not configure probes or metrics scrapes against routes that do not exist.

### 2. Containerize each application

Create one Dockerfile for the frontend and one for the backend.

Each Dockerfile should:

* Use a small, supported base image pinned to a major/minor version where practical.
* Install only production dependencies in the final runtime image.
* Include a `.dockerignore` so source-control files, dependencies, environment files, and build output are not copied unnecessarily.
* Run as a non-root user where the runtime permits it.
* Receive configuration through environment variables, never baked-in credentials.
* Expose the port that the application actually listens on.

Build and run each image locally before moving to Kubernetes:

```bash
docker build -f docker/backend.Dockerfile -t cloudbite-backend:local .
docker run --rm -p BACKEND_HOST_PORT:BACKEND_CONTAINER_PORT --env-file .env cloudbite-backend:local

docker build -f docker/frontend.Dockerfile -t cloudbite-frontend:local .
docker run --rm -p FRONTEND_HOST_PORT:FRONTEND_CONTAINER_PORT cloudbite-frontend:local
```

Replace the uppercase placeholders with the actual ports. Never commit `.env`.

### 3. Add Kubernetes manifests

Start with a namespace, then deploy the backend, then the frontend. Use a Service for each workload so Kubernetes provides stable in-cluster DNS names.

For both frontend and backend deployments:

* Set explicit container ports.
* Define CPU and memory requests and limits with values appropriate to the local cluster.
* Use at least two replicas for stateless components when local resources permit. The frontend has two replicas. Kubernetes uses shared PostgreSQL order storage; the backend currently has one replica by configuration.
* Add a readiness probe so traffic goes only to ready containers.
* Add a liveness probe only after confirming the endpoint is safe to call repeatedly.
* Set `imagePullPolicy` appropriately for local images versus registry images.
* Put non-sensitive configuration in a ConfigMap.
* Reference Kubernetes Secrets by name for sensitive values; commit only a `secrets.example.yaml` template with empty placeholders.

Apply and inspect resources:

```bash
kubectl apply -f kubernetes/
kubectl get all -n cloudbite
kubectl get pods -n cloudbite
kubectl describe pod POD_NAME -n cloudbite
kubectl logs deployment/cloudbite-backend -n cloudbite
```

Use the actual namespace and deployment names selected in the manifests.

### 4. Make local images available to Minikube

Minikube cannot automatically see images built on the host. Use one of these approaches and document the chosen one:

```bash
minikube image load cloudbite-backend:local
minikube image load cloudbite-frontend:local
```

or build directly against Minikube's container runtime. For the first implementation, `minikube image load` is simpler and less surprising.

### 5. Add monitoring

The monitoring stack uses Blackbox Exporter to probe `/health` and `/api/health`; it does not depend on a backend `/metrics` route. The Kubernetes variant also uses namespace-scoped kube-state-metrics for replica and restart metrics. Start it using `monitoring/README.md`, then verify the `cloudbite_health` and `kube_state_metrics` targets are `UP` in Prometheus and both dashboards are populated.

For the next monitoring increment, coordinate backend request instrumentation and a Prometheus-format `/metrics` endpoint with Member 1. Add Kubernetes/container metric sources before creating panels for:

* How many HTTP requests are received and how many fail?
* What is request latency, if the application exposes it?
* What CPU and memory are used by the application containers?

Keep the Grafana dashboard JSON in `monitoring/grafana/` so another team member can reproduce it.

### 6. Write the deployment guide

The guide must let a teammate reproduce the environment from a clean machine. Include:

1. Prerequisites and version checks for Docker, Minikube, kubectl, Prometheus, and Grafana.
2. How to create the local cluster.
3. How to configure local environment values without committing secrets.
4. Exact build, image-load, deploy, and access commands.
5. How to check pod health and inspect logs.
6. How to open Prometheus and Grafana.
7. How to delete only CloudBite resources when finished.
8. A troubleshooting section for `ImagePullBackOff`, failing probes, pending pods, and service connectivity.

## Working method

Work on this branch: `feature/containerization-deployment-monitoring`.

Keep each change narrow and commit it immediately after it is verified. Recommended commit sequence:

```text
build: add backend Docker image
build: add frontend Docker image
deploy: add backend Kubernetes workload
deploy: add frontend Kubernetes workload
monitor: add Prometheus configuration
monitor: add Grafana dashboard
docs: add local deployment guide
```

Before each commit:

```bash
git status --short
git diff --check
```

Then stage only intended files and commit with a descriptive message:

```bash
git add docker/backend.Dockerfile .dockerignore
git commit -m "build: add backend Docker image"
```

Do not include another member's files in your commit. Pull or rebase from `main` before opening a pull request, resolve conflicts carefully, and re-run the checks affected by the rebase.

## Definition of done

Member 3 work is complete when all of the following are true:

* Frontend and backend images build locally without secrets embedded in them.
* The images run locally and the application can communicate with its backend.
* Kubernetes manifests deploy the application successfully to Minikube.
* Pods become Ready, have meaningful health checks, and restart automatically when a container fails.
* Services provide frontend and backend connectivity.
* Configuration is environment-based; real secrets are not committed.
* Prometheus successfully scrapes the intended target(s).
* Grafana has an importable dashboard showing application and container health.
* A teammate can follow `docs/deployment-guide.md` from start to finish.
* Every logical change is committed separately and the branch is ready for a pull request.

## Common pitfalls

* A container works locally but fails in Kubernetes because it binds only to `localhost`. The backend should bind to `0.0.0.0` inside its container.
* `ImagePullBackOff` usually means Minikube cannot access a local image or the image tag is wrong.
* A readiness probe that calls a protected or database-heavy endpoint can keep healthy pods out of service. Use a lightweight endpoint.
* `localhost` inside a pod means that same pod, not another service. Use the Kubernetes Service DNS name to reach the backend or database.
* Do not use real passwords in YAML, Dockerfiles, screenshots, commits, or Grafana dashboards.
* Monitoring cannot show application request metrics until the backend exposes them; infrastructure configuration alone cannot create those metrics.
