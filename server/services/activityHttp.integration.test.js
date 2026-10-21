import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { generateKeyPairSync } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { createGameRouter } from '../routes/game.js';
import { createAuthRouter } from '../routes/auth.js';
import { clerkAuth, createClerkAuth } from '../middleware/clerkAuth.js';
import { createActivityLifecycle } from './activityLifecycle.js';

const OWNER_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OWNER_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const ACTIVITY_ID = 'cccccccccccccccccccccccc';
const TRACE = [
  { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 8 },
  { lat: 40.7484, lng: -73.9847, timestamp: 112000, accuracy: 8 },
  { lat: 40.7494, lng: -73.9847, timestamp: 124000, accuracy: 8 },
  { lat: 40.7494, lng: -73.9857, timestamp: 136000, accuracy: 8 },
  { lat: 40.7484, lng: -73.9857, timestamp: 148000, accuracy: 8 },
];

function makeSystem({ claimPending = false } = {}) {
  const records = new Map();
  let nextId = 0;
  const repository = {
    async findByKey(owner, key) { return [...records.values()].find((record) => record.owner === owner && record.clientActivityId === key) || null; },
    async findByFingerprint(owner, hash) { return [...records.values()].find((record) => record.owner === owner && record.submissionHash === hash) || null; },
    async create(data) {
      const record = { ...data, _id: nextId++ === 0 ? ACTIVITY_ID : 'dddddddddddddddddddddddd', status: 'recording' };
      records.set(String(record._id), record);
      return record;
    },
    async getOwned(id, owner) { const record = records.get(String(id)); return record?.owner === owner ? record : null; },
    async saveSubmission(id, owner, hash, samples) {
      const record = records.get(String(id));
      if (!record || record.owner !== owner || record.status !== 'recording') return null;
      Object.assign(record, { submissionHash: hash, samples: structuredClone(samples), status: 'submitted' });
      return record;
    },
    async finishValidation(id, status, validation, rejectionReason) {
      const record = records.get(String(id));
      if (!record || record.status !== 'submitted') return null;
      Object.assign(record, { status, validation, rejectionReason, serverValidated: true,
        claimEligible: status === 'accepted', claimBoundary: validation.boundary });
      return record;
    },
    async markProcessed(id, result) {
      const record = records.get(String(id));
      if (record?.status !== 'accepted') return null;
      Object.assign(record, { status: 'processed', claimResult: result });
      return record;
    },
  };
  const awardIds = new Map();
  const mutations = {
    async claim({ activityId, userId }) {
      const activity = records.get(activityId);
      assert.equal(activity.owner, userId);
      if (claimPending) return { status: 503, body: { success: false, code: 'transactions_unavailable' } };
      if (awardIds.has(activityId)) return { status: 200, body: { success: true, alreadyApplied: true, territory: awardIds.get(activityId) } };
      const territory = { _id: 'eeeeeeeeeeeeeeeeeeeeeeee', owner: userId, area_sqm: activity.validation.area_sqm,
        perimeter_m: activity.validation.perimeter_m, boundary: activity.claimBoundary };
      awardIds.set(activityId, territory);
      return { status: 201, body: { success: true, territory } };
    },
  };
  return { records, activityService: createActivityLifecycle({ repository, mutations }), awards: awardIds };
}

function testAuth(req, res, next) {
  const ownerByToken = { 'Bearer integration-owner-a': OWNER_A, 'Bearer integration-owner-b': OWNER_B };
  const ownerId = ownerByToken[req.headers.authorization];
  if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });
  req.user = { _id: ownerId };
  return next();
}

function invokeInProcess(app, { method = 'GET', url = '/', body, authorization, contentType = 'application/json' } = {}) {
  const rawBody = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  const req = Readable.from(rawBody ? [Buffer.from(rawBody)] : []);
  req.method = method;
  req.url = url;
  req.originalUrl = url;
  req.headers = { accept: 'application/json' };
  if (body !== undefined) {
    req.headers['content-type'] = contentType;
    req.headers['content-length'] = String(Buffer.byteLength(rawBody));
  }
  if (authorization) req.headers.authorization = authorization;
  req.httpVersion = '1.1';
  req.socket = { encrypted: false, remoteAddress: '127.0.0.1' };
  req.connection = req.socket;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`In-process Express request timed out: ${method} ${url}`)), 3000);
    const complete = (result) => { clearTimeout(timeout); resolve(result); };
    let responseBody = '';
    const res = Object.create(app.response);
    EventEmitter.call(res);
    res.app = app;
    res.req = req;
    res.locals = {};
    res.statusCode = 200;
    res.finished = false;
    res.headerStore = new Map();
    res.setHeader = (name, value) => res.headerStore.set(name.toLowerCase(), value);
    res.getHeader = (name) => res.headerStore.get(name.toLowerCase());
    res.hasHeader = (name) => res.headerStore.has(name.toLowerCase());
    res.removeHeader = (name) => res.headerStore.delete(name.toLowerCase());
    res.end = (chunk) => {
      if (chunk != null) responseBody += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      res.finished = true;
      res._header = 'sent';
      res.emit('finish');
      complete({ status: res.statusCode, body: responseBody ? JSON.parse(responseBody) : null, headers: res.headerStore });
      return res;
    };
    res.write = (chunk) => { responseBody += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk); return true; };
    try {
      app.handle(req, res, (error) => error ? reject(error) : complete({ status: res.statusCode, body: null, headers: res.headerStore }));
    } catch (error) { reject(error); }
  });
}

function appFor(system, auth = testAuth, territoryModel) {
  return createApp({ logRequests: false, gameRouter: createGameRouter({ activityService: system.activityService, auth, territoryModel }) });
}

test('Express mounted URL runs JSON parser and real Clerk middleware for unauthenticated requests', async () => {
  const system = makeSystem();
  const app = appFor(system, clerkAuth);
  const missing = await invokeInProcess(app, { method: 'POST', url: '/api/game/activities', body: { clientActivityId: 'activity-key-0001' } });
  const malformed = await invokeInProcess(app, { method: 'POST', url: '/api/game/activities',
    body: { clientActivityId: 'activity-key-0001' }, authorization: 'Bearer' });
  const invalid = await invokeInProcess(app, { method: 'POST', url: '/api/game/activities',
    body: { clientActivityId: 'activity-key-0001' }, authorization: 'Bearer not.a.valid.jwt' });
  assert.equal(missing.status, 401);
  assert.equal(malformed.status, 401);
  assert.equal(invalid.status, 401);
  assert.equal(system.records.size, 0);
});

test('mounted route accepts a test identity only after Clerk JWT signature verification', async () => {
  const system = makeSystem();
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwtKey = publicKey.export({ type: 'spki', format: 'pem' });
  const clerkId = 'user_territoryrun_test';
  const user = { _id: OWNER_A, clerkId, username: 'integration-owner', email: 'owner@territoryrun.test' };
  class TestUserModel {
    static async findOne(query) { return query.clerkId === clerkId ? user : null; }
  }
  const auth = createClerkAuth({ UserModel: TestUserModel, jwtKey });
  const app = createApp({ authRouter: createAuthRouter({ auth }),
    gameRouter: createGameRouter({ activityService: system.activityService, auth }), logRequests: false });
  const token = jwt.sign({ sub: clerkId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60 },
    privateKey, { algorithm: 'RS256', keyid: 'local' });

  const profile = await invokeInProcess(app, { url: '/api/auth/profile', authorization: `Bearer ${token}` });
  assert.equal(profile.status, 200);
  assert.deepEqual(Object.keys(profile.body.user).sort(), ['_id', 'color', 'email', 'id', 'imageUrl', 'stats', 'username'].sort());
  assert.equal(profile.body.user._id, OWNER_A);
  assert.equal(profile.body.user.id, clerkId);

  const response = await invokeInProcess(app, { method: 'POST', url: '/api/game/activities',
    authorization: `Bearer ${token}`, body: { clientActivityId: 'activity-key-0001' } });
  assert.equal(response.status, 201);
  assert.equal(system.records.get(ACTIVITY_ID).owner, OWNER_A);

  const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
  const rejected = await invokeInProcess(app, { method: 'POST', url: '/api/game/activities',
    authorization: `Bearer ${tampered}`, body: { clientActivityId: 'activity-key-0002' } });
  assert.equal(rejected.status, 401);
  assert.equal(system.records.size, 1);
});

test('mounted /api/auth/profile rejects missing, malformed, and invalid Clerk authorization', async () => {
  const app = createApp({ authRouter: createAuthRouter({ auth: clerkAuth }), logRequests: false });
  for (const authorization of [undefined, 'Bearer', 'Bearer not.a.valid.jwt']) {
    const response = await invokeInProcess(app, { url: '/api/auth/profile', authorization });
    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { message: 'Unauthorized' });
  }
});

test('mounted authenticated activity lifecycle rejects malformed JSON and owner mismatch', async () => {
  const system = makeSystem();
  const app = appFor(system);
  const malformed = await invokeInProcess(app, { method: 'POST', url: '/api/game/activities', body: '{', authorization: 'Bearer integration-owner-a' });
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.code, 'invalid_json');

  const created = await invokeInProcess(app, { method: 'POST', url: '/api/game/activities', authorization: 'Bearer integration-owner-a',
    body: { clientActivityId: 'activity-key-0001', ownerId: OWNER_B } });
  assert.equal(created.status, 201);
  assert.equal(system.records.get(ACTIVITY_ID).owner, OWNER_A);
  const foreign = await invokeInProcess(app, { method: 'POST', url: `/api/game/activities/${ACTIVITY_ID}/submit`,
    authorization: 'Bearer integration-owner-b', body: { samples: TRACE } });
  assert.equal(foreign.status, 404);
  assert.equal(system.awards.size, 0);
});

test('mounted activity submission returns processed receipt exactly once on duplicate retry', async () => {
  const system = makeSystem();
  const app = appFor(system);
  await invokeInProcess(app, { method: 'POST', url: '/api/game/activities', authorization: 'Bearer integration-owner-a', body: { clientActivityId: 'activity-key-0001' } });
  const submitUrl = `/api/game/activities/${ACTIVITY_ID}/submit`;
  const first = await invokeInProcess(app, { method: 'POST', url: submitUrl, authorization: 'Bearer integration-owner-a',
    body: { samples: TRACE, reward: 100000, distance: 999999, area: 999999 } });
  const retry = await invokeInProcess(app, { method: 'POST', url: submitUrl, authorization: 'Bearer integration-owner-a', body: { samples: TRACE } });
  assert.equal(first.status, 201);
  assert.equal(first.body.status, 'processed');
  assert.equal(retry.status, 200);
  assert.equal(retry.body.status, 'processed');
  assert.equal(first.body.outcome._id, retry.body.outcome._id);
  assert.equal(system.awards.size, 1);
});

test('mounted lifecycle returns explicit rejection and pending states', async () => {
  const rejectedSystem = makeSystem();
  const rejectedApp = appFor(rejectedSystem);
  await invokeInProcess(rejectedApp, { method: 'POST', url: '/api/game/activities', authorization: 'Bearer integration-owner-a', body: { clientActivityId: 'activity-key-0001' } });
  const rejected = await invokeInProcess(rejectedApp, { method: 'POST', url: `/api/game/activities/${ACTIVITY_ID}/submit`,
    authorization: 'Bearer integration-owner-a', body: { samples: [] } });
  assert.equal(rejected.status, 422);
  assert.equal(rejected.body.status, 'rejected');

  const pendingSystem = makeSystem({ claimPending: true });
  const pendingApp = appFor(pendingSystem);
  await invokeInProcess(pendingApp, { method: 'POST', url: '/api/game/activities', authorization: 'Bearer integration-owner-a', body: { clientActivityId: 'activity-key-0001' } });
  const pending = await invokeInProcess(pendingApp, { method: 'POST', url: `/api/game/activities/${ACTIVITY_ID}/submit`,
    authorization: 'Bearer integration-owner-a', body: { samples: TRACE } });
  assert.equal(pending.status, 503);
  assert.equal(pending.body.status, 'accepted');
  assert.equal(pending.body.pending, true);
});

test('public territory response omits raw path_nodes and mutation linkage while retaining display boundary', async () => {
  let observedFilter;
  let observedProjection;
  const territoryModel = {
    find(filter) {
      observedFilter = filter;
      return {
        limit() { return this; },
        select(projection) {
          observedProjection = projection;
          const territory = { _id: 'territory-id', path_nodes: TRACE.map(({ lat, lng }) => [lng, lat]),
            claimActivity: 'activity-id', boundary: { type: 'Polygon', coordinates: [] }, owner: OWNER_A };
          if (projection.includes('-path_nodes')) delete territory.path_nodes;
          if (projection.includes('-claimActivity')) delete territory.claimActivity;
          return Promise.resolve([territory]);
        },
      };
    },
  };
  const response = await invokeInProcess(appFor(makeSystem(), testAuth, territoryModel), { url: '/api/game/territories' });
  assert.equal(response.status, 200);
  assert.equal(response.body.territories[0].boundary.type, 'Polygon');
  assert.equal('path_nodes' in response.body.territories[0], false);
  assert.equal('claimActivity' in response.body.territories[0], false);
  assert.equal(observedProjection, '-__v -path_nodes -claimActivity');
  assert.ok(observedFilter.timestamp.$gt instanceof Date);
});
