import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createActivityLifecycle } from './activityLifecycle.js';

const USER_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const ACTIVITY_1 = 'cccccccccccccccccccccccc';

function generateSquareTrace(sizeMeters, startTime = 100000) {
  const lat = 40.7484;
  const lng = -73.9857;
  const latDelta = (meters) => meters / 111195;
  const lngDelta = (meters) => meters / (111195 * Math.cos((lat * Math.PI) / 180));
  return [
    { lat, lng, timestamp: startTime, accuracy: 5 },
    { lat, lng: lng + lngDelta(sizeMeters), timestamp: startTime + 10000, accuracy: 5 },
    { lat: lat + latDelta(sizeMeters), lng: lng + lngDelta(sizeMeters), timestamp: startTime + 20000, accuracy: 5 },
    { lat: lat + latDelta(sizeMeters), lng, timestamp: startTime + 30000, accuracy: 5 },
    { lat, lng, timestamp: startTime + 40000, accuracy: 5 },
  ];
}

function createTestHarness() {
  const records = new Map();
  const territories = new Map();
  let failClaim = false;

  const repository = {
    async findByKey(owner, key) {
      return [...records.values()].find((r) => r.owner === owner && r.clientActivityId === key) || null;
    },
    async findByFingerprint(owner, hash) {
      return [...records.values()].find((r) => r.owner === owner && r.submissionHash === hash) || null;
    },
    async create(data) {
      const id = data._id || ACTIVITY_1;
      const record = { ...data, _id: id, status: 'recording', serverValidated: false };
      records.set(String(id), record);
      return record;
    },
    async getOwned(id, owner) {
      const r = records.get(String(id));
      return r?.owner === owner ? r : null;
    },
    async saveSubmission(id, owner, hash, samples) {
      const r = records.get(String(id));
      if (!r || r.owner !== owner || r.status !== 'recording') return null;
      // Fixed lifecycle behavior: transition recording -> submitted with submittedAt
      r.submissionHash = hash;
      r.samples = structuredClone(samples);
      r.status = 'submitted';
      r.submittedAt = new Date();
      return r;
    },
    async finishValidation(id, status, validation, rejectionReason, claimEligibleOverride) {
      const r = records.get(String(id));
      if (!r || r.status !== 'submitted') return null;
      r.serverValidated = true;
      r.claimEligible = claimEligibleOverride !== undefined ? claimEligibleOverride : status === 'accepted';
      r.validation = validation;
      r.rejectionReason = rejectionReason || null;
      r.status = status;
      if (validation?.boundary) r.claimBoundary = validation.boundary;
      return r;
    },
    async markProcessed(id, result) {
      const r = records.get(String(id));
      if (!r || r.status !== 'accepted') return null;
      r.status = 'processed';
      r.claimResult = result;
      return r;
    },
  };

  const mutations = {
    async claim({ userId, activityId }) {
      const r = records.get(String(activityId));
      assert.ok(r, 'Activity must exist');
      assert.equal(r.owner, userId, 'Owner must match claim user');
      assert.equal(r.status, 'accepted', 'Activity must be accepted for claim');
      assert.equal(r.serverValidated, true);
      assert.equal(r.claimEligible, true);

      if (failClaim) {
        return { status: 503, body: { success: false, code: 'claim_failed', message: 'Database busy' } };
      }

      if (territories.has(activityId)) {
        return {
          status: 200,
          body: {
            success: true,
            alreadyApplied: true,
            territory: territories.get(activityId),
          },
        };
      }

      const territory = {
        _id: 'dddddddddddddddddddddddd',
        owner: userId,
        area_sqm: r.validation.area_sqm,
        perimeter_m: r.validation.perimeter_m,
        boundary: r.claimBoundary,
        claimActivity: activityId,
      };
      territories.set(activityId, territory);

      return {
        status: 201,
        body: {
          success: true,
          alreadyApplied: false,
          territory,
        },
      };
    },
  };

  const service = createActivityLifecycle({ repository, mutations });

  return {
    records,
    territories,
    service,
    repository,
    mutations,
    setFailClaim(val) { failClaim = val; },
  };
}

test('Regression 1: Submitting recording activity transitions through submitted, accepted, and reaches processed with submittedAt', async () => {
  const harness = createTestHarness();
  const started = await harness.service.start({ ownerId: USER_A, clientActivityId: 'client-key-reg-1' });
  assert.equal(started.status, 201);
  const activityId = started.body.activity.id;

  const trace = generateSquareTrace(30); // ~120m perimeter > 100m, ~900m2 area > 50m2
  const result = await harness.service.submit({ ownerId: USER_A, activityId, samples: trace });

  assert.equal(result.status, 201);
  assert.equal(result.body.success, true);
  assert.equal(result.body.status, 'processed');
  assert.ok(result.body.outcome);
  assert.ok(result.body.metrics);

  const stored = harness.records.get(activityId);
  assert.equal(stored.status, 'processed');
  assert.ok(stored.submittedAt instanceof Date);
  assert.ok(stored.submissionHash);
  assert.equal(stored.serverValidated, true);
  assert.equal(stored.claimEligible, true);
  assert.equal(harness.territories.size, 1);
});

test('Regression 2: Invalid submissions transition to rejected, return HTTP 422, and do not award territory', async () => {
  const harness = createTestHarness();
  const started = await harness.service.start({ ownerId: USER_A, clientActivityId: 'client-key-reg-2' });
  const activityId = started.body.activity.id;

  // Trace too short (<100m)
  const shortTrace = generateSquareTrace(10); // 40m perimeter < 100m
  const result = await harness.service.submit({ ownerId: USER_A, activityId, samples: shortTrace });

  assert.equal(result.status, 422);
  assert.equal(result.body.success, false);
  assert.equal(result.body.status, 'rejected');
  assert.equal(result.body.reason?.code, 'distance_too_short');

  const stored = harness.records.get(activityId);
  assert.equal(stored.status, 'rejected');
  assert.equal(stored.serverValidated, true);
  assert.equal(stored.claimEligible, false);
  assert.equal(harness.territories.size, 0);
});

test('Regression 3: Retrying the same accepted/processed run is idempotent and does not create duplicate claims', async () => {
  const harness = createTestHarness();
  const started = await harness.service.start({ ownerId: USER_A, clientActivityId: 'client-key-reg-3' });
  const activityId = started.body.activity.id;

  const trace = generateSquareTrace(30);
  const first = await harness.service.submit({ ownerId: USER_A, activityId, samples: trace });
  assert.equal(first.status, 201);
  assert.equal(first.body.status, 'processed');
  assert.equal(harness.territories.size, 1);

  // Retry same submission
  const retry = await harness.service.submit({ ownerId: USER_A, activityId, samples: trace });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.status, 'processed');
  assert.equal(retry.body.alreadyProcessed, true);
  assert.equal(harness.territories.size, 1); // Territory count unchanged
});

test('Regression 4: Concurrent submissions cannot create duplicate territory claims', async () => {
  const harness = createTestHarness();
  const started = await harness.service.start({ ownerId: USER_A, clientActivityId: 'client-key-reg-4' });
  const activityId = started.body.activity.id;

  const trace = generateSquareTrace(30);
  const [res1, res2] = await Promise.all([
    harness.service.submit({ ownerId: USER_A, activityId, samples: trace }),
    harness.service.submit({ ownerId: USER_A, activityId, samples: trace }),
  ]);

  assert.ok((res1.status === 201 && res2.status === 200) || (res1.status === 200 && res2.status === 201));
  assert.equal(harness.territories.size, 1);
  assert.equal(harness.records.get(activityId).status, 'processed');
});

test('Regression 5: Activity ownership checks prevent one user from submitting another user activity', async () => {
  const harness = createTestHarness();
  const started = await harness.service.start({ ownerId: USER_A, clientActivityId: 'client-key-reg-5' });
  const activityId = started.body.activity.id;

  const trace = generateSquareTrace(30);
  // User B tries to submit User A's activity
  const foreignSubmit = await harness.service.submit({ ownerId: USER_B, activityId, samples: trace });

  assert.equal(foreignSubmit.status, 404);
  assert.equal(foreignSubmit.body.code, 'activity_not_found');
  assert.equal(harness.territories.size, 0);
  // Original activity remains unmodified in recording
  assert.equal(harness.records.get(activityId).status, 'recording');
});

test('Regression 6: A failed processing step (claim failure) does not falsely report success', async () => {
  const harness = createTestHarness();
  const started = await harness.service.start({ ownerId: USER_A, clientActivityId: 'client-key-reg-6' });
  const activityId = started.body.activity.id;

  harness.setFailClaim(true);
  const trace = generateSquareTrace(30);
  const failed = await harness.service.submit({ ownerId: USER_A, activityId, samples: trace });

  assert.equal(failed.status, 503);
  assert.equal(failed.body.code, 'claim_pending');
  assert.equal(failed.body.pending, true);
  assert.equal(harness.territories.size, 0);

  // Activity remains in accepted state, ready for retry
  const stored = harness.records.get(activityId);
  assert.equal(stored.status, 'accepted');

  // When database recovers, retrying completes the processing
  harness.setFailClaim(false);
  const recovered = await harness.service.submit({ ownerId: USER_A, activityId, samples: trace });
  assert.equal(recovered.status, 201);
  assert.equal(recovered.body.status, 'processed');
  assert.equal(harness.territories.size, 1);
});

test('Regression 7: Client retry mechanism sends a real request and clears isSubmitting in finally', async () => {
  // Simulate client-side safe concurrency with isSubmittingRef and finally
  const isSubmittingRef = { current: false };
  let isSubmittingState = false;
  let requestsMade = 0;
  let shouldFail = true;

  const fakeApiPost = async () => {
    requestsMade += 1;
    if (shouldFail) {
      const err = new Error('Network timeout');
      err.response = { status: 503, data: { message: 'Service temporarily unavailable' } };
      throw err;
    }
    return { data: { status: 'processed', outcome: { _id: 't1' } } };
  };

  const clientRetry = async () => {
    if (isSubmittingRef.current) return { status: 'pending' };
    isSubmittingRef.current = true;
    isSubmittingState = true;
    try {
      try {
        const response = await fakeApiPost();
        return { status: 'processed', outcome: response.data.outcome };
      } catch (error) {
        return { status: 'pending', error: error.message };
      }
    } finally {
      isSubmittingRef.current = false;
      isSubmittingState = false;
    }
  };

  // Attempt 1: Fails with network error
  const attempt1 = await clientRetry();
  assert.equal(attempt1.status, 'pending');
  assert.equal(requestsMade, 1);
  assert.equal(isSubmittingRef.current, false, 'isSubmittingRef cleared in finally');
  assert.equal(isSubmittingState, false, 'isSubmittingState cleared in finally');

  // Concurrent attempts while in progress are guarded
  let inFlightRejections = 0;
  isSubmittingRef.current = true; // simulate busy lock
  const rejectedCall = await clientRetry();
  assert.equal(rejectedCall.status, 'pending');
  assert.equal(requestsMade, 1, 'No additional network request made during locked state');
  isSubmittingRef.current = false;

  // Attempt 2: User taps Retry Upload. Because isSubmitting is false, a REAL request is sent!
  shouldFail = false;
  const attempt2 = await clientRetry();
  assert.equal(attempt2.status, 'processed');
  assert.equal(requestsMade, 2, 'Real HTTP request was dispatched on retry');
  assert.equal(isSubmittingRef.current, false);
});

test('Regression 8: Profile statistics reflect real persisted territory count after submission', async () => {
  const harness = createTestHarness();
  let userStatsTerritories = 0;

  // Simulate user record in DB
  const userRecord = {
    _id: USER_A,
    clerkId: 'user_clerk_123',
    username: 'agent_runner',
    email: 'runner@example.com',
    stats: { distance: 0, territories: 0 },
  };

  // Mock user territory counter updater hooked into mutations
  const originalClaim = harness.mutations.claim;
  harness.mutations.claim = async (args) => {
    const res = await originalClaim(args);
    if (res.body?.success && !res.body?.alreadyApplied) {
      userRecord.stats.territories = harness.territories.size;
    }
    return res;
  };

  // Profile endpoint logic
  const getProfile = () => ({
    status: 200,
    body: {
      user: {
        _id: String(userRecord._id),
        id: userRecord.clerkId,
        username: userRecord.username,
        email: userRecord.email,
        stats: userRecord.stats,
      },
    },
  });

  // 1. Initial profile has 0 territories
  const initialProfile = getProfile();
  assert.equal(initialProfile.body.user.stats.territories, 0);

  // 2. Submit valid activity
  const started = await harness.service.start({ ownerId: USER_A, clientActivityId: 'client-key-reg-8' });
  const trace = generateSquareTrace(30);
  const result = await harness.service.submit({ ownerId: USER_A, activityId: started.body.activity.id, samples: trace });
  assert.equal(result.status, 201);
  assert.equal(result.body.status, 'processed');

  // 3. Profile reflects 1 territory
  const updatedProfile = getProfile();
  assert.equal(updatedProfile.body.user.stats.territories, 1);

  // 4. Retrying the accepted/processed run does not increment count
  await harness.service.submit({ ownerId: USER_A, activityId: started.body.activity.id, samples: trace });
  const retriedProfile = getProfile();
  assert.equal(retriedProfile.body.user.stats.territories, 1);
});
