# P0 remediation sprint report

**Date:** 15 October 2026
**Scope:** Territory claim/attack authorization, idempotency, ownership accounting, and isolated regression coverage.
**Database safety:** No MongoDB connection was made. Tests use in-memory transactional fixtures. Existing uncommitted user changes were preserved.

## Outcome

Claim and attack requests now identify an activity record instead of supplying a reward, polygon metrics, or attack distance. The service only accepts activity evidence marked as server-validated and verified, and derives area/perimeter from the stored polygon before creating a territory. Requests without that evidence fail closed. This repository does not yet contain a trusted activity ingestion/verifier, so current mobile/web claim and attack flows cannot receive rewards until that separate component is designed and implemented.

Territory ownership changes now run in a MongoDB transaction, retain the previous owner before changing ownership, record unique activity/territory mutations, and reset both owners' territory counts from territory records. Claim activity IDs and attack activity/territory pairs are idempotent. If transactions are unavailable, the endpoint returns 503 and does not fall back to non-atomic writes.

## Root causes and changes

| Defect | Root cause | Remediation |
|---|---|---|
| Arbitrary claims/rewards | `/claim` accepted client `boundary`, `area`, `perimeter`, and `reward`; no activity evidence existed. | Endpoint now accepts an activity ID only. Private `Activity` state must be `serverValidated` + `verified` + `claimEligible`; the service validates the stored GeoJSON ring and derives area/perimeter itself. Client-supplied reward/geometry fields are ignored. |
| Fabricated attacks | `/attack` accepted caller-provided `attackDistance`. | Endpoint now accepts activity and territory IDs only; service requires owner-bound verified activity with matching server-computed eligible attack evidence. The client value cannot authorize the transfer. |
| Incorrect owner statistics | Previous owner was overwritten before the code used `territory.owner` to decrement its count; writes were separate. | Transfer captures old owner, conditionally updates territory against that owner, clears stale team ownership, inserts a unique attack record, counts territories for both owners, and updates both counts in the same transaction. |
| Retry/concurrency duplication | No claim/attack identity key or unique mutation record. | Unique sparse `claimActivity` index and unique `(activity, territory)` attack index; repeated operations return their previous result. Duplicate-key races retry only to read the committed result. |
| Malformed polygons | The server only checked that an array had three values. | Trusted stored polygon must be a single closed WGS84 ring with finite in-range coordinate pairs, at least three distinct vertices, a bounded point count, no proper self-crossing, and positive computed area/perimeter. |
| Oversized JSON | Express JSON parser had no explicit limit. | Set global JSON body limit to 64 KB. |
| Non-atomic fallback risk | Deployment transaction capability was unknown. | No non-transaction fallback is used. The API reports `transactions_unavailable` (503) if MongoDB lacks transaction support. |

### Activity trust boundary

`Activity` adds the smallest persistence contract required by these mutations: owner, verification state, server-derived claim polygon/eligibility, and server-derived per-territory attack eligibility. Defaults are unverified/ineligible. No public route accepts or writes the trust fields. No trusted producer exists yet, so callers cannot manufacture an eligible activity through these endpoints.

This prevents fabricated *reward fields* and replayed claims through the public API. It does **not** establish that a real person physically followed a client-submitted GPS path. Polygon validation alone cannot do that. A server-side trace ingestion and fraud/attestation design is still required before enabling successful gameplay. Until then, claim/attack mutations are deliberately unavailable for existing clients.

## Acceptance criteria and regression tests

The suite encodes these conditions:

- A server-verified, owner-bound, eligible activity creates exactly one territory with server-derived metrics.
- A malformed ID or polygon, unverified activity, or another user's activity creates no territory.
- Client `reward`, `area`, `perimeter`, `attackDistance`, `userId`, and `owner` values cannot influence the result.
- Replayed and concurrent claim/attack requests cannot award twice.
- Transfer resets both users' counts to match current territory ownership.
- A failure after partial work rolls the entire transaction back.
- A MongoDB deployment without transaction support fails closed with no writes.
- Mongoose ObjectId identities are normalized before authorization checks.

Test file: [gameMutations.test.js](/Users/skanakmegha/Documents/MEGHA/Personal-Development/TerritoryRun/server/services/gameMutations.test.js). It exercises the actual Express handlers and mutation service with an injected in-memory transaction repository. It uses no network listener, credentials, `.env`, or database.

## Files changed

- [server/services/gameMutations.js](/Users/skanakmegha/Documents/MEGHA/Personal-Development/TerritoryRun/server/services/gameMutations.js) — geometry validation, mutation service, Mongo transaction adapter, idempotent claim/attack, owner counts.
- [server/models/Activity.js](/Users/skanakmegha/Documents/MEGHA/Personal-Development/TerritoryRun/server/models/Activity.js) — private verified-evidence model; safe unverified defaults.
- [server/models/Attack.js](/Users/skanakmegha/Documents/MEGHA/Personal-Development/TerritoryRun/server/models/Attack.js) — unique activity/territory mutation record.
- [server/models/Territory.js](/Users/skanakmegha/Documents/MEGHA/Personal-Development/TerritoryRun/server/models/Territory.js) — claim activity reference and sparse unique index.
- [server/routes/game.js](/Users/skanakmegha/Documents/MEGHA/Personal-Development/TerritoryRun/server/routes/game.js) — injectable router; claim/attack accept evidence IDs only.
- [server/index.js](/Users/skanakmegha/Documents/MEGHA/Personal-Development/TerritoryRun/server/index.js) — JSON body size limit.
- [package.json](/Users/skanakmegha/Documents/MEGHA/Personal-Development/TerritoryRun/package.json) — `npm test` script.
- [server/services/gameMutations.test.js](/Users/skanakmegha/Documents/MEGHA/Personal-Development/TerritoryRun/server/services/gameMutations.test.js) — assertion-based API/service regression suite.
- [REMEDIATION_REPORT.md](/Users/skanakmegha/Documents/MEGHA/Personal-Development/TerritoryRun/REMEDIATION_REPORT.md) — this report.

Pre-existing dirty files were `app.json`, `mobile/App.js`, `mobile/app.json`, `mobile/src/hooks/useGameStore.js`, `mobile/src/utils/api.js`, `server/middleware/clerkAuth.js`, `server/routes/auth.js`, and `test-api.js`; they were not edited in this sprint. The existing `PRODUCT_AUDIT.md` was read and left unchanged.

## Commands and observed results

| Command | Result |
|---|---|
| `node --test server/services/gameMutations.test.js` before implementation | Failed as expected because the new mutation module did not yet exist. |
| First `npm test` with a loopback HTTP server | Blocked by sandbox: `listen EPERM` on `127.0.0.1`; suite was changed to call actual route handlers directly. No HTTP socket was opened afterward. |
| `npm test` final run | **Passed: 14 tests, 0 failures, 0 skipped.** Uses in-memory fixtures. |
| `npm run build` | **Passed**; same existing Vite warning for the 1.68 MB Mapbox chunk (463.56 kB gzip). |
| `npm run lint` | **Failed: 78 errors, 7 warnings** repository-wide, matching the audit baseline count. Errors are predominantly existing web/mobile lint findings and legacy test scripts. |
| `npx eslint server/services/gameMutations.js server/services/gameMutations.test.js server/models/Activity.js server/models/Attack.js` | **Passed** for all new service/model/test files. |
| Broader targeted ESLint over the new files plus existing game route, territory model and server entrypoint | **Failed on 9 existing findings**: Node `process` globals in the server entrypoint/legacy route-suggestion code and an empty catch in route suggestions. No findings in the new service, models or test file. |

No server, MongoDB, test database, or external API was started. The audit's legacy `test-db.js` was not run because it writes to the configured URI.

## Security and data-integrity implications

- Caller-controlled reward counts and metric values no longer flow into territory writes.
- A transfer records the prior owner before mutation, uses a compare-and-set ownership update, and recomputes both counters from territory ownership inside a transaction.
- Retry behavior is bounded to database uniqueness races; other persistence failures return a generic error without leaking database messages.
- A standalone MongoDB deployment will reject these writes. Deployment must use a replica set or MongoDB Atlas topology that supports transactions; verify this before rollout.
- Existing user counters may already be inconsistent from prior exploits/attacks. The first touched owner pair is recounted during a successful transaction, but a global backfill/reconciliation is not included.
- Existing territory documents have no `claimActivity`; sparse unique indexing preserves those documents. Index creation and current database index state have not been checked against a real DB.
- Existing clients still submit old claim/attack payloads and will receive validation/rejection until a client update and trusted activity producer ship.

## Product/security decisions still required

The audit confirms inconsistent current rules: web claims require a loop gap ≤50 m, distance ≥100 m and area ≥50 m²; mobile omits the area check; server previously enforced none. Attack proximity uses 30 m in the web client while the server threshold multiplies perimeter meters by strength in square meters, which is dimensionally inconsistent. This sprint does not choose or implement those mechanics.

Before a trusted activity verifier can set the eligibility fields, decide:

1. Whether the claim shape is the full GPS loop, a polygon derived from self-crossings, or cells/tiles; exact closure tolerance, minimum distance/area, and coordinate precision.
2. How overlapping territories, self-intersections, repeated/parallel paths, and simultaneous claims resolve.
3. Whether attack progress means distance along a boundary, distance within a proximity corridor, or another rule; define units, reset/decay, and repeat-use behavior.
4. What server evidence is acceptable for movement quality and spoof resistance, how long raw traces are kept, and whether platform integrity/attestation is required.
5. Whether MongoDB deployment supports transactions and how existing statistics are reconciled.

## Recommended next sprint

Build the activity ingestion and verification pipeline only after those decisions: accept bounded timestamped samples with accuracy metadata into private storage; calculate distance/geometry on the server; apply deterministic anti-jump/gap/replay checks; produce immutable verification and eligibility evidence; and add retention/deletion controls. Then update the mobile/web clients to submit activity IDs and display pending/rejected/success results, and validate the Mongo transaction/index behavior against an isolated replica-set test database. Do not enable territory awards until that evidence producer and device/privacy policy are reviewed.
