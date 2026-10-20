# CloudBite chaos engineering report

Date: 2026-10-20. Scope: isolated local APIs, frontend JavaScript, JSON storage, and disposable PostgreSQL 16. No deployed services, existing database clusters, or development order files are used by the chaos suite.

## Reproduce

```bash
npm ci
npm run test:chaos
npm run check
node --test test/frontend.test.js test/checkout-recovery.test.js test/backend-regression.test.js test/server.test.js test/security-contract.test.js
```

Node.js 22 was used. The real PostgreSQL test needs `initdb`, `pg_ctl`, and `postgres` in `/usr/lib/postgresql/16/bin`, or set `CHAOS_PG_BIN` to another installation's bin directory. Run as an ordinary user; PostgreSQL refuses initialization as root. If binaries are missing, that test explicitly skips; the other scenarios still run. No containers or external package downloads are required after installing application dependencies. The restricted coding sandbox requires escalation to allow local socket listeners; ordinary local execution needs no privileged ports or firewall changes. Allow several minutes on a slow mounted workspace.

To reproduce the original defects separately, without reverting the working tree:

```bash
CHAOS_BASELINE_REF=28f81dde6e80 node --test scripts/chaos/baseline.js
```

This diagnostic test expects the original bugs. It copies committed backend source into a temporary directory, uses synthetic orders, and deletes the snapshot afterward. Its assertions are intentionally different from the fixed-behavior suite. The reference is the committed baseline, not a claim that every existing uncommitted change was tested before modification.

## Isolation and methodology

- Every scenario gets a unique `cloudbite-chaos-*` directory under the operating system temporary directory. Server processes receive an explicit environment whitelist and use that temporary directory as their working directory, preventing repository `.env` loading and inherited real database credentials.
- API servers and HTTP fault proxies bind only to `127.0.0.1` on ephemeral ports. A TCP blackhole accepts but never completes the PostgreSQL handshake. The real PostgreSQL cluster has TCP disabled and uses a private Unix socket in the temporary directory.
- Test-only IPC injection in `scripts/chaos/server-fixture.js` pauses operations before persistence or after persistence but before the HTTP response. Production code exposes no chaos endpoint or fault flag.
- Tests inspect persisted JSON or authenticated database-backed API records, order IDs, tracking access, version counters, and record counts. They check rejected writes do not mutate records and that committed orders remain retrievable after recovery.
- Client submit events, malformed responses, and timeout handling execute the actual frontend scripts in a Node VM with a small DOM/storage adapter. These are handler-level tests, not a full browser or visual accessibility test. Network and database failures use real local sockets and processes.
- Temporary child servers, proxies, timers, database processes, and directories are cleaned up. An initial cleanup-order defect deleted a disposable cluster's directory before stopping it; the owned process was stopped and cleanup now stops all servers and the cluster before deleting files. An initial 8-second fixture startup deadline was increased to 60 seconds after dependency loading took approximately 14 seconds on this mounted workspace. Neither harness failure is treated as an application result.
- The older frontend integration suite previously wrote to `server/data/orders.json` and restored it. It now uses its own temporary order file so the supplied regression command also isolates checkout writes.

## Results

All 12 chaos tests passed with no skips in 318.5 seconds, covering all ten requested scenarios plus both JSON restart boundaries and real PostgreSQL recovery. All 43 application regression tests passed with no skips in 7.6 seconds. The original-baseline diagnostic also passed by reproducing its three expected defects. Evidence: [chaos run](docs/chaos-evidence/chaos.tap), [original-baseline reproduction](docs/chaos-evidence/baseline.tap), and [application regressions](docs/chaos-evidence/regression.tap). [JavaScript syntax checks](docs/chaos-evidence/syntax.txt) passed for 25 files; both Compose manifests and the backend Deployment parsed successfully as YAML. Scenario names in `test/chaos.test.js` are stable and can be selected with Node's `--test-name-pattern` option.

### 1. API response delays of 5–30 seconds

**Prediction:** responses within the deadline should render normally; a response exceeding the client deadline should release loading controls, preserve the cart, and offer retry. A timeout must not imply a write failed to commit.

**Execution:** three loopback proxies buffer real `/api/menu` responses for 5, 15, and 30 seconds concurrently. The real client timeout path is also exercised with an abort-aware stalled fetch and a shortened timer so the deadline assertion does not add another 10-second wait.

**Actual:** real menu responses completed after 5,119 ms, 16,027 ms, and 31,041 ms, all HTTP 200 with catalog arrays. The client abort test restored the checkout button, retained its cart, and displayed an error. The real long responses use a test client with a 35-second deadline; they do not establish that the production browser waits 30 seconds.

**Handling and recovery:** shared frontend requests now bound both fetch and JSON body consumption to 10 seconds. No write is automatically retried. Removing proxy delay restores immediate requests; a valid confirmation after timeout completes checkout. No orders were written by the read-only delay test.

### 2. Sudden network disconnection

**Prediction:** a dropped response after commit creates an uncertain outcome. Retrying the same attempt should recover the committed order, not place another.

**Execution:** a real HTTP proxy forwards checkout, receives the completed upstream response, and destroys the downstream socket. Retry through the same proxy after clearing the fault.

**Actual:** the client request failed while exactly one order existed on disk. Retrying with the same checkout key returned that order and a valid tracking token; persisted count remained one.

**Handling and recovery:** persistent key hashes and request fingerprints make retries recoverable. The frontend retains its cart and attempt key after failure and explains that confirmation was not received. A recovered token successfully fetched the order. The offline-before-response handler path is also covered by scenario 5.

### 3. Database connection failures

**Prediction:** unavailable storage should return a bounded `503`, keep process liveness healthy, refuse order creation, and recover without silently changing storage backends.

**Execution:** connect the real pg driver to a loopback TCP blackhole and then to the same closed port. Separately initialize a new PostgreSQL cluster, commit an order, stop the cluster with `pg_ctl -m immediate`, exercise the API during the outage, and restart the same cluster while keeping the backend alive.

**Actual:** hanging/refused connections returned `503` within the asserted three-second bound with `DB_TIMEOUT_MS=300`. `/api/health` returned `503`; `/api/live` remained `200`. The real PostgreSQL outage rejected checkout; after restart, the same backend returned healthy readiness and the acknowledged pre-outage order remained accessible. PostgreSQL mode created no JSON spillover file. Retrying the rejected attempt succeeded after recovery.

**Handling and recovery:** pg connection, query, and server statement deadlines default to 3 seconds; idle pool errors are handled. Storage errors are sanitized to `503`. Kubernetes liveness now uses `/api/live`, retaining dependency-aware readiness on `/api/health`. Cluster restart recovery was executed locally; no Kubernetes deployment was changed or exercised.

### 4. Duplicate API requests

**Prediction:** concurrent identical checkout attempts with the same key should create one order; a changed payload using that key should fail explicitly.

**Execution:** send 20 concurrent JSON-backed POSTs with the same `Idempotency-Key`. Also send 12 retries through two independent backends connected to the disposable PostgreSQL cluster.

**Actual:** each set returned a single order identity; JSON responses also shared the same recovered tracking token. JSON persisted count was one. Changed customer details with the same key returned `409` without changing the count; an independent key created a separate order. PostgreSQL persisted one order for its retry group across replicas.

**Handling and recovery:** JSON checks keys inside its serialized mutation queue. PostgreSQL uses a unique index on the persisted key hash plus conflict handling. Early replay bypasses current catalog validation for an already confirmed attempt. Only key hashes and fingerprints are stored, and internal hashes are omitted from API responses.

### 5. Rapid repeated button clicks

**Prediction:** while checkout is pending, extra submit events should do nothing; a failed attempt should unlock retry and retain its key.

**Execution:** invoke the actual checkout handler 20 times before resolving its dependency, reject the one request as offline, then submit a successful retry.

**Actual:** only one fetch started. Failure retained the cart and enabled the button. Retry sent the identical nonempty key, showed confirmation, and kept further submissions disabled.

**Handling and recovery:** an in-flight guard complements the disabled button. A random UUID identifies the attempt and is retained in memory plus localStorage when available. Confirmation clears the stored pending attempt. The test checks handler invocations rather than physical mouse automation.

### 6. Expired authentication tokens

**Prediction:** an expired staff credential should neither expose orders nor mutate status. Fresh credentials should restore authorized access without changing order history.

**Execution:** create an order, restart the isolated backend with the same staff token and a past `ADMIN_TOKEN_EXPIRES_AT`, attempt listing and status mutation, then rotate the token and configure a future expiry.

**Actual:** expired-token listing returned the existing anonymous contract: HTTP 200, `isAdmin: false`, zero records. Mutation returned `403`; stored status stayed `CONFIRMED`. The rotated unexpired credential listed the existing order.

**Handling and recovery:** optional staff credential expiry is now enforced on every authorization check; invalid expiry configuration fails startup. The application uses static staff credentials, not OAuth/JWT refresh tokens. Unset expiry retains the existing nonexpiring static-token behavior; customer tracking tokens have no expiry mechanism in this change.

### 7. Malformed API responses

**Prediction:** invalid JSON, null bodies, missing confirmation fields, and invalid tracking tokens must not clear carts or claim checkout success.

**Execution:** provide the real frontend handler with null, an empty object, incomplete success objects, an invalid token, and a JSON parsing exception, followed by a valid response for each case.

**Actual:** every invalid response left the cart present, restored the button, and showed an error. Each following valid response completed checkout and rendered the recovered order ID.

**Handling and recovery:** shared requests reject invalid top-level JSON shapes. Checkout additionally validates confirmation ID, finite nonnegative total, and private tracking-token shape before declaring success. Price refresh validates menu records before replacing the cart and keeps refresh failures visible; a separate regression verifies malformed records leave the cart unchanged and a later valid menu refresh updates its price. These tests exercise injected client response bodies; they do not claim every catalog record shape is validated across every page.

### 8. Missing environment variables

**Prediction:** production must fail clearly when persistence configuration is absent; missing staff credentials must fail closed while local customer flows remain usable.

**Execution:** launch a child with `NODE_ENV=production` and neither `DATABASE_URL` nor `PGHOST`. Separately start a development/test fixture with an empty `ADMIN_TOKEN` and isolated JSON storage.

**Actual:** production exited before opening a listener with an explicit database configuration error and wrote no orders. The no-staff-token fixture denied staff access while customer checkout and readiness still worked.

**Handling and recovery:** production cannot silently fall back to a local JSON file. Base Docker Compose explicitly selects development mode for the local JSON demo; its database overlay selects production mode. Supplying proper database configuration is exercised by the real PostgreSQL test. No repository secrets are read by child fixtures.

### 9. Concurrent updates to the same record

**Prediction:** two status updates based on the same record version should not both overwrite the record successfully.

**Execution:** issue simultaneous `PREPARING` and `CANCELLED` updates with `expectedVersion: 0`, first against JSON and then through two PostgreSQL-backed replicas. Refresh the JSON record and retry using its new version.

**Actual:** each pair produced one HTTP 200 and one `409`. The record retained the winning status and version 1. JSON retry with version 1 succeeded and advanced the version to 2. Record count stayed unchanged.

**Handling and recovery:** JSON compares versions inside its mutation queue; PostgreSQL compares and increments the version in one SQL UPDATE. Staff UI actions send the version displayed on the card and refresh on conflict. Legacy API callers omitting `expectedVersion` retain last-write-wins semantics and must migrate to versioned updates to obtain this protection.

### 10. Server restarts during active operations

**Prediction:** acknowledged orders should survive; a request interrupted before commit should be retryable; one interrupted after commit must recover without duplication.

**Execution:** pause a real JSON checkout before persistence, send `SIGKILL` only to its child API process, and restart against the same temporary store. Repeat after persistence but before response. Also kill a PostgreSQL-backed API after commit and retry through a new backend.

**Actual:** active connections failed as expected. JSON had only its seed record before-write and seed plus committed record after-write. In both cases retry resulted in exactly two records, with working tracking access for seed and recovered order. PostgreSQL retry retained its committed identity; the final authenticated count was three, matching the seed, recovered outage attempt, and interrupted committed attempt.

**Handling and recovery:** persisted checkout keys allow replay after process death. Existing JSON fsync-and-rename publication is retained. These pause points cover the application commit boundaries; they do not simulate hardware power loss, filesystem corruption, or every instruction inside a file replacement.

## Original defects reproduced

The separate committed-baseline diagnostic reproduced two distinct persisted orders for the same payload and key; authorization despite a past expiry setting; and two HTTP 200 responses for competing updates both claiming version 0. The fixed suite asserts one persisted order, denied expired credentials, and one `409` conflict respectively. Missing deadline and click-guard behavior was identified in source and verified through the new frontend tests; no original runtime result is claimed for scenarios not run against the committed snapshot.

## Remaining limits

- Requests without `Idempotency-Key` remain supported and can create duplicates. The shipped browser supplies a key. Treat that key as a private recovery credential; use random UUIDs and do not place it in logs or URLs. Keys live as long as their order record; no expiry/retention migration is provided.
- If browser storage is blocked, the in-memory key survives retries in the current page but not a reload. Reloading or changing checkout details after an uncertain commit can create a new attempt. Full cross-device checkout recovery needs an authenticated customer identity.
- JSON storage supports one server process per file. Replica behavior is tested with PostgreSQL, not multiple processes sharing a JSON file. No guarantees are made about host power loss or storage-volume loss.
- The API still permits unversioned status writes for backward compatibility. Use `expectedVersion` for concurrent clients.
- Staff expiry is configured per backend startup; there is no identity provider, automatic token refresh, or new customer-token expiry contract.
- No physical browser, production network, Kubernetes outage injection, packet-level network partition, or load-capacity benchmark was run. Existing catalog/search/accessibility findings in the project tracker remain separate unless explicitly addressed here.
