import test from 'node:test';
import assert from 'node:assert/strict';
import { createActivityLifecycle, validateActivitySamples } from './activityLifecycle.js';
import { createGameRouter } from '../routes/game.js';
import authRouter from '../routes/auth.js';
import { clerkAuth } from '../middleware/clerkAuth.js';

const OWNER = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const ACTIVITY = 'cccccccccccccccccccccccc';
const samples = [
  { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 8 },
  { lat: 40.7484, lng: -73.9847, timestamp: 112000, accuracy: 8 },
  { lat: 40.7494, lng: -73.9847, timestamp: 124000, accuracy: 8 },
  { lat: 40.7494, lng: -73.9857, timestamp: 136000, accuracy: 8 },
  { lat: 40.7484, lng: -73.9857, timestamp: 148000, accuracy: 8 },
];

function rectangle(widthM, heightM) {
  const lat = 40.7484;
  const lng = -73.9857;
  const latDelta = (meters) => meters / 111195;
  const lngDelta = (meters) => meters / (111195 * Math.cos(lat * Math.PI / 180));
  return [
    { lat, lng, timestamp: 100000, accuracy: 8 },
    { lat, lng: lng + lngDelta(widthM), timestamp: 110000, accuracy: 8 },
    { lat: lat + latDelta(heightM), lng: lng + lngDelta(widthM), timestamp: 120000, accuracy: 8 },
    { lat: lat + latDelta(heightM), lng, timestamp: 130000, accuracy: 8 },
    { lat, lng, timestamp: 140000, accuracy: 8 },
  ];
}

// Acceptance criteria: authenticated owner is fixed at recording creation;
// submitted raw samples are persisted before validation; only server-derived
// loop geometry and metrics reach mutation; invalid traces never mutate;
// repeated identical submissions return one durable receipt; changed or foreign
// submissions fail; failed persistence is retryable without partial awards.
function fixture() {
  const records = new Map();
  let writesFail = false;
  const awardedIds = new Set();
  let claimCalls = 0;
  let claimFail = false;
  let created = 0;
  const repository = {
    async findByKey(owner, key) { return [...records.values()].find((a) => a.owner === owner && a.clientActivityId === key) || null; },
    async findByFingerprint(owner, fingerprint) { return [...records.values()].find((a) => a.owner === owner && a.submissionHash === fingerprint) || null; },
    async create(data) {
      const id = created++ === 0 ? ACTIVITY : 'ffffffffffffffffffffffff';
      const record = { ...data, _id: id, status: 'recording', serverValidated: false };
      records.set(id, record);
      return record;
    },
    async getOwned(id, owner) { const a = records.get(id); return a?.owner === owner ? a : null; },
    async saveSubmission(id, owner, hash, points) {
      if (writesFail) throw new Error('injected write failure');
      if ([...records.values()].some((a) => a.owner === owner && a.submissionHash === hash && a._id !== id)) {
        throw Object.assign(new Error('duplicate trace'), { code: 11000 });
      }
      const a = records.get(id);
      if (!a || a.owner !== owner || a.status !== 'recording') return null;
      Object.assign(a, { submissionHash: hash, samples: structuredClone(points), status: 'submitted' });
      return a;
    },
    async finishValidation(id, status, validation, rejectionReason) {
      if (writesFail) throw new Error('injected write failure');
      const a = records.get(id);
      if (a?.status !== 'submitted') return null;
      Object.assign(a, { status, validation, rejectionReason, serverValidated: true,
        claimEligible: status === 'accepted', claimBoundary: validation.boundary });
      return a;
    },
    async markProcessed(id, result) {
      if (writesFail) throw new Error('injected write failure');
      const a = records.get(id);
      if (a?.status !== 'accepted') return null;
      Object.assign(a, { status: 'processed', claimResult: result });
      return a;
    },
  };
  const mutations = {
    async claim({ userId, activityId }) {
      const a = records.get(activityId);
      assert.equal(a.owner, userId);
      assert.equal(a.status, 'accepted');
      assert.equal(a.serverValidated, true);
      assert.equal(a.claimEligible, true);
      claimCalls += 1;
      if (claimFail) return { status: 503, body: { success: false, code: 'persistence_error' } };
      const alreadyApplied = awardedIds.has(activityId);
      awardedIds.add(activityId);
      return { status: alreadyApplied ? 200 : 201, body: { success: true, alreadyApplied, territory: { _id: 'dddddddddddddddddddddddd', owner: userId,
        area_sqm: a.validation.area_sqm, perimeter_m: a.validation.perimeter_m, boundary: a.claimBoundary } } };
    },
  };
  const service = createActivityLifecycle({ repository, mutations });
  return { records, service, setWritesFail(v) { writesFail = v; }, setClaimFail(v) { claimFail = v; },
    get claims() { return awardedIds.size; }, get claimCalls() { return claimCalls; } };
}

async function start(f, owner = OWNER, key = 'client-activity-0001') {
  return f.service.start({ ownerId: owner, clientActivityId: key });
}

test('valid first activity is validated from samples and produces a server-computed claim', async () => {
  const f = fixture();
  const opened = await start(f);
  assert.equal(opened.status, 201);
  const result = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples });
  assert.equal(result.status, 201);
  assert.equal(result.body.status, 'processed');
  assert.ok(result.body.outcome.area_sqm > 50);
  assert.ok(result.body.outcome.perimeter_m > 100);
  assert.deepEqual(f.records.get(ACTIVITY).claimBoundary, f.records.get(ACTIVITY).validation.boundary);
  assert.equal(f.claims, 1);
});

test('restarting recording with the same owner key returns its original activity ID', async () => {
  const f = fixture();
  const first = await start(f);
  const retry = await start(f);
  assert.equal(first.status, 201);
  assert.equal(retry.status, 200);
  assert.equal(first.body.activity.id, retry.body.activity.id);
  assert.equal(f.records.size, 1);
});

test('malformed polygon-like traces are rejected without awarding a territory', async () => {
  const f = fixture();
  await start(f);
  const malformed = samples.map((point) => ({ ...point }));
  malformed[2].lng = 500;
  const result = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples: malformed });
  assert.equal(result.status, 422);
  assert.equal(result.body.status, 'rejected');
  assert.equal(f.records.get(ACTIVITY).rejectionReason.code, 'invalid_sample');
  assert.equal(f.claims, 0);
});

test('claim rule boundaries accept 49 m closure and reject 51 m closure', () => {
  const within = samples.map((sample) => ({ ...sample }));
  within[4].lat += 49 / 111195;
  within[4].timestamp = 156000;
  assert.ok(validateActivitySamples(within).area_sqm >= 50);

  const outside = samples.map((sample) => ({ ...sample }));
  outside[4].lat += 51 / 111195;
  outside[4].timestamp = 156000;
  assert.throws(() => validateActivitySamples(outside), /within 50 m/);
});

test('minimum distance and area rules are independently enforced', () => {
  assert.throws(() => validateActivitySamples(rectangle(24.9, 25)), /at least 100 m/);
  assert.ok(validateActivitySamples(rectangle(25.1, 25)).distance_m >= 100);
  assert.throws(() => validateActivitySamples(rectangle(0.6, 50)), /at least 50 m²/);
});

test('accuracy, order, sample gaps, duplicate points, speed and self-crossings are rejected', () => {
  const poorAccuracy = samples.map((sample) => ({ ...sample }));
  poorAccuracy[1].accuracy = 31;
  assert.throws(() => validateActivitySamples(poorAccuracy), /accuracy are invalid/);

  const outOfOrder = samples.map((sample) => ({ ...sample }));
  outOfOrder[2].timestamp = outOfOrder[1].timestamp;
  assert.throws(() => validateActivitySamples(outOfOrder), /strictly increasing/);

  const sparse = samples.map((sample) => ({ ...sample }));
  sparse[2].timestamp = sparse[1].timestamp + 30001;
  assert.throws(() => validateActivitySamples(sparse), /gap is too large/);

  const duplicate = samples.map((sample) => ({ ...sample }));
  duplicate[1].lat = duplicate[0].lat;
  duplicate[1].lng = duplicate[0].lng;
  assert.throws(() => validateActivitySamples(duplicate), /duplicate GPS samples/);

  const fast = samples.map((sample) => ({ ...sample }));
  fast[1].timestamp = fast[0].timestamp + 1000;
  assert.throws(() => validateActivitySamples(fast), /supported travel speed/);

  const crossing = [
    { lat: 40, lng: -73, timestamp: 100000, accuracy: 8 },
    { lat: 40.001, lng: -72.999, timestamp: 120000, accuracy: 8 },
    { lat: 40, lng: -72.999, timestamp: 140000, accuracy: 8 },
    { lat: 40.001, lng: -73, timestamp: 160000, accuracy: 8 },
    { lat: 40, lng: -73, timestamp: 180000, accuracy: 8 },
  ];
  assert.throws(() => validateActivitySamples(crossing), /simple loop/);
});

test('stationary phone with GPS jitter does not accumulate distance', () => {
  // Phone standing still; GPS jitter causes small coordinate changes within
  // the combined accuracy radius of consecutive samples. These should not
  // accumulate distance, leaving the trace below the 100 m minimum.
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 8 };
  const jittered = [
    origin,
    { lat: 40.7484 + 0.00005, lng: -73.9857, timestamp: 110000, accuracy: 8 },
    { lat: 40.7484, lng: -73.9857 + 0.00005, timestamp: 120000, accuracy: 8 },
    { lat: 40.7484 - 0.00005, lng: -73.9857, timestamp: 130000, accuracy: 8 },
    { lat: 40.7484, lng: -73.9857 - 0.00005, timestamp: 140000, accuracy: 8 },
    { lat: 40.7484, lng: -73.9857, timestamp: 150000, accuracy: 8 },
  ];
  // Jitter steps (~5 m) are within combined accuracy (16 m) → skipped, not counted as duplicates.
  // Distance stays 0 → rejected as too short, not as duplicate samples.
  assert.throws(
    () => validateActivitySamples(jittered),
    (err) => err.code === 'distance_too_short' && err.message.includes('100 m')
  );
});

test('genuinely moving phone accumulates distance correctly', () => {
  // Phone walks a 30 m square loop = 120 m total, accuracy 5 m each, 10 s between samples.
  // Combined accuracy = 10 m, movement per side = 30 m > 10 m → counted.
  // Speed = 30 m / 10 s = 3 m/s < 12 m/s limit.
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 5 };
  const step = 30 / 111195;
  const samples = [
    origin,
    { lat: 40.7484, lng: -73.9857 + step, timestamp: 110000, accuracy: 5 },
    { lat: 40.7484 + step, lng: -73.9857 + step, timestamp: 120000, accuracy: 5 },
    { lat: 40.7484 + step, lng: -73.9857, timestamp: 130000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857, timestamp: 140000, accuracy: 5 },
  ];
  const result = validateActivitySamples(samples);
  // Distance should be ~120 m (4 sides × 30 m), above production 100 m minimum.
  assert.ok(result.distance_m > 100, `expected distance > 100 m, got ${result.distance_m}`);
  assert.ok(result.area_sqm > 0, `expected positive area, got ${result.area_sqm}`);
});

test('implausible GPS jump is rejected', () => {
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 8 };
  const samples = [
    origin,
    { lat: 40.75, lng: -73.9857, timestamp: 101000, accuracy: 8 }, // ~178 m in 1 s ≈ 178 m/s
    { lat: 40.75, lng: -73.984, timestamp: 102000, accuracy: 8 },
    { lat: 40.7484, lng: -73.984, timestamp: 103000, accuracy: 8 },
    { lat: 40.7484, lng: -73.9857, timestamp: 104000, accuracy: 8 },
  ];
  assert.throws(() => validateActivitySamples(samples), /supported travel speed/);
});

test('forged reward, area, perimeter and distance fields are ignored', async () => {
  const f = fixture();
  await start(f);
  const forged = samples.map((point) => ({ ...point }));
  const result = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples: forged,
    reward: 9999999, area: 9999999, perimeter: 9999999, distance: 9999999 });
  assert.equal(result.status, 201);
  assert.notEqual(result.body.outcome.area_sqm, 9999999);
  assert.notEqual(result.body.outcome.perimeter_m, 9999999);
  assert.equal(f.claims, 1);
});

test('replayed identical submission returns the same processed receipt and awards once', async () => {
  const f = fixture();
  await start(f);
  const first = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples });
  const replay = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples });
  assert.equal(first.body.outcome._id, replay.body.outcome._id);
  assert.equal(replay.body.alreadyProcessed, true);
  assert.equal(f.claims, 1);
});

test('the same exact trace cannot be awarded again under a fresh activity ID', async () => {
  const f = fixture();
  await start(f);
  await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples });
  const second = await start(f, OWNER, 'client-activity-0002');
  const replay = await f.service.submit({ ownerId: OWNER, activityId: second.body.activity.id, samples });
  assert.equal(replay.status, 409);
  assert.equal(replay.body.code, 'trace_replayed');
  assert.equal(f.claims, 1);
});

test('a changed trace or a different authenticated owner cannot use a recording', async () => {
  const f = fixture();
  await start(f);
  assert.equal((await f.service.submit({ ownerId: OTHER, activityId: ACTIVITY, samples })).status, 404);
  await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples });
  const changed = samples.map((point) => ({ ...point }));
  changed[1].accuracy = 7;
  const conflict = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples: changed });
  assert.equal(conflict.status, 409);
  assert.equal(f.claims, 1);
});

test('activity routes bind creation and submission to the authenticated user', async () => {
  const f = fixture();
  const router = createGameRouter({ service: { claim: async () => ({ status: 500, body: {} }) },
    activityService: f.service, auth: (req, res, next) => next() });
  const invoke = async (path, params, body, authenticatedOwner) => {
    const route = router.stack.find((layer) => layer.route?.path === path)?.route;
    assert.ok(route, `route ${path} exists`);
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } };
    await route.stack.at(-1).handle({ params, body, user: { _id: authenticatedOwner } }, response);
    return response;
  };
  const opened = await invoke('/activities', {}, { clientActivityId: 'client-activity-0001', ownerId: OTHER }, OWNER);
  assert.equal(opened.statusCode, 201);
  assert.equal(f.records.get(ACTIVITY).owner, OWNER);
  const foreign = await invoke('/activities/:activityId/submit', { activityId: ACTIVITY }, { samples }, OTHER);
  assert.equal(foreign.statusCode, 404);
  assert.equal(f.claims, 0);
});

test('profile route path matches the mobile API URL under the server mount prefix', () => {
  assert.ok(authRouter.stack.some((layer) => layer.route?.path === '/profile'));
});

test('real Clerk middleware rejects missing and malformed bearer authentication before user lookup', async () => {
  for (const authorization of [undefined, 'Bearer']) {
    let nextCalled = false;
    const response = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; return this; },
    };
    await clerkAuth({ headers: authorization ? { authorization } : {} }, response, () => { nextCalled = true; });
    assert.equal(response.statusCode, 401);
    assert.equal(nextCalled, false);
  }
});

test('recording persistence failure is retried with the same id without an award', async () => {
  const f = fixture();
  await start(f);
  f.setWritesFail(true);
  const failed = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples });
  assert.equal(failed.status, 503);
  assert.equal(f.claims, 0);
  f.setWritesFail(false);
  const retry = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples });
  assert.equal(retry.status, 201);
  assert.equal(f.claims, 1);
});

test('territory mutation failure leaves an accepted durable activity that retry can process once', async () => {
  const f = fixture();
  await start(f);
  f.setClaimFail(true);
  const failed = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples });
  assert.equal(failed.status, 503);
  assert.equal(f.records.get(ACTIVITY).status, 'accepted');
  f.setClaimFail(false);
  const retry = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples });
  assert.equal(retry.status, 201);
  assert.equal(retry.body.status, 'processed');
  assert.equal(f.records.get(ACTIVITY).status, 'processed');
});

test('repeated concurrent submissions rely on idempotent mutation and leave one processed activity', async () => {
  const f = fixture();
  await start(f);
  const results = await Promise.all([
    f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples }),
    f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples }),
  ]);
  assert.ok(results.every((result) => result.body.success));
  assert.equal(f.records.get(ACTIVITY).status, 'processed');
  assert.equal(f.claims, 1);
});

test('noisy samples: movement within accuracy threshold does not accumulate, movement above does', () => {
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 8 };
  // Step 1: ~3 m movement, accuracy 8+8=16 combined → within threshold → skipped
  // Step 2: ~25 m movement, accuracy 8+8=16 combined → above threshold → counted
  // Step 3: ~2 m movement, accuracy 8+8=16 combined → within threshold → skipped
  // Step 4: ~30 m movement, accuracy 5+5=10 combined → above threshold → counted
  const step3m = 3 / 111195;
  const step25m = 25 / 111195;
  const step2m = 2 / 111195;
  const step30m = 30 / 111195;
  const noisy = [
    origin,
    { lat: 40.7484, lng: -73.9857 + step3m, timestamp: 110000, accuracy: 8 },
    { lat: 40.7484 + step25m, lng: -73.9857 + step3m, timestamp: 120000, accuracy: 8 },
    { lat: 40.7484 + step25m + step2m, lng: -73.9857 + step3m, timestamp: 130000, accuracy: 8 },
    { lat: 40.7484 + step25m + step30m, lng: -73.9857 + step3m + step2m, timestamp: 140000, accuracy: 5 },
    { lat: 40.7484 + step25m, lng: -73.9857 + step3m + step2m, timestamp: 150000, accuracy: 5 },
  ];
  // Only steps 2 (25 m) and 4 (30 m) are above accuracy threshold → ~55 m total
  // Below 100 m production minimum → rejected as too short
  assert.throws(
    () => validateActivitySamples(noisy),
    (err) => err.code === 'distance_too_short'
  );
});

test('cumulative distance is strictly monotonic with back-and-forth GPS movement', () => {
  // Phone walks forward 10 m, then back 5 m, then forward 15 m.
  // Each segment > accuracy threshold (5+5=10 m), so all are counted.
  // Distance should be 10 + 5 + 15 = 30 m and never decrease.
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 5 };
  const step10m = 10 / 111195;
  const step5m = 5 / 111195;
  const step15m = 15 / 111195;
  const backAndForth = [
    origin,
    { lat: 40.7484 + step10m, lng: -73.9857, timestamp: 110000, accuracy: 5 },
    { lat: 40.7484 + step5m, lng: -73.9857, timestamp: 120000, accuracy: 5 },
    { lat: 40.7484 + step15m, lng: -73.9857, timestamp: 130000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857, timestamp: 140000, accuracy: 5 },
  ];
  // Total movement ≈ 10 + 5 + 15 + 15 (return to origin) = 45 m
  // Below 100 m production minimum → rejected as too short, but distance accumulated monotonically
  assert.throws(
    () => validateActivitySamples(backAndForth),
    (err) => err.code === 'distance_too_short'
  );
});

test('validation failure returns 422 with structured reason code', async () => {
  const f = fixture();
  await start(f);
  // Submit a trace that's too short (under 100 m production minimum)
  const shortTrace = [
    { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857 + 10 / 111195, timestamp: 110000, accuracy: 5 },
    { lat: 40.7484 + 10 / 111195, lng: -73.9857 + 10 / 111195, timestamp: 120000, accuracy: 5 },
    { lat: 40.7484 + 10 / 111195, lng: -73.9857, timestamp: 130000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857, timestamp: 140000, accuracy: 5 },
  ];
  const result = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples: shortTrace });
  assert.equal(result.status, 422);
  assert.equal(result.body.status, 'rejected');
  assert.equal(result.body.reason.code, 'distance_too_short');
  assert.equal(f.claims, 0);
});

test('loop not closed returns 422 with structured reason code', async () => {
  const f = fixture();
  await start(f);
  // Open trace — end point far from start (> 50 m closure)
  const openTrace = [
    { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857 + 100 / 111195, timestamp: 110000, accuracy: 5 },
    { lat: 40.7484 + 100 / 111195, lng: -73.9857 + 100 / 111195, timestamp: 120000, accuracy: 5 },
    { lat: 40.7484 + 100 / 111195, lng: -73.9857, timestamp: 130000, accuracy: 5 },
    { lat: 40.7484 + 200 / 111195, lng: -73.9857, timestamp: 140000, accuracy: 5 },
  ];
  const result = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples: openTrace });
  assert.equal(result.status, 422);
  assert.equal(result.body.status, 'rejected');
  assert.equal(result.body.reason.code, 'loop_not_closed');
  assert.equal(f.claims, 0);
});

test('duplicate tap on submission is idempotent — no double award', async () => {
  const f = fixture();
  await start(f);
  const first = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples });
  assert.equal(first.status, 201);
  assert.equal(f.claims, 1);
  // Immediate duplicate tap with same samples
  const second = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples });
  assert.equal(second.status, 200);
  assert.equal(second.body.alreadyProcessed, true);
  assert.equal(f.claims, 1);
});

test('route just below 100m minimum is rejected', async () => {
  const f = fixture();
  await start(f);
  const step = 23 / 111195; // ~23m per side, total ~92m < 100m
  const shortTrace = [
    { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857 + step, timestamp: 110000, accuracy: 5 },
    { lat: 40.7484 + step, lng: -73.9857 + step, timestamp: 120000, accuracy: 5 },
    { lat: 40.7484 + step, lng: -73.9857, timestamp: 130000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857, timestamp: 140000, accuracy: 5 },
  ];
  const result = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples: shortTrace });
  assert.equal(result.status, 422);
  assert.equal(result.body.status, 'rejected');
  assert.equal(result.body.reason.code, 'distance_too_short');
  assert.equal(f.claims, 0);
  // Activity preserved for retry
  assert.equal(f.records.get(ACTIVITY).status, 'rejected');
});

test('route just above 100m minimum is accepted', async () => {
  const f = fixture();
  await start(f);
  const step = 40 / 111195; // ~40m per side, total ~160m > 100m
  const validTrace = [
    { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857 + step, timestamp: 110000, accuracy: 5 },
    { lat: 40.7484 + step, lng: -73.9857 + step, timestamp: 120000, accuracy: 5 },
    { lat: 40.7484 + step, lng: -73.9857, timestamp: 130000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857, timestamp: 140000, accuracy: 5 },
  ];
  const result = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples: validTrace });
  assert.equal(result.status, 201);
  assert.equal(result.body.status, 'processed');
  assert.equal(f.claims, 1);
});

test('failed submission transitions to rejected and fresh activity can be submitted', async () => {
  const f = fixture();
  await start(f);
  const shortTrace = [
    { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857 + 20 / 111195, timestamp: 110000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857, timestamp: 120000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857, timestamp: 130000, accuracy: 5 },
  ];
  const rejected = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples: shortTrace });
  assert.equal(rejected.status, 422);
  assert.equal(f.claims, 0);
  // Activity correctly transitions to rejected state after validation failure
  assert.equal(f.records.get(ACTIVITY).status, 'rejected');
  assert.equal(f.records.get(ACTIVITY).rejectionReason.code, 'duplicate_sample');

  // A fresh recording activity with valid trace (>100m) succeeds
  const opened2 = await start(f, OWNER, 'client-activity-0002');
  const validTrace = rectangle(30, 30);
  const fresh = await f.service.submit({ ownerId: OWNER, activityId: opened2.body.activity.id, samples: validTrace });
  assert.equal(fresh.status, 201);
  assert.equal(fresh.body.status, 'processed');
  assert.equal(f.claims, 1);
});

test('retrying rejected submission does not double award territory', async () => {
  const f = fixture();
  await start(f);
  const shortTrace = [
    { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857 + 20 / 111195, timestamp: 110000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857, timestamp: 120000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857, timestamp: 130000, accuracy: 5 },
  ];
  const first = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples: shortTrace });
  assert.equal(first.status, 422);
  assert.equal(f.claims, 0);
  // Retry same rejected activity — still rejected, no award
  const retry = await f.service.submit({ ownerId: OWNER, activityId: ACTIVITY, samples: shortTrace });
  assert.equal(retry.status, 422);
  assert.equal(f.claims, 0);
});
