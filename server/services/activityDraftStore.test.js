import test from 'node:test';
import assert from 'node:assert/strict';
import { createActivityDraftStore, activityDraftKeyForTest } from '../../mobile/src/utils/activityDraftStore.js';

const OWNER_A = 'user-a';
const OWNER_B = 'user-b';
const ACTIVITY = 'aaaaaaaaaaaaaaaaaaaaaaaa';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async getItem(key) { return values.has(key) ? values.get(key) : null; },
    async setItem(key, value) { values.set(key, value); },
    async removeItem(key) { values.delete(key); },
    async getAllKeys() { return [...values.keys()]; },
  };
}

function draft(overrides = {}) {
  return { activityId: ACTIVITY, isActive: false, submissionStatus: 'pending', samples: [], path: [], lastUpdateTime: 10, ...overrides };
}

test('activity drafts are keyed by owner and activity; account switching cannot load another owner draft', async () => {
  const storage = memoryStorage();
  const drafts = createActivityDraftStore(storage);
  await drafts.save(OWNER_A, ACTIVITY, draft());
  assert.ok(storage.values.has(activityDraftKeyForTest(OWNER_A, ACTIVITY)));
  assert.equal(await drafts.load(OWNER_B, ACTIVITY), null);
  assert.equal((await drafts.loadLatest(OWNER_B)), null);
  assert.equal((await drafts.loadLatest(OWNER_A)).activityId, ACTIVITY);
});

test('serialized writes leave the latest full draft after rapid sample updates', async () => {
  const storage = memoryStorage();
  const drafts = createActivityDraftStore(storage);
  const one = { lat: 40, lng: -73, timestamp: 1000, accuracy: 5 };
  const two = { lat: 40.001, lng: -73, timestamp: 2000, accuracy: 5 };
  await Promise.all([
    drafts.save(OWNER_A, ACTIVITY, draft({ samples: [one], path: [[40, -73]], lastUpdateTime: 1 })),
    drafts.save(OWNER_A, ACTIVITY, draft({ samples: [one, two], path: [[40, -73], [40.001, -73]], lastUpdateTime: 2 })),
  ]);
  const recovered = await drafts.load(OWNER_A, ACTIVITY);
  assert.equal(recovered.samples.length, 2);
  assert.equal(recovered.lastUpdateTime, 2);
});

test('a delayed stale snapshot cannot overwrite newer samples or terminal status', async () => {
  const storage = memoryStorage();
  const drafts = createActivityDraftStore(storage);
  await drafts.save(OWNER_A, ACTIVITY, draft({ lastUpdateTime: 20, samples: [{ lat: 40, lng: -73, timestamp: 20, accuracy: 5 }] }));
  await drafts.save(OWNER_A, ACTIVITY, draft({ lastUpdateTime: 10, samples: [{ lat: 40.001, lng: -73, timestamp: 10, accuracy: 5 }] }));
  await drafts.save(OWNER_A, ACTIVITY, draft({ lastUpdateTime: 20, submissionStatus: 'processed', outcome: { id: 'receipt' } }));
  await drafts.save(OWNER_A, ACTIVITY, draft({ lastUpdateTime: 20, submissionStatus: 'uploading' }));
  const recovered = await drafts.load(OWNER_A, ACTIVITY);
  assert.equal(recovered.submissionStatus, 'processed');
  assert.deepEqual(recovered.outcome, { id: 'receipt' });
  assert.equal(recovered.samples.length, 0);
});

test('malformed new snapshots cannot overwrite the last valid durable draft', async () => {
  const storage = memoryStorage();
  const drafts = createActivityDraftStore(storage);
  const good = draft({ samples: [{ lat: 40, lng: -73, timestamp: 1, accuracy: 5 }] });
  await drafts.save(OWNER_A, ACTIVITY, good);
  await assert.rejects(drafts.save(OWNER_A, ACTIVITY, draft({
    lastUpdateTime: 20, samples: [{ lat: 200, lng: -73, timestamp: 2, accuracy: 5 }],
  })), /malformed/);
  assert.deepEqual((await drafts.load(OWNER_A, ACTIVITY)).samples, good.samples);
});

test('uploading draft recovers as pending for same-ID retry after termination', async () => {
  const storage = memoryStorage();
  const drafts = createActivityDraftStore(storage);
  await drafts.save(OWNER_A, ACTIVITY, draft({ submissionStatus: 'uploading' }));
  assert.equal((await drafts.load(OWNER_A, ACTIVITY)).submissionStatus, 'pending');
});

test('missing, malformed, truncated and identity-mismatched drafts are ignored and removed', async () => {
  const key = activityDraftKeyForTest(OWNER_A, ACTIVITY);
  const storage = memoryStorage({ [key]: '{truncated' });
  const drafts = createActivityDraftStore(storage);
  assert.equal(await drafts.load(OWNER_A, ACTIVITY), null);
  assert.equal(storage.values.has(key), false);
  await drafts.save(OWNER_A, ACTIVITY, draft());
  const record = JSON.parse(storage.values.get(key));
  record.draft.samples = [{ lat: 'bad', lng: -73, timestamp: 10, accuracy: 5 }];
  storage.values.set(key, JSON.stringify(record));
  assert.equal(await drafts.load(OWNER_A, ACTIVITY), null);
  assert.equal(storage.values.has(key), false);
  assert.equal(await drafts.load(OWNER_A, 'bbbbbbbbbbbbbbbbbbbbbbbb'), null);
});

test('a partial storage write cannot be interpreted as a successful claim', async () => {
  const key = activityDraftKeyForTest(OWNER_A, ACTIVITY);
  const storage = memoryStorage({ [key]: JSON.stringify({ version: 1, ownerId: OWNER_A, activityId: ACTIVITY,
    draft: draft({ submissionStatus: 'processed', outcome: null, samples: [{ lat: 1 }] }) }) });
  const drafts = createActivityDraftStore(storage);
  assert.equal(await drafts.load(OWNER_A, ACTIVITY), null);
  assert.equal(storage.values.has(key), false);
});
