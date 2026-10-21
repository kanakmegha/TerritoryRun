import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClerkSignInParams } from '../../mobile/src/utils/signInIdentifier.js';

test('email input is trimmed and passed through Clerk’s generic identifier field', () => {
  assert.deepEqual(buildClerkSignInParams('  runner@example.com  ', 'example-password'), {
    identifier: 'runner@example.com',
    password: 'example-password',
  });
});

test('username input is trimmed and passed through the same Clerk identifier field', () => {
  assert.deepEqual(buildClerkSignInParams('  runner_42  ', 'example-password'), {
    identifier: 'runner_42',
    password: 'example-password',
  });
});

test('empty identifier or password is rejected before calling Clerk', () => {
  assert.equal(buildClerkSignInParams('   ', 'example-password'), null);
  assert.equal(buildClerkSignInParams('runner@example.com', ''), null);
  assert.equal(buildClerkSignInParams(null, 'example-password'), null);
});
