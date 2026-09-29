# CI/CD Integration Status

The merged `Jenkinsfile` currently provides a reproducible CI check for the existing Node/Express application. It does not yet deploy CloudBite. The remaining stages depend on the Member 3 container and Kubernetes work and on Jenkins security tools being installed and configured.

## Current pipeline

| Stage | Command or action | Failure behavior |
| --- | --- | --- |
| Source Checkout | `checkout scm` | Stops if Jenkins cannot retrieve the branch. |
| Install Dependencies | `npm ci` at the repository root | Stops if `package-lock.json` is missing or differs from `package.json`. |
| Code Quality | `npm run check` | Stops on JavaScript syntax errors. This is a baseline check, not SonarQube analysis. |
| Automated Tests | `npm test` | Stops if the API test fails. |
| Dependency Security Scan | `npm audit --audit-level=high` | Stops on high or critical dependency findings. |

The Jenkins agent needs Node.js 20 or newer and npm. The pipeline uses `sh` on Unix agents and `bat` on Windows agents. It polls source control every five minutes; for pull request builds, configure a Jenkins multibranch job and GitHub webhook or branch discovery. A pull request trigger is a Jenkins job setting, not something the Jenkinsfile alone can guarantee.

Run the same checks locally from the repository root:

```bash
npm ci
npm run check
npm test
npm audit --audit-level=high
```

The root `package.json` and `package-lock.json` are the CI install contract. The separate `server/package.json` is not installed by this pipeline; keep dependency changes synchronized or consolidate manifests with the application owner before containerizing the backend.

## Release stages still required by `requirements.md`

The end-to-end requirements call for SonarQube analysis, secret scanning, two Docker image builds, Trivy image scans, a security gate, and Kubernetes deployment. These stages must be added before the pipeline is described as a complete DevSecOps release pipeline.

| Requirement | Dependency to settle before enabling it |
| --- | --- |
| SonarQube quality gate | Jenkins SonarQube installation, scanner, project key, and credentials. |
| Secret scan | Gitleaks or equivalent installed on the Jenkins agent and configured to fail on findings. |
| Frontend/backend image builds | Dockerfiles and the final frontend-to-backend routing contract. |
| Image vulnerability scan | Trivy installed on the Jenkins agent and image tags shared with the build stage. |
| Kubernetes deployment | Complete manifests, image distribution strategy, kubeconfig credentials, and a clear deployment branch policy. |
| Monitoring | A backend Prometheus metrics endpoint plus Prometheus and Grafana resources. |

Do not report a CI success as a deployment success. The release stages should fail closed when a required scanner or deployment prerequisite is missing, and deployment must run only after all required checks pass.

## Current application contract for Member 3

* The root `npm start` command runs `server/server.js`.
* Express listens on `PORT` or port `5000` by default.
* Express serves the static `client/` files and the `/api` routes from one origin.
* `GET /api/health` returns an HTTP 200 health response.
* There is no `/metrics` endpoint yet.
* Restaurant and menu data, and order records, currently use JSON files in `server/data/`; there is no database service yet.

These facts should be used when designing the first Docker image. A separate frontend image will need same-origin `/api` routing through a reverse proxy or an agreed frontend configuration change. JSON order storage is not safe for multiple backend replicas and is not persistent across pod replacement without a shared storage design.
