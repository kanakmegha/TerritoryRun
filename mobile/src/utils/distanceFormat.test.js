import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDistance } from './distanceFormat.js';

test('formatDistance: shows centimetres for sub-10m distances', () => {
  // 2.45 m → 245 cm
  const r1 = formatDistance(2.45);
  assert.equal(r1.value, '245 cm');
  assert.equal(r1.unit, 'cm');

  // 0.5 m → 50 cm
  const r2 = formatDistance(0.5);
  assert.equal(r2.value, '50 cm');
  assert.equal(r2.unit, 'cm');

  // 9.9 m → 990 cm
  const r3 = formatDistance(9.9);
  assert.equal(r3.value, '990 cm');
  assert.equal(r3.unit, 'cm');

  // 0 m → 0 cm
  const r4 = formatDistance(0);
  assert.equal(r4.value, '0 cm');
  assert.equal(r4.unit, 'cm');
});

test('formatDistance: shows metres for 10m–999m', () => {
  // 10 m → 10.0 m (boundary: exactly 10 uses metres)
  const r1 = formatDistance(10);
  assert.equal(r1.value, '10.0 m');
  assert.equal(r1.unit, 'm');

  // 12.4 m → 12.4 m
  const r2 = formatDistance(12.4);
  assert.equal(r2.value, '12.4 m');
  assert.equal(r2.unit, 'm');

  // 999 m → 999.0 m
  const r3 = formatDistance(999);
  assert.equal(r3.value, '999.0 m');
  assert.equal(r3.unit, 'm');
});

test('formatDistance: shows kilometres for >= 1000m', () => {
  // 1000 m → 1.00 km (boundary: exactly 1000 uses km)
  const r1 = formatDistance(1000);
  assert.equal(r1.value, '1.00 km');
  assert.equal(r1.unit, 'km');

  // 5 km → 5.00 km
  const r2 = formatDistance(5000);
  assert.equal(r2.value, '5.00 km');
  assert.equal(r2.unit, 'km');

  // 12.34 km → 12.34 km
  const r3 = formatDistance(12340);
  assert.equal(r3.value, '12.34 km');
  assert.equal(r3.unit, 'km');
});

test('formatDistance: handles negative/invalid input gracefully', () => {
  const r1 = formatDistance(-5);
  assert.equal(r1.value, '0 cm');

  const r2 = formatDistance(NaN);
  assert.equal(r2.value, '0 cm');
});
