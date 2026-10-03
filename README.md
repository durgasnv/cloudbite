# CloudBite

For the complete explanation of the application, Jenkins pipeline, Docker/Minikube/Kubernetes deployment, monitoring, access URLs, and feature flows, see [How CloudBite runs](docs/how-cloudbite-runs.md).

CloudBite is a simplified cloud-native food delivery application that demonstrates a secure DevSecOps software delivery lifecycle. Users can browse restaurants and menus, manage a cart, and simulate placing an order.

The project addresses a common software-delivery problem: security checks are often performed only near the end of development, when vulnerabilities are more expensive to fix. The Jenkins pipeline now defines automated tests, syntax and SonarQube analysis, secret detection, dependency auditing, and container-image scanning. A failed gate stops deployment.

Successful `main` builds are configured to deploy the two scanned images to Minikube. Prometheus and Grafana provide endpoint-health monitoring. The monitoring stack was verified locally on 2026-10-02, and the PostgreSQL-backed application deployment was verified on 2026-10-03; the Jenkins-to-Minikube release path is not yet verified. The setup and current limitations are recorded in [the CI/CD integration guide](docs/ci-cd-integration.md) and [monitoring guide](monitoring/README.md).

Restaurant feeds can be filtered by city. Staff order access requires a configured `ADMIN_TOKEN`; customer tracking uses a private token returned at checkout. Orders use PostgreSQL when `DATABASE_URL` or `PGHOST` is set, with JSON storage available for local development. See [configuration](docs/configuration.md) and [Kubernetes setup](kubernetes/README.md). Use synthetic customer details for demonstrations; this project does not provide production customer accounts.

The restaurant and menu catalog was generated from the uploaded Zomato metropolitan dataset: 50 restaurants across 13 cities and 957 menu items. The raw `zomato_dataset.csv` is ignored by Git; [the importer and data notes](docs/zomato-import.md) explain the selection, limitations, and how to regenerate it. These are historical demo records, not live listings or availability.
