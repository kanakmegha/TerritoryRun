import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Activity from '../models/Activity.js';
import Territory from '../models/Territory.js';
import Attack from '../models/Attack.js';
import { createGameMutations } from './gameMutations.js';
import { createActivityLifecycle } from './activityLifecycle.js';

const MONGO_URI = process.env.TERRITORY_RUN_MONGO_TEST_URI;
const RUN_MONGO_TESTS = process.env.RUN_TERRITORY_MONGO_INTEGRATION === '1';
const DB_NAME = 'territoryrun_test';
const REPLICA_SET_NAME = 'territoryrunTest';
const RING = [
  [-73.9857, 40.7484], [-73.9847, 40.7484], [-73.9847, 40.7494],
  [-73.9857, 40.7494], [-73.9857, 40.7484],
];
const TRACE = [
  { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 8 },
  { lat: 40.7484, lng: -73.9847, timestamp: 112000, accuracy: 8 },
  { lat: 40.7494, lng: -73.9847, timestamp: 124000, accuracy: 8 },
  { lat: 40.7494, lng: -73.9857, timestamp: 136000, accuracy: 8 },
  { lat: 40.7484, lng: -73.9857, timestamp: 148000, accuracy: 8 },
];

function requireDedicatedLocalReplicaSet(uri) {
  assert.ok(uri, 'Set TERRITORY_RUN_MONGO_TEST_URI to the dedicated local test replica-set URI.');
  const parsed = new URL(uri);
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(parsed.hostname), 'Mongo integration tests only connect to a loopback host.');
  assert.equal(parsed.pathname.replace(/^\//, ''), DB_NAME, `Mongo integration tests require database ${DB_NAME}.`);
  assert.equal(parsed.searchParams.get('replicaSet'), REPLICA_SET_NAME,
    `Mongo integration tests require the dedicated ${REPLICA_SET_NAME} replica set.`);
}

function token() {
  return new mongoose.Types.ObjectId().toHexString();
}

async function createUser(label, territoryCount = 0) {
  const suffix = token();
  return User.create({ username: `${label}_${suffix}`, email: `${label}_${suffix}@territoryrun.test`,
    color: '#123abc', stats: { distance: 0, territories: territoryCount } });
}

async function createAcceptedClaimActivity(owner, suffix = token()) {
  return Activity.create({ owner: owner._id, clientActivityId: `claim-${suffix}`, status: 'accepted',
    serverValidated: true, claimEligible: true, claimBoundary: { type: 'Polygon', coordinates: [RING] } });
}

async function clean(ids) {
  await Promise.all([
    Activity.deleteMany({ _id: { $in: ids.activities || [] } }),
    Territory.deleteMany({ _id: { $in: ids.territories || [] } }),
    Attack.deleteMany({ $or: [{ activity: { $in: ids.activities || [] } }, { territory: { $in: ids.territories || [] } }] }),
    User.deleteMany({ _id: { $in: ids.users || [] } }),
  ]);
}

test('MongoDB replica-set integration: claim, transfer, rollback, replay, concurrency and counters', {
  skip: !RUN_MONGO_TESTS,
}, async (t) => {
  requireDedicatedLocalReplicaSet(MONGO_URI);
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
  try {
    await Promise.all([User.init(), Activity.init(), Territory.init(), Attack.init()]);
    const mutations = createGameMutations();

    await t.test('activity HTTP service repository persists an idempotent claim receipt', async () => {
      const ids = { users: [], activities: [], territories: [] };
      try {
        const owner = await createUser('claim');
        ids.users.push(owner._id);
        const lifecycle = createActivityLifecycle({ mutations });
        const started = await lifecycle.start({ ownerId: owner._id, clientActivityId: `activity-${token()}` });
        const activityId = started.body.activity.id;
        ids.activities.push(new mongoose.Types.ObjectId(activityId));
        const [first, duplicate] = await Promise.all([
          lifecycle.submit({ ownerId: owner._id, activityId, samples: TRACE }),
          lifecycle.submit({ ownerId: owner._id, activityId, samples: TRACE }),
        ]);
        assert.ok(first.body.success || duplicate.body.success);
        const activity = await Activity.findById(activityId).lean();
        assert.equal(activity.status, 'processed');
        const territories = await Territory.find({ claimActivity: activityId }).lean();
        assert.equal(territories.length, 1);
        const persistedOwner = await User.findById(owner._id).lean();
        assert.equal(persistedOwner.stats.territories, 1);
        ids.territories.push(...territories.map(({ _id }) => _id));
        const retry = await lifecycle.submit({ ownerId: owner._id, activityId, samples: TRACE });
        assert.equal(retry.body.status, 'processed');
        assert.equal((await Territory.countDocuments({ claimActivity: activityId })), 1);
      } finally { await clean(ids); }
    });

    await t.test('concurrent claim mutations persist one territory and one counter increment', async () => {
      const ids = { users: [], activities: [], territories: [] };
      try {
        const owner = await createUser('concurrentclaim');
        ids.users.push(owner._id);
        const activity = await createAcceptedClaimActivity(owner);
        ids.activities.push(activity._id);
        const outcomes = await Promise.all([
          mutations.claim({ userId: String(owner._id), activityId: String(activity._id) }),
          mutations.claim({ userId: String(owner._id), activityId: String(activity._id) }),
        ]);
        assert.ok(outcomes.every((result) => result.body.success));
        const territories = await Territory.find({ claimActivity: activity._id }).lean();
        assert.equal(territories.length, 1);
        ids.territories.push(territories[0]._id);
        assert.equal((await User.findById(owner._id).lean()).stats.territories, 1);
      } finally { await clean(ids); }
    });

    await t.test('ownership transfer commits owner and both counters together', async () => {
      const ids = { users: [], activities: [], territories: [] };
      try {
        const previous = await createUser('previous', 1);
        const attacker = await createUser('attacker', 0);
        ids.users.push(previous._id, attacker._id);
        const territory = await Territory.create({ owner: previous._id, ownerColor: previous.color, area_sqm: 100,
          perimeter_m: 40, strength_count: 1, strength: 100, path_nodes: RING,
          boundary: { type: 'Polygon', coordinates: [RING] } });
        ids.territories.push(territory._id);
        const activity = await Activity.create({ owner: attacker._id, clientActivityId: `attack-${token()}`, status: 'accepted',
          serverValidated: true, attackEvidence: [{ territoryId: territory._id, eligible: true }] });
        ids.activities.push(activity._id);
        const result = await mutations.attack({ userId: String(attacker._id), activityId: String(activity._id), territoryId: String(territory._id) });
        assert.equal(result.body.success, true);
        assert.equal(String((await Territory.findById(territory._id).lean()).owner), String(attacker._id));
        assert.equal((await User.findById(previous._id).lean()).stats.territories, 0);
        assert.equal((await User.findById(attacker._id).lean()).stats.territories, 1);
      } finally { await clean(ids); }
    });

    await t.test('injected counter failure aborts territory and attack writes', async () => {
      const ids = { users: [], activities: [], territories: [] };
      const originalUpdateOne = User.updateOne;
      try {
        const owner = await createUser('rollback');
        ids.users.push(owner._id);
        const activity = await createAcceptedClaimActivity(owner);
        ids.activities.push(activity._id);
        User.updateOne = function failCounterWrite(...args) {
          if (String(args[0]?._id) === String(owner._id)) throw new Error('injected test-only counter failure');
          return originalUpdateOne.apply(this, args);
        };
        const result = await mutations.claim({ userId: String(owner._id), activityId: String(activity._id) });
        assert.equal(result.body.success, false);
        assert.equal(await Territory.countDocuments({ claimActivity: activity._id }), 0);
        assert.equal((await User.findById(owner._id).lean()).stats.territories, 0);
      } finally {
        User.updateOne = originalUpdateOne;
        await clean(ids);
      }
    });

    await t.test('competing transfers use compare-and-set and leave counters equal to owners', async () => {
      const ids = { users: [], activities: [], territories: [] };
      try {
        const previous = await createUser('owner', 1);
        const contenderA = await createUser('contendera', 0);
        const contenderB = await createUser('contenderb', 0);
        ids.users.push(previous._id, contenderA._id, contenderB._id);
        const territory = await Territory.create({ owner: previous._id, ownerColor: previous.color, area_sqm: 100,
          perimeter_m: 40, strength_count: 1, strength: 100, path_nodes: RING,
          boundary: { type: 'Polygon', coordinates: [RING] } });
        ids.territories.push(territory._id);
        const activities = await Promise.all([contenderA, contenderB].map((owner) => Activity.create({ owner: owner._id,
          clientActivityId: `attack-${token()}`, status: 'accepted', serverValidated: true,
          attackEvidence: [{ territoryId: territory._id, eligible: true }] })));
        ids.activities.push(...activities.map(({ _id }) => _id));
        const attempts = await Promise.all(activities.map((activity, index) => mutations.attack({
          userId: String([contenderA, contenderB][index]._id), activityId: String(activity._id), territoryId: String(territory._id),
        })));
        assert.equal(attempts.filter((result) => result.body.success).length, 1);
        const finalTerritory = await Territory.findById(territory._id).lean();
        const ownerCounts = await Promise.all([previous, contenderA, contenderB].map(async (user) => ({
          user, actual: await Territory.countDocuments({ owner: user._id }),
        })));
        for (const entry of ownerCounts) assert.equal((await User.findById(entry.user._id).lean()).stats.territories, entry.actual);
        assert.equal(String(finalTerritory.owner) === String(contenderA._id) || String(finalTerritory.owner) === String(contenderB._id), true);
      } finally { await clean(ids); }
    });
  } finally {
    await mongoose.disconnect();
  }
});
