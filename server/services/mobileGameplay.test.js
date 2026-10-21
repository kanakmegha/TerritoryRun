import test from 'node:test';
import assert from 'node:assert/strict';
import { createGpsTrackingController } from '../../mobile/src/utils/gpsTracking.js';
import { createActivityRunStarter } from '../../mobile/src/utils/activityRunStarter.js';
import { buildRouteSuggestionRequest, normalizeSuggestedRoute } from '../../mobile/src/utils/routeSuggestions.js';
import { createRouteSuggestionResult } from './routeSuggestions.js';

const goodPosition = { coords: { latitude: 37.77, longitude: -122.42, accuracy: 8 }, timestamp: 1_700_000_000_000 };

test('route suggestions require usable coordinates and never send placeholder zero coordinates', () => {
  assert.equal(buildRouteSuggestionRequest(null, 5), null);
  assert.equal(buildRouteSuggestionRequest({ lat: 0, lng: 0 }, 5), null);
  assert.equal(buildRouteSuggestionRequest({ lat: 91, lng: 2 }, 5), null);
  assert.deepEqual(buildRouteSuggestionRequest({ lat: 37, lng: -122 }, 5), { lat: 37, lng: -122, targetDistance: 5 });
});

test('unverified estimates and missing or malformed polylines are never rendered as real roads', () => {
  const estimate = normalizeSuggestedRoute({ id: 'est', distance: 5, polyline: null, source: 'estimate', verified: false });
  const malformed = normalizeSuggestedRoute({ id: 'bad', distance: 5, polyline: '!!!', source: 'google_directions', verified: true });
  assert.equal(estimate.verified, false);
  assert.deepEqual(estimate.coordinates, []);
  assert.equal(malformed.verified, false);
  assert.deepEqual(malformed.coordinates, []);
});

test('route suggestion service validates its request and labels generated fallbacks as estimates', async () => {
  const invalid = await createRouteSuggestionResult({ body: { lat: '37', lng: -122, targetDistance: 5 }, apiKey: '' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.code, 'invalid_coordinates');
  const valid = await createRouteSuggestionResult({ body: { lat: 37, lng: -122, targetDistance: 5 }, apiKey: '' });
  assert.equal(valid.status, 200);
  assert.equal(valid.body.routes.length, 4);
  assert.ok(valid.body.routes.every(route => route.source === 'estimate' && route.verified === false && route.polyline === null));
});

test('route suggestion service only marks valid provider geometry as verified and falls back on malformed provider data', async () => {
  const result = await createRouteSuggestionResult({
    body: { lat: 37, lng: -122, targetDistance: 5 },
    apiKey: 'test-only-key',
    fetchImpl: async () => ({ ok: true, json: async () => ({
      status: 'OK',
      routes: [{ overview_polyline: { points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' }, legs: [{ distance: { value: 5000 } }] }],
    }) }),
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.routes[0].source, 'google_directions');
  assert.equal(result.body.routes[0].verified, true);
  assert.equal(result.body.routes[0].distance, 5);

  const malformed = await createRouteSuggestionResult({
    body: { lat: 37, lng: -122, targetDistance: 5 },
    apiKey: 'test-only-key',
    fetchImpl: async () => ({ ok: true, json: async () => ({
      status: 'OK', routes: [{ overview_polyline: { points: 'malformed' }, legs: [{ distance: { value: 5000 } }] }],
    }) }),
  });
  assert.equal(malformed.body.routes[0].verified, false);
  assert.equal(malformed.body.routes[0].polyline, null);
});

test('GPS controller reports denied permission and does not start a watcher', async () => {
  let watches = 0;
  const controller = createGpsTrackingController({
    location: { requestForegroundPermissionsAsync: async () => ({ status: 'denied' }) },
    onPosition() {},
  });
  const result = await controller.start();
  assert.deepEqual(result, { ok: false, code: 'permission_denied' });
  assert.equal(watches, 0);
  assert.equal(controller.isTracking, false);
});

test('GPS controller takes a valid initial fix, deduplicates starts, and removes its watch', async () => {
  let watches = 0;
  let removals = 0;
  const positions = [];
  const location = {
    Accuracy: { BestForNavigation: 6 },
    requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    getCurrentPositionAsync: async () => goodPosition,
    watchPositionAsync: async (_options, callback) => {
      watches += 1;
      callback({ ...goodPosition, timestamp: goodPosition.timestamp + 1_000 });
      return { remove: async () => { removals += 1; } };
    },
  };
  const controller = createGpsTrackingController({ location, onPosition: p => positions.push(p) });
  const [one, two] = await Promise.all([controller.start(), controller.start()]);
  assert.equal(one.ok, true);
  assert.equal(two.ok, true);
  assert.equal(watches, 1);
  assert.equal(positions.length, 2);
  await controller.stop();
  assert.equal(removals, 1);
  assert.equal(controller.isTracking, false);
});

test('stopping during location permission startup cannot leak a later GPS watcher', async () => {
  let allowPermission;
  let watches = 0;
  const permission = new Promise(resolve => { allowPermission = resolve; });
  const controller = createGpsTrackingController({
    location: {
      requestForegroundPermissionsAsync: () => permission,
      getCurrentPositionAsync: async () => goodPosition,
      watchPositionAsync: async () => { watches += 1; return { remove: async () => {} }; },
    },
    onPosition() {},
  });
  const starting = controller.start();
  await controller.stop();
  allowPermission({ status: 'granted' });
  assert.equal((await starting).ok, false);
  assert.equal(watches, 0);
});

test('stopping an inactive GPS controller is idempotent', async () => {
  const controller = createGpsTrackingController({
    location: {
      requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
      getCurrentPositionAsync: async () => goodPosition,
    },
    onPosition() {},
  });
  // Stop with no active watcher should not throw.
  await controller.stop();
  await controller.stop();
  assert.equal(controller.isTracking, false);
});

test('starting after stopping creates a fresh watcher (new generation)', async () => {
  let watches = 0;
  let removals = 0;
  const location = {
    Accuracy: { BestForNavigation: 6 },
    requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    getCurrentPositionAsync: async () => goodPosition,
    watchPositionAsync: async (_options, callback) => {
      watches += 1;
      callback({ ...goodPosition, timestamp: goodPosition.timestamp + 1_000 });
      return { remove: async () => { removals += 1; } };
    },
  };
  const controller = createGpsTrackingController({ location, onPosition() {} });
  await controller.start();
  assert.equal(watches, 1);
  await controller.stop();
  assert.equal(removals, 1);
  // Start again → new generation, new watcher.
  await controller.start();
  assert.equal(watches, 2);
  assert.equal(controller.isTracking, true);
  await controller.stop();
  assert.equal(removals, 2);
  assert.equal(controller.isTracking, false);
});

function createStarterFixture({ locationResult, failStart = false, ownerId = 'owner-1', httpStatus = null, onStopLocation } = {}) {
  const storageData = new Map();
  const saved = [];
  const requests = [];
  const runs = [];
  let startFails = failStart;
  let statusToFail = httpStatus;
  const starter = createActivityRunStarter({
    getCurrentRun: () => ({ isActive: false, submissionStatus: 'processed' }),
    getOwnerId: () => ownerId,
    ensureLocation: async () => locationResult || { ok: true, position: { lat: 37, lng: -122, accuracy: 5, timestamp: 1000 } },
    stopLocation: onStopLocation || (async () => {}),
    storage: {
      getItem: async key => storageData.get(key) || null,
      setItem: async (key, value) => storageData.set(key, value),
      removeItem: async key => storageData.delete(key),
    },
    api: { post: async (path, body) => {
      requests.push({ path, body });
      if (startFails) {
        if (statusToFail) {
          const err = new Error('Request failed with status code ' + statusToFail);
          err.response = { status: statusToFail, data: { code: 'endpoint_not_found', message: 'Not found' } };
          throw err;
        }
        throw new Error('offline');
      }
      return { data: { activity: { id: '0123456789abcdef01234567' } } };
    } },
    activityDrafts: { save: async (...args) => saved.push(args) },
    onRunCreated: (...args) => runs.push(args),
    createActivityId: () => 'client-key-one',
    now: () => 1000,
  });
  return { starter, requests, saved, runs, storageData, setStartFails: value => { startFails = value; }, setHttpStatus: value => { statusToFail = value; } };
}

test('run startup blocks without usable GPS and gives an actionable failure', async () => {
  const fixture = createStarterFixture({ locationResult: { ok: false, code: 'permission_denied' } });
  const result = await fixture.starter('claim');
  assert.equal(result.ok, false);
  assert.match(result.message, /location access/i);
  assert.equal(fixture.requests.length, 0);
  assert.equal(fixture.runs.length, 0);
});

test('successful conquest selection starts one authenticated claim activity and retains the chosen route', async () => {
  const fixture = createStarterFixture();
  const route = { id: 'walking-1', name: 'Loop', source: 'google_directions', verified: true, distance: 5,
    polyline: 'encoded', coordinates: [{ latitude: 37, longitude: -122 }, { latitude: 37.01, longitude: -122.01 }] };
  const [first, second] = await Promise.all([fixture.starter('claim', route), fixture.starter('claim', route)]);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.requests[0].path, '/api/game/activities');
  assert.equal(fixture.saved.length, 1);
  assert.equal(fixture.runs.length, 1);
  assert.equal(fixture.runs[0][0].selectedRoute.id, 'walking-1');
  assert.deepEqual(fixture.runs[0][0].selectedRoute.coordinates, route.coordinates);
  assert.equal(fixture.runs[0][1], 'claim');
});

test('failed start preserves the idempotency key so retry cannot create a second activity identity', async () => {
  const fixture = createStarterFixture({ failStart: true });
  const failed = await fixture.starter('claim');
  assert.equal(failed.ok, false);
  assert.equal(fixture.storageData.get('pendingActivityStart:owner-1'), 'client-key-one');
  assert.equal(fixture.runs.length, 0);
});

test('retry after an interrupted start reuses the same idempotency key and creates one activity', async () => {
  const fixture = createStarterFixture({ failStart: true });
  const failed = await fixture.starter('claim');
  assert.equal(failed.ok, false);
  fixture.setStartFails(false);
  const retried = await fixture.starter('claim');
  assert.equal(retried.ok, true);
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.requests[0].body.clientActivityId, fixture.requests[1].body.clientActivityId);
  assert.equal(fixture.runs.length, 1);
});

test('stopLocation is called when activity creation fails so the GPS watcher does not leak', async () => {
  let stopCalled = false;
  const fixture = createStarterFixture({
    failStart: true,
    onStopLocation: async () => { stopCalled = true; },
  });
  const result = await fixture.starter('claim');
  assert.equal(result.ok, false);
  assert.equal(stopCalled, true, 'stopLocation must be called on activity creation failure');
});

test('HTTP 404 from backend returns actionable message and preserves idempotency key', async () => {
  const fixture = createStarterFixture({ failStart: true, httpStatus: 404 });
  const result = await fixture.starter('claim');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'server_endpoint_not_found');
  assert.match(result.message, /HTTP 404/);
  // Storage key is preserved so retry uses the same clientActivityId
  assert.equal(fixture.storageData.get('pendingActivityStart:owner-1'), 'client-key-one');
});

test('authenticated user without a database ID is blocked before starting a conquest', async () => {
  const fixture = createStarterFixture({ ownerId: '' });
  const result = await fixture.starter('claim');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'profile_not_ready');
  assert.match(result.message, /profile is still loading/i);
  assert.equal(fixture.requests.length, 0, 'No HTTP request should be made without owner ID');
});

test('indoor test mode flag is passed through to backend activity request', async () => {
  const fixture = createStarterFixture();
  const result = await fixture.starter('claim', null, true);
  assert.equal(result.ok, true);
  assert.equal(fixture.requests[0].body.isTest, true);
});
