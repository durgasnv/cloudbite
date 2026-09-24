# CloudBite

## Secure DevSecOps Pipeline for a Cloud-Native Food Delivery Application

---

## 1. Project Overview

CloudBite is a simplified food delivery web application inspired by platforms such as Zomato. The application allows users to browse restaurants, view menus, add food items to a cart, and simulate placing an order.

The primary focus of the project is not to recreate a complete food delivery platform, but to demonstrate how a real-world application can be developed, tested, secured, containerized, deployed, and monitored using DevSecOps practices.

Security is integrated throughout the software development lifecycle rather than being performed only after deployment.

The project will implement an automated CI/CD pipeline that performs application testing, code quality analysis, security scanning, containerization, and deployment.

---

## 2. Problem Statement

Traditional software development workflows often treat security as a final step before deployment. This can result in vulnerabilities being discovered late in the development lifecycle, increasing the cost and effort required to fix them.

The goal of CloudBite is to demonstrate a secure and automated software delivery process in which security checks are integrated into the CI/CD pipeline.

The system should:

* Automatically build and test application changes.
* Detect code quality issues.
* Identify vulnerable dependencies.
* Detect accidentally committed secrets.
* Scan Docker images for vulnerabilities.
* Prevent insecure builds from being deployed.
* Deploy successful builds using containers and Kubernetes.
* Monitor the deployed application.

---

## 3. Project Objectives

The main objectives are:

1. Develop a simplified food delivery application.
2. Implement REST APIs for application functionality.
3. Store application data in a database.
4. Use GitHub for source code management.
5. Implement a CI/CD pipeline using Jenkins.
6. Integrate automated testing into the pipeline.
7. Integrate code quality analysis.
8. Perform dependency and security scanning.
9. Detect exposed secrets in source code.
10. Containerize the application using Docker.
11. Scan Docker images for vulnerabilities.
12. Deploy the application using Kubernetes.
13. Monitor the application using Prometheus and Grafana.
14. Demonstrate that critical security issues can block deployment.

---

# 4. Project Scope

## 4.1 Application Scope

The application will provide a simplified food ordering experience.

Users should be able to:

* View available restaurants.
* View restaurant details.
* View food items available at a restaurant.
* Add food items to a cart.
* Update cart quantities.
* Remove items from the cart.
* View the total cart amount.
* Proceed to checkout.
* Simulate placing an order.
* View order confirmation.
* View order status.

The application will not implement real-world food delivery operations.

The following features are outside the initial scope:

* Real payment processing.
* Real-time delivery tracking.
* Delivery partner management.
* GPS-based tracking.
* Restaurant owner dashboards.
* Real restaurant integration.
* Real payment gateway integration.
* Production-level recommendation systems.

The order process will be simulated.

Example:

```text
Browse Restaurant
       ↓
View Menu
       ↓
Add Items to Cart
       ↓
Review Cart
       ↓
Checkout
       ↓
Simulated Order Creation
       ↓
Order Confirmation
```

---

# 5. Functional Requirements

## FR-01: Restaurant Listing

The system shall allow users to view a list of available restaurants.

Each restaurant may contain:

* Restaurant ID
* Restaurant name
* Description
* Location
* Cuisine type
* Rating
* Image

---

## FR-02: Restaurant Details

The system shall allow users to select a restaurant and view its details.

---

## FR-03: Menu Display

The system shall allow users to view food items available at a selected restaurant.

Each food item may contain:

* Food ID
* Food name
* Description
* Price
* Category
* Availability
* Image

---

## FR-04: Add Food to Cart

The system shall allow users to add available food items to a cart.

---

## FR-05: Update Cart

The system shall allow users to:

* Increase item quantity.
* Decrease item quantity.
* Remove items.
* View the updated total.

---

## FR-06: Checkout

The system shall provide a checkout interface displaying:

* Selected items.
* Quantities.
* Individual prices.
* Total amount.

---

## FR-07: Simulated Order Placement

The system shall allow users to simulate placing an order.

The system shall:

1. Validate the cart.
2. Create an order record.
3. Generate an order ID.
4. Store the order in the database.
5. Set an initial order status.

Example:

```text
Order ID: ORD1025
Status: CONFIRMED
```

---

## FR-08: Order Status

The system shall allow users to view the status of a simulated order.

Possible statuses:

* CONFIRMED
* PREPARING
* READY
* COMPLETED
* CANCELLED

---

## FR-09: REST APIs

The backend shall expose REST APIs for core application functionality.

Example APIs:

```text
GET    /api/restaurants
GET    /api/restaurants/:id
GET    /api/restaurants/:id/menu

POST   /api/cart
PUT    /api/cart/:id
DELETE /api/cart/:id

POST   /api/orders
GET    /api/orders/:id
```

The exact API structure may be modified during implementation.

---

# 6. Non-Functional Requirements

## NFR-01: Security

Security checks shall be integrated into the CI/CD lifecycle.

The pipeline should identify:

* Vulnerable dependencies.
* Code quality and security issues.
* Exposed secrets.
* Vulnerable Docker images.

Critical security issues should prevent deployment.

---

## NFR-02: Automation

The CI/CD pipeline should automatically execute when new code is pushed to the repository or when a pull request is created.

---

## NFR-03: Reliability

The application should remain available after successful deployment.

Kubernetes should be configured to restart failed application containers where applicable.

---

## NFR-04: Scalability

The application should be designed to support multiple container replicas through Kubernetes.

---

## NFR-05: Maintainability

The project should follow a modular structure.

Application code, CI/CD configuration, security configuration, Kubernetes manifests, and monitoring configuration should be maintained separately.

---

## NFR-06: Version Control

All source code and configuration files should be maintained in GitHub.

Sensitive information such as passwords, tokens, API keys, and database credentials shall not be committed to the repository.

---

# 7. DevSecOps Requirements

The project shall implement security throughout the CI/CD pipeline.

The proposed pipeline is:

```text
Developer
    ↓
GitHub
    ↓
Jenkins
    ↓
Checkout Source Code
    ↓
Install Dependencies
    ↓
Run Automated Tests
    ↓
Code Quality Analysis
    ↓
Secret Scanning
    ↓
Dependency Vulnerability Scanning
    ↓
Build Docker Image
    ↓
Docker Image Vulnerability Scan
    ↓
Security Gate
    ↓
    ├── FAIL → Stop Pipeline
    │
    └── PASS → Continue
                   ↓
              Deploy to Kubernetes
                   ↓
              Monitor Application
```

---

# 8. CI/CD Requirements

The Jenkins pipeline should contain the following stages:

## Stage 1: Source Checkout

Retrieve the latest source code from GitHub.

## Stage 2: Dependency Installation

Install required application dependencies.

## Stage 3: Automated Testing

Run automated tests.

The pipeline should fail if critical tests fail.

## Stage 4: Code Quality Analysis

Analyze source code using a tool such as SonarQube.

## Stage 5: Secret Scanning

Check the source code for accidentally committed secrets.

## Stage 6: Dependency Scanning

Identify known vulnerabilities in application dependencies.

## Stage 7: Docker Image Build

Build the application Docker image.

## Stage 8: Container Security Scan

Scan the Docker image for known vulnerabilities.

## Stage 9: Security Gate

Evaluate security scan results.

If critical vulnerabilities are detected, the pipeline should fail and prevent deployment.

## Stage 10: Deployment

If all required checks pass, deploy the application to Kubernetes.

---

# 9. Containerization Requirements

The application shall be containerized using Docker.

At minimum, the project should provide Docker configuration for:

* Frontend.
* Backend.

The database may be containerized for local development.

The Docker images should:

* Use appropriate base images.
* Avoid unnecessary packages.
* Use environment variables for configuration.
* Avoid storing secrets inside images.
* Be scanned for vulnerabilities before deployment.

---

# 10. Kubernetes Requirements

The application shall be deployed using Kubernetes.

The Kubernetes configuration should include, where applicable:

* Frontend Deployment.
* Frontend Service.
* Backend Deployment.
* Backend Service.
* Database configuration.

The deployment should support:

* Container health checks where applicable.
* Restarting failed containers.
* Multiple replicas for scalable components.
* Environment-based configuration.

The initial Kubernetes deployment may use Minikube for local development.

---

# 11. Monitoring Requirements

The deployed application shall be monitored using Prometheus and Grafana.

The monitoring system should provide information such as:

* Application health.
* CPU usage.
* Memory usage.
* Request metrics where available.
* Container restarts.
* Application availability.

Grafana dashboards should be created to visualize collected metrics.

---

# 12. Security Failure Demonstration

The project should include a demonstration of the security gate.

The team should demonstrate the following scenario:

```text
Developer introduces vulnerable dependency
              ↓
Code pushed to GitHub
              ↓
Jenkins Pipeline Triggered
              ↓
Security Scan
              ↓
Critical Vulnerability Detected
              ↓
Pipeline Fails
              ↓
Deployment Blocked
```

The team should then fix the vulnerability and demonstrate:

```text
Vulnerability Fixed
        ↓
Code Pushed
        ↓
Pipeline Runs
        ↓
Security Checks Pass
        ↓
Docker Image Built
        ↓
Kubernetes Deployment
        ↓
Application Available
```

This demonstration is a key feature of the DevSecOps implementation.

---

# 13. Technology Stack

## Application

* Frontend: React or HTML/CSS/JavaScript
* Backend: Node.js and Express.js
* Database: MongoDB or PostgreSQL
* API Testing: Postman

## Version Control

* Git
* GitHub

## CI/CD

* Jenkins

## DevSecOps

* SonarQube Community Edition
* Trivy
* Gitleaks or equivalent secret scanning tool
* Dependency vulnerability scanning

## Containerization

* Docker
* Docker Compose (optional for local development)

## Container Orchestration

* Kubernetes
* Minikube for local development
* kubectl

## Monitoring

* Prometheus
* Grafana

---

# 14. Team Responsibilities

## Member 1: Application Development

Responsibilities:

* Frontend development.
* Backend REST APIs.
* Database integration.
* Restaurant and menu functionality.
* Cart functionality.
* Simulated order functionality.
* Application testing.

Primary directories:

```text
frontend/
backend/
database/
```

---

## Member 2: CI/CD and DevSecOps

Responsibilities:

* Jenkins setup.
* CI/CD pipeline.
* Automated testing integration.
* SonarQube integration.
* Secret scanning.
* Dependency vulnerability scanning.
* Security gates.
* Pipeline failure handling.

Primary directories:

```text
jenkins/
security/
```

---

## Member 3: Containerization, Deployment and Monitoring

Responsibilities:

* Docker configuration.
* Docker image creation.
* Kubernetes deployment.
* Kubernetes services.
* Application scaling.
* Prometheus configuration.
* Grafana dashboards.
* Container monitoring.

Primary directories:

```text
docker/
kubernetes/
monitoring/
```

---

# 15. Repository Structure

The proposed repository structure is:

```text
CloudBite/
│
├── frontend/
│
├── backend/
│
├── database/
│
├── docker/
│
├── jenkins/
│   └── Jenkinsfile
│
├── security/
│
├── kubernetes/
│
├── monitoring/
│   ├── prometheus/
│   └── grafana/
│
├── tests/
│
├── .gitignore
├── .env.example
├── README.md
└── requirements.md
```

---

# 16. Development Environment

The initial development environment shall use local systems.

Cloud deployment is not required for the initial implementation.

The project can use:

```text
Developer Laptop
      ↓
GitHub
      ↓
Jenkins
      ↓
Docker
      ↓
Minikube Kubernetes
      ↓
Prometheus
      ↓
Grafana
```

Cloud deployment may be considered as an optional future enhancement.

---

# 17. Git and Collaboration Requirements

The team shall use GitHub for source code management.

The team should use feature branches.

Example:

```text
main
│
├── feature/frontend
├── feature/backend
├── feature/cart
├── feature/ci-cd
├── feature/security
├── feature/docker
└── feature/kubernetes
```

Changes should be merged into the main branch through pull requests where possible.

The team should maintain meaningful commit messages.

Example:

```text
feat: add restaurant listing API
feat: implement cart functionality
ci: add Jenkins pipeline
security: add Trivy container scanning
deploy: add Kubernetes backend deployment
monitor: add Grafana dashboard
```

---

# 18. Environment and Secrets Management

Sensitive information shall not be stored directly in source code.

The following information should not be committed to GitHub:

* Database passwords.
* Authentication secrets.
* API keys.
* Access tokens.
* Cloud credentials.

A `.env.example` file should be provided as a template.

Example:

```text
DATABASE_URL=
DATABASE_USER=
DATABASE_PASSWORD=
JWT_SECRET=
```

Actual values should be provided through environment variables or appropriate secret management mechanisms.

---

# 19. Testing Requirements

The project should include:

### Unit Testing

Test individual backend functions and components.

### API Testing

Test REST APIs for:

* Valid requests.
* Invalid requests.
* Missing fields.
* Incorrect data.
* Error responses.

### Integration Testing

Test interactions between:

* Backend and database.
* Frontend and backend.

### CI Testing

Automated tests should execute as part of the Jenkins pipeline.

The pipeline should fail when critical tests fail.

---

# 20. Project Success Criteria

The project will be considered successful when:

* [ ] Users can browse restaurants.
* [ ] Users can view restaurant menus.
* [ ] Users can add food items to a cart.
* [ ] Users can update and remove cart items.
* [ ] Users can simulate placing an order.
* [ ] Orders are stored in the database.
* [ ] Application code is stored in GitHub.
* [ ] Jenkins automatically executes the CI/CD pipeline.
* [ ] Automated tests run successfully.
* [ ] Code quality checks are performed.
* [ ] Security scanning is integrated.
* [ ] Secret scanning is performed.
* [ ] Docker images are built automatically.
* [ ] Docker images are scanned for vulnerabilities.
* [ ] Critical vulnerabilities can block deployment.
* [ ] Application is deployed using Kubernetes.
* [ ] Application health is monitored.
* [ ] Prometheus collects metrics.
* [ ] Grafana displays monitoring information.
* [ ] The team can demonstrate both a failed security pipeline and a successful deployment.

---

# 21. Future Enhancements

The following features may be considered after completing the core project:

* Automatic rollback after failed deployments.
* Blue-green deployment.
* Canary deployment.
* Cloud deployment using AWS, Azure, or GCP.
* Infrastructure as Code using Terraform.
* Authentication and role-based access control.
* Real-time order status.
* Horizontal Pod Autoscaling.
* Slack or email deployment notifications.
* Centralized logging.
* AI-assisted incident analysis.
* Deployment dashboard.

These features are optional and should only be implemented after the core DevSecOps pipeline is stable.

---

# 22. Minimum Viable Project

The minimum viable version of the project should contain:

```text
Food Delivery Application
        ↓
GitHub
        ↓
Jenkins
        ↓
Automated Tests
        ↓
Security Scanning
        ↓
Docker
        ↓
Kubernetes
        ↓
Prometheus + Grafana
```

The team should prioritize completing this end-to-end workflow before implementing advanced features.

---

# 23. Final Project Demonstration

The final demonstration should show the complete software delivery lifecycle.

### Demonstration Flow

```text
1. User browses restaurant
2. User views menu
3. User adds food to cart
4. User simulates an order
5. Developer makes a code change
6. Code is pushed to GitHub
7. Jenkins pipeline starts automatically
8. Automated tests run
9. Code quality checks run
10. Security scans run
11. Docker image is created
12. Docker image is scanned
13. Security gate evaluates results
14. Successful build is deployed to Kubernetes
15. Application is monitored using Prometheus
16. Metrics are visualized in Grafana
```

The team should also demonstrate a failed security scenario where a vulnerability is detected and deployment is blocked.

---

# 24. Expected Outcome

The final system should demonstrate how a simplified food delivery application can move from development to deployment through an automated and security-focused software delivery pipeline.

The project should showcase the integration of:

```text
Development
    +
Security
    +
Continuous Integration
    +
Continuous Delivery
    +
Containerization
    +
Container Orchestration
    +
Monitoring
```

The primary outcome is a working demonstration of DevSecOps principles in which security is integrated throughout the application's lifecycle and insecure builds are prevented from reaching the deployment environment.
