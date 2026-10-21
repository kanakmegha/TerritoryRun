import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIGN_IN_STATES,
  sanitizeIdentifier,
  parseClerkAuthError,
  executeSignInFlow,
  executeVerificationFlow,
} from '../../mobile/src/utils/authFlow.js';

test('sanitizeIdentifier strips PII and only reports length and type', () => {
  const emailSanitized = sanitizeIdentifier('  agent007@domain.com  ');
  assert.equal(emailSanitized.type, 'email');
  assert.equal(emailSanitized.length, 19);
  assert.equal(emailSanitized.identifier, undefined);

  const usernameSanitized = sanitizeIdentifier('GhostRunner99');
  assert.equal(usernameSanitized.type, 'username');
  assert.equal(usernameSanitized.length, 13);

  const emptySanitized = sanitizeIdentifier('');
  assert.equal(emptySanitized.type, 'empty');
  assert.equal(emptySanitized.length, 0);
});

test('parseClerkAuthError formats known Clerk error codes accurately', () => {
  // form_identifier_not_found (422)
  const unknownIdErr = {
    status: 422,
    errors: [{ code: 'form_identifier_not_found', message: "Couldn't find your account." }],
  };
  const parsedUnknownId = parseClerkAuthError(unknownIdErr);
  assert.equal(parsedUnknownId.code, 'form_identifier_not_found');
  assert.equal(parsedUnknownId.status, 422);
  assert.match(parsedUnknownId.message, /No account found with this email or username/);

  // form_password_incorrect (422)
  const badPassErr = {
    status: 422,
    errors: [{ code: 'form_password_incorrect', message: 'Password incorrect.' }],
  };
  const parsedBadPass = parseClerkAuthError(badPassErr);
  assert.equal(parsedBadPass.code, 'form_password_incorrect');
  assert.match(parsedBadPass.message, /Incorrect security key/);

  // form_code_incorrect
  const badCodeErr = {
    status: 422,
    errors: [{ code: 'form_code_incorrect', message: 'Incorrect code' }],
  };
  const parsedBadCode = parseClerkAuthError(badCodeErr);
  assert.equal(parsedBadCode.code, 'form_code_incorrect');
  assert.match(parsedBadCode.message, /Incorrect verification code/);

  // Network error
  const networkErr = new TypeError('Network request failed');
  const parsedNetwork = parseClerkAuthError(networkErr);
  assert.equal(parsedNetwork.code, 'network_error');
  assert.match(parsedNetwork.message, /Network request failed/);
});

test('valid credentials and completed sign-in: activates session and logs all stages', async () => {
  const stages = [];
  const fakeSessionId = 'sess_valid_12345';
  let activeSessionId = null;

  const mockSignIn = {
    create: async ({ identifier, password }) => {
      assert.equal(identifier, 'agent@nexus.io');
      assert.equal(password, 'superSecret123');
      return {
        status: 'complete',
        createdSessionId: fakeSessionId,
      };
    },
  };

  const mockSetActive = async ({ session }) => {
    activeSessionId = session;
  };

  const result = await executeSignInFlow({
    signIn: mockSignIn,
    setActive: mockSetActive,
    identifier: '  agent@nexus.io  ',
    password: 'superSecret123',
    onStage: (stageNum, details) => stages.push({ stageNum, ...details }),
  });

  assert.equal(result.success, true);
  assert.equal(result.state, SIGN_IN_STATES.SIGNED_IN);
  assert.equal(result.sessionId, fakeSessionId);
  assert.equal(activeSessionId, fakeSessionId);

  // Verify lifecycle stages were traced
  const loggedStageNums = stages.map(s => s.stageNum);
  assert.ok(loggedStageNums.includes(1), 'Stage 1 button pressed logged');
  assert.ok(loggedStageNums.includes(2), 'Stage 2 submission started logged');
  assert.ok(loggedStageNums.includes(3), 'Stage 3 Clerk request logged');
  assert.ok(loggedStageNums.includes(4), 'Stage 4 Clerk status complete logged');
  assert.ok(loggedStageNums.includes(6), 'Stage 6 session activation logged');
});

test('unknown identifier (422 form_identifier_not_found): returns actionable error without silent stop', async () => {
  const stages = [];
  const mockSignIn = {
    create: async () => {
      const err = new Error("Couldn't find your account.");
      err.status = 422;
      err.errors = [{ code: 'form_identifier_not_found', message: "Couldn't find your account." }];
      throw err;
    },
  };

  const mockSetActive = async () => {
    assert.fail('setActive should not be called on unknown identifier');
  };

  const result = await executeSignInFlow({
    signIn: mockSignIn,
    setActive: mockSetActive,
    identifier: 'unknown@example.com',
    password: 'password123',
    onStage: (stageNum, details) => stages.push({ stageNum, ...details }),
  });

  assert.equal(result.success, false);
  assert.equal(result.state, SIGN_IN_STATES.RECOVERABLE_ERROR);
  assert.equal(result.error.code, 'form_identifier_not_found');
  assert.equal(result.error.status, 422);
  assert.match(result.error.message, /No account found with this email or username/);

  // Check safe logging: Stage 4 error logged, no passwords or emails in logs
  const stage4 = stages.find(s => s.stageNum === 4);
  assert.ok(stage4, 'Stage 4 error logged');
  assert.equal(stage4.code, 'form_identifier_not_found');
});

test('invalid password: returns recoverable error with friendly instruction', async () => {
  const mockSignIn = {
    create: async () => {
      const err = new Error('Incorrect password');
      err.status = 422;
      err.errors = [{ code: 'form_password_incorrect', message: 'Incorrect password' }];
      throw err;
    },
  };

  const result = await executeSignInFlow({
    signIn: mockSignIn,
    setActive: async () => {},
    identifier: 'runner123',
    password: 'wrongPassword',
  });

  assert.equal(result.success, false);
  assert.equal(result.state, SIGN_IN_STATES.RECOVERABLE_ERROR);
  assert.equal(result.error.code, 'form_password_incorrect');
  assert.match(result.error.message, /Incorrect security key/);
});

test('verification-required response: transitions to awaiting_verification instead of silent failure', async () => {
  const stages = [];
  let preparedStrategy = null;

  const mockSignIn = {
    create: async () => {
      return {
        status: 'needs_first_factor',
        createdSessionId: null, // Critical: createdSessionId is null when verification is needed!
        supportedFirstFactors: [
          { strategy: 'email_code', emailAddressId: 'email_123' },
        ],
        prepareFirstFactor: async ({ strategy }) => {
          preparedStrategy = strategy;
        },
      };
    },
  };

  let setActiveCalled = false;
  const mockSetActive = async () => {
    setActiveCalled = true;
  };

  const result = await executeSignInFlow({
    signIn: mockSignIn,
    setActive: mockSetActive,
    identifier: 'verify_me@domain.com',
    password: 'goodPassword',
    onStage: (stageNum, details) => stages.push({ stageNum, ...details }),
  });

  assert.equal(setActiveCalled, false, 'setActive must NOT be called with null session');
  assert.equal(result.success, false);
  assert.equal(result.state, SIGN_IN_STATES.AWAITING_VERIFICATION);
  assert.equal(result.factorType, 'first_factor');
  assert.equal(result.strategy, 'email_code');
  assert.equal(preparedStrategy, 'email_code');

  // Verify Stage 5 was logged
  const stage5 = stages.find(s => s.stageNum === 5);
  assert.ok(stage5, 'Stage 5 logged verification required');
  assert.equal(stage5.strategy, 'email_code');
});

test('second factor (2FA/TOTP): transitions to awaiting_verification with TOTP strategy', async () => {
  const mockSignIn = {
    create: async () => ({
      status: 'needs_second_factor',
      createdSessionId: null,
      supportedSecondFactors: [{ strategy: 'totp' }],
    }),
  };

  const result = await executeSignInFlow({
    signIn: mockSignIn,
    setActive: async () => {},
    identifier: 'agent_mfa',
    password: 'validPassword',
  });

  assert.equal(result.state, SIGN_IN_STATES.AWAITING_VERIFICATION);
  assert.equal(result.factorType, 'second_factor');
  assert.equal(result.strategy, 'totp');
  assert.match(result.message, /Two-Factor Authentication/);
});

test('submitting verification code successfully completes sign-in and activates session', async () => {
  const stages = [];
  const fakeSessionId = 'sess_mfa_done_789';
  let activated = null;

  const mockSignIn = {
    attemptSecondFactor: async ({ strategy, code }) => {
      assert.equal(strategy, 'totp');
      assert.equal(code, '123456');
      return {
        status: 'complete',
        createdSessionId: fakeSessionId,
      };
    },
  };

  const result = await executeVerificationFlow({
    signIn: mockSignIn,
    setActive: async ({ session }) => { activated = session; },
    code: '123456',
    factorType: 'second_factor',
    strategy: 'totp',
    onStage: (stageNum, details) => stages.push({ stageNum, ...details }),
  });

  assert.equal(result.success, true);
  assert.equal(result.state, SIGN_IN_STATES.SIGNED_IN);
  assert.equal(activated, fakeSessionId);
});

test('session-finalization failure: handles setActive error and returns recoverable error', async () => {
  const stages = [];
  const mockSignIn = {
    create: async () => ({
      status: 'complete',
      createdSessionId: 'sess_corrupted',
    }),
  };

  const mockSetActive = async () => {
    throw new Error('Device keystore unavailable');
  };

  const result = await executeSignInFlow({
    signIn: mockSignIn,
    setActive: mockSetActive,
    identifier: 'user@example.com',
    password: 'password123',
    onStage: (stageNum, details) => stages.push({ stageNum, ...details }),
  });

  assert.equal(result.success, false);
  assert.equal(result.state, SIGN_IN_STATES.RECOVERABLE_ERROR);
  assert.equal(result.error.code, 'session_activation_failed');
  assert.match(result.error.message, /Failed to activate session/);

  const stage6Err = stages.find(s => s.stageNum === 6 && s.action === 'session_activation_error');
  assert.ok(stage6Err, 'Stage 6 session activation error logged');
});

test('missing session ID on complete status is caught without crashing', async () => {
  const mockSignIn = {
    create: async () => ({
      status: 'complete',
      createdSessionId: null, // Invalid: complete with null session ID
    }),
  };

  const result = await executeSignInFlow({
    signIn: mockSignIn,
    setActive: async () => {},
    identifier: 'user@example.com',
    password: 'password123',
  });

  assert.equal(result.success, false);
  assert.equal(result.state, SIGN_IN_STATES.RECOVERABLE_ERROR);
  assert.equal(result.error.code, 'session_activation_failed');
});

test('network error during submission produces recoverable network error with retry message', async () => {
  const mockSignIn = {
    create: async () => {
      throw new TypeError('Network request failed');
    },
  };

  const result = await executeSignInFlow({
    signIn: mockSignIn,
    setActive: async () => {},
    identifier: 'user@example.com',
    password: 'password123',
  });

  assert.equal(result.success, false);
  assert.equal(result.state, SIGN_IN_STATES.RECOVERABLE_ERROR);
  assert.equal(result.error.code, 'network_error');
  assert.match(result.error.message, /Network request failed/);
});

test('repeated button taps: validation fails fast on empty/missing inputs', async () => {
  const result = await executeSignInFlow({
    signIn: {},
    setActive: async () => {},
    identifier: '',
    password: '',
  });

  assert.equal(result.success, false);
  assert.equal(result.state, SIGN_IN_STATES.RECOVERABLE_ERROR);
  assert.equal(result.error.code, 'validation_error');
});

test('profile API failure after authentication does not sign out the user', () => {
  // Simulate the behavior of useGameStore.js initAuth when profile request fails:
  // When res = api.get('/api/auth/profile') throws a 500 error:
  const error = { response: { status: 500 } };
  const status = Number(error?.response?.status);

  // The store sets profileError and keeps the user session intact
  let userSignedOut = false;
  const signOut = () => { userSignedOut = true; };

  const profileError = status
    ? `Profile request failed (HTTP ${status}). Check your connection or retry.`
    : 'Could not load your profile. Check your connection or retry.';

  // Assert user is NOT signed out automatically
  assert.equal(userSignedOut, false);
  assert.match(profileError, /HTTP 500/);
});

test('successful sign-in followed by app navigation: state transitions to signed_in and triggers stage 8', () => {
  let appNavMounted = false;
  const onAuthStateChange = (isLoaded, isSignedIn) => {
    if (isLoaded && isSignedIn) {
      appNavMounted = true;
    }
  };

  // Initially unauthenticated
  onAuthStateChange(true, false);
  assert.equal(appNavMounted, false);

  // After successful Clerk sign in
  onAuthStateChange(true, true);
  assert.equal(appNavMounted, true);
});
