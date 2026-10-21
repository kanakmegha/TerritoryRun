import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { calculatePolygonMetrics, createGameMutations } from './gameMutations.js';
import { createGameRouter } from '../routes/game.js';

const USER_A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const USER_B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const TERRITORY_ID = 'cccccccccccccccccccccccc';
const ACTIVITY_CLAIM = 'dddddddddddddddddddddddd';
const ACTIVITY_ATTACK = 'eeeeeeeeeeeeeeeeeeeeeeee';
const CLOSED_RING = [
  [-73.9857, 40.7484], [-73.9847, 40.7484], [-73.9847, 40.7494],
  [-73.9857, 40.7494], [-73.9857, 40.7484],
];

// Acceptance criteria encoded before implementation:
// - only server-verified, owner-bound activity evidence can create a claim;
// - server derives polygon metrics and ignores client reward/area/perimeter/distance;
// - malformed inputs and cross-user evidence never mutate state;
// - claim and transfer retries are idempotent, including simultaneous retries;
// - transfers set both user counts from authoritative territory ownership atomically;
// - injected persistence failure rolls back every mutation;
// - transaction-unavailable deployments fail closed (no fallback partial writes).
function makeFixture({ activityOverrides = {}, transactionAvailable = true } = {}) {
  const state = {
    users: new Map([
      [USER_A, { _id: USER_A, color: '#00f3ff', stats: { territories: 0 } }],
      [USER_B, { _id: USER_B, color: '#ff00aa', stats: { territories: 1 } }],
    ]),
    activities: new Map([
      [ACTIVITY_CLAIM, {
        _id: ACTIVITY_CLAIM, owner: USER_A, status: 'accepted', serverValidated: true,
        claimEligible: true, claimBoundary: { type: 'Polygon', coordinates: [CLOSED_RING] },
      }],
      [ACTIVITY_ATTACK, {
        _id: ACTIVITY_ATTACK, owner: USER_A, status: 'accepted', serverValidated: true,
        attackEvidence: [{ territoryId: TERRITORY_ID, eligible: true }],
      }],
    ]),
    territories: new Map([
      [TERRITORY_ID, { _id: TERRITORY_ID, owner: USER_B, teamOwner: '999999999999999999999999', ownerColor: '#ff00aa',
        area_sqm: 100, perimeter_m: 40, strength: 100, strength_count: 1,
        boundary: { type: 'Polygon', coordinates: [CLOSED_RING] }, path_nodes: CLOSED_RING }],
    ]),
    attacks: new Map(),
  };
  for (const [id, overrides] of Object.entries(activityOverrides)) {
    state.activities.set(id, { ...state.activities.get(id), ...overrides });
  }
  let failAt = null;
  let queue = Promise.resolve();

  const withTransaction = async (work) => {
    if (!transactionAvailable) throw Object.assign(new Error('transactions unavailable'), { code: 'TRANSACTIONS_UNAVAILABLE' });
    let release;
    const previous = queue;
    queue = new Promise((resolve) => { release = resolve; });
    await previous;
    const draft = structuredClone(state);
    const tx = {
      getUser: async (id) => draft.users.get(id) || null,
      getActivity: async (id, ownerId) => {
        const activity = draft.activities.get(id);
        return activity?.owner === ownerId ? activity : null;
      },
      findTerritoryByClaimActivity: async (activityId) => [...draft.territories.values()].find((t) => t.claimActivity === activityId) || null,
      getTerritory: async (id) => draft.territories.get(id) || null,
      createTerritory: async (territory) => {
        if (failAt === 'createTerritory') throw new Error('injected territory write failure');
        const saved = { ...territory, _id: territory._id || 'ffffffffffffffffffffffff' };
        draft.territories.set(saved._id, saved);
        return saved;
      },
      countTerritories: async (ownerId) => [...draft.territories.values()].filter((t) => t.owner === ownerId).length,
      setUserTerritoryCount: async (ownerId, count) => {
        if (failAt === 'setUserTerritoryCount') throw new Error('injected statistics write failure');
        const user = draft.users.get(ownerId);
        if (!user) return false;
        user.stats.territories = count;
        return true;
      },
      getAttack: async (activityId, territoryId) => draft.attacks.get(`${activityId}:${territoryId}`) || null,
      createAttack: async (attack) => {
        if (failAt === 'createAttack') throw new Error('injected attack write failure');
        const key = `${attack.activity}:${attack.territory}`;
        if (draft.attacks.has(key)) return draft.attacks.get(key);
        draft.attacks.set(key, attack);
        return attack;
      },
      transferTerritory: async (id, expectedOwner, newOwner, color) => {
        if (failAt === 'transferTerritory') throw new Error('injected ownership write failure');
        const territory = draft.territories.get(id);
        if (!territory || territory.owner !== expectedOwner) return null;
        territory.owner = newOwner;
        territory.teamOwner = null;
        territory.ownerColor = color;
        return territory;
      },
    };
    try {
      const result = await work(tx);
      for (const key of Object.keys(state)) state[key] = draft[key];
      return result;
    } finally {
      release();
    }
  };

  return {
    state,
    setFailure(point) { failAt = point; },
    service: createGameMutations({ withTransaction }),
  };
}

let fixture;
beforeEach(() => { fixture = makeFixture(); });

const serviceProxy = {
  claim: (...args) => fixture.service.claim(...args),
  attack: (...args) => fixture.service.attack(...args),
};
const routeAuth = (req, res, next) => next();
const router = createGameRouter({ service: serviceProxy, auth: routeAuth });

async function post(path, body, userId = USER_A) {
  const route = router.stack.find((layer) => layer.route?.path === path)?.route;
  assert.ok(route, `route ${path} exists`);
  const handler = route.stack.at(-1).handle;
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  await handler({ user: { _id: userId }, body }, response);
  return { status: response.statusCode, body: response.payload };
}

test('valid first claim uses verified activity and server-computed metrics', async () => {
  const result = await post('/claim', { activityId: ACTIVITY_CLAIM });
  assert.equal(result.status, 201);
  assert.equal(result.body.success, true);
  assert.equal(result.body.territory.owner, USER_A);
  assert.equal(result.body.territory.reward, undefined);
  assert.ok(result.body.territory.area_sqm > 0);
  assert.ok(result.body.territory.perimeter_m > 0);
  assert.equal(fixture.state.users.get(USER_A).stats.territories, 1);
});

test('client reward, area, perimeter and attack distance values cannot affect rewards', async () => {
  const result = await post('/claim', {
    activityId: ACTIVITY_CLAIM, reward: 1000000, area: 999999999,
    perimeter: 999999999, attackDistance: 999999999, userId: USER_B, owner: USER_B,
  });
  assert.equal(result.status, 201);
  assert.deepEqual({
    area_sqm: result.body.territory.area_sqm,
    perimeter_m: result.body.territory.perimeter_m,
  }, calculatePolygonMetrics({ type: 'Polygon', coordinates: [CLOSED_RING] }));
  assert.equal(result.body.territory.owner, USER_A);
  assert.equal(fixture.state.users.get(USER_A).stats.territories, 1);
});

test('malformed activity IDs are rejected without state changes', async () => {
  const before = fixture.state.territories.size;
  const result = await post('/claim', { activityId: 'not-an-object-id' });
  assert.equal(result.status, 400);
  assert.equal(fixture.state.territories.size, before);
});

test('invalid or malformed verified polygon is rejected without creating a territory', async () => {
  fixture.state.activities.get(ACTIVITY_CLAIM).claimBoundary = {
    type: 'Polygon', coordinates: [[[-73, 40], [-72, 40], [-73, 40]]],
  };
  const result = await post('/claim', { activityId: ACTIVITY_CLAIM });
  assert.equal(result.status, 400);
  assert.equal(result.body.code, 'invalid_geometry');
  assert.equal(fixture.state.territories.size, 1);
  assert.equal(fixture.state.users.get(USER_A).stats.territories, 0);

  fixture.state.activities.get(ACTIVITY_CLAIM).claimBoundary = {
    type: 'Polygon', coordinates: [[
      [-73, 40], [-72.999, 40.001], [-73, 40.001], [-72.999, 40], [-73, 40],
    ]],
  };
  const selfCrossing = await post('/claim', { activityId: ACTIVITY_CLAIM });
  assert.equal(selfCrossing.status, 400);
  assert.equal(selfCrossing.body.code, 'invalid_geometry');
  assert.equal(fixture.state.territories.size, 1);

  fixture.state.activities.get(ACTIVITY_CLAIM).claimBoundary = {
    type: 'Polygon', coordinates: [[
      [-73.9857, 40.7484], [-73.9847, 40.7484], [-73.9847, 40.7494],
      [-73.9852, 40.7484], [-73.9857, 40.7494], [-73.9857, 40.7484],
    ]],
  };
  const touching = await post('/claim', { activityId: ACTIVITY_CLAIM });
  assert.equal(touching.status, 400);
  assert.equal(touching.body.code, 'invalid_geometry');
  assert.equal(fixture.state.territories.size, 1);
});

test('unverified, missing, or another user\'s activity cannot create a claim', async () => {
  const pendingId = '111111111111111111111111';
  fixture.state.activities.set(pendingId, { _id: pendingId, owner: USER_A, status: 'pending', serverValidated: false });
  const pending = await post('/claim', { activityId: pendingId });
  assert.equal(pending.status, 409);
  const foreign = await post('/claim', { activityId: ACTIVITY_CLAIM }, USER_B);
  assert.equal(foreign.status, 404);
  assert.equal(fixture.state.territories.size, 1);
});

test('replayed and simultaneous claim submissions award exactly once', async () => {
  const [first, second] = await Promise.all([
    post('/claim', { activityId: ACTIVITY_CLAIM }),
    post('/claim', { activityId: ACTIVITY_CLAIM }),
  ]);
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(first.body.territory._id, second.body.territory._id);
  assert.equal(fixture.state.territories.size, 2);
  assert.equal(fixture.state.users.get(USER_A).stats.territories, 1);
});

test('injected claim persistence failure rolls back territory and statistics', async () => {
  fixture.setFailure('setUserTerritoryCount');
  const result = await post('/claim', { activityId: ACTIVITY_CLAIM });
  fixture.setFailure(null);
  assert.equal(result.status, 500);
  assert.equal(fixture.state.territories.size, 1);
  assert.equal(fixture.state.users.get(USER_A).stats.territories, 0);
});

test('transaction-unavailable deployment fails closed without partial claim writes', async () => {
  const unavailable = makeFixture({ transactionAvailable: false });
  const result = await unavailable.service.claim({ userId: USER_A, activityId: ACTIVITY_CLAIM });
  assert.equal(result.status, 503);
  assert.equal(unavailable.state.territories.size, 1);
});

test('valid territory transfer updates previous and new owner counts from ownership records', async () => {
  const result = await post('/attack', { territoryId: TERRITORY_ID, activityId: ACTIVITY_ATTACK });
  assert.equal(result.status, 200);
  assert.equal(result.body.territory.owner, USER_A);
  assert.equal(result.body.territory.teamOwner, null);
  assert.equal(fixture.state.users.get(USER_A).stats.territories, 1);
  assert.equal(fixture.state.users.get(USER_B).stats.territories, 0);
});

test('authenticated Mongoose ObjectId is normalized before server authorization checks', async () => {
  const route = router.stack.find((layer) => layer.route?.path === '/claim').route;
  const handler = route.stack.at(-1).handle;
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  const userObjectId = new mongoose.Types.ObjectId(USER_A);
  await handler({ user: { _id: userObjectId }, body: { activityId: ACTIVITY_CLAIM } }, response);
  assert.equal(response.statusCode, 201);
  assert.equal(fixture.state.territories.get('ffffffffffffffffffffffff').owner, USER_A);
});

test('client attackDistance cannot authorize without verified evidence or affect verified eligibility', async () => {
  const forged = await post('/attack', { territoryId: TERRITORY_ID, attackDistance: 999999999 });
  assert.equal(forged.status, 400);
  assert.equal(fixture.state.territories.get(TERRITORY_ID).owner, USER_B);

  const result = await post('/attack', {
    territoryId: TERRITORY_ID, activityId: ACTIVITY_ATTACK, attackDistance: 0,
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.territory.owner, USER_A);
  assert.equal(fixture.state.users.get(USER_A).stats.territories, 1);
  assert.equal(fixture.state.users.get(USER_B).stats.territories, 0);
});

test('another user cannot transfer territory using someone else\'s activity', async () => {
  const result = await post('/attack', { territoryId: TERRITORY_ID, activityId: ACTIVITY_ATTACK }, USER_B);
  assert.equal(result.status, 404);
  assert.equal(fixture.state.territories.get(TERRITORY_ID).owner, USER_B);
});

test('repeated and concurrent transfer attempts decrement/increment only once', async () => {
  const [first, second] = await Promise.all([
    post('/attack', { territoryId: TERRITORY_ID, activityId: ACTIVITY_ATTACK }),
    post('/attack', { territoryId: TERRITORY_ID, activityId: ACTIVITY_ATTACK }),
  ]);
  assert.equal(first.status, 200);
  assert.ok([200, 409].includes(second.status));
  assert.equal(fixture.state.territories.get(TERRITORY_ID).owner, USER_A);
  assert.equal(fixture.state.users.get(USER_A).stats.territories, 1);
  assert.equal(fixture.state.users.get(USER_B).stats.territories, 0);
  assert.equal(fixture.state.attacks.size, 1);
});

test('injected transfer persistence failure rolls back ownership, attack record and both counts', async () => {
  fixture.setFailure('setUserTerritoryCount');
  const result = await post('/attack', { territoryId: TERRITORY_ID, activityId: ACTIVITY_ATTACK });
  fixture.setFailure(null);
  assert.equal(result.status, 500);
  assert.equal(fixture.state.territories.get(TERRITORY_ID).owner, USER_B);
  assert.equal(fixture.state.users.get(USER_A).stats.territories, 0);
  assert.equal(fixture.state.users.get(USER_B).stats.territories, 1);
  assert.equal(fixture.state.attacks.size, 0);
});

test('test activity claim is rejected and does not create territory', async () => {
  fixture.state.activities.get(ACTIVITY_CLAIM).isTest = true;
  const result = await post('/claim', { activityId: ACTIVITY_CLAIM });
  assert.equal(result.status, 409);
  assert.equal(result.body.code, 'test_activity_not_claimable');
  assert.equal(fixture.state.territories.size, 1);
  assert.equal(fixture.state.users.get(USER_A).stats.territories, 0);
});

test('test activity attack is rejected', async () => {
  fixture.state.activities.get(ACTIVITY_ATTACK).isTest = true;
  const result = await post('/attack', { territoryId: TERRITORY_ID, activityId: ACTIVITY_ATTACK });
  assert.equal(result.status, 409);
  assert.equal(result.body.code, 'test_activity_not_claimable');
});
