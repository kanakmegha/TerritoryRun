const DRAFT_PREFIX = 'territory-run:draft:v1:';
const VALID_STATES = new Set(['recording', 'uploading', 'pending', 'processed', 'rejected']);
const STATE_PRIORITY = { recording: 0, uploading: 1, pending: 2, processed: 3, rejected: 3 };

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const draftKey = (ownerId, activityId) => `${DRAFT_PREFIX}${encodeURIComponent(String(ownerId))}:${String(activityId)}`;
const ownerPrefix = (ownerId) => `${DRAFT_PREFIX}${encodeURIComponent(String(ownerId))}:`;

function isValidDraft(record, ownerId, activityId) {
  const draft = record?.draft;
  if (record?.version !== 1 || record.ownerId !== String(ownerId) || record.activityId !== activityId ||
      !draft || typeof draft !== 'object' || draft.activityId !== activityId ||
      typeof draft.isActive !== 'boolean' || !VALID_STATES.has(draft.submissionStatus) ||
      !Array.isArray(draft.samples) || !Array.isArray(draft.path)) return false;

  if (draft.samples.length > 5000 || draft.path.length > 5000) return false;
  if (!draft.samples.every((sample) => sample && isFiniteNumber(sample.lat) && sample.lat >= -90 && sample.lat <= 90 &&
      isFiniteNumber(sample.lng) && sample.lng >= -180 && sample.lng <= 180 &&
      isFiniteNumber(sample.timestamp) && sample.timestamp > 0 &&
      (sample.accuracy === null || (isFiniteNumber(sample.accuracy) && sample.accuracy > 0)))) return false;
  return draft.path.every((point) => Array.isArray(point) && point.length === 2 &&
    isFiniteNumber(point[0]) && point[0] >= -90 && point[0] <= 90 &&
    isFiniteNumber(point[1]) && point[1] >= -180 && point[1] <= 180);
}

export function createActivityDraftStore(storage) {
  const writes = new Map();

  function serialize(key, action) {
    const previous = writes.get(key) || Promise.resolve();
    const next = previous.catch(() => {}).then(action);
    writes.set(key, next);
    return next.finally(() => {
      if (writes.get(key) === next) writes.delete(key);
    });
  }

  async function loadByKey(ownerId, activityId, key = draftKey(ownerId, activityId)) {
    await (writes.get(key) || Promise.resolve()).catch(() => {});
    const serialized = await storage.getItem(key);
    if (serialized == null) return null;
    try {
      const record = JSON.parse(serialized);
      if (!isValidDraft(record, ownerId, activityId)) {
        await serialize(key, () => storage.removeItem(key));
        return null;
      }
      const draft = { ...record.draft };
      // An upload in flight may have committed remotely before the app died.
      // Retrying the same activity ID lets the server return its durable result.
      if (draft.submissionStatus === 'uploading') draft.submissionStatus = 'pending';
      return draft;
    } catch {
      await serialize(key, () => storage.removeItem(key));
      return null;
    }
  }

  return {
    save(ownerId, activityId, draft) {
      const key = draftKey(ownerId, activityId);
      return serialize(key, async () => {
        const record = { version: 1, ownerId: String(ownerId), activityId, updatedAt: Date.now(), draft };
        if (!isValidDraft(record, ownerId, activityId)) throw new TypeError('Activity draft is malformed.');
        const previousValue = await storage.getItem(key);
        if (previousValue) {
          try {
            const previous = JSON.parse(previousValue);
            if (isValidDraft(previous, ownerId, activityId)) {
              const oldTime = previous.draft.lastUpdateTime || 0;
              const newTime = draft.lastUpdateTime || 0;
              if (oldTime > newTime || (oldTime === newTime &&
                  STATE_PRIORITY[previous.draft.submissionStatus] > STATE_PRIORITY[draft.submissionStatus])) return;
            }
          } catch { /* Replace an unreadable prior record with the complete new snapshot. */ }
        }
        await storage.setItem(key, JSON.stringify(record));
      });
    },

    load(ownerId, activityId) {
      return loadByKey(ownerId, activityId);
    },

    async loadLatest(ownerId) {
      const prefix = ownerPrefix(ownerId);
      const keys = (await storage.getAllKeys()).filter((key) => key.startsWith(prefix));
      const drafts = [];
      for (const key of keys) {
        const activityId = key.slice(prefix.length);
        const draft = await loadByKey(ownerId, activityId, key);
        if (draft) drafts.push(draft);
      }
      const pendingPriority = (draft) => ['recording', 'uploading', 'pending'].includes(draft.submissionStatus) ? 1 : 0;
      return drafts.sort((a, b) => pendingPriority(b) - pendingPriority(a) ||
        (b.lastUpdateTime || 0) - (a.lastUpdateTime || 0))[0] || null;
    },

    remove(ownerId, activityId) {
      const key = draftKey(ownerId, activityId);
      return serialize(key, () => storage.removeItem(key));
    },
  };
}

export const activityDraftKeyForTest = draftKey;
