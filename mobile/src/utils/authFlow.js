import { buildClerkSignInParams } from './signInIdentifier.js';

export const SIGN_IN_STATES = {
  IDLE: 'idle',
  SIGNING_IN: 'signing_in',
  AWAITING_VERIFICATION: 'awaiting_verification',
  SIGNED_IN: 'signed_in',
  RECOVERABLE_ERROR: 'recoverable_error',
};

/**
 * Sanitizes an identifier so it can be safely logged without exposing PII.
 */
export function sanitizeIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    return { type: 'empty', length: 0 };
  }
  const trimmed = identifier.trim();
  const isEmail = trimmed.includes('@');
  return {
    type: isEmail ? 'email' : 'username',
    length: trimmed.length,
  };
}

/**
 * Extracts safe error code, HTTP status, and user-friendly message from Clerk errors or standard errors.
 */
export function parseClerkAuthError(err) {
  if (!err) {
    return {
      code: 'unknown_error',
      status: 0,
      message: 'An unknown error occurred. Please try again.',
    };
  }

  // Check for Clerk API response errors with errors array
  const firstError = Array.isArray(err.errors) && err.errors.length > 0 ? err.errors[0] : null;
  const rawCode = firstError?.code || err.code || '';
  const rawStatus = typeof err.status === 'number' ? err.status : (typeof err.statusCode === 'number' ? err.statusCode : 0);
  const rawMessage = firstError?.longMessage || firstError?.message || err.message || '';

  // Network errors
  const isNetwork =
    err.name === 'TypeError' ||
    (typeof rawMessage === 'string' && (
      rawMessage.toLowerCase().includes('network') ||
      rawMessage.toLowerCase().includes('fetch') ||
      rawMessage.toLowerCase().includes('connection')
    ));

  if (isNetwork) {
    return {
      code: 'network_error',
      status: rawStatus || 0,
      message: 'Network request failed. Please check your internet connection and try again.',
    };
  }

  // Map known Clerk error codes to friendly actionable messages
  switch (rawCode) {
    case 'form_identifier_not_found':
      return {
        code: rawCode,
        status: rawStatus || 422,
        message: 'No account found with this email or username. Please check your credentials or switch to Initialize New Protocol (Sign Up).',
      };
    case 'form_password_incorrect':
      return {
        code: rawCode,
        status: rawStatus || 422,
        message: 'Incorrect security key. Please check your password and try again.',
      };
    case 'form_code_incorrect':
      return {
        code: rawCode,
        status: rawStatus || 422,
        message: 'Incorrect verification code. Please check the code and try again.',
      };
    case 'verification_expired':
    case 'verification_failed':
      return {
        code: rawCode,
        status: rawStatus || 422,
        message: 'The verification code has expired. Please request a new code or sign in again.',
      };
    case 'session_exists':
      return {
        code: rawCode,
        status: rawStatus || 400,
        message: 'A session is already active. Finalizing sign-in...',
      };
    case 'form_param_format_invalid':
      return {
        code: rawCode,
        status: rawStatus || 422,
        message: 'Invalid input format. Please check your credentials and try again.',
      };
    case 'session_activation_failed':
      return {
        code: rawCode,
        status: rawStatus || 500,
        message: 'Unable to activate sign-in session. Please tap Retry to try again.',
      };
    default:
      return {
        code: rawCode || 'auth_error',
        status: rawStatus,
        message: rawMessage || 'Authentication failed. Please try again.',
      };
  }
}

/**
 * Executes the Clerk sign-in flow and invokes lifecycle callbacks at each stage.
 */
export async function executeSignInFlow({
  signIn,
  setActive,
  identifier,
  password,
  onStage = () => {},
}) {
  // Stage 1: Sign-in button pressed
  onStage(1, { action: 'button_pressed' });

  const signInParams = buildClerkSignInParams(identifier, password);
  if (!signInParams) {
    return {
      success: false,
      state: SIGN_IN_STATES.RECOVERABLE_ERROR,
      error: {
        code: 'validation_error',
        status: 400,
        message: 'Enter your email or username and password.',
      },
    };
  }

  // Stage 2: Submission started (safe sanitized info only)
  const sanitized = sanitizeIdentifier(identifier);
  onStage(2, { action: 'submission_started', ...sanitized });

  // Stage 3: Clerk request started
  onStage(3, { action: 'clerk_request_started' });
  let completeSignIn;
  try {
    completeSignIn = await signIn.create(signInParams);
    onStage(3, { action: 'clerk_request_completed' });
  } catch (err) {
    const parsedError = parseClerkAuthError(err);
    // Stage 4: Clerk returned an error
    onStage(4, { action: 'clerk_error', ...parsedError });
    return {
      success: false,
      state: SIGN_IN_STATES.RECOVERABLE_ERROR,
      error: parsedError,
    };
  }

  const status = completeSignIn?.status;
  // Stage 4: Clerk returned a status
  onStage(4, { action: 'clerk_status', status });

  if (status === 'complete') {
    const createdSessionId = completeSignIn.createdSessionId;
    if (!createdSessionId) {
      const error = {
        code: 'session_activation_failed',
        status: 500,
        message: 'Sign-in reported complete but no session identifier was generated.',
      };
      onStage(6, { action: 'session_activation_failed', error });
      return {
        success: false,
        state: SIGN_IN_STATES.RECOVERABLE_ERROR,
        error,
      };
    }

    // Stage 6: Sign-in finalization / session activation
    onStage(6, { action: 'session_activation_started', hasSessionId: true });
    try {
      await setActive({ session: createdSessionId });
      onStage(6, { action: 'session_activation_completed' });
      return {
        success: true,
        state: SIGN_IN_STATES.SIGNED_IN,
        sessionId: createdSessionId,
      };
    } catch (err) {
      const parsedError = parseClerkAuthError(err);
      onStage(6, { action: 'session_activation_error', ...parsedError });
      return {
        success: false,
        state: SIGN_IN_STATES.RECOVERABLE_ERROR,
        error: {
          code: 'session_activation_failed',
          status: parsedError.status || 500,
          message: 'Failed to activate session: ' + parsedError.message,
        },
      };
    }
  }

  if (status === 'needs_first_factor') {
    const factors = completeSignIn.supportedFirstFactors || [];
    const factor = factors[0] || null;
    const strategy = factor?.strategy || 'email_code';
    // Stage 5: Required first-factor verification
    onStage(5, { action: 'first_factor_required', status, strategy });

    if (strategy === 'email_code' && factor?.emailAddressId && typeof completeSignIn.prepareFirstFactor === 'function') {
      try {
        await completeSignIn.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId: factor.emailAddressId,
        });
      } catch (prepErr) {
        onStage(5, { action: 'prepare_factor_error', error: parseClerkAuthError(prepErr) });
      }
    }

    return {
      success: false,
      state: SIGN_IN_STATES.AWAITING_VERIFICATION,
      status,
      factorType: 'first_factor',
      strategy,
      message: strategy === 'phone_code'
        ? 'A verification code was sent to your phone.'
        : 'A verification code was sent to your email.',
    };
  }

  if (status === 'needs_second_factor') {
    const factors = completeSignIn.supportedSecondFactors || [];
    const factor = factors[0] || null;
    const strategy = factor?.strategy || 'totp';
    // Stage 5: Required second-factor verification
    onStage(5, { action: 'second_factor_required', status, strategy });

    if ((strategy === 'phone_code' || strategy === 'email_code') && typeof completeSignIn.prepareSecondFactor === 'function') {
      try {
        await completeSignIn.prepareSecondFactor({ strategy });
      } catch (prepErr) {
        onStage(5, { action: 'prepare_factor_error', error: parseClerkAuthError(prepErr) });
      }
    }

    return {
      success: false,
      state: SIGN_IN_STATES.AWAITING_VERIFICATION,
      status,
      factorType: 'second_factor',
      strategy,
      message: strategy === 'totp'
        ? 'Enter your Two-Factor Authentication (TOTP) code.'
        : strategy === 'backup_code'
        ? 'Enter a backup authentication code.'
        : 'Enter your second-factor authentication code.',
    };
  }

  const unhandledError = {
    code: 'unsupported_sign_in_status',
    status: 400,
    message: `Sign in requires additional setup (${status}). Please log in via the web or contact support.`,
  };
  onStage(4, { action: 'unhandled_status', ...unhandledError });
  return {
    success: false,
    state: SIGN_IN_STATES.RECOVERABLE_ERROR,
    error: unhandledError,
  };
}

/**
 * Executes factor verification code submission and activates session upon completion.
 */
export async function executeVerificationFlow({
  signIn,
  setActive,
  code,
  factorType,
  strategy,
  onStage = () => {},
}) {
  const trimmedCode = typeof code === 'string' ? code.trim() : '';
  if (!trimmedCode) {
    return {
      success: false,
      state: SIGN_IN_STATES.AWAITING_VERIFICATION,
      error: {
        code: 'validation_error',
        status: 400,
        message: 'Please enter the authentication code.',
      },
    };
  }

  // Stage 5: Submitting verification code
  onStage(5, { action: 'verification_submission_started', strategy });
  let verificationResult;
  try {
    if (factorType === 'second_factor') {
      verificationResult = await signIn.attemptSecondFactor({
        strategy: strategy || 'totp',
        code: trimmedCode,
      });
    } else {
      verificationResult = await signIn.attemptFirstFactor({
        strategy: strategy || 'email_code',
        code: trimmedCode,
      });
    }
    onStage(5, { action: 'verification_submission_completed' });
  } catch (err) {
    const parsedError = parseClerkAuthError(err);
    onStage(5, { action: 'verification_error', ...parsedError });
    return {
      success: false,
      state: SIGN_IN_STATES.AWAITING_VERIFICATION,
      error: parsedError,
    };
  }

  const status = verificationResult?.status;
  onStage(4, { action: 'verification_status', status });

  if (status === 'complete') {
    const createdSessionId = verificationResult.createdSessionId;
    if (!createdSessionId) {
      const error = {
        code: 'session_activation_failed',
        status: 500,
        message: 'Verification succeeded but no session ID was returned.',
      };
      onStage(6, { action: 'session_activation_failed', error });
      return {
        success: false,
        state: SIGN_IN_STATES.RECOVERABLE_ERROR,
        error,
      };
    }

    onStage(6, { action: 'session_activation_started', hasSessionId: true });
    try {
      await setActive({ session: createdSessionId });
      onStage(6, { action: 'session_activation_completed' });
      return {
        success: true,
        state: SIGN_IN_STATES.SIGNED_IN,
        sessionId: createdSessionId,
      };
    } catch (err) {
      const parsedError = parseClerkAuthError(err);
      onStage(6, { action: 'session_activation_error', ...parsedError });
      return {
        success: false,
        state: SIGN_IN_STATES.RECOVERABLE_ERROR,
        error: {
          code: 'session_activation_failed',
          status: parsedError.status || 500,
          message: 'Failed to activate session: ' + parsedError.message,
        },
      };
    }
  }

  return {
    success: false,
    state: SIGN_IN_STATES.AWAITING_VERIFICATION,
    status,
    error: {
      code: 'verification_incomplete',
      status: 400,
      message: `Verification incomplete (status: ${status}). Please try again.`,
    },
  };
}
