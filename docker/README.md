# Local Containers

The backend image runs Express on port `5000`. The frontend image serves static files with unprivileged NGINX on port `8080` and forwards `/api/` requests to the backend container. Browser code uses the same-origin `/api` path in both Docker Compose and Kubernetes.

## Prerequisite

Docker Engine or Docker Desktop with Compose must be running. On WSL, enable Docker Desktop integration for this distribution before running the commands below.

## Start and verify

From the repository root:

```bash
docker compose -f docker/compose.yaml up --build -d
docker compose -f docker/compose.yaml ps
curl -f http://localhost:8080/health
curl -f http://localhost:8080/api/health
curl -f http://localhost:8080/api/restaurants
```

Open `http://localhost:8080/` in a browser. The backend is reachable through the frontend proxy; only the frontend port is published on the host.

Inspect logs if a service is not healthy:

```bash
docker compose -f docker/compose.yaml logs cloudbite-backend
docker compose -f docker/compose.yaml logs cloudbite-frontend
```

Stop only this Compose project:

```bash
docker compose -f docker/compose.yaml down
```

The base Compose stack writes orders to `server/data/orders.json` inside the backend container. The build context excludes any local copy of that file, so a new image starts without order records. Orders are lost when the container is recreated. For persistent order storage and a configured staff token, set private `CLOUDBITE_DB_PASSWORD` and `CLOUDBITE_ADMIN_TOKEN` values, then run:

```bash
docker compose -f docker/compose.yaml -f docker/compose.database.yaml up --build -d
```

This overlay adds PostgreSQL with a named Docker volume and configures the backend to use it. Keep the volume if you want orders to survive a Compose restart.

To start the optional Prometheus and Grafana stack alongside the application, follow [the monitoring guide](../monitoring/README.md).

## Image contract

| Image | Dockerfile | Internal port | Health path |
| --- | --- | --- | --- |
| `cloudbite-backend:local` | `docker/backend.Dockerfile` | `5000` | `/api/health` |
| `cloudbite-frontend:local` | `docker/frontend.Dockerfile` | `8080` | `/health` |

The backend image installs dependencies from the root `package-lock.json` and runs as the unprivileged `node` user. The frontend image uses an unprivileged NGINX base image. `.env` files and local order records are excluded from the build context. Staff access requires a private configured `ADMIN_TOKEN`; the former public demo key is rejected. Customer order lookup requires its private tracking token.
