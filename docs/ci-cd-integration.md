# CI/CD Integration Guide

The `Jenkinsfile` runs the CloudBite checks in order and stops on a failed command. A passing feature-branch or pull-request build does **not** deploy. Only a successful `main` build in a Jenkins Multibranch Pipeline reaches the Minikube deployment stage. Configure branch and pull-request discovery and a GitHub webhook in Jenkins; SCM polling is a fallback for branch changes.

## Pipeline stages

| Stage | Gate |
| --- | --- |
| Checkout, install, syntax check, tests | `checkout scm`, `npm ci`, `npm run check`, `npm test` |
| SonarQube analysis and quality gate | The scanner submits an analysis; Jenkins waits for the server's result and fails on a rejected gate or timeout. |
| Secret and dependency scans | Gitleaks scans Git history; `npm audit` fails on high or critical findings. |
| Build and scan both images | Docker builds unique `BUILD_NUMBER` tags; Trivy fails on high or critical image vulnerabilities. |
| Deploy to Minikube | `main` only; load those exact scanned tags, apply Kubernetes resources, and wait for both rollouts. |

All required tools are invoked directly. A missing scanner or unavailable service fails the build; no stage silently skips a required check. The Trivy database must be reachable or pre-cached on the agent. Image tags identify a Jenkins build, but are local Minikube images rather than registry artifacts.

## Jenkins setup

Use a Linux agent labelled `cloudbite-release` with Node.js 20+, npm, Docker daemon access, Gitleaks, Trivy, Minikube, kubectl, and Bash. Docker and Minikube must address the same local image store/cluster; a remote Docker daemon or separate Minikube host needs a registry-based design instead. Give the agent only the cluster access required for the `cloudbite` namespace and image loading. Do not store tokens, kubeconfig, or passwords in Git.

The deployment script uses `minikube` from `PATH` by default. For a non-system installation, set `MINIKUBE_BIN` to an executable path available to the Jenkins agent. The local cluster's kubeconfig must refer to that same Minikube profile.

Install the SonarQube Scanner for Jenkins plugin and configure:

1. A SonarQube server installation named `SonarQube`, with its token in Jenkins credentials.
2. A SonarScanner tool installation named `SonarScanner`.
3. A SonarQube webhook to `https://<jenkins-host>/sonarqube-webhook/` (trailing slash required), so `waitForQualityGate` receives the result. Configure a webhook secret if appropriate.
4. A SonarQube project matching `sonar-project.properties` and a quality gate that rejects the issues your team intends to block.
5. A Jenkins Secret file credential named `cloudbite-kubeconfig`. The file must work from the release agent; Minikube kubeconfigs often contain local certificate paths, so bundle/access those securely or use a service-account-based config. Do not commit the file.

Use a Multibranch Pipeline for `when { branch 'main' }`; a standalone Pipeline job does not provide the same branch condition. Only grant the deploy credential to trusted branches/jobs. A pull request from an untrusted fork must not have access to Docker daemon or deployment credentials; isolate PR checks on an unprivileged agent before enabling fork builds.

## Local checks

From the repository root, run:

```bash
npm ci
npm run check
npm test
npm audit --audit-level=high
gitleaks git --redact --exit-code 1 .
docker build -f docker/backend.Dockerfile -t cloudbite-backend:local .
docker build -f docker/frontend.Dockerfile -t cloudbite-frontend:local .
trivy image --scanners vuln --severity HIGH,CRITICAL --exit-code 1 cloudbite-backend:local
trivy image --scanners vuln --severity HIGH,CRITICAL --exit-code 1 cloudbite-frontend:local
```

SonarQube and deployment need configured services. For a safe failure demonstration, use a disposable branch and introduce a known vulnerable *test-only* dependency in that branch, push it, and show the dependency scan failing before image build/deployment. Remove or upgrade it in a follow-up commit and show the gate passing. Never publish a real secret as a demonstration; use a synthetic scanner fixture outside repository history if testing Gitleaks locally. Retain Jenkins build links/screenshots as evidence, with any sensitive output redacted.

## Current limits

The pipeline is defined in source but cannot be called operational until a configured Jenkins release agent, SonarQube, scanners, and the Minikube cluster run it successfully. The backend still stores orders in a pod-local JSON file; rollout replacement can lose orders. Database-backed persistence and native request metrics require application work outside the current infrastructure-only scope. Monitoring deployment remains a separate operator step because it needs a Grafana admin credential; its Kubernetes setup includes replica and restart metrics. See [monitoring setup](../monitoring/README.md).

On 2026-10-02, both Docker images built locally, the backend image contained no local orders, the application Deployments reached 1/1 backend and 2/2 frontend Ready in Minikube, all four Prometheus targets were `UP`, and Grafana's health endpoint responded. This verifies the Member 3 local path, **not** a Jenkins run. The current Jenkins service account is not in the Docker socket's group, has no installed `minikube` command, and cannot read the local user's kubeconfig. Configure a dedicated `cloudbite-release` agent with the required tools and tightly scoped access; do not treat the Jenkins controller's Docker socket access as a routine fix.

The newly integrated frontend/API branch accepts a hard-coded demo admin key and allows order lookup by sequential ID. Secret scanners do not establish that this access model is secure. Treat a live deployment as blocked until the application owner replaces the demo access path and limits customer data exposure. `.dockerignore` now keeps local order records out of the backend image, but it does not make pod-local order storage durable.

`test/security-contract.test.js` is an intentional fail-closed regression test: it rejects the public `admin123` key and the fallback `admin-secret-key` as staff credentials, even when a different `ADMIN_TOKEN` is configured. With the current application code, `npm test` and Jenkins are expected to fail at this test. Member 1 should remove the demo/fallback acceptance and update the UI/help text; do not weaken or skip the test just to obtain a green build.
