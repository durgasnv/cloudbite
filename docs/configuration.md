# Configuration and Secrets Guide

CloudBite configuration must be supplied at runtime. Do not hard-code values in application code, Dockerfiles, Kubernetes manifests, or committed environment files.

## Configuration categories

| Category | Examples | Store it in |
| --- | --- | --- |
| Public runtime configuration | `PORT`, `NODE_ENV`, API base URL, logging level | ConfigMap or local `.env` file |
| Sensitive configuration | Database password, JWT secret, API token | Kubernetes Secret or uncommitted local `.env` file |
| Build configuration | Node version, build command | Dockerfile or package configuration |

## Current application variables

The backend reads `PORT` (default `5000`), `ADMIN_TOKEN`, and PostgreSQL connection variables. `dotenv` loads local `.env` values if present. Without PostgreSQL settings, orders use `server/data/orders.json` for local development only. Staff mode stays disabled when `ADMIN_TOKEN` is unset. The former public demo keys are rejected.

| Variable | Consumed by | Sensitive? | Purpose |
| --- | --- | --- | --- |
| `PORT` | Backend | No | Current Express listen port; defaults to `5000`. |
| `ADMIN_TOKEN` | Backend | Yes | Staff API token. Set a strong, private value; `admin123` and `admin-secret-key` are rejected. |
| `DATABASE_URL` | Backend | Yes | PostgreSQL URL. Takes precedence over `PGHOST` settings. |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | Backend | Password is sensitive | PostgreSQL connection when `DATABASE_URL` is unset. |
| `NODE_ENV` | Runtime | No | Node.js environment. |

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
