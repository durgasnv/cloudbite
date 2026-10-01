# CloudBite

CloudBite is a simplified cloud-native food delivery application that demonstrates a secure DevSecOps software delivery lifecycle. Users can browse restaurants and menus, manage a cart, and simulate placing an order.

The project addresses a common software-delivery problem: security checks are often performed only near the end of development, when vulnerabilities are more expensive to fix. The Jenkins pipeline now defines automated tests, syntax and SonarQube analysis, secret detection, dependency auditing, and container-image scanning. A failed gate stops deployment.

Successful `main` builds are configured to deploy the two scanned images to Minikube. Prometheus and Grafana provide endpoint-health monitoring. These services still require a configured Jenkins/Minikube environment; live deployment has not been verified here. The setup and current limitations are recorded in [the CI/CD integration guide](docs/ci-cd-integration.md) and [monitoring guide](monitoring/README.md).
