# Configuration and Secrets Guide

CloudBite configuration must be supplied at runtime. Do not hard-code values in application code, Dockerfiles, Kubernetes manifests, or committed environment files.

## Configuration categories

| Category | Examples | Store it in |
| --- | --- | --- |
| Public runtime configuration | `PORT`, `NODE_ENV`, API base URL, logging level | ConfigMap or local `.env` file |
| Sensitive configuration | Database password, JWT secret, API token | Kubernetes Secret or uncommitted local `.env` file |
| Build configuration | Node version, build command | Dockerfile or package configuration |

## Variables to agree with Member 1

The names below are examples, not the final application contract. Confirm the exact names and values before creating deployment manifests.

| Variable | Consumed by | Sensitive? | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | Frontend and backend | No | Selects development or production behavior. |
| `PORT` | Frontend or backend | No | Container listen port. |
| `DATABASE_URL` | Backend | Yes | Database connection string. |
| `DATABASE_USER` | Backend | Usually | Database account name, if separate from URL. |
| `DATABASE_PASSWORD` | Backend | Yes | Database password, if separate from URL. |
| `JWT_SECRET` | Backend | Yes | Future authentication signing secret. |
| `API_BASE_URL` | Frontend | No | Backend API location used by the frontend. |

## Local development

1. Copy `.env.example` to `.env` when the application team provides it.
2. Fill in local, non-production values.
3. Confirm `.env` is covered by `.gitignore`.
4. Start the application using the method documented by Member 1.

Never paste local `.env` values into issues, pull requests, commits, screenshots, or chat.

## Kubernetes configuration

Use a ConfigMap for non-sensitive values and reference it from the appropriate Deployment. Use a Kubernetes Secret for sensitive values. Commit only a template such as `kubernetes/secrets.example.yaml` with empty values or clearly non-working placeholders.

Example Secret creation for local use:

```bash
kubectl create secret generic cloudbite-secrets \
  --namespace cloudbite \
  --from-literal=DATABASE_URL='local-value-not-to-be-committed'
```

Do not put a real `DATABASE_URL`, password, token, or signing key in a YAML file committed to Git.

## Pre-commit check

Before committing, inspect staged content and stop if it contains a secret:

```bash
git diff --cached
git status --short
```

The CI secret scanner is a safeguard, not permission to commit credentials. If a secret is committed, revoke or rotate it immediately, remove it from the active branch, and tell the team.
