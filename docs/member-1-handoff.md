# Member 1 application handoff

This is a recommendation and integration checklist for the application owner, not an implementation plan for Members 2 or 3. It reflects the code currently in `client/`, `server/`, and the deployed container contract. Agree on API and database changes with the team before changing the manifests or pipeline.

## Priorities

| Priority | Change for Member 1 | Why it matters / acceptance check |
| --- | --- | --- |
| 1 | Replace `server/data/orders.json` with a database-backed order repository. Choose the database with the team, add schema/migrations and a repeatable seed, and keep credentials in runtime environment variables. | Orders survive a backend pod replacement; concurrent orders do not overwrite one another or reuse an ID. The backend can then be considered for more than one replica. |
| 1 | Treat checkout fields from `client/js/cart.js` as untrusted. Resolve item IDs against the server-side menu, check availability and positive integer quantities, calculate prices and fees on the server, and return the authoritative total. | A request with a forged price, total, unknown item, or invalid quantity is rejected or priced correctly; no negative/`NaN` total can be stored. |
| 1 | Protect order reads and status changes. `GET /api/orders` currently returns customer names, phones, and addresses, while `PATCH /api/orders/:id/status` is unauthenticated and accepts extra statuses (`Placed`, `Delivered`) beyond the requirements. | An unauthenticated user cannot list other customers' data or change an order's status; the five documented status values are enforced consistently. Decide whether a public demo needs a limited, non-personal order lookup instead. |
| 2 | Add request metrics to the Express backend, exposing a Prometheus-format `/metrics` route. Count requests by normalized route, method, and status; record latency without customer IDs, paths containing IDs, or other high-cardinality/PII labels. | Prometheus can scrape the route; test traffic produces request-rate, error-rate, and latency series. Keep `/api/health` lightweight and unauthenticated for existing probes. |
| 2 | Expand automated tests for the application contract and failure cases. Include restaurant/menu lookups, order validation, persistence across process restart, concurrent orders, missing database, and status authorization. | `npm test` catches a broken API or unsafe checkout before the Jenkins security stages. Tests use disposable data and do not mutate the committed JSON fixtures. |
| 2 | Reconcile the two package manifests. Jenkins and `docker/backend.Dockerfile` install from the root `package.json`/`package-lock.json`, while `server/package.json` declares a different Express version. | One supported dependency source is documented, lockfile changes are committed, and local, CI, and container installs resolve the same runtime dependencies. |
| 3 | Review browser rendering and cross-origin settings. Cart data is stored in `localStorage` and inserted into HTML in `client/js/cart.js`; `server/server.js` currently allows CORS from any origin and returns raw error messages. | Untrusted text is rendered safely; production CORS is limited to the intended origin or omitted for same-origin traffic; internal errors do not leak details to clients. |

## Interfaces to preserve or announce

* The frontend calls relative `/api` URLs. NGINX proxies them to the backend Service; do not require a browser-visible Kubernetes DNS name.
* The backend listens on `PORT` (default `5000`) and exposes `GET /api/health`. The current Kubernetes readiness/liveness probes and Blackbox Exporter depend on that route.
* The current frontend expects the existing restaurant, menu, order-create, order-list, and order-status response shapes. If an endpoint becomes protected or changes shape, update the frontend and tests in the same change, and notify Members 2 and 3.
* Tell Member 3 the chosen database, required environment variable names, secret keys, port, readiness behavior, and whether migrations run before startup. Member 3 can then add Compose/Kubernetes database configuration and persistence safely.
* Tell Member 3 the exact `/metrics` path and port once implemented. The monitoring configuration must not claim request-rate/error-rate data until that scrape target exists.
* Tell Member 2 about new packages, migration commands, and integration tests so the Jenkins install/test stages and SonarQube scope remain accurate. Do not bypass a failing security gate to make the release pass.

## Data and completion evidence

The repository already has six sample restaurants and 28 menu items in `server/data/`; no external dataset is required for the demo. Use synthetic, non-personal records for database seeds and tests. Do not commit real customer details or credentials. `server/data/orders.json` is currently empty and is not a durable order store.

For each application change, run `npm run check`, `npm test`, and the relevant container/API smoke test, then commit that logical change. Before considering the database work complete, recreate the backend container or pod and verify that an order remains retrievable. Before considering metrics complete, confirm the Prometheus target is `UP` and the expected series appear after test requests.
