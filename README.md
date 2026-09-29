# CloudBite

CloudBite is a simplified cloud-native food delivery application that demonstrates a secure DevSecOps software delivery lifecycle. Users can browse restaurants and menus, manage a cart, and simulate placing an order.

The project addresses a common software-delivery problem: security checks are often performed only near the end of development, when vulnerabilities are more expensive to fix. CloudBite currently runs automated tests, syntax checks, and dependency auditing in CI. The planned pipeline adds secret detection, deeper code analysis, and container-image scanning so that critical security issues block deployment.

The planned release workflow will containerize successful builds, deploy them to Kubernetes, and monitor them with Prometheus and Grafana. The goal is an end-to-end demonstration of developing, securing, deploying, and monitoring a small real-world-style application. The current CI stages and remaining release work are recorded in [the CI/CD integration guide](docs/ci-cd-integration.md).
