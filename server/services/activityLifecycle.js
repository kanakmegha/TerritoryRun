import crypto from 'node:crypto';
import process from 'node:process';
import Activity from '../models/Activity.js';
import { calculatePolygonMetrics } from './gameMutations.js';

const MAX_SAMPLES = 5000;
const MAX_ACCURACY_METERS = 30;
const MAX_SAMPLE_GAP_MS = 30_000;
const MAX_SPEED_MPS = 12;
const MIN_DISTANCE_METERS = 100;
const MIN_AREA_SQM = 50;
const MAX_CLOSURE_METERS = 50;

// --- Development-only indoor test mode thresholds ---
// These are intentionally separate from the production constants above so that
// normal validation is never weakened. Test mode is only honoured by the server
// when NODE_ENV is not 'production' AND DEV_INDOOR_TEST_MODE=true is set.
const DEV_INDOOR_TEST_MODE = process.env.NODE_ENV !== 'production' && process.env.DEV_INDOOR_TEST_MODE === 'true';
const TEST_MIN_DISTANCE_METERS = Number(process.env.DEV_TEST_MIN_DISTANCE_METERS) || 20;
const TEST_MIN_AREA_SQM = Number(process.env.DEV_TEST_MIN_AREA_SQM) || 1;
const TEST_MAX_CLOSURE_METERS = Number(process.env.DEV_TEST_MAX_CLOSURE_METERS) || 50;
const EARTH_RADIUS_METERS = 6378137;

class ActivityError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const fail = (status, code, message) => ({ status, body: { success: false, code, message } });
const radians = (n) => n * Math.PI / 180;

function distanceMeters(a, b) {
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function validateActivitySamples(samples) {
  if (!Array.isArray(samples) || samples.length < 4 || samples.length > MAX_SAMPLES) {
    throw new ActivityError(400, 'invalid_samples', `Activity must contain 4 to ${MAX_SAMPLES} GPS samples.`);
  }
  const normalized = samples.map((sample) => {
    const { lat, lng, timestamp, accuracy } = sample || {};
    if (![lat, lng, timestamp, accuracy].every((v) => typeof v === 'number' && Number.isFinite(v)) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180 || timestamp <= 0 || accuracy <= 0 || accuracy > MAX_ACCURACY_METERS) {
      throw new ActivityError(400, 'invalid_sample', 'GPS sample coordinates, timestamp, or accuracy are invalid.');
    }
    return { lat, lng, timestamp, accuracy };
  });

  let distance = 0;
  for (let i = 1; i < normalized.length; i += 1) {
    const before = normalized[i - 1];
    const current = normalized[i];
    const elapsed = current.timestamp - before.timestamp;
    if (elapsed <= 0) throw new ActivityError(400, 'sample_order', 'GPS timestamps must be strictly increasing.');
    if (elapsed > MAX_SAMPLE_GAP_MS) throw new ActivityError(400, 'sample_gap', 'GPS sample gap is too large.');
    const moved = distanceMeters(before, current);
    // Exact duplicates are never accepted.
    if (moved === 0) throw new ActivityError(400, 'duplicate_sample', 'Consecutive duplicate GPS samples are not accepted.');
    // Accuracy-aware stationary/jitter rejection: if the reported movement is
    // within the combined horizontal accuracy of the two samples, we cannot
    // distinguish real movement from GPS jitter. Treat as stationary and do not
    // accumulate distance. A trace made entirely of jitter will have insufficient
    // distance/area and will be rejected by the distance/area rules below.
    if (moved <= before.accuracy + current.accuracy) continue;
    if (moved / (elapsed / 1000) > MAX_SPEED_MPS) throw new ActivityError(400, 'implausible_speed', 'GPS samples exceed the supported travel speed.');
    distance += moved;
  }

  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  const closure = distanceMeters(first, last);
  if (closure > MAX_CLOSURE_METERS) throw new ActivityError(422, 'loop_not_closed', 'The activity must finish within 50 m of its start.');
  if (distance < MIN_DISTANCE_METERS) throw new ActivityError(422, 'distance_too_short', 'The recorded path must be at least 100 m.');
  const polygonSamples = [...normalized];
  if (distanceMeters(first, last) < 0.5) polygonSamples.pop();
  const ring = polygonSamples.map(({ lat, lng }) => [lng, lat]);
  ring.push([...ring[0]]);
  const boundary = { type: 'Polygon', coordinates: [ring] };
  let metrics;
  try { metrics = calculatePolygonMetrics(boundary); }
  catch { throw new ActivityError(422, 'invalid_geometry', 'The GPS path does not form a valid simple loop.'); }
  if (metrics.area_sqm < MIN_AREA_SQM) throw new ActivityError(422, 'area_too_small', 'The enclosed area must be at least 50 m².');
  return { boundary, distance_m: distance, area_sqm: metrics.area_sqm, perimeter_m: metrics.perimeter_m,
    duration_ms: last.timestamp - first.timestamp, sample_count: normalized.length };
}

/**
 * Same validation as validateActivitySamples but with relaxed thresholds for
 * development indoor testing. Short indoor loops (e.g. 10-30 m) cannot satisfy
 * the production 100 m / 50 m² / 50 m closure rules. This function is only
 * reachable when DEV_INDOOR_TEST_MODE is true (non-production builds only).
 */
export function validateActivitySamplesForTest(samples) {
  if (!Array.isArray(samples) || samples.length < 4 || samples.length > MAX_SAMPLES) {
    throw new ActivityError(400, 'invalid_samples', `Activity must contain 4 to ${MAX_SAMPLES} GPS samples.`);
  }
  const normalized = samples.map((sample) => {
    const { lat, lng, timestamp, accuracy } = sample || {};
    if (![lat, lng, timestamp, accuracy].every((v) => typeof v === 'number' && Number.isFinite(v)) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180 || timestamp <= 0 || accuracy <= 0 || accuracy > MAX_ACCURACY_METERS) {
      throw new ActivityError(400, 'invalid_sample', 'GPS sample coordinates, timestamp, or accuracy are invalid.');
    }
    return { lat, lng, timestamp, accuracy };
  });

  let distance = 0;
  for (let i = 1; i < normalized.length; i += 1) {
    const before = normalized[i - 1];
    const current = normalized[i];
    const elapsed = current.timestamp - before.timestamp;
    if (elapsed <= 0) throw new ActivityError(400, 'sample_order', 'GPS timestamps must be strictly increasing.');
    if (elapsed > MAX_SAMPLE_GAP_MS) throw new ActivityError(400, 'sample_gap', 'GPS sample gap is too large.');
    const moved = distanceMeters(before, current);
    if (moved === 0) throw new ActivityError(400, 'duplicate_sample', 'Consecutive duplicate GPS samples are not accepted.');
    // Accuracy-aware stationary/jitter rejection: if the reported movement is
    // within the larger of the two reported horizontal accuracies, we cannot
    // distinguish real movement from GPS jitter. Treat as stationary and do not
    // accumulate distance. Using max (not sum) keeps the filter from rejecting
    // legitimate short movements once the GPS fix has improved.
    if (moved <= Math.max(before.accuracy, current.accuracy)) continue;
    if (moved / (elapsed / 1000) > MAX_SPEED_MPS) throw new ActivityError(400, 'implausible_speed', 'GPS samples exceed the supported travel speed.');
    distance += moved;
  }

  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  const closure = distanceMeters(first, last);
  if (closure > TEST_MAX_CLOSURE_METERS) throw new ActivityError(422, 'loop_not_closed', `The activity must finish within ${TEST_MAX_CLOSURE_METERS} m of its start.`);
  if (distance < TEST_MIN_DISTANCE_METERS) throw new ActivityError(422, 'distance_too_short', `The recorded path must be at least ${TEST_MIN_DISTANCE_METERS} m.`);
  const polygonSamples = [...normalized];
  if (distanceMeters(first, last) < 0.5) polygonSamples.pop();
  const ring = polygonSamples.map(({ lat, lng }) => [lng, lat]);
  ring.push([...ring[0]]);
  const boundary = { type: 'Polygon', coordinates: [ring] };
  let metrics;
  try { metrics = calculatePolygonMetrics(boundary); }
  catch { throw new ActivityError(422, 'invalid_geometry', 'The GPS path does not form a valid simple loop.'); }
  if (metrics.area_sqm < TEST_MIN_AREA_SQM) throw new ActivityError(422, 'area_too_small', `The enclosed area must be at least ${TEST_MIN_AREA_SQM} m².`);
  return { boundary, distance_m: distance, area_sqm: metrics.area_sqm, perimeter_m: metrics.perimeter_m,
    duration_ms: last.timestamp - first.timestamp, sample_count: normalized.length, isTest: true };
}

function createMongoRepository() {
  return {
    findByKey: (owner, key) => Activity.findOne({ owner, clientActivityId: key }).lean(),
    findByFingerprint: (owner, fingerprint) => Activity.findOne({ owner, submissionHash: fingerprint }).lean(),
    create: (data) => Activity.create(data).then((doc) => doc.toObject()),
    getOwned: (id, owner) => Activity.findOne({ _id: id, owner }).lean(),
    saveSubmission: (id, owner, hash, samples) => Activity.findOneAndUpdate(
      { _id: id, owner, status: 'recording' },
      { $set: { submissionHash: hash, samples } },
      { new: true, runValidators: true },
    ).lean(),
    finishValidation: (id, status, validation, rejection, claimEligibleOverride) => Activity.findOneAndUpdate(
      { _id: id, status: 'submitted' },
      { $set: { serverValidated: true, claimEligible: claimEligibleOverride !== undefined ? claimEligibleOverride : status === 'accepted', validation, rejectionReason: rejection || null,
        ...(status === 'accepted' ? { status } : {}),
        ...(validation?.boundary ? { claimBoundary: validation.boundary } : {}) } },
      { new: true, runValidators: true },
    ).lean(),
    markProcessed: (id, result) => Activity.findOneAndUpdate(
      { _id: id, status: 'accepted' },
      { $set: { status: 'processed', claimResult: result } },
      { new: true, runValidators: true },
    ).lean(),
  };
}

export function createActivityLifecycle({ repository = createMongoRepository(), mutations } = {}) {
  return {
    async start({ ownerId, clientActivityId, isTest }) {
      const honouredTestMode = DEV_INDOOR_TEST_MODE && isTest === true;
      if (!ownerId || typeof clientActivityId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(clientActivityId)) {
        return fail(400, 'invalid_activity_key', 'A valid activity idempotency key is required.');
      }
      try {
        const existing = await repository.findByKey(ownerId, clientActivityId);
        if (existing) return { status: 200, body: { success: true, activity: publicActivity(existing) } };
        const activity = await repository.create({ owner: ownerId, clientActivityId, status: 'recording', isTest: honouredTestMode });
        return { status: 201, body: { success: true, activity: publicActivity(activity) } };
      } catch (error) {
        if (error?.code === 11000) {
          const existing = await repository.findByKey(ownerId, clientActivityId);
          if (existing) return { status: 200, body: { success: true, activity: publicActivity(existing) } };
        }
        return fail(500, 'persistence_error', 'Could not start activity recording.');
      }
    },

    async submit({ ownerId, activityId, samples, isTest }) {
      const honouredTestMode = DEV_INDOOR_TEST_MODE && isTest === true;
      if (!/^[a-f\d]{24}$/i.test(String(activityId || ''))) return fail(400, 'invalid_id', 'A valid activity ID is required.');
      let activity;
      try { activity = await repository.getOwned(activityId, ownerId); }
      catch { return fail(500, 'persistence_error', 'Could not load activity. Please retry.'); }
      if (!activity) return fail(404, 'activity_not_found', 'Recording was not found for this user.');

      let fingerprint;
      if (samples !== undefined) {
        if (!Array.isArray(samples) || samples.length > MAX_SAMPLES) {
          return fail(400, 'invalid_samples', `Activity must contain no more than ${MAX_SAMPLES} GPS samples.`);
        }
        try {
          const canonical = samples.map((sample) => [sample?.lat, sample?.lng, sample?.timestamp, sample?.accuracy]);
          fingerprint = crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
        }
        catch { return fail(400, 'invalid_samples', 'Activity samples must be valid JSON.'); }
        if (activity.submissionHash && activity.submissionHash !== fingerprint) {
          return fail(409, 'submission_conflict', 'This activity was already submitted with different samples.');
        }
        if (activity.status === 'recording') {
          try {
            const duplicate = await repository.findByFingerprint(ownerId, fingerprint);
            if (duplicate && String(duplicate._id) !== String(activityId)) {
              return fail(409, 'trace_replayed', 'This GPS trace was already submitted as another activity.');
            }
            activity = await repository.saveSubmission(activityId, ownerId, fingerprint, samples) ||
              await repository.getOwned(activityId, ownerId);
          } catch (error) {
            if (error?.code === 11000) return fail(409, 'trace_replayed', 'This GPS trace was already submitted as another activity.');
            return fail(503, 'submission_pending', 'Activity could not be saved. Keep it on this device and retry.');
          }
        }
      } else if (activity.status === 'recording') {
        return fail(400, 'samples_required', 'GPS samples are required for first submission.');
      }

      if (activity.submissionHash && fingerprint && activity.submissionHash !== fingerprint) {
        return fail(409, 'submission_conflict', 'This activity was already submitted with different samples.');
      }
      if (activity.status === 'submitted') {
        let validation;
        let rejection = null;
        let nextStatus = 'accepted';
        try {
          validation = honouredTestMode
            ? validateActivitySamplesForTest(activity.samples)
            : validateActivitySamples(activity.samples);
        }
        catch (error) {
          if (error instanceof ActivityError) { nextStatus = 'rejected'; rejection = { code: error.code, message: error.message }; }
          else return fail(500, 'validation_error', 'Activity validation failed.');
        }
        try {
          activity = await repository.finishValidation(activityId, nextStatus, validation || { sample_count: activity.samples?.length || 0 }, rejection,
            honouredTestMode ? false : undefined) ||
            await repository.getOwned(activityId, ownerId);
        } catch { return fail(503, 'validation_pending', 'Activity is saved and validation will retry.'); }
      }
      if (activity.status === 'rejected') {
        return { status: 422, body: { success: false, activityId, status: 'rejected', reason: activity.rejectionReason } };
      }
      if (activity.status === 'processed') {
        return { status: 200, body: { success: true, activityId, status: 'processed', outcome: activity.claimResult,
          metrics: publicMetrics(activity.validation), alreadyProcessed: true } };
      }
      if (activity.status !== 'accepted') return { status: 202, body: { success: true, activityId, status: activity.status, pending: true } };

      const result = await mutations.claim({ userId: String(ownerId), activityId: String(activityId) });
      if (!result.body?.success) return { status: 503, body: { success: false, code: 'claim_pending',
        activityId, status: 'accepted', pending: true,
        message: 'Activity passed validation; territory save is pending. Retry this activity.' } };
      try {
        const processed = await repository.markProcessed(activityId, result.body.territory);
        const final = processed || await repository.getOwned(activityId, ownerId);
        return { status: result.status, body: { success: true, activityId, status: final.status,
          outcome: result.body.territory, metrics: publicMetrics(final.validation), alreadyApplied: result.body.alreadyApplied === true } };
      } catch { return fail(503, 'claim_pending', 'Territory save succeeded; activity receipt is pending. Retry this activity.'); }
    },
  };
}

function publicActivity(activity) {
  return { id: String(activity._id), clientActivityId: activity.clientActivityId, status: activity.status };
}

function publicMetrics(validation = {}) {
  return {
    distance_m: validation.distance_m,
    area_sqm: validation.area_sqm,
    perimeter_m: validation.perimeter_m,
    duration_ms: validation.duration_ms,
    sample_count: validation.sample_count,
  };
}
