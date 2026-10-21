const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

// Safe diagnostic flag — never logs tokens or secrets, only GPS sample metadata.
// eslint-disable-next-line no-undef
const LOG_GPS = typeof __DEV__ !== 'undefined' && __DEV__;

function normalizePosition(position) {
  const latitude = position?.coords?.latitude;
  const longitude = position?.coords?.longitude;
  const accuracy = position?.coords?.accuracy;
  const timestamp = position?.timestamp;
  if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90 ||
      !isFiniteNumber(longitude) || longitude < -180 || longitude > 180 ||
      (latitude === 0 && longitude === 0) || !isFiniteNumber(accuracy) || accuracy <= 0 || accuracy > 30 ||
      !isFiniteNumber(timestamp) || timestamp <= 0) return null;
  return { lat: latitude, lng: longitude, accuracy, timestamp };
}

export function createGpsTrackingController({ location, onPosition, onStatus = () => {} }) {
  let subscription = null;
  let latestPosition = null;
  let startPromise = null;
  let generation = 0;

  const acceptPosition = (rawPosition, expectedGeneration = generation) => {
    if (expectedGeneration !== generation) return;
    const position = normalizePosition(rawPosition);
    if (!position) return;
    latestPosition = position;
    if (LOG_GPS) {
      console.log('[GPS Watcher] sample', {
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        timestamp: position.timestamp,
      });
    }
    onPosition(position);
  };

  return {
    start() {
      if (subscription && latestPosition) return Promise.resolve({ ok: true, position: latestPosition });
      if (startPromise) return startPromise;
      const startGeneration = generation;

      const pendingStart = (async () => {
        onStatus('requesting');
        try {
          if (location.hasServicesEnabledAsync && !(await location.hasServicesEnabledAsync())) {
            onStatus('error');
            return { ok: false, code: 'location_services_disabled' };
          }
          if (startGeneration !== generation) return { ok: false, code: 'location_unavailable' };
          const permission = await location.requestForegroundPermissionsAsync();
          if (startGeneration !== generation) return { ok: false, code: 'location_unavailable' };
          if (permission.status !== 'granted') {
            onStatus('error');
            return { ok: false, code: 'permission_denied' };
          }

          onStatus('locating');
          const initial = await location.getCurrentPositionAsync({ accuracy: location.Accuracy.BestForNavigation });
          if (startGeneration !== generation) return { ok: false, code: 'location_unavailable' };
          const position = normalizePosition(initial);
          if (!position) {
            onStatus('error');
            return { ok: false, code: 'location_unavailable' };
          }
          acceptPosition(initial, startGeneration);

          const createdSubscription = await location.watchPositionAsync(
            { accuracy: location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
            (position) => acceptPosition(position, startGeneration),
          );
          if (startGeneration !== generation) {
            await createdSubscription.remove();
            return { ok: false, code: 'location_unavailable' };
          }
          subscription = createdSubscription;
          onStatus('locked');
          return { ok: true, position };
        } catch {
          onStatus('error');
          return { ok: false, code: 'location_unavailable' };
        }
      })();
      let wrappedStart;
      wrappedStart = pendingStart.finally(() => {
        if (startPromise === wrappedStart) startPromise = null;
      });
      startPromise = wrappedStart;
      return wrappedStart;
    },

    async stop() {
      generation += 1;
      const active = subscription;
      subscription = null;
      latestPosition = null;
      if (active) await active.remove();
      onStatus('idle');
    },

    get isTracking() {
      return Boolean(subscription);
    },
  };
}

export function locationFailureMessage(code) {
  if (code === 'permission_denied') return 'Allow location access in Settings, then try starting again.';
  if (code === 'location_services_disabled') return 'Turn on Location Services, then try starting again.';
  if (code === 'location_unavailable') return 'A usable GPS fix is not available yet. Move outdoors and try again.';
  return 'Could not start the run. Check your connection and try again.';
}
