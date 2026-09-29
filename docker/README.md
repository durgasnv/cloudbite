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

Orders are currently written to `server/data/orders.json` inside the backend container. They are lost when that container is recreated. Do not use this stack as durable order storage; the application needs a database before multi-replica backend deployment.

## Image contract

| Image | Dockerfile | Internal port | Health path |
| --- | --- | --- | --- |
| `cloudbite-backend:local` | `docker/backend.Dockerfile` | `5000` | `/api/health` |
| `cloudbite-frontend:local` | `docker/frontend.Dockerfile` | `8080` | `/health` |

The backend image installs dependencies from the root `package-lock.json` and runs as the unprivileged `node` user. The frontend image uses an unprivileged NGINX base image. Neither image contains a credential or `.env` file.
