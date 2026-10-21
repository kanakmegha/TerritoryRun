import test from 'node:test';
import assert from 'node:assert/strict';
import {
  processGPSUpdate,
  bearingBetween,
  bearingDifference,
} from './gpsFilter.js';

// --- bearingBetween tests ---

test('bearingBetween: north is 0 radians', () => {
  const b = bearingBetween(0, 0, 0.001, 0);
  assert.ok(Math.abs(b) < 0.001, `expected ~0, got ${b}`);
});

test('bearingBetween: east is PI/2 radians', () => {
  const b = bearingBetween(0, 0, 0, 0.001);
  assert.ok(Math.abs(b - Math.PI / 2) < 0.001, `expected ~PI/2, got ${b}`);
});

test('bearingDifference: same bearings → 0', () => {
  assert.equal(bearingDifference(0, 0), 0);
  assert.equal(bearingDifference(Math.PI, Math.PI), 0);
});

test('bearingDifference: opposite bearings → PI', () => {
  const d = bearingDifference(0, Math.PI);
  assert.ok(Math.abs(d - Math.PI) < 0.001, `expected PI, got ${d}`);
});

// --- processGPSUpdate tests ---

test('processGPSUpdate: first sample returns 0 distance', () => {
  const result = processGPSUpdate(null, {
    lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 5,
  });
  assert.equal(result.distanceIncrement, 0);
  assert.equal(result.newState.buffer, 0);
});

test('processGPSUpdate: stationary GPS jitter does not accumulate distance', () => {
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 8 };
  // Jitter steps of ~5m within combined accuracy (8+8=16m) → should not accumulate
  const jittered = [
    origin,
    { lat: 40.7484 + 0.00005, lng: -73.9857, timestamp: 110000, accuracy: 8 },
    { lat: 40.7484, lng: -73.9857 + 0.00005, timestamp: 120000, accuracy: 8 },
    { lat: 40.7484 - 0.00005, lng: -73.9857, timestamp: 130000, accuracy: 8 },
    { lat: 40.7484, lng: -73.9857 - 0.00005, timestamp: 140000, accuracy: 8 },
    { lat: 40.7484, lng: -73.9857, timestamp: 150000, accuracy: 8 },
  ];

  let totalDistance = 0;
  let state = null;
  for (let i = 1; i < jittered.length; i++) {
    const result = processGPSUpdate(jittered[i - 1], jittered[i], state);
    totalDistance += result.distanceIncrement;
    state = result.newState;
  }

  // Jitter steps (~5m each) are within combined accuracy (16m) → should not accumulate
  assert.equal(totalDistance, 0, `expected 0 distance from jitter, got ${totalDistance}`);
});

test('processGPSUpdate: short genuine movement accumulates distance', () => {
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 5 };
  // Walk 8m per side (combined accuracy = 10m, each step is 8m < 10m, so buffered)
  // But direction is consistent (N→E→S→W), so confidence builds and buffer commits
  const step = 8 / 111195;
  const samples = [
    origin,
    { lat: 40.7484, lng: -73.9857 + step, timestamp: 110000, accuracy: 5 },
    { lat: 40.7484 + step, lng: -73.9857 + step, timestamp: 120000, accuracy: 5 },
    { lat: 40.7484 + step, lng: -73.9857, timestamp: 130000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857, timestamp: 140000, accuracy: 5 },
  ];

  let totalDistance = 0;
  let state = null;
  for (let i = 1; i < samples.length; i++) {
    const result = processGPSUpdate(samples[i - 1], samples[i], state);
    totalDistance += result.distanceIncrement;
    state = result.newState;
  }

  // All 4 sides of 8m each should accumulate (direction is consistent)
  // But each side is 8m < combined accuracy 10m, so they're buffered
  // After 3 consistent samples, buffer commits at step 3 (8+8=16m)
  // After 4 consistent samples, buffer commits at step 4 (another 8m)
  // Total should be ~32m (4 × 8m)
  assert.ok(totalDistance > 20, `expected >20m from 32m walk, got ${totalDistance}`);
  assert.ok(totalDistance <= 35, `expected <=35m from 32m walk, got ${totalDistance}`);
});

test('processGPSUpdate: outdoor walking accumulates full distance', () => {
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 5 };
  // Walk a 30m square loop = 120m total
  const step = 30 / 111195;
  const samples = [
    origin,
    { lat: 40.7484, lng: -73.9857 + step, timestamp: 110000, accuracy: 5 },
    { lat: 40.7484 + step, lng: -73.9857 + step, timestamp: 120000, accuracy: 5 },
    { lat: 40.7484 + step, lng: -73.9857, timestamp: 130000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857, timestamp: 140000, accuracy: 5 },
  ];

  let totalDistance = 0;
  let state = null;
  for (let i = 1; i < samples.length; i++) {
    const result = processGPSUpdate(samples[i - 1], samples[i], state);
    totalDistance += result.distanceIncrement;
    state = result.newState;
  }

  // Each side is 30m > combined accuracy 10m → committed immediately
  // Total should be ~120m
  assert.ok(totalDistance > 100, `expected >100m from 120m walk, got ${totalDistance}`);
});

test('processGPSUpdate: exact duplicate samples return 0 distance', () => {
  const sample = { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 5 };
  const result = processGPSUpdate(sample, sample, null);
  assert.equal(result.distanceIncrement, 0);
});

test('processGPSUpdate: out-of-order timestamps return 0 distance', () => {
  const first = { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 5 };
  const second = { lat: 40.7484, lng: -73.9857 + 0.001, timestamp: 90000, accuracy: 5 };
  const result = processGPSUpdate(first, second, null);
  assert.equal(result.distanceIncrement, 0);
});

test('processGPSUpdate: consecutive duplicate samples do not accumulate distance', () => {
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 5 };
  const duplicate = { lat: 40.7484, lng: -73.9857, timestamp: 101000, accuracy: 5 };
  // First sample: no previous, distanceIncrement 0
  const r1 = processGPSUpdate(null, origin, null);
  assert.equal(r1.distanceIncrement, 0);
  // Second sample: exact duplicate of first, distanceIncrement 0
  const r2 = processGPSUpdate(origin, duplicate, r1.newState);
  assert.equal(r2.distanceIncrement, 0);
  assert.equal(r2.newState.confidence, 0);
  assert.equal(r2.newState.direction, null);
  // Third sample: different from duplicate, 30m in 10s = 3 m/s < 12 m/s
  const third = { lat: 40.7484 + 30 / 111195, lng: -73.9857, timestamp: 106000, accuracy: 5 };
  const r3 = processGPSUpdate(duplicate, third, r2.newState);
  assert.ok(r3.distanceIncrement > 0, `expected positive distance increment, got ${r3.distanceIncrement}`);
});

test('processGPSUpdate: mixed duplicate and movement samples accumulate only real movement', () => {
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 5 };
  const step = 15 / 111195;
  const samples = [
    origin,
    { lat: 40.7484, lng: -73.9857 + step, timestamp: 102000, accuracy: 5 },  // 15m move
    { lat: 40.7484, lng: -73.9857 + step, timestamp: 104000, accuracy: 5 },   // duplicate
    { lat: 40.7484 + step, lng: -73.9857 + step, timestamp: 106000, accuracy: 5 }, // 15m move
    { lat: 40.7484 + step, lng: -73.9857, timestamp: 108000, accuracy: 5 },    // 15m move
  ];

  let totalDistance = 0;
  let state = null;
  for (let i = 1; i < samples.length; i++) {
    const result = processGPSUpdate(samples[i - 1], samples[i], state);
    totalDistance += result.distanceIncrement;
    state = result.newState;
  }

  // Steps 1, 3, 4 each contribute ~15m. Step 2 is duplicate, adds 0.
  // Total ≈ 45m
  assert.ok(totalDistance > 35, `expected >35m, got ${totalDistance}`);
  assert.ok(totalDistance < 50, `expected <50m, got ${totalDistance}`);
});

test('processGPSUpdate: duplicate samples after genuine movement do not add distance', () => {
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 100000, accuracy: 5 };
  const step = 30 / 111195;
  const moved = { lat: 40.7484 + step, lng: -73.9857, timestamp: 106000, accuracy: 5 };
  const duplicate = { lat: 40.7484 + step, lng: -73.9857, timestamp: 107000, accuracy: 5 };
  const samples = [origin, moved, duplicate];

  let totalDistance = 0;
  let state = null;
  for (let i = 1; i < samples.length; i++) {
    const result = processGPSUpdate(samples[i - 1], samples[i], state);
    totalDistance += result.distanceIncrement;
    state = result.newState;
  }

  // Only origin->moved should count (~30m), duplicate adds 0
  assert.ok(totalDistance > 25, `expected >25m, got ${totalDistance}`);
  assert.ok(totalDistance < 35, `expected <35m, got ${totalDistance}`);
});
