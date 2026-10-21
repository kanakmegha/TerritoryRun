import mongoose from 'mongoose';
import User from '../models/User.js';
import Territory from '../models/Territory.js';
import Activity from '../models/Activity.js';
import Attack from '../models/Attack.js';

const OBJECT_ID = /^[a-f\d]{24}$/i;
const MAX_POLYGON_POINTS = 2000;
const EARTH_RADIUS_METERS = 6378137;

class MutationError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const idString = (value) => value == null ? null : String(value);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);

function validObjectId(value) {
  return typeof value === 'string' && OBJECT_ID.test(value);
}

function toRad(value) {
  return value * Math.PI / 180;
}

function distanceMeters(a, b) {
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLat = lat2 - lat1;
  const dLng = toRad(b[0] - a[0]);
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function projectRing(ring) {
  const origin = ring[0];
  const latScale = Math.PI * EARTH_RADIUS_METERS / 180;
  const lngScale = latScale * Math.cos(toRad(origin[1]));
  return ring.map(([lng, lat]) => [(lng - origin[0]) * lngScale, (lat - origin[1]) * latScale]);
}

function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a, b, point) {
  const epsilon = 1e-8;
  return point[0] >= Math.min(a[0], b[0]) - epsilon && point[0] <= Math.max(a[0], b[0]) + epsilon &&
    point[1] >= Math.min(a[1], b[1]) - epsilon && point[1] <= Math.max(a[1], b[1]) + epsilon;
}

function segmentsIntersect(a, b, c, d) {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  const epsilon = 1e-8;
  if (((abC > epsilon && abD < -epsilon) || (abC < -epsilon && abD > epsilon)) &&
    ((cdA > epsilon && cdB < -epsilon) || (cdA < -epsilon && cdB > epsilon))) return true;
  return (Math.abs(abC) <= epsilon && onSegment(a, b, c)) ||
    (Math.abs(abD) <= epsilon && onSegment(a, b, d)) ||
    (Math.abs(cdA) <= epsilon && onSegment(c, d, a)) ||
    (Math.abs(cdB) <= epsilon && onSegment(c, d, b));
}

/** Validate GeoJSON and derive metrics from coordinates; never trust caller totals. */
export function calculatePolygonMetrics(polygon) {
  const ring = polygon?.type === 'Polygon' && Array.isArray(polygon.coordinates) && polygon.coordinates.length === 1
    ? polygon.coordinates[0]
    : null;
  if (!ring || ring.length < 4 || ring.length > MAX_POLYGON_POINTS + 1) {
    throw new MutationError(400, 'invalid_geometry', 'A single closed polygon ring is required.');
  }

  for (const point of ring) {
    if (!Array.isArray(point) || point.length !== 2 || !finite(point[0]) || !finite(point[1]) ||
      point[0] < -180 || point[0] > 180 || point[1] < -90 || point[1] > 90) {
      throw new MutationError(400, 'invalid_geometry', 'Polygon coordinates must be finite WGS84 [longitude, latitude] pairs.');
    }
  }

  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Math.abs(first[0] - last[0]) > 1e-9 || Math.abs(first[1] - last[1]) > 1e-9) {
    throw new MutationError(400, 'invalid_geometry', 'Polygon ring must be closed.');
  }

  const openRing = ring.slice(0, -1);
  if (new Set(openRing.map(([lng, lat]) => `${lng},${lat}`)).size < 3) {
    throw new MutationError(400, 'invalid_geometry', 'Polygon needs at least three distinct vertices.');
  }

  const projected = projectRing(ring);
  const edgeCount = projected.length - 1;
  for (let i = 0; i < edgeCount; i += 1) {
    for (let j = i + 1; j < edgeCount; j += 1) {
      if (j === i + 1 || (i === 0 && j === edgeCount - 1)) continue;
      if (segmentsIntersect(projected[i], projected[i + 1], projected[j], projected[j + 1])) {
        throw new MutationError(400, 'invalid_geometry', 'Self-intersecting polygon rings are not accepted.');
      }
    }
  }

  let twiceArea = 0;
  let perimeter = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const j = i + 1;
    twiceArea += projected[i][0] * projected[j][1] - projected[j][0] * projected[i][1];
    perimeter += distanceMeters(ring[i], ring[j]);
  }
  const area = Math.abs(twiceArea / 2);
  if (!finite(area) || !finite(perimeter) || area <= 0 || perimeter <= 0) {
    throw new MutationError(400, 'invalid_geometry', 'Polygon must enclose a positive area.');
  }
  return { area_sqm: area, perimeter_m: perimeter };
}

function isTransactionUnavailable(error) {
  return error?.code === 'TRANSACTIONS_UNAVAILABLE' || error?.code === 20 ||
    /transactions are not supported|transaction numbers are only allowed|replica set member or mongos/i.test(error?.message || '');
}

async function runMongoTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(createMongoTransaction(session));
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function createMongoTransaction(session) {
  return {
    async getUser(userId) {
      return User.findById(userId).select('_id color').session(session).lean();
    },
    async getActivity(activityId, ownerId) {
      return Activity.findOne({ _id: activityId, owner: ownerId }).session(session).lean();
    },
    async findTerritoryByClaimActivity(activityId) {
      return Territory.findOne({ claimActivity: activityId }).session(session).lean();
    },
    async getTerritory(territoryId) {
      return Territory.findById(territoryId).session(session).lean();
    },
    async getAttack(activityId, territoryId) {
      return Attack.findOne({ activity: activityId, territory: territoryId }).session(session).lean();
    },
    async createTerritory(data) {
      const [territory] = await Territory.create([data], { session });
      return territory.toObject();
    },
    async transferTerritory(territoryId, expectedOwner, newOwner, color, strength) {
      return Territory.findOneAndUpdate(
        { _id: territoryId, owner: expectedOwner },
        { $set: { owner: newOwner, teamOwner: null, ownerColor: color, timestamp: new Date(), strength_count: 1, strength } },
        { new: true, session, runValidators: true },
      ).lean();
    },
    async createAttack(data) {
      const [attack] = await Attack.create([data], { session });
      return attack.toObject();
    },
    async countTerritories(ownerId) {
      return Territory.countDocuments({ owner: ownerId }).session(session);
    },
    async setUserTerritoryCount(userId, count) {
      const result = await User.updateOne({ _id: userId }, { $set: { 'stats.territories': count } }, { session });
      return result.matchedCount === 1;
    },
  };
}

function failure(status, code, message) {
  return { status, body: { success: false, code, message } };
}

async function executeTransaction(withTransaction, action) {
  try {
    return await withTransaction(action);
  } catch (error) {
    if (error?.code === 11000 || error?.code === 11001) {
      try {
        // A unique-key race means another request committed the same activity
        // first. Retry only to read and return its idempotent result.
        return await withTransaction(action);
      } catch (retryError) {
        return transactionFailure(retryError);
      }
    }
    return transactionFailure(error);
  }
}

function transactionFailure(error) {
  if (error instanceof MutationError) return failure(error.status, error.code, error.message);
  if (isTransactionUnavailable(error)) {
    return failure(503, 'transactions_unavailable', 'Territory changes require a MongoDB replica set transaction.');
  }
  return failure(500, 'persistence_error', 'Territory change was not saved. Please retry.');
}

export function createGameMutations({ withTransaction = runMongoTransaction } = {}) {
  return {
    async claim({ userId, activityId }) {
      if (!validObjectId(userId) || !validObjectId(activityId)) {
        return failure(400, 'invalid_id', 'A valid user and activity ID are required.');
      }

      return executeTransaction(withTransaction, async (tx) => {
        const existing = await tx.findTerritoryByClaimActivity(activityId);
        if (existing) {
          if (idString(existing.owner) !== userId) throw new MutationError(409, 'claim_conflict', 'This activity already claimed a territory.');
          return { status: 200, body: { success: true, alreadyApplied: true, territory: existing } };
        }

        const activity = await tx.getActivity(activityId, userId);
        if (!activity) throw new MutationError(404, 'activity_not_found', 'Verified activity was not found for this user.');
        if (activity.isTest === true) {
          throw new MutationError(409, 'test_activity_not_claimable', 'Indoor test activities cannot create real territory.');
        }
        if (!activity.serverValidated || activity.status !== 'accepted') {
          throw new MutationError(409, 'activity_not_verified', 'Activity has not passed server verification.');
        }
        if (activity.claimEligible !== true) {
          throw new MutationError(409, 'claim_rules_pending', 'This activity has no server-approved territory claim evidence.');
        }

        const user = await tx.getUser(userId);
        if (!user) throw new MutationError(404, 'user_not_found', 'User not found.');
        const boundary = activity.claimBoundary;
        const metrics = calculatePolygonMetrics(boundary);
        const territory = await tx.createTerritory({
          owner: userId,
          ownerColor: user.color,
          area_sqm: metrics.area_sqm,
          perimeter_m: metrics.perimeter_m,
          strength_count: 1,
          strength: metrics.area_sqm,
          path_nodes: boundary.coordinates[0],
          boundary,
          claimActivity: activityId,
        });
        const newCount = await tx.countTerritories(userId);
        if (!await tx.setUserTerritoryCount(userId, newCount)) {
          throw new Error('Claiming user disappeared during transaction.');
        }
        return { status: 201, body: { success: true, territory } };
      });
    },

    async attack({ userId, activityId, territoryId }) {
      if (![userId, activityId, territoryId].every(validObjectId)) {
        return failure(400, 'invalid_id', 'Valid user, activity and territory IDs are required.');
      }

      return executeTransaction(withTransaction, async (tx) => {
        const previousAttack = await tx.getAttack(activityId, territoryId);
        if (previousAttack) {
          if (idString(previousAttack.toOwner) !== userId) {
            throw new MutationError(409, 'activity_already_used', 'This activity already resolved this territory attack.');
          }
          const current = await tx.getTerritory(territoryId);
          return { status: 200, body: { success: true, alreadyApplied: true, territory: current } };
        }

        const activity = await tx.getActivity(activityId, userId);
        if (!activity) throw new MutationError(404, 'activity_not_found', 'Verified activity was not found for this user.');
        if (activity.isTest === true) {
          throw new MutationError(409, 'test_activity_not_claimable', 'Indoor test activities cannot be used for attacks.');
        }
        if (!activity.serverValidated || activity.status !== 'accepted') {
          throw new MutationError(409, 'activity_not_verified', 'Activity has not passed server verification.');
        }
        const evidence = activity.attackEvidence?.find((entry) => idString(entry.territoryId) === territoryId && entry.eligible === true);
        if (!evidence) throw new MutationError(409, 'attack_rules_pending', 'Activity has no server-approved attack evidence for this territory.');

        const user = await tx.getUser(userId);
        if (!user) throw new MutationError(404, 'user_not_found', 'User not found.');
        const territory = await tx.getTerritory(territoryId);
        if (!territory) throw new MutationError(404, 'territory_not_found', 'Territory not found.');
        const previousOwnerId = idString(territory.owner);
        if (!previousOwnerId) throw new MutationError(409, 'ownership_conflict', 'Territory has no transferable owner.');
        if (previousOwnerId === userId) throw new MutationError(409, 'already_owner', 'You already own this territory.');
        if (!await tx.getUser(previousOwnerId)) throw new MutationError(409, 'owner_not_found', 'Current territory owner was not found.');

        const updated = await tx.transferTerritory(territoryId, previousOwnerId, userId, user.color, territory.area_sqm);
        if (!updated) throw new MutationError(409, 'ownership_conflict', 'Territory ownership changed; refresh and retry with a new activity.');
        await tx.createAttack({ activity: activityId, territory: territoryId, fromOwner: previousOwnerId, toOwner: userId });

        const previousOwnerCount = await tx.countTerritories(previousOwnerId);
        const newOwnerCount = await tx.countTerritories(userId);
        if (!await tx.setUserTerritoryCount(previousOwnerId, previousOwnerCount) ||
          !await tx.setUserTerritoryCount(userId, newOwnerCount)) {
          throw new Error('Territory owner disappeared during transaction.');
        }
        return { status: 200, body: { success: true, territory: updated } };
      });
    },
  };
}

export const gameMutations = createGameMutations();
