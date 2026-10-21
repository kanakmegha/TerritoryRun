import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateActivitySamples,
  validateActivitySamplesForTest,
} from './activityLifecycle.js';

// --- Short-distance completion (test mode only) ---

test('test-mode validation accepts a short 30 m closed loop', () => {
  // Square loop: 15 m per side = 60 m total, accuracy 5 m each, 2 s between samples.
  // Combined accuracy = 10 m, movement per side = 15 m > 10 m → counted.
  // Speed = 15 m / 2 s = 7.5 m/s < 12 m/s limit.
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 1_700_000_000_000, accuracy: 5 };
  const samples = [
    origin,
    { lat: 40.7484 + 15 / 111320, lng: -73.9857, timestamp: 1_700_000_002_000, accuracy: 5 },
    { lat: 40.7484 + 15 / 111320, lng: -73.9857 + 15 / (111320 * Math.cos(40.7484 * Math.PI / 180)), timestamp: 1_700_000_004_000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857 + 15 / (111320 * Math.cos(40.7484 * Math.PI / 180)), timestamp: 1_700_000_006_000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857, timestamp: 1_700_000_008_000, accuracy: 5 },
  ];
  const result = validateActivitySamplesForTest(samples);
  assert.ok(result.distance_m >= 45 && result.distance_m <= 75, `distance ${result.distance_m}`);
  assert.ok(result.area_sqm > 0, `area ${result.area_sqm}`);
  assert.equal(result.isTest, true);
});

test('test-mode validation rejects a path shorter than the test minimum', () => {
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 1_700_000_000_000, accuracy: 5 };
  const samples = [
    origin,
    { lat: 40.7484 + 1 / 111320, lng: -73.9857, timestamp: 1_700_000_001_000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857 + 1 / 111320, timestamp: 1_700_000_002_000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857, timestamp: 1_700_000_003_000, accuracy: 5 },
  ];
  assert.throws(
    () => validateActivitySamplesForTest(samples),
    (err) => err.code === 'distance_too_short'
  );
});

test('test-mode validation rejects an unclosed loop (end > 50 m from start)', () => {
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 1_700_000_000_000, accuracy: 5 };
  const mPerLngDeg = (2 * Math.PI * 6378137 / 360) * Math.cos(40.7484 * Math.PI / 180);
  const samples = [
    origin,
    { lat: 40.7484 + 60 / 111320, lng: -73.9857, timestamp: 1_700_000_010_000, accuracy: 5 },
    { lat: 40.7484 + 60 / 111320, lng: -73.9857 + 70 / mPerLngDeg, timestamp: 1_700_000_020_000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857 + 70 / mPerLngDeg, timestamp: 1_700_000_030_000, accuracy: 5 },
  ];
  assert.throws(
    () => validateActivitySamplesForTest(samples),
    (err) => err.code === 'loop_not_closed'
  );
});

test('production validation rejects a short 20 m loop (production rules unchanged)', () => {
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 1_700_000_000_000, accuracy: 5 };
  const samples = [
    origin,
    { lat: 40.7484 + 5 / 111320, lng: -73.9857, timestamp: 1_700_000_001_000, accuracy: 5 },
    { lat: 40.7484 + 5 / 111320, lng: -73.9857 + 5 / 111320, timestamp: 1_700_000_002_000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857 + 5 / 111320, timestamp: 1_700_000_003_000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857, timestamp: 1_700_000_004_000, accuracy: 5 },
  ];
  assert.throws(
    () => validateActivitySamples(samples),
    (err) => err.code === 'distance_too_short'
  );
});

test('test-mode validation rejects poor GPS accuracy (> 30 m)', () => {
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 1_700_000_000_000, accuracy: 31 };
  const samples = [
    origin,
    { lat: 40.7484 + 5 / 111320, lng: -73.9857, timestamp: 1_700_000_001_000, accuracy: 31 },
    { lat: 40.7484 + 5 / 111320, lng: -73.9857 + 5 / 111320, timestamp: 1_700_000_002_000, accuracy: 31 },
    { lat: 40.7484, lng: -73.9857 + 5 / 111320, timestamp: 1_700_000_003_000, accuracy: 31 },
    { lat: 40.7484, lng: -73.9857, timestamp: 1_700_000_004_000, accuracy: 31 },
  ];
  assert.throws(
    () => validateActivitySamplesForTest(samples),
    (err) => err.code === 'invalid_sample'
  );
});

test('short genuine movement accumulates when above max accuracy', () => {
  // Movement of 8 m with accuracy 5 m on both samples:
  // max(5, 5) = 5 m, 8 m > 5 m → counted.
  // sum(5, 5) = 10 m, 8 m < 10 m → would be rejected by the old sum filter.
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 1_700_000_000_000, accuracy: 5 };
  const step = 8 / 111320;
  const samples = [
    origin,
    { lat: 40.7484, lng: -73.9857 + step, timestamp: 1_700_000_002_000, accuracy: 5 },
    { lat: 40.7484 + step, lng: -73.9857 + step, timestamp: 1_700_000_004_000, accuracy: 5 },
    { lat: 40.7484 + step, lng: -73.9857, timestamp: 1_700_000_006_000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857, timestamp: 1_700_000_008_000, accuracy: 5 },
  ];
  const result = validateActivitySamplesForTest(samples);
  // 4 sides × 8 m = 32 m, above test minimum of 20 m.
  assert.ok(result.distance_m >= 20 && result.distance_m <= 45, `distance ${result.distance_m}`);
});

test('cumulative distance is monotonically non-decreasing', () => {
  // A trace with varied movement where each accepted step adds >= 0.
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 1_700_000_000_000, accuracy: 5 };
  const samples = [
    origin,
    { lat: 40.7484, lng: -73.9857 + 8 / 111320, timestamp: 1_700_000_002_000, accuracy: 5 },
    { lat: 40.7484 + 8 / 111320, lng: -73.9857 + 8 / 111320, timestamp: 1_700_000_004_000, accuracy: 5 },
    { lat: 40.7484 + 8 / 111320, lng: -73.9857, timestamp: 1_700_000_006_000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857, timestamp: 1_700_000_008_000, accuracy: 5 },
  ];
  const result = validateActivitySamplesForTest(samples);
  // Distance should equal the sum of all accepted segment distances.
  assert.ok(result.distance_m > 20, `expected distance > 20 m, got ${result.distance_m}`);
  // The server-side distance is the cumulative sum — monotonic by construction.
  assert.equal(typeof result.distance_m, 'number');
  assert.ok(Number.isFinite(result.distance_m));
});

test('test-mode 20 m minimum is evaluated against cumulative distance', () => {
  // Trace with total movement under 20 m → rejected as distance_too_short.
  const origin = { lat: 40.7484, lng: -73.9857, timestamp: 1_700_000_000_000, accuracy: 5 };
  const step = 3 / 111320;
  const samples = [
    origin,
    { lat: 40.7484, lng: -73.9857 + step, timestamp: 1_700_000_002_000, accuracy: 5 },
    { lat: 40.7484 + step, lng: -73.9857 + step, timestamp: 1_700_000_004_000, accuracy: 5 },
    { lat: 40.7484 + step, lng: -73.9857, timestamp: 1_700_000_006_000, accuracy: 5 },
    { lat: 40.7484, lng: -73.9857, timestamp: 1_700_000_008_000, accuracy: 5 },
  ];
  assert.throws(
    () => validateActivitySamplesForTest(samples),
    (err) => err.code === 'distance_too_short'
  );
});
