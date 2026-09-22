# CloudBite Grafana Dashboard

This directory will hold `cloudbite-dashboard.json`, an exportable Grafana dashboard. Keeping the JSON in Git means another team member can import the same dashboard instead of recreating it manually.

## Before importing

1. Prometheus must be running and scraping the CloudBite backend successfully.
2. In Prometheus, confirm the CloudBite target reports `UP`.
3. Add Prometheus as a Grafana data source. Give it a stable name such as `Prometheus`.

If Prometheus has no CloudBite data, dashboard panels will be empty even when Grafana is configured correctly.

## Import procedure

1. Open Grafana.
2. Select **Dashboards** → **New** → **Import**.
3. Upload `cloudbite-dashboard.json` from this directory.
4. Select the Prometheus data source.
5. Save the dashboard.

After modifying a dashboard, export its JSON with the data source represented as a variable or placeholder where possible. Replace `cloudbite-dashboard.json`, review the diff for accidental URLs or tokens, and commit it with a descriptive `monitor:` message.

## Required dashboard signals

The final dashboard should include panels for:

| Signal | What it answers |
| --- | --- |
| Backend availability | Is the Prometheus scrape target up? |
| Request rate | Is the API receiving traffic? |
| Error rate | Are requests failing? |
| Request latency | Are requests getting slower? |
| CPU usage | Are containers using too much CPU? |
| Memory usage | Are containers approaching their memory limit? |
| Container restarts | Is the workload unstable? |

Application request metrics require backend instrumentation. Kubernetes/container metrics may require the chosen Prometheus setup to scrape kubelet or cAdvisor metrics. Confirm the actual metric names before creating queries; do not copy example queries blindly.

## Security rules

* Do not export Grafana API keys, passwords, cookies, or access tokens.
* Do not hard-code an environment-specific Prometheus URL if a Grafana data source variable can be used.
* Do not expose sensitive application labels or request contents in dashboard panels.
