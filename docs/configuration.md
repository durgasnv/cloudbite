# Configuration and Secrets Guide

CloudBite configuration must be supplied at runtime. Do not hard-code values in application code, Dockerfiles, Kubernetes manifests, or committed environment files.

## Configuration categories

| Category | Examples | Store it in |
| --- | --- | --- |
| Public runtime configuration | `PORT`, `NODE_ENV`, API base URL, logging level | ConfigMap or local `.env` file |
| Sensitive configuration | Database password, JWT secret, API token | Kubernetes Secret or uncommitted local `.env` file |
| Build configuration | Node version, build command | Dockerfile or package configuration |

## Current application variables

The backend reads `PORT` (default `5000`), `ADMIN_TOKEN`, and PostgreSQL connection variables. `dotenv` loads local `.env` values if present. With `NODE_ENV=production`, missing PostgreSQL configuration stops startup with an actionable error. In development/test without PostgreSQL settings, orders use `server/data/orders.json` for local development only. Staff mode stays disabled when `ADMIN_TOKEN` is unset. The former public demo keys are rejected.

| Variable | Consumed by | Sensitive? | Purpose |
| --- | --- | --- | --- |
| `PORT` | Backend | No | Current Express listen port; defaults to `5000`. |
| `ADMIN_TOKEN` | Backend | Yes | Staff API token. Set a strong, private value; `admin123` and `admin-secret-key` are rejected. |
| `DATABASE_URL` | Backend | Yes | PostgreSQL URL. Takes precedence over `PGHOST` settings. |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | Backend | Password is sensitive | PostgreSQL connection when `DATABASE_URL` is unset. |
| `NODE_ENV` | Runtime | No | Production requires database configuration; base Docker Compose uses development mode for the JSON demo and the database overlay enables production. |
| `ORDER_FILE_PATH` | Backend | No | Optional JSON order file path; useful for isolated test storage. Parent directory must exist. |
| `DB_TIMEOUT_MS` | Backend | No | PostgreSQL connection, query, and statement timeout; default 3000 ms, permitted range 100–30000 ms. |
| `ADMIN_TOKEN_EXPIRES_AT` | Backend | No | Optional staff token expiration date; expired credentials fail closed. Invalid dates stop startup. Unset means the static token does not expire automatically. |

JSON order storage serializes writes within one backend process and replaces the file atomically. Run only one backend process against a JSON file; use PostgreSQL for multiple processes or replicas. Empty, corrupt, malformed, or duplicate order records fail with `503` and are never silently replaced. Restore a valid backup before retrying. A missing orders file initializes on the first checkout if its directory is writable.

`GET /api/health` verifies JSON readability and creates and removes a temporary file to check directory write access. PostgreSQL health checks verify the schema and connection. Storage failure returns `503`. Checkout requires positive integer item IDs and quantities (at most 50 per entry); prices and totals must be finite, non-negative numbers when supplied. Catalog query parameters accept one string per filter, and invalid values return `400`. CORS permits `Idempotency-Key`, `X-Order-Token`, and `X-Admin-Token` for frontends on another origin.

`GET /api/live` reports process liveness without querying storage. Kubernetes uses it for liveness and keeps `/api/health` for readiness. Database outages return sanitized `503` errors without silently switching storage backends.

Checkout accepts an optional `Idempotency-Key` header (16–128 letters, digits, underscores, or hyphens). The browser creates a random UUID and reuses it for the same payload after timeout, disconnect, or reload when localStorage works. Treat the key as a private recovery credential: retries recover the tracking token and original order. Store only the key hash on the server; never put keys in URLs or logs. Reusing a key with changed details returns `409`. Legacy requests without keys remain supported and are not retry-safe. Keys remain valid for the lifetime of their order record.

Status updates accept `expectedVersion` (a non-negative integer). The staff UI sends the displayed order version; stale concurrent writes return `409` and refresh the listing. Legacy callers that omit the version retain last-write-wins behavior. Browser API calls time out after 10 seconds, including JSON parsing; writes are never automatically retried. If browser storage is blocked, retry protection survives within the open page but cannot be guaranteed after reloading it.

## Local development

1. Use `npm ci` and `npm start` for JSON-backed local development, or set `DATABASE_URL` to use PostgreSQL.
2. To run PostgreSQL with Docker Compose, supply `CLOUDBITE_DB_PASSWORD` and `CLOUDBITE_ADMIN_TOKEN`, then run `docker compose -f docker/compose.yaml -f docker/compose.database.yaml up --build`.
3. Keep any local `.env` file out of Git; `.gitignore` already excludes it.

Never paste local `.env` values into issues, pull requests, commits, screenshots, or chat.

## Kubernetes configuration

Use a ConfigMap for non-sensitive values and a Kubernetes Secret for the PostgreSQL password and staff token. The Deployment and PostgreSQL StatefulSet require `cloudbite-secrets` in the `cloudbite` namespace with keys `postgres-password` and `admin-token`. Create it before deployment; do not commit it.

Example Secret creation for local use:

```bash
kubectl apply -f kubernetes/namespace.yaml
kubectl create secret generic cloudbite-secrets --namespace cloudbite \
  --from-env-file=/path/to/private/cloudbite-secrets.env
```

The private env file must contain `postgres-password=...` and `admin-token=...`. Do not put real passwords or tokens in committed YAML. The PostgreSQL volume claim holds order data across pod replacement; back it up before removing the namespace or volume.

## Pre-commit check

Before committing, inspect staged content and stop if it contains a secret:

```bash
git diff --cached
git status --short
```

The CI secret scanner is a safeguard, not permission to commit credentials. If a secret is committed, revoke or rotate it immediately, remove it from the active branch, and tell the team.
