export function buildClerkSignInParams(identifier, password) {
  const normalizedIdentifier = typeof identifier === 'string' ? identifier.trim() : '';
  if (!normalizedIdentifier || typeof password !== 'string' || password.length === 0) return null;

  return { identifier: normalizedIdentifier, password };
}
