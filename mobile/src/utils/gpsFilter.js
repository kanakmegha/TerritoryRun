import { calculateDistance } from './geometry.js';

/**
 * Calculate bearing (direction) from point 1 to point 2 in radians [-PI, PI].
 * 0 = North, PI/2 = East, PI = South, -PI/2 = West.
 */
export function bearingBetween(lat1, lon1, lat2, lon2) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return Math.atan2(y, x);
}

/**
 * Absolute angular difference between two bearings in radians [0, PI].
 */
export function bearingDifference(b1, b2) {
  let diff = b2 - b1;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return Math.abs(diff);
}

/**
 * Process a single GPS sample and return the distance increment.
 *
 * Uses accuracy-aware filtering with direction-confidence buffering:
 * - Exact duplicates (moved === 0) are never counted.
 * - Movement larger than the combined accuracy of both fixes is committed
 *   immediately.
 * - Small movement within accuracy noise is buffered and only committed
 *   when direction is consistent over multiple samples (stationary GPS
 *   jitter changes direction randomly; real walking moves consistently).
 *
 * @param {Object|null} prev - Previous sample {lat, lng, timestamp, accuracy} or null
 * @param {Object|null} curr - Current sample {lat, lng, timestamp, accuracy} or null
 * @param {Object} state - Filter state {buffer, direction, confidence} or null for first call
 * @returns {Object} {distanceIncrement, newState}
 */
export function processGPSUpdate(prev, curr, state = null) {
  const buffer = state ? state.buffer : 0;
  const direction = state ? state.direction : null;
  const confidence = state ? state.confidence : 0;

  if (!curr) {
    return { distanceIncrement: 0, newState: { buffer: 0, direction: null, confidence: 0 } };
  }

  if (!prev) {
    return { distanceIncrement: 0, newState: { buffer: 0, direction: null, confidence: 0 } };
  }

  const moved = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);

  // Exact duplicates are never accepted.
  if (moved === 0) {
    return { distanceIncrement: 0, newState: { buffer: 0, direction: null, confidence: 0 } };
  }

  // Reject out-of-order timestamps.
  if (curr.timestamp <= prev.timestamp) {
    return { distanceIncrement: 0, newState: { buffer, direction, confidence } };
  }

  // Reject implausible jumps (speed > 12 m/s ≈ 43 km/h).
  const elapsedMs = curr.timestamp - prev.timestamp;
  if (elapsedMs > 0 && moved / (elapsedMs / 1000) > 12) {
    return { distanceIncrement: 0, newState: { buffer, direction, confidence } };
  }

  const combinedAccuracy = prev.accuracy + curr.accuracy;

  if (moved > combinedAccuracy) {
    // Significant movement — commit immediately along with any buffered movement.
    return {
      distanceIncrement: moved + buffer,
      newState: { buffer: 0, direction: null, confidence: 0 },
    };
  } else if (moved > 0.1) {
    // Small movement within accuracy noise. Buffer it and only commit
    // when direction is consistent across multiple samples. Stationary
    // GPS jitter changes direction randomly (confidence never builds);
    // real walking moves in a consistent direction (confidence builds).
    const bearing = bearingBetween(prev.lat, prev.lng, curr.lat, curr.lng);
    let consistent = true;
    if (direction !== null) {
      const diff = bearingDifference(direction, bearing);
      consistent = diff < Math.PI / 2; // within 90° = consistent
    }

    let newBuffer = buffer;
    let newConfidence = confidence;

    if (consistent) {
      newConfidence += 1;
      newBuffer += moved;
    } else {
      // Direction changed — restart buffer with this sample.
      newBuffer = moved;
      newConfidence = 1;
    }

    // Commit buffer when confident enough, or when buffer exceeds
    // 2× the accuracy threshold (unlikely to be pure jitter).
    if (newConfidence >= 3 || newBuffer > combinedAccuracy * 2) {
      return {
        distanceIncrement: newBuffer,
        newState: { buffer: 0, direction: null, confidence: 0 },
      };
    }

    return {
      distanceIncrement: 0,
      newState: { buffer: newBuffer, direction: bearing, confidence: newConfidence },
    };
  }

  // Movement below noise floor — ignore entirely.
  return { distanceIncrement: 0, newState: { buffer, direction, confidence } };
}
