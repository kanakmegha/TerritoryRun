# Territory Run — Activity Pipeline Sprint Report

**Date:** 15 October 2026
**Scope:** Verify the previous P0 remediation, add an authenticated mobile activity-to-claim lifecycle, and document product rules and remaining launch gates.
**Database safety:** No MongoDB URI was read or used, and no database or server was started. Automated tests use in-memory repository and transaction fixtures.

## Phase 1 — Previous remediation review

The previous implementation does remove reward, area, perimeter, and attack distance from the server mutation inputs. `gameMutations.claim` reads an owner-bound `Activity`, checks server validation/eligibility, derives metrics from its stored boundary, and creates the territory with a unique `claimActivity`. `attack` requires matching owner-bound server evidence and never reads request distance. Transfers capture the old owner, compare-and-set the owner, clear `teamOwner`, and recount both users in a Mongo transaction. Duplicate claim/attack records are unique-index protected. If transactions are unsupported, the service returns 503 without a partial-write fallback.

The previous report was directionally accurate about fail-closed writes and in-memory tests, but overstated the reachable implementation and the coverage boundary:

- There was no public producer for `serverValidated` or attack evidence. Existing mobile and web clients could not successfully claim; the mutation tests seeded trusted records directly.
- The tests call the last Express route handler function directly. They exercise actual handler and mutation-service code, but do not run an HTTP server, JSON parser, Clerk middleware, Mongoose adapter, or Mongo transaction.
- The old `Activity` schema had only `pending/verified/rejected`; it had no activity key, raw trace, or lifecycle. Its attack evidence was hand-seeded. The updated schema and service now use `recording/submitted/accepted/rejected/processed` and do not create attack evidence.
- The prior report said geometry rejects self-intersection, but the implementation only caught proper crossings. This sprint updated segment checks to include touches and collinear intersections.
- Clearing `Territory.teamOwner` is the only live team cleanup path. `server/models/Team.js` is entirely commented out, so there is no active `Team.territories` collection to update.
- The authenticated profile request used `/api/auth/profile` while that same full prefix was also declared inside a router mounted at `/api/auth`. The local route is now `/profile`, which resolves to the mobile URL.
- Mongo transaction support in the deployment remains unknown. No deployment configuration or live database was inspected.

At review time, the web game hook still sent client `boundary`, `area`, `perimeter`, `reward`, and `attackDistance`. The mobile game hook also sent those values before this sprint. The claim/attack mutation handlers now read only `activityId` and (for an attack) `territoryId`; those legacy numeric and geometry fields cannot change a mutation. The mobile lifecycle now sends sample `lat`, `lng`, device `timestamp`, and reported `accuracy`; these are still client-controlled evidence and are only plausibility checked. `userId`/`owner` request fields do not select the owner; the service uses `req.user._id`. A client-supplied `territoryId` only identifies an attack target and cannot create eligible attack evidence.

## Phase 2 — Lifecycle and API contract

`Activity` stores the authenticated owner, a per-owner client idempotency key, a bounded raw GPS sample list, a canonical sample fingerprint, lifecycle status, server validation results/rejection reason, server-derived claim geometry, and the processed claim receipt. Raw samples, validated results, and territory mutations have separate fields and status transitions; only the lifecycle service writes the trusted validation fields. The claim mutation remains a separate transaction-backed service.

1. `POST /api/game/activities` with `{ "clientActivityId": "..." }` creates a `recording` record for `req.user._id`; replaying the same key for that owner returns the same server activity ID.
2. `POST /api/game/activities/:activityId/submit` with `{ "samples": [{ "lat", "lng", "timestamp", "accuracy" }] }` checks the authenticated owner and bounded shape, fingerprints the trace, and durably changes `recording` to `submitted` before validating it.
3. The server validates the samples, derives a simple closed polygon and measurements, and conditionally changes `submitted` to `accepted` or `rejected`. The client cannot submit a polygon, distance, area, reward, or eligibility flag.
4. An accepted activity is passed to the existing claim mutation. Its Mongo transaction creates at most one territory and reconciles the user's territory count. The activity is marked `processed` with the receipt after that transaction commits.
5. If the process stops between the territory transaction and the activity receipt write, retry finds the territory by unique `claimActivity`, returns the existing result, and finishes the activity record. A repeated identical request returns the durable result; changed samples for one activity or an exact same-owner trace under a new activity key returns 409.

Responses include `201` for a new recording or first processed claim, `200` for an existing recording/processed result, `202` for an in-progress lifecycle state, `422` plus a stable rejection reason for invalid activity evidence, `400` for malformed IDs/samples, `409` for changed/replayed evidence, and `503` for retryable persistence/transaction failures. JSON parse and body-size errors return JSON `400`/`413` responses. The global JSON limit is 1 MB; trace size is limited to 5,000 samples.

The mobile client creates the activity before recording, stores the activity ID, key, samples, and upload state in AsyncStorage, and flushes the stopped draft to AsyncStorage before upload. It retries using the same activity ID after network failure, restores an active or pending draft after app restart, offers retry actions, and only displays territory success after a processed server result. Successful receipts replace the displayed distance/pace with server-derived values. Per-sample coordinates are no longer sent to the road lookup provider.

This is a durable submission workflow rather than a streaming GPS upload. The server has a `recording` ID while the client records; the full raw sample list becomes durable on the server when submitted. A device crash before its latest AsyncStorage write can lose recent points. Foreground tracking is not background tracking.

## Phase 3 — Recommended rules, trade-offs, and decisions

The following provisional claim verifier preserves the closest existing client behavior while resolving its inconsistency. The web client had a 50 m closure and 100 m distance rule plus a 50 m² area rule; mobile omitted the area rule. These values are implemented as an initial proposal and require Product confirmation before a public rollout.

| Rule | Provisional recommendation / implementation | Trade-off and acceptance criteria |
|---|---|---|
| Loop closure | End within 50 m of start; server closes the derived polygon. | Matches current client intent and tolerates GPS drift. Product confirms that a claim must be a loop. Fixtures at 49 m accept when other rules pass; 51 m reject. |
| Minimum route and area | At least 100 m of recorded Haversine path and 50 m² enclosed area. | Preserves web behavior; may exclude short routes and small GPS loops. Add boundary fixtures immediately below/at/above each threshold and make mobile preview agree. |
| GPS accuracy | Every sample must report finite accuracy no worse than 30 m. | Poor fixes become explicit rejection instead of inflated rewards; devices/urban canyons may reject more often. Product confirms threshold and copy before release. |
| Duplicate, ordering, sparse points | Timestamps strictly increase; consecutive points under 0.5 m apart reject; gaps over 30 seconds reject without interpolation. | Deterministic and easy to explain, but can reject stationary pauses and background gaps. Add duplicate, out-of-order, and 30/31-second fixtures. |
| Implausible movement | Reject segment speed over 12 m/s. | Blocks obvious jumps, not GPS spoofing; the threshold supports fast running but may not support cycling. Product decides supported modes before enabling cycling. |
| Geometry | One simple polygon; reject proper crossings, touches, and collinear self-intersections. Repeated paths do not add strength; one accepted activity produces one territory with strength 1. | Prevents ambiguous self-crossing fills, but loopbacks and retracing must be walked again. Add bow-tie, touch, retrace, and parallel-path fixtures. |
| Overlapping claims | Recommendation: reject a new claim that overlaps an existing live territory; allow shared borders only. | Avoids two owners appearing to own the same area, but requires a precise overlap tolerance and a concurrency-safe spatial reservation. **Not implemented** pending the spatial ownership rule and race design. |
| Attacks | Keep attacks disabled until one rule is chosen. Recommendation: qualify from a submitted loop by server-measured path length inside a 30 m corridor around the target boundary, with a separate repeat-use rule. | More coherent than the old `perimeter_m × strength` threshold (m × m²). The old web UI's 30 m proximity is only a hint, not a verified product rule. No attack evidence is produced by this slice. |
| Competing claims | Recommendation: one deterministic winner for overlapping space, with the first committed qualifying claim winning. | Simple to explain, but needs cell/geometry conflict serialization; current independent polygon inserts do not implement this. |
| Ownership duration | Recommendation: permanent until a verified attack or an explicitly announced season reset; no silent decay. | Predictable for users but can leave dormant ownership. Current map API filters territories by last seven days, so persistence is not currently visible for long-lived claims. Product must decide lifetime/season and the map query must match it. |

Additional Product decisions: whether users may walk/cycle, whether exact GPS points are retained and for how long, whether users can delete/export activities, whether a device integrity signal is required, and what happens when accuracy is missing on an otherwise plausible run. An uploaded client GPS path proves only that an authenticated client submitted those coordinates; it does not prove that a person physically ran them.

## Tests and observed commands

Acceptance criteria were encoded in service tests: a valid first claim derives metrics from a valid trace; malformed or low-quality samples do not award; caller-supplied reward/distance/area/perimeter do not affect the result; owner mismatch is rejected; same-key retries and exact trace replay do not award twice; submission and mutation failures leave a retryable state; and existing transaction fixtures prove concurrent claims/transfers and rollback behavior.

| Command | Observed result |
|---|---|
| `npm test` | **Passed: 29 tests, 0 failures, 0 skipped.** In-memory activity repository and mutation/transaction fixtures only. No DB URI or credentials used. |
| `npm run build` | **Passed.** Vite built successfully; Mapbox chunk warning remains at 1,680.20 kB (463.56 kB gzip). This is the web build, not an Expo/native build. |
| `npx eslint server/services/activityLifecycle.js server/services/activityLifecycle.test.js server/services/gameMutations.js server/services/gameMutations.test.js server/models/Activity.js server/models/Attack.js server/models/Territory.js mobile/src/utils/activityId.js` | **Passed.** |
| `npx eslint server/services/activityLifecycle.js server/services/activityLifecycle.test.js server/services/gameMutations.js server/services/gameMutations.test.js server/models/Activity.js server/models/Attack.js server/models/Territory.js server/routes/game.js server/routes/auth.js server/index.js mobile/src/utils/activityId.js` | **Failed: 9 existing errors** in server entrypoint/legacy route code (`process` globals and empty catches). |
| `npx eslint mobile/src/hooks/useGameStore.js mobile/src/components/Map/VectorMap.js mobile/src/components/Dashboard/Dashboard.js mobile/src/screens/RouteSuggestion.js mobile/src/screens/ActiveRun.js mobile/src/screens/ConquestSummary.js` | **Failed: 9 errors, 2 warnings**, in existing unused variables, the summary screen's animation-ref lint findings, and existing hook dependencies. |
| `node --check server/services/activityLifecycle.js && node --check server/services/gameMutations.js && node --check server/routes/game.js && node --check server/models/Activity.js && node --check mobile/src/utils/activityId.js` | **Passed.** |
| `git diff --check` | **Failed on trailing whitespace in pre-existing dirty edits** in `mobile/src/utils/api.js` and `server/middleware/clerkAuth.js`; no unrelated formatting cleanup was applied. |
| `node --check` for server lifecycle/router/model modules | **Passed** for the checked JavaScript modules. |

No HTTP listener, Clerk verification request, mobile simulator/device, live database, or isolated replica-set integration test was run. The in-memory mocks prove service decisions and rollback behavior, but do not prove Mongoose index creation or deployed Mongo transaction behavior.

## Files changed in this sprint

- `server/services/activityLifecycle.js` — owner-bound durable lifecycle, GPS plausibility and geometry validation, replay hash, retryable claim orchestration.
- `server/services/activityLifecycle.test.js` — lifecycle/replay/owner/failure/route assertions using mocks.
- `server/services/gameMutations.js` and `server/services/gameMutations.test.js` — align trusted activity state with `accepted`; include endpoint mutation regressions and complete touch/collinear segment rejection.
- `server/models/Activity.js` — lifecycle, raw samples, validation result, idempotency keys, replay fingerprint indexes.
- `server/routes/game.js` — authenticated recording and submit endpoints; claim/attack continue to accept evidence IDs only.
- `server/routes/auth.js` — router-local `/profile` path matching the existing mobile `/api/auth/profile` request under its mount prefix.
- `server/index.js` — 1 MB bounded JSON body plus explicit malformed/oversized JSON responses.
- `mobile/src/hooks/useGameStore.js` — server activity creation, timestamped GPS capture, durable local draft/retry, and structured result handling.
- `mobile/src/utils/activityId.js` — stable-shape client idempotency key generation and timestamp helper.
- `mobile/src/screens/RouteSuggestion.js`, `mobile/src/screens/ActiveRun.js`, `mobile/src/screens/ConquestSummary.js`, `mobile/src/components/Dashboard/Dashboard.js`, `mobile/src/components/Map/VectorMap.js` — start/resume, pending retry, no false success state, GPS startup, and removal of road lookup as a claim gate.
- `ACTIVITY_PIPELINE_REPORT.md` — this report.

The initial worktree also contained uncommitted edits in `app.json`, `mobile/App.js`, `mobile/app.json`, `mobile/src/utils/api.js`, `server/middleware/clerkAuth.js`, `test-api.js`, the original reports, and parts of the server mutation work. These were preserved; the existing mobile API URL placeholder and unrelated auth middleware edits were not replaced.

## Security, privacy, and data integrity

- The authenticated server user is the only source of `Activity.owner`; sample submissions are owner-filtered before state transitions. Stored metrics and boundaries come from server validation.
- Same-activity retries are idempotent, exact raw trace fingerprints prevent straightforward replay under a new key, and the territory unique key plus Mongo transaction ensures one claim and consistent territory counts.
- Client-generated timestamps and coordinates remain forgeable. An attacker can synthesize a plausible path or modify timestamps to evade exact fingerprint matching. This verifier is a plausibility filter, not physical-run proof or device attestation.
- Precise raw GPS traces are stored indefinitely in the Activity record. There is no consent, retention, deletion, export, or encryption policy in this sprint. The existing public territory endpoint also returns full territory geometry/path nodes. Both are privacy release blockers.
- The Clerk middleware's email-based account linking behavior was inspected and remains unchanged; verified-email and concurrent-link semantics need a separate auth review. Owner binding is only as trustworthy as that identity-to-user mapping.
- Existing user territory counters may need reconciliation. The claim/attack transaction requires MongoDB replica-set or mongos transaction support and currently fails closed otherwise. Model index deployment has not been exercised against an existing database.
- Overlap handling and attack verification are not implemented. Web claim/attack clients still send legacy request fields and now fail closed. Only the mobile claim path has been updated.

## Release acceptance criteria and next sprint

Before enabling real users, require Product sign-off on the provisional rules; deterministic overlap policy and concurrent spatial conflict handling; a separate verified attack activity path or disabled attack UI; a privacy/retention/deletion policy and private territory API response; review/fix of Clerk account linking; and confirmation of the Mongo transaction topology and indexes in a dedicated isolated replica-set environment.

Then run a mobile simulator and physical-device verification for location permission, sample accuracy, app restart, offline upload/retry, maximum trace length, profile loading, and accurate processed/rejected/pending UI. Migrate or remove the legacy web claim path and run authenticated HTTP contract tests against a dedicated test database. Reconcile existing territory counters before deployment. Do not describe the application as production-ready until those gates pass.
