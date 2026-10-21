# Territory Run — Release Readiness Assessment

**Assessment date:** 15 October 2026
**Status:** Not ready for production or public gameplay. Evidence below is from source inspection and local isolated tests; no live server, MongoDB instance, simulator, or device was used in this assessment.

## Phase 2B — MongoDB acceptance gate

**Run date:** 15 October 2026. **Gate status: OPEN.** No supported, safe replica-set runtime is available in this environment, so no real MongoDB integration test executed. No database URI was contacted.

### Environment capability check

- `mongod`, `mongosh`, `mongo`, `podman`: unavailable on `PATH`.
- Docker CLI: installed. Docker daemon access was denied in the prior Phase 2 check; it was not retried in this phase.
- `mongodb-memory-server`, `mongodb-memory-server-core`, `testcontainers`, `@testcontainers/mongodb`: unavailable in the project dependencies.
- No external or shared database was considered as a fallback.

### Existing suite and evidence

`server/services/gameMutations.mongo.test.js` opts in only when `RUN_TERRITORY_MONGO_INTEGRATION` is exactly `1`. Before connecting, it requires a URI, a loopback hostname, database `territoryrun_test`, and replica set `territoryrunTest`. It uses real Mongoose models and transaction sessions, initializes indexes, and removes only the IDs created by each nested test; it does not drop collections. Tests create randomized fixture identities. This cleanup design and test isolation were source-inspected, not exercised against MongoDB.

| Required behavior | Existing Mongo suite coverage | Phase 2B execution result |
|---|---|---|
| Transaction commit: initial claim, owner transfer | Claim lifecycle and transfer assertions check persisted territory owner and counts. | **Not run: no replica set.** |
| Transaction rollback after failed operation | Injects a failure in the owner counter update after a claim write and asserts no territory/counter mutation remains. | **Not run: no replica set.** |
| Duplicate submission/idempotency | Concurrent duplicate lifecycle submissions and duplicate claim mutations assert one territory and one increment; retry after successful processing returns the same receipt. | **Not run: no replica set.** |
| Retry after failed/interrupted request | The Mongo suite does not retry after its injected failure or simulate interruption after commit before receipt persistence. Existing retry-after-failure assertions are in mock-backed lifecycle tests only. | **Not covered by a real Mongo test; acceptance remains open.** |
| Concurrent claims/transfers | Same-activity concurrent claims and competing ownership transfers assert a single claim/transfer and owner-count consistency. | **Not run: no replica set.** |
| Both owners’ counters | Successful transfer checks old/new owner counts; competing transfers compare all fixture users’ counters against persisted territory ownership. | **Not run: no replica set.** |
| Cleanup/isolation | Fixture IDs are individually deleted in `finally`; the suite never clears a collection or database. | **Source-inspected only; no DB execution.** |

### Guard validation commands

All commands below are bounded pre-connection checks. Valid-looking URI values are used only in configurations that skip or fail guard validation; none was attempted as a Mongo connection.

| Command case | Actual result |
|---|---|
| `env -u RUN_TERRITORY_MONGO_INTEGRATION TERRITORY_RUN_MONGO_TEST_URI='mongodb://127.0.0.1:27018/territoryrun_test?replicaSet=territoryrunTest' node --test server/services/gameMutations.mongo.test.js` | Exit 0; parent suite skipped, 0 tests passed, 1 skipped. No connection. |
| `env RUN_TERRITORY_MONGO_INTEGRATION=true TERRITORY_RUN_MONGO_TEST_URI='mongodb://127.0.0.1:27018/territoryrun_test?replicaSet=territoryrunTest' node --test server/services/gameMutations.mongo.test.js` | Exit 0; non-exact opt-in skipped the suite, 0 tests passed, 1 skipped. No connection. |
| `env -u TERRITORY_RUN_MONGO_TEST_URI RUN_TERRITORY_MONGO_INTEGRATION=1 node --test server/services/gameMutations.mongo.test.js` | Exit 1 at the missing-URI assertion before connection. |
| `env RUN_TERRITORY_MONGO_INTEGRATION=1 TERRITORY_RUN_MONGO_TEST_URI='mongodb://127.0.0.1:27018/shared?replicaSet=territoryrunTest' node --test server/services/gameMutations.mongo.test.js` | Exit 1 at the database-name assertion before connection. |
| `env RUN_TERRITORY_MONGO_INTEGRATION=1 TERRITORY_RUN_MONGO_TEST_URI='mongodb://127.0.0.1:27018/territoryrun_test?replicaSet=other' node --test server/services/gameMutations.mongo.test.js` | Exit 1 at the replica-set-name assertion before connection. |

These runs verify missing/invalid opt-in, URI, database and replica-set guards. A valid opt-in/URI combination was deliberately not run because no instance could be verified as fresh and disposable.

### External prerequisite and reproducible setup

Provide a local machine or CI worker with MongoDB Server (`mongod`) and MongoDB Database Tools (`mongosh`) installed, with permission to bind `127.0.0.1`. Create a fresh disposable database directory; do not reuse an existing Mongo data directory. One safe setup is:

1. In a terminal, create a unique empty directory and keep its exact printed path: `TEST_DBPATH=$(mktemp -d /tmp/territoryrun-test-db.XXXXXX)`.
2. Start MongoDB in that terminal: `mongod --replSet territoryrunTest --dbpath "$TEST_DBPATH" --bind_ip 127.0.0.1 --port 27018`.
3. In another terminal, initialize this fresh instance once: `mongosh 'mongodb://127.0.0.1:27018/admin' --eval 'rs.initiate({_id:"territoryrunTest",members:[{_id:0,host:"127.0.0.1:27018"}]})'`. Confirm the response indicates initialization and that `rs.status()` reports the expected set and a primary before running tests.
4. From the repository root, run: `RUN_TERRITORY_MONGO_INTEGRATION=1 TERRITORY_RUN_MONGO_TEST_URI='mongodb://127.0.0.1:27018/territoryrun_test?replicaSet=territoryrunTest' node --test server/services/gameMutations.mongo.test.js`.
5. Record each nested assertion’s result. Afterward, stop that exact `mongod` process. The test suite removes only its fixture IDs; the entire fresh instance is disposable. Remove only the unique directory created in step 1 after confirming it is the same path and the process is stopped.

Do not substitute a production, staging, shared, remote, or unknown URI. The acceptance gate stays open until this suite is executed on that dedicated replica set and the commit, rollback, duplicate/replay, retry, concurrency, counter, and cleanup results are captured. Add or extend a real Mongo retry-after-failure test before claiming that specific requirement is covered.

## Phase 2 — Real integration verification update

**Run date:** 15 October 2026. No MongoDB target was contacted. The host has no `mongod` or `mongosh`; Docker is installed, but its local daemon socket returned `permission denied`. I did not try another URI or database. The real replica-set acceptance criterion therefore remains open.

### Test architecture and safe setup

- `server/services/activityHttp.integration.test.js` calls `createApp()` and mounts the actual game router, JSON parser, and route middleware using an in-process Express request harness. This avoids a TCP listener because a previous standalone loopback probe failed with `listen EPERM`. The updated valid-identity case calls the production `createClerkAuth` middleware and Clerk SDK `verifyToken` with a locally generated, ephemeral RS256 key; the user lookup is a test-only model. This verifies Clerk JWT signature checking and authenticated owner binding without using a real Clerk credential, Clerk service, or MongoDB. Requests still do not traverse TCP.
- `server/services/gameMutations.mongo.test.js` uses real Mongoose models and transaction sessions when explicitly enabled. Its safety guard requires `RUN_TERRITORY_MONGO_INTEGRATION=1`, loopback host, database name exactly `territoryrun_test`, and replica set exactly `territoryrunTest`. It deletes only fixture IDs created by each test and never drops collections. The suite was skipped because no dedicated instance is available.
- Minimum local setup: create a fresh, disposable database directory; run `mongod --replSet territoryrunTest --dbpath /tmp/territoryrun-test-db --bind_ip 127.0.0.1 --port 27018`; initialize it once with `mongosh 'mongodb://127.0.0.1:27018/admin' --eval 'rs.initiate({_id:"territoryrunTest",members:[{_id:0,host:"127.0.0.1:27018"}]})'`; then run `RUN_TERRITORY_MONGO_INTEGRATION=1 TERRITORY_RUN_MONGO_TEST_URI='mongodb://127.0.0.1:27018/territoryrun_test?replicaSet=territoryrunTest' node --test server/services/gameMutations.mongo.test.js`. These commands require local MongoDB Database Tools and a replica-set capable `mongod`. Never point the URI at a shared, staging, production, or otherwise unknown database.

### Verification results

| Area | Result | Evidence boundary |
|---|---|---|
| Full unit and in-process suite: `npm test` | **Passed: 43 passed, 0 failed, 1 skipped (44 total).** | Includes lifecycle, mutation, draft-store, mounted Express and Clerk verifier cases. Node emitted a non-failing module-type warning for the mobile helper. |
| Mounted HTTP with absent, malformed, invalid, and valid test JWT | **Passed in-process.** | The valid JWT signature was verified by Clerk SDK `verifyToken`; owner binding then reached the mounted route. Test user lookup uses a test model. No actual Clerk-issued token, Clerk service, TCP socket, or persistent user store was used. |
| Owner mismatch, invalid JSON, forged measurements, replay, pending/rejected/processed outcomes | **Passed in-process and service tests.** | Uses isolated fixtures and the existing lifecycle/mutation coverage. Does not prove persistence behavior. |
| MongoDB replica-set integration: claim, transfer, failure rollback, concurrency, owner counters | **Skipped; not run.** | No `mongod`/`mongosh`; Docker daemon access denied. No database URI was set/read or contacted. Therefore no real transaction behavior is claimed. |
| Mongo target fail-closed guard | **Verified.** | `env -u TERRITORY_RUN_MONGO_TEST_URI RUN_TERRITORY_MONGO_INTEGRATION=1 node --test server/services/gameMutations.mongo.test.js` exited 1 with the expected “Set TERRITORY_RUN_MONGO_TEST_URI…” assertion before attempting a connection. |
| Clerk production credentials/provider path | **Not run.** | Cryptographic verification runs locally through the actual SDK and middleware using an ephemeral key, but there is no Clerk-issued test credential/provider call. |
| ESLint targeted files | **Passed: 0 errors.** | `./node_modules/.bin/eslint server/middleware/clerkAuth.js server/services/activityHttp.integration.test.js server/services/gameMutations.mongo.test.js`. |
| TCP HTTP integration | **Not run.** | Loopback is restricted by the execution environment (`EPERM`); only the mounted in-process Express stack ran. |
| Device and simulator checks | **Not run.** | No mobile runtime/device lifecycle claims are made by this phase. |

The production auth middleware keeps the Clerk SDK verifier and Mongoose user model as defaults. `createClerkAuth` adds dependency injection for isolated tests; test signing material is generated at runtime and is not stored or logged. The MongoDB guard now also checks the exact test replica-set name. No production gameplay rules or mutation semantics changed.

### Reproducible commands and remaining gates

- Passed: `npm test` — 43 passed, 0 failed, 1 skipped.
- Expected guard failure: `env -u TERRITORY_RUN_MONGO_TEST_URI RUN_TERRITORY_MONGO_INTEGRATION=1 node --test server/services/gameMutations.mongo.test.js` — exits 1 before connecting when the explicitly requested test target is missing.
- Not run successfully: `node --test server/services/gameMutations.mongo.test.js` with the opt-in flags. Run it only after starting the fresh local replica set above.
- Run actual Clerk-provider acceptance with a dedicated Clerk test instance and credential after configuring test-only provider keys; verify absent, malformed, invalid-signature and provider-issued valid token cases through the mounted app.
- Run TCP integration in CI or a local environment that permits loopback sockets. Keep the current in-process suite as a separate middleware test.
- The open transaction acceptance gate requires captured output from the Mongo suite on the dedicated replica set, including commit, rollback, duplicate, concurrent claim/transfer and owner-count assertions. Unit transaction fixtures do not satisfy this gate.

## Verified implementation and discrepancies

### What the code does

- `POST /api/game/activities` derives the owner from `req.user._id`; a client `ownerId` is ignored. Submissions load the Activity by both activity ID and authenticated owner.
- Activity submission accepts bounded raw samples and derives path distance, duration, area, perimeter, and claim polygon server-side. Client reward, distance, area, perimeter, and polygon fields are not passed into the mutation service.
- The current verifier enforces hard-coded prototype checks: sample count 4–5,000; accuracy >0 and ≤30 m; strictly increasing client timestamps; ≤30 s between samples; at least 0.5 m movement per adjacent sample; ≤12 m/s; closure ≤50 m; path ≥100 m; area ≥50 m²; simple loop geometry.
- Claim mutation uses owner-bound accepted Activity evidence and stores one territory keyed by `claimActivity`. Transfers use a compare-and-set owner update, clear `teamOwner`, create an attack record, and recount both owners in a transaction. Transfer paths are test-fixtured but attack evidence has no producer, so normal clients cannot make an eligible attack.
- Activity submission writes raw trace as `submitted` before validating; a claim is `processed` only after the mutation receipt is saved. Retry can recover a transaction that committed before receipt persistence by looking up the unique claim activity.
- Profile URL composition is consistent: mobile requests `/api/auth/profile`, server mounts the auth router at `/api/auth`, and the router declares `/profile`.

### Gaps versus previous reports

- Earlier `REMEDIATION_REPORT.md` route tests inspected `router.stack` and invoked only the last handler. Those tests bypassed middleware, JSON parsing, and route mounting. This sprint adds in-process tests that exercise the Express app stack; they still do not cover TCP transport or a valid Clerk signature.
- The `Activity` lifecycle tests use an in-memory repository and a mock mutation service; game mutation tests use a serial in-memory transaction fixture. Neither exercises the Mongoose repository/adapter, unique-index creation, MongoDB transaction rollback, or deployed transaction capability. The report correctly discloses this boundary elsewhere, but its headline claims about transactional correctness remain unverified against MongoDB.
- The mobile draft previously used one global AsyncStorage key with fire-and-forget writes. This sprint replaces it with owner/activity-scoped keys and serialized writes, and removes the unowned legacy key rather than attributing it to whichever account signs in. This cannot prove native process-kill durability or protect data from local filesystem access; test it on devices.
- If fewer than four samples exist, the client now submits the trace so the server can persist a rejected lifecycle state. Current server validation turns short traces into a terminal 422 rejection.
- `ConquestSummary` previously displayed “RUN COMPLETE” for missing/unknown status. It now displays “RESULT UNAVAILABLE”; only a `processed` status says territory acquired.
- No overlap arbitration exists. Distinct valid Activity IDs can create intersecting territories, including concurrent claims. Transactions and unique `claimActivity` prevent duplicate use of one Activity, not spatial conflicts between different Activities.
- `/api/game/territories` filters by a seven-day timestamp window. Territory records and counters persist, but the map result removes older territories. This conflicts with permanent ownership unless Product chooses a seven-day visibility rule.
- `/api/game/suggest` creates heuristic/synthetic routes when no mapping key is configured, and mobile suggested route cards are not selectable. The selected/planned route is not bound to recorded GPS or claim validation. Planned-run journey is not end to end.
- Mobile API production base URL is a placeholder (`https://your-production-url.com`), so production API routing is not configured. The mobile app also contains a source-embedded Clerk publishable configuration; this is not a server secret, but environment configuration and rotation/release setup need review.
- Auth middleware no longer logs Clerk identity/email or token-verification errors. It still links accounts by email without a verified-email policy visible here; review that policy. Profile failure sets the provider ready with no user but has no clear user-visible recovery state, so profile outage UX still needs device validation.
- Current code uses device-provided timestamps and GPS accuracy; a syntactically valid trace is only plausibility-filtered, not proof of physical movement. Exact-trace hashing does not stop timestamp-adjusted replay or synthetic GPS traces.
- The seven-day map cutoff, overlap policy, and precise boundary visibility are still unresolved Product rules. This sprint did not choose territory expiration/season semantics or an overlap winner rule. It removed the redundant raw `path_nodes` field and internal `claimActivity` reference from map responses; public boundary polygons remain because the map needs them.
- Raw Activity samples still have no retention or deletion policy. Implementing expiry without a Product-selected period could destroy retry, appeal, or integrity evidence, so the alternatives and decision needed are recorded below.

## Test and check results

| Check | Result | Evidence boundary |
|---|---|---|
| `npm test` | **Passed: 42 tests, 0 failures, 1 skipped.** | Includes mock/service tests, five in-process Express tests, and seven AsyncStorage-compatible store tests. The MongoDB integration suite is the one skipped test. Node emitted a non-failing `MODULE_TYPELESS_PACKAGE_JSON` warning while importing the mobile helper from the nested mobile package boundary. |
| In-process Express HTTP tests | **Passed: 5 tests.** | Runs `createApp()`/Express routing and JSON parsing via `app.handle`, with actual `/api/game` mount. Clerk middleware is exercised for absent and malformed credentials; successful requests use a test-only auth middleware and in-memory activity/mutation fixtures. No TCP listener or real valid Clerk token is exercised. |
| Clerk JWT verification and test user resolution | **Passed in local mounted test (Phase 2).** | An ephemeral RS256 JWT passes through the production Clerk SDK verifier and production auth middleware; user lookup is a test-only model. A Clerk-issued credential/provider flow remains unrun. |
| Activity draft store tests | **Passed: 7 tests.** | Mock storage verifies owner/activity key isolation, serial/stale-write protection, `uploading` recovery as pending, malformed new snapshots preserving the last valid record, missing/malformed/truncated/partial draft rejection, and no false processed state. Not a native AsyncStorage/device test. |
| `node --test server/services/gameMutations.mongo.test.js` | **Skipped: not configured (exit 0, 1 skipped).** | Suite only permits an explicit loopback URI whose database is exactly `territoryrun_test` and which has a `replicaSet` parameter. No Mongo URI was read, and no database was contacted. |
| `node --check` on changed JS files | **Passed.** | Syntax only; does not exercise runtime integration. |
| Focused `./node_modules/.bin/eslint` over modified backend services/routes/models, mobile store/hook/summary, and new tests | **Passed: 0 errors.** | Fixed all 10 reported targeted errors. The six ref access findings in `ConquestSummary.js` and four route-suggestion findings were present in the inspected dirty tree before this sprint; the affected source lines were inherited from that work. |
| `git diff --check` | **Passed after cleanup.** | Removed the three reported trailing-space lines in `mobile/src/utils/api.js` (2) and `server/middleware/clerkAuth.js` (1). These were present in the working tree before this sprint. |
| Minimal loopback probe | **Failed with `EPERM` before application code.** | A standalone Node HTTP server attempted `listen(0, '127.0.0.1')` and received `listen EPERM`; this isolates the cause to the execution environment's socket restriction rather than app configuration. |
| Mobile simulator/device restart and GPS | **Not run.** | Draft store logic is mock-tested; actual AsyncStorage scheduling, native termination, permissions, GPS and foreground/background behavior need iOS/Android device verification. |
| Web build and repository-wide lint | **Not run during this assessment.** | Prior `ACTIVITY_PIPELINE_REPORT.md` records a successful web build and lint failures. The targeted lint check above did run. |

## Mobile journey assessment

| Journey step | Current evidence | Release status |
|---|---|---|
| Sign in and load profile | Mobile gets Clerk token and requests the correctly mounted profile path. A profile error now releases the provider but has no clear user-visible recovery state. | Blocked on valid Clerk verification and device failure recovery. |
| Start run | Server recording is created with an owner-scoped idempotency key before local run begins. Foreground location permission/watch are used. | Partially implemented; permission denial and location-start failures require device checks. |
| Record GPS | Client retains coordinates, device timestamps, and reported accuracy; owner/activity drafts are saved through a serialized store. Tracking is foreground only. | Mock tests pass; native process termination and permission behavior remain unverified. |
| Stop and submit | Stop awaits a per-activity draft save, then submits, including short traces so the server can create a durable rejection. Retries reuse the same server activity ID. | Mock/in-process tests cover lifecycle decisions; native offline/restart behavior remains unverified. |
| Process claim and show outcome | Only explicit `processed` renders territory acquired; pending/rejected are explicit and unknown states now show “RESULT UNAVAILABLE.” | Backend response paths are in-process tested; rendering is source-inspected, not device-tested. |
| Reload map | Client refetches after processing. Public territory response omits redundant `path_nodes` and internal claim linkage but retains map boundary geometry. | Seven-day feed cutoff remains until Product chooses visibility/season semantics; real persistent DB/map journey not verified. |
| Restart app and recover | Activity drafts are keyed by authenticated owner and activity ID. Writes serialize; in-flight uploads recover as pending; active drafts recover from the same owner after profile load. Logout clears memory and the legacy shared key. | Store behavior is mock-tested. Native AsyncStorage/app-kill timing and account-switch UX still require simulator/device tests. Background tracking is not claimed. |

## Integration verification plan and infrastructure requirement

1. In-process HTTP tests instantiate the extracted Express app, mount `/api/game`, parse JSON, and run route middleware without opening a socket. A Phase 2 test verifies a locally signed JWT through the actual Clerk SDK verifier and middleware; user lookup is test-only. For provider-issued credential and TCP coverage, run against a dedicated Clerk test instance and loopback-enabled CI environment.
2. Provision a disposable MongoDB replica set dedicated to tests. The suite reads only `TERRITORY_RUN_MONGO_TEST_URI` and requires `RUN_TERRITORY_MONGO_INTEGRATION=1`, loopback host, exact database name `territoryrun_test`, and explicit `replicaSet` parameter. Example local setup: `mkdir -p /tmp/territoryrun-test-db`; start `mongod --replSet territoryrunTest --dbpath /tmp/territoryrun-test-db --bind_ip 127.0.0.1 --port 27018`; initialize once with `mongosh 'mongodb://127.0.0.1:27018/admin' --eval 'rs.initiate({_id:"territoryrunTest",members:[{_id:0,host:"127.0.0.1:27018"}]})'`; then run `RUN_TERRITORY_MONGO_INTEGRATION=1 TERRITORY_RUN_MONGO_TEST_URI='mongodb://127.0.0.1:27018/territoryrun_test?replicaSet=territoryrunTest' node --test server/services/gameMutations.mongo.test.js`. Use only a newly created disposable instance; never point this variable at application, staging, production, or an unknown database. The suite covers real repository/index/transaction behavior, claim and transfer, injected failure after a transaction write, duplicate/replay, concurrency, and owner counters. A standalone MongoDB instance is insufficient because transactions require a replica set or mongos topology.
3. Run Expo on both iOS and Android simulator/device, then at least one physical device per supported platform. Verify login/session restore, foreground GPS permission, poor accuracy, stop, denied/revoked location, offline upload, forced process termination during recording and upload, retry, pending/rejected/processed screens, map refresh, and app restart. Use synthetic route fixtures for deterministic QA; do not use a production account or database.

### Manual device procedure when simulators are available

Run this only against a test build, test Clerk account, test API base URL, and disposable replica-set database. Confirm the API points at a database explicitly named for tests before signing in. Use simulator location replay or a controlled outdoor route; never alter GPS while driving.

1. Install the test build on iOS and Android. Sign in, grant foreground location, and confirm the profile loads. Force-close and relaunch; confirm the Clerk session and profile restore.
2. Select a target distance and inspect suggested routes. Record whether a route can actually be selected and followed; expected current finding is that cards are display-only. Start a run, wait for multiple GPS fixes, stop, and observe the status transition. A successful claim may be displayed only after the API returns `processed` with a territory receipt.
3. With a deterministic valid closed-loop fixture, submit once. Confirm the response has server-derived metrics, the activity becomes processed, the map refresh shows the territory, and a second identical submit/retry returns the same territory ID without increasing territory count.
4. Enable airplane mode before stopping a separate valid run. Confirm it remains visibly pending and never says territory acquired. Force-close the app, restore network, relaunch, and retry. Confirm one territory appears only after a processed response.
5. Force-close during a separate active recording, relaunch, and inspect the recovered draft and sample count. Repeat after switching sign-out/sign-in between two test accounts; verify no account can see or submit the other account's local trace. Record any lost final samples or owner leakage as a failure.
6. Use server-side synthetic fixtures (not client reward fields) for malformed coordinates, poor reported accuracy, out-of-order timestamps, large gaps, open routes, self-intersections, and too-small areas. Confirm stable rejection reasons and zero territory/counter changes.
7. Revoke location permission, deny it on a fresh install, and simulate process termination during upload. Verify the app can explain the condition, keep recoverable evidence where applicable, and never show a false success. Repeat on both operating systems and attach OS/app build versions and sanitized outcome logs without coordinates or tokens.

## Location privacy and security risks

- Raw timestamped GPS samples are stored indefinitely in Activity documents. There is no retention, deletion/export, or documented informed-consent path.
- Territory API is public and still returns exact boundary polygons needed by the game map. This can reveal sensitive places; redundant `path_nodes` and the internal claim activity reference are now excluded. The public/private/generalized boundary choice is unresolved.
- Mobile raw traces now use owner/activity-scoped AsyncStorage keys, but AsyncStorage is not encrypted and the implementation has not been validated on a device. A shared device with filesystem access remains a local privacy risk.
- Client timestamps, coordinates, and accuracy values can be fabricated; validation is a plausibility gate, not anti-spoof proof. There is no device attestation or authoritative sensor signature.
- Clerk identity-to-user email linking needs review; identity fields are no longer logged. No token values were printed or database URI read during this assessment.
- Open CORS and public territory/leaderboard routes need an explicit abuse and privacy policy before public launch. The raw `path_nodes` duplicate and claim linkage were removed from the public territory response; exact boundary polygons remain public pending a Product/privacy decision.

## Retention and public-map decision required

Choose one raw-trace policy before public release: delete GPS samples immediately after a durable processed/rejected result (lowest exposure, weaker appeals/fraud review); retain encrypted traces for a short, explicit period (supports support and abuse review, with breach and access risk); or keep traces until user deletion (simpler retry/audit, highest privacy exposure). Product and Privacy must set the period, consent language, deletion/export semantics, and access roles. Separately decide whether exact territory boundaries are public, visible only to authenticated players, or generalized/masked for display. Auth-only access reduces anonymous scraping but does not prevent player location inference; coordinate generalization protects privacy but can alter gameplay/map accuracy.

## Product decisions required

Resolve the proposed rules in [GAME_RULES.md](/Users/skanakmegha/Documents/MEGHA/Personal-Development/TerritoryRun/GAME_RULES.md), especially: loop requirement and provisional thresholds; GPS quality limits; trace simplification; open/back-and-forth progress; repeats and upgrades; overlap tolerance and concurrent winner; ownership permanence/season/decay; attack eligibility; and raw trace/map geometry retention and privacy.

## Release blockers and acceptance criteria

1. **Product-approved claim rules:** Product signs off on exact thresholds and loop/geometry behavior; tests cover boundaries and rejection copy. Current constants remain prototype values until then.
2. **Spatial conflict integrity:** Overlapping and concurrent claims have deterministic arbitration. Isolated integration test proves only the chosen result persists and all counters match.
3. **Mongo transaction proof:** Dedicated replica-set integration suite verifies claim and transfer commit/rollback, unique indexes, concurrent mutation, and retry behavior. Transactions unavailable must fail closed.
4. **HTTP and auth proof:** Full mounted Express request tests prove missing/invalid token rejection, authenticated owner binding, JSON validation, idempotent retry, and safe structured responses. Verify Clerk identity linking and profile failure recovery.
5. **Mobile durable lifecycle:** Draft storage is owner-scoped and awaited/serialized; recovery tests survive forced termination during recording and upload; local short-run rejection is synchronized or represented as a server-side terminal outcome. No pending/unknown outcome may look like a completed claim.
6. **Map and ownership semantics:** Product chooses permanent/seasonal/decaying ownership and overlap arbitration; map API behavior matches that decision. Privacy approves whether public map boundaries are exact or generalized. The current seven-day filter is removed only after this decision is made.
7. **Device acceptance:** iOS and Android runs verify sign-in, location permission, recording, stop, offline retry, restart recovery, rejection, processed receipt, and map refresh. Record app/build versions and evidence.
8. **Release configuration and privacy:** Replace production API placeholder with approved environment configuration; approve location consent, retention/deletion, access controls, CORS, and logging before public rollout.

## Next three implementation tasks

1. **Product rules and claim conflict contract:** Review and approve [GAME_RULES.md](/Users/skanakmegha/Documents/MEGHA/Personal-Development/TerritoryRun/GAME_RULES.md), then design a minimal deterministic overlap check and competing-claim policy. This precedes changes to claim eligibility and geometry.
2. **Backend integration verification:** Run the in-process HTTP suite, then repeat it over loopback in CI. Provision the guarded replica-set fixture and run the MongoDB suite to prove real indexes, transactions, rollback, concurrency, and owner counters.
3. **Mobile recovery verification:** Run owner-switch, forced-termination, offline retry, and foreground GPS procedures on iOS and Android; fix any native storage/lifecycle failures found. The store is now owner-scoped and serializes writes, but simulator/device proof remains open.

## Files changed in this sprint

- `server/app.js`, `server/index.js` — extracted reusable Express app construction and retained existing listener/database startup behavior.
- `server/services/activityHttp.integration.test.js` — in-process Express routing, mount, JSON parser, Clerk rejection, owner binding, malformed payload, replay, and outcome-state tests.
- `server/services/gameMutations.mongo.test.js` — opt-in local replica-set suite for claims, transfers, rollback, duplicate/replay, concurrency, and counters; skipped because no test instance was configured.
- `server/services/activityLifecycle.js` — make short traces receive durable server rejection and include explicit accepted/pending metadata when claim persistence fails.
- `server/routes/game.js` — exclude redundant `path_nodes` and private claim linkage from public territory feed; avoid logging suggestion-provider error details.
- `server/middleware/clerkAuth.js` — remove identity and token-verification error logging.
- `mobile/src/utils/activityDraftStore.js`, `server/services/activityDraftStore.test.js` — owner/activity-scoped AsyncStorage contract, serialized/stale-write protection and mock recovery tests.
- `mobile/src/hooks/useGameStore.js` — owner-scoped hydration, durable state transitions, same-ID retries, logout memory cleanup and upload recovery.
- `mobile/src/screens/ConquestSummary.js` — explicit unknown-result state.
- `mobile/src/utils/api.js` — remove the two reported trailing-whitespace findings.
- `RELEASE_READINESS.md` — this assessment and run evidence.

## Release decision

**Do not release territory claiming publicly yet.** The in-process Express stack and mock-backed lifecycle tests pass, but TCP transport, valid Clerk token resolution, real MongoDB transaction semantics, spatial conflict handling, native draft recovery, privacy controls, production routing, and device GPS behavior remain unverified or incomplete. The core flow is a testable prototype vertical slice, not a production-ready game.
