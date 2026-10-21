export function createClientActivityId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

export function currentTimestamp() {
  return Date.now();
}
