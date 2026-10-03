# How CloudBite runs

This is the working map for CloudBite: what each tool does, how a request moves through the system, how to open each interface, and how to run the project. Run commands from the repository root unless a command says otherwise. URLs below are local to the computer running the command; a port forward must remain open while you use its URL.

## The whole system

```text
Developer pushes code
        |
        v
Jenkins -> tests -> SonarQube -> Gitleaks -> npm audit -> Docker builds -> Trivy
        |                                                   |
        | successful main build                              | two tagged images
        v                                                   v
    deploy-minikube.sh -------------------------------> Minikube / Kubernetes
                                                         |
Browser -> frontend Service -> NGINX frontend Pods ----> backend Service -> Express Pod
                                 |                              |                  |
                                 +--- /api reverse proxy -------+                  +--> PostgreSQL PVC

Prometheus -> Blackbox Exporter -> frontend /health and backend /api/health
           -> kube-state-metrics -> Kubernetes replica and restart data
Grafana    -> Prometheus         -> CloudBite dashboards
```

Docker builds the application images and can also run the app without Kubernetes. Minikube is the local Kubernetes cluster. Kubernetes keeps the requested Pods running, gives them stable Service names, and mounts persistent storage for PostgreSQL. Jenkins is the proposed automated release path; the local Minikube deployment works, but the full Jenkins pipeline has not yet been verified end to end.

## Components, purpose, and access

| Component | Purpose in CloudBite | Where to access it |
| --- | --- | --- |
| CloudBite frontend | NGINX serves the HTML, CSS, and JavaScript and forwards `/api/` to Express. | Kubernetes: `http://localhost:18080/` after the frontend port forward below. Compose: `http://localhost:8080/`. Local `npm start`: `http://localhost:5000/`. |
| CloudBite backend | Express serves restaurant, menu, order, and health APIs. | Use the frontend's `/api/...` paths. Direct Kubernetes access, if needed: `kubectl port-forward -n cloudbite service/cloudbite-backend 5000:5000`, then `http://localhost:5000/api/health`. |
| PostgreSQL | Stores orders shared across backend pod replacements. | Internal Kubernetes Service `cloudbite-postgres:5432`; it has no public URL. Inspect through `kubectl` rather than publishing the database port. |
| Docker and Docker Compose | Build the two images; Compose is a separate local way to run the app and optional database/monitoring. | Docker CLI (`docker ps`, `docker compose ...`). Compose app is on `localhost:8080`. |
| Minikube | Runs a local Kubernetes cluster, usually with the Docker driver. | CLI: `minikube status` where installed. This host also has a running Docker container named `minikube`. |
| Kubernetes | Runs the app, database, and monitoring resources in namespace `cloudbite`. | CLI: `kubectl get pods,deployments,statefulsets,pvc,services -n cloudbite`. ClusterIP Services need port forwards for host-browser access. |
| Jenkins | Runs the checks, image builds, scans, and `main` deployment defined in `Jenkinsfile`. | Open the URL configured for your Jenkins server; this repository does not define a Jenkins host or published port. No Jenkins container was running in the local Docker check on 2026-10-03. |
| SonarQube | Analyzes code and sends a quality-gate result to Jenkins. | Open the URL configured for the Jenkins `SonarQube` server installation. CloudBite does not deploy SonarQube or assign its URL. |
| Gitleaks, npm audit, Trivy | Check Git history for secrets, npm dependencies, and built images for vulnerabilities. | Their results appear in Jenkins stage logs; they have no CloudBite web UI. |
| Blackbox Exporter | Makes HTTP probes of frontend and backend health routes. | In-cluster `blackbox-exporter:9115`; results are read through Prometheus/Grafana. |
| kube-state-metrics | Exposes Kubernetes Deployment replicas and Pod restarts for the `cloudbite` namespace. | In-cluster `kube-state-metrics:8080`; results are read through Prometheus/Grafana. |
| Prometheus | Scrapes and stores probe and Kubernetes state metrics every 15 seconds. | Kubernetes: `http://localhost:9090/targets` after port forwarding. Compose monitoring: the same URL. |
| Grafana | Displays the **CloudBite Health** and **CloudBite Kubernetes** dashboards. | Kubernetes: `http://localhost:3000/` after port forwarding. Compose monitoring: the same URL. Sign in as `admin` with the password you configured. |

These localhost addresses can conflict if Compose and Kubernetes port forwards run at the same time. Stop one listener or choose a different local port on the left side of `LOCAL:CONTAINER`.

## Open the current Kubernetes deployment

The application was locally verified in Minikube on 2026-10-03, and the monitoring stack was verified on 2026-10-02. Use three terminals for the following forwards:

```bash
kubectl get deployments,statefulsets,pvc,pods -n cloudbite
kubectl port-forward -n cloudbite service/cloudbite-frontend 18080:8080
```

```bash
kubectl port-forward -n cloudbite service/prometheus 9090:9090
```

```bash
kubectl port-forward -n cloudbite service/grafana 3000:3000
```

Open `http://localhost:18080/` for the app, `http://localhost:9090/targets` for Prometheus targets, and `http://localhost:3000/` for Grafana. Check `http://localhost:18080/health` for NGINX and `http://localhost:18080/api/health` for Express and its order store. The Grafana password comes from the private `cloudbite-grafana-admin` Kubernetes Secret; the repository does not contain it. Port forwarding stops with Ctrl+C.

The frontend Service and backend Service are `ClusterIP`, so Kubernetes DNS names such as `cloudbite-backend` work inside the cluster but are not browser URLs. NGINX receives browser requests on the frontend Service and sends `/api/` requests to the backend Service. The PostgreSQL Service is internal as well.

## How the application features work

| Feature | What a user does | What the code does |
| --- | --- | --- |
| Home and navigation | Open `/`, then browse restaurants, cart, and order history. | Static pages in `client/` call the same-origin `/api` endpoints. |
| Restaurant feed and city filter | Open `/restaurants.html` and choose any city in the selector. | `client/js/restaurants.js` builds the city list from the available restaurant records. It compares the selected city to each restaurant's `city`, or the final part of its `location`. “All cities” clears the filter. A URL such as `/restaurants.html?city=Hyderabad` preselects a city. The backend also supports exact, case-insensitive `GET /api/restaurants?city=Hyderabad`. Available choices depend on the loaded catalog; the app does not detect a visitor's physical location. |
| Search and cuisine | Search for a restaurant, cuisine, location, or dish; choose a cuisine chip. | The browser filters loaded restaurants and menu items together. The API also accepts `search` and `cuisine` on `GET /api/restaurants`, and these can be combined with `city`. |
| Menu | Select a restaurant, then view its dishes and filter by menu category. | `GET /api/restaurants/:id` loads restaurant details; `GET /api/restaurants/:id/menu` loads its menu. `GET /api/menu` also supports `category`, `restaurantId`, and `search`. |
| Cart | Add available dishes, change quantities, or remove them. | Browser `localStorage` holds the cart and updates the badge and totals. There is no server-side cart or cross-device sync. |
| Checkout | Enter customer details and place a simulated order. | `POST /api/orders` checks items against the server menu, rejects unavailable items or price mismatches, computes the total, and creates a random order ID plus a private tracking token. The total is subtotal + ₹40 delivery below ₹500 (free at ₹500 or above) + ₹10 platform fee. No payment or real restaurant fulfillment occurs. |
| Customer order tracking | Open `/orders.html` after checkout, or enter a saved order ID. | The browser stores the order ID and tracking token in `localStorage`. `GET /api/orders/:id` requires the `x-order-token` header for customers; the order ID alone is insufficient. Customer responses omit phone and address. Losing that browser storage loses the token needed for customer access. |
| Staff mode and order status | In `/orders.html`, enter the configured staff token, list orders, and change a status. | The browser keeps the staff token in `sessionStorage`. The API requires `x-admin-token` or a Bearer token to list all orders or call `PATCH /api/orders/:id/status`. Valid statuses are `CONFIRMED`, `PREPARING`, `READY`, `COMPLETED`, and `CANCELLED`. Staff mode is disabled when `ADMIN_TOKEN` is unset. |
| Health | Open `/health` and `/api/health`. | NGINX answers `/health`; Express answers `/api/health` and checks PostgreSQL when configured. Kubernetes readiness and liveness probes use these routes. |

Restaurant and menu records currently come from `server/data/restaurants.json` and `server/data/menu.json`, generated from the uploaded Zomato metropolitan CSV (50 restaurants across 13 cities and 957 dishes). Orders use PostgreSQL when `DATABASE_URL` or `PGHOST` is set, as in Kubernetes and the Compose database overlay. Otherwise orders use `server/data/orders.json` for local development. The [Zomato importer](zomato-import.md) can regenerate the catalog; the raw Kaggle CSV is ignored by Git and not loaded by the running app. Imported listings are historical demo data, not live restaurant availability.

## How the deployment is built

1. `docker/backend.Dockerfile` creates a Node/Express image listening on port `5000`. `docker/frontend.Dockerfile` creates an NGINX image listening on port `8080`.
2. `docker/nginx.conf` serves `client/`, answers `/health`, and proxies `/api/` to the backend Service/container.
3. `kubernetes/namespace.yaml` creates `cloudbite`. `configmap.yaml` supplies non-sensitive backend settings. A private `cloudbite-secrets` Secret supplies `postgres-password` and `admin-token`.
4. `postgres-statefulset.yaml` runs PostgreSQL with a 1 Gi persistent volume claim; `postgres-service.yaml` gives it a stable in-cluster name.
5. Backend and frontend Deployments run one and two replicas respectively. Services provide stable names; probes control readiness and restart unhealthy containers.
6. `scripts/deploy-minikube.sh` loads the requested image tags into Minikube, applies resources in dependency order, and waits for rollouts. It uses `minikube image load` when available, or imports through the running Minikube Docker container. The script requires `BACKEND_IMAGE`, `FRONTEND_IMAGE`, and `KUBECONFIG`.

For a new cluster, create the application Secret before running the deployment script. The [configuration guide](configuration.md) shows the required keys and creation command. Monitoring is applied separately with `kubectl apply -k monitoring/` after creating the Grafana admin Secret, as described in the [monitoring guide](../monitoring/README.md). The database volume persists through backend pod replacement; deleting the namespace or its volume claim can delete order data.

## What Jenkins does on a code change

`Jenkinsfile` is intended for a Multibranch Pipeline on a Linux agent labeled `cloudbite-release`. GitHub webhooks can trigger branch discovery/builds, and Jenkins also polls SCM every five minutes. Jenkins checks out the code, runs `npm ci`, syntax checks and tests, sends code to SonarQube, waits for its quality gate, runs Gitleaks and `npm audit`, builds uniquely tagged Docker images, and runs Trivy against both images. A failing stage stops later stages. Only a successful `main` branch build reaches `scripts/deploy-minikube.sh` with the `cloudbite-kubeconfig` Jenkins credential. Feature branches and pull requests run checks without deploying.

The release agent still needs the configured SonarQube integration, scanners, Docker access, and usable kubeconfig. The Jenkins controller on this host has not been configured as that release agent. The Minikube deployment was verified manually, including an order surviving backend replacement; this does not prove that a Jenkins build has deployed it. Jenkins does not deploy the monitoring stack.

## What monitoring shows

Prometheus sends Blackbox Exporter to request the frontend and backend health URLs. `probe_success=1` means the endpoint returned HTTP 200; `probe_duration_seconds` records probe time. In Kubernetes, Prometheus also scrapes kube-state-metrics for desired/available Deployment replicas and Pod container restarts. Grafana's **CloudBite Health** and **CloudBite Kubernetes** dashboards display those series. Check target state first at `/targets` if a panel is empty.

The current setup does not provide request counts, error rates, CPU/memory graphs, or a backend `/metrics` endpoint. Prometheus uses ephemeral storage in this local deployment, so its history can disappear when its Pod is recreated. Health probes show that endpoints respond; they do not prove that every checkout path works.

## Run without Kubernetes

For a quick single-process development run, use `npm ci` and `npm start`, then open `http://localhost:5000/`. Without PostgreSQL settings, orders go to the local JSON file.

For two application containers, run:

```bash
docker compose -f docker/compose.yaml up --build -d
```

Open `http://localhost:8080/`. This base Compose setup uses the backend container's JSON order file, which does not survive container replacement. To use persistent PostgreSQL, set `CLOUDBITE_DB_PASSWORD` and `CLOUDBITE_ADMIN_TOKEN` privately and run `docker compose -f docker/compose.yaml -f docker/compose.database.yaml up --build -d`. To add Prometheus and Grafana to Compose, set `GRAFANA_ADMIN_PASSWORD` through the private `docker/.env` described in the [monitoring guide](../monitoring/README.md), and include `-f docker/compose.monitoring.yaml` in the Compose command. Compose monitoring uses the health dashboard; the Kubernetes dashboard depends on kube-state-metrics and is available only in Minikube.

## Quick checks and current limits

```bash
npm run check
npm test
kubectl get deployments,statefulsets,pvc,pods -n cloudbite
kubectl rollout status deployment/cloudbite-backend -n cloudbite
kubectl rollout status deployment/cloudbite-frontend -n cloudbite
```

The current catalog is a small demo catalog; location choices come from those records. Orders and staff access use private tokens, but customer accounts, payment processing, real delivery, and production identity checks are not implemented. For deeper setup and troubleshooting, see the [Kubernetes guide](../kubernetes/README.md), [CI/CD guide](ci-cd-integration.md), and [troubleshooting guide](troubleshooting.md).
