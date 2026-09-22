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

Use the actual application ports, image names, API paths, and environment variables agreed with Member 1. Do not guess them: confirm them before writing the final manifests.

## Work in this order

### 1. Agree on the application contract

Before creating infrastructure files, get these details from Member 1:

* Frontend build command, start command, and port.
* Backend start command, port, health endpoint, and metrics endpoint.
* Required environment variables and their safe example values.
* Database type, connection-variable name, and whether the database will run locally, in Docker Compose, or in Kubernetes.
* The expected frontend-to-backend URL in development and in Kubernetes.

Record the agreed values in `docs/deployment-guide.md`. If an endpoint does not exist, do not invent one; ask Member 1 to add it or agree on a temporary approach.

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
* Use at least two replicas for stateless components when local resources permit; one replica is acceptable while developing on a small laptop, but document that limitation.
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

Prometheus needs a metrics endpoint to scrape. Prefer a backend endpoint such as `/metrics` in Prometheus format. Coordinate its implementation with Member 1 if it does not exist.

Configure Prometheus to discover or target the backend service, then verify that the target is `UP` in Prometheus. Create a Grafana dashboard that answers these questions:

* Is the backend reachable and healthy?
* How many HTTP requests are received and how many fail?
* What is request latency, if the application exposes it?
* What CPU and memory are used by the application containers?
* Have any containers restarted?

Export the dashboard JSON to `monitoring/grafana/` so it can be imported by another team member without manually rebuilding it.

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
