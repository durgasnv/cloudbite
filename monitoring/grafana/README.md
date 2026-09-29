# CloudBite Grafana Dashboard

This directory contains the version-controlled `cloudbite-dashboard.json` and Grafana provisioning files. The dashboard is loaded automatically by the Compose and Minikube monitoring stacks described in [the monitoring guide](../README.md).

## What is currently shown

| Panel | Prometheus metric |
| --- | --- |
| Frontend availability | `probe_success` for `/health` |
| Backend availability | `probe_success` for `/api/health` |
| Health probe duration | `probe_duration_seconds` for both endpoints |

These panels use Blackbox Exporter probes. They do not show request rate, errors, CPU, memory, or container restarts yet. Those need application instrumentation or additional cluster metric sources.

## Manual import, if provisioning is not used

1. Open Grafana.
2. Select **Dashboards** → **New** → **Import**.
3. Upload `cloudbite-dashboard.json` from this directory.
4. Select a Prometheus data source with UID `prometheus`, or update the panel data source references.
5. Save the dashboard.

After modifying a dashboard, export its JSON, review the diff for accidental URLs or tokens, and commit it with a descriptive `monitor:` message. Provisioned dashboards are overwritten from the file on restart; make persistent changes in Git.

## Later dashboard signals

After the relevant metrics are available, add panels for:

| Signal | What it answers |
| --- | --- |
| Request rate | Is the API receiving traffic? |
| Error rate | Are requests failing? |
| Request latency | Are requests getting slower? |
| CPU usage | Are containers using too much CPU? |
| Memory usage | Are containers approaching their memory limit? |
| Container restarts | Is the workload unstable? |

Application request metrics require backend instrumentation. Kubernetes/container metrics require an appropriate cluster metric source. Confirm actual metric names before writing queries.

## Security rules

* Do not export Grafana API keys, passwords, cookies, or access tokens.
* Do not hard-code an environment-specific Prometheus URL if a Grafana data source variable can be used.
* Do not expose sensitive application labels or request contents in dashboard panels.
