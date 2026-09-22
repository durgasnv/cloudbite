# CloudBite

CloudBite is a simplified cloud-native food delivery application that demonstrates a secure DevSecOps software delivery lifecycle. Users can browse restaurants and menus, manage a cart, and simulate placing an order.

The project addresses a common software-delivery problem: security checks are often performed only near the end of development, when vulnerabilities are more expensive to fix. CloudBite integrates automated testing, code-quality checks, secret detection, dependency scanning, and container-image scanning into its CI/CD pipeline so that critical security issues block deployment.

Successful builds are containerized, deployed to Kubernetes, and monitored with Prometheus and Grafana. The goal is an end-to-end demonstration of developing, securing, deploying, and monitoring a small real-world-style application.
