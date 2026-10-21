import { locationFailureMessage } from './gpsTracking.js';
import { createClientActivityId, currentTimestamp } from './activityId.js';

export function createActivityRunStarter({
  getCurrentRun,
  getOwnerId,
  ensureLocation,
  stopLocation,
  storage,
  api,
  activityDrafts,
  onRunCreated,
  addAlert = () => {},
  createActivityId = createClientActivityId,
  now = currentTimestamp,
}) {
  let inFlight = null;

  async function performStart(mode, selectedRoute, isTest = false) {
    const run = getCurrentRun();
    if (run?.isActive) return { ok: true, resume: true };
    if (['pending', 'uploading'].includes(run?.submissionStatus)) {
      const message = 'Upload the saved activity before starting another run.';
      addAlert(message);
      return { ok: false, code: 'upload_pending', message };
    }
    if (mode !== 'claim') {
      const message = 'Conquest claims are the only supported activity mode right now.';
      addAlert(message);
      return { ok: false, code: 'unsupported_mode', message };
    }

    const ownerId = String(getOwnerId() || '');
    if (!ownerId) {
      const message = 'Your profile is still loading. Try again in a moment.';
      addAlert(message);
      return { ok: false, code: 'profile_not_ready', message };
    }

    const gps = await ensureLocation();
    if (!gps?.ok || !gps.position) {
      const code = gps?.code || 'location_unavailable';
      const message = locationFailureMessage(code);
      addAlert(message);
      return { ok: false, code, message };
    }

    const pendingStartKey = `pendingActivityStart:${ownerId}`;
    let clientActivityId;
    try {
      clientActivityId = await storage.getItem(pendingStartKey);
      if (!clientActivityId) {
        clientActivityId = createActivityId();
        await storage.setItem(pendingStartKey, clientActivityId);
      }

      const response = await api.post('/api/game/activities', { clientActivityId, isTest });
      const activityId = response.data?.activity?.id;
      if (typeof activityId !== 'string' || !/^[a-f\d]{24}$/i.test(activityId)) {
        throw new Error('invalid_activity_response');
      }

      const { lat, lng, timestamp, accuracy } = gps.position;
      const initialSample = { lat, lng, timestamp, accuracy };
      const nextRun = {
        isActive: true,
        activityId,
        clientActivityId,
        path: [[lat, lng]],
        samples: [initialSample],
        distance: 0,
        pace: 0,
        lastUpdateTime: now(),
        submissionStatus: 'recording',
        selectedRoute: selectedRoute ? {
          id: selectedRoute.id,
          name: selectedRoute.name,
          source: selectedRoute.source,
          verified: selectedRoute.verified === true,
          distance: selectedRoute.distance,
          polyline: selectedRoute.polyline || null,
          coordinates: Array.isArray(selectedRoute.coordinates)
            ? selectedRoute.coordinates.map(({ latitude, longitude }) => ({ latitude, longitude }))
            : [],
        } : null,
      };

      await activityDrafts.save(ownerId, activityId, nextRun);
      await storage.removeItem(pendingStartKey);
      onRunCreated(nextRun, mode, initialSample);
      addAlert(`${mode.toUpperCase()} MODE ACTIVE${isTest ? ' (indoor test)' : ''}`);
      return { ok: true, run: nextRun };
    } catch (error) {
      if (typeof stopLocation === 'function') {
        try {
          await stopLocation();
        } catch {
          // ignore cleanup errors on failure
        }
      }

      const status = error?.response?.status;
      const serverCode = error?.response?.data?.code;
      const serverMessage = error?.response?.data?.message;
      let message;
      let code = 'run_start_failed';

      if (status === 404) {
        code = 'server_endpoint_not_found';
        message = serverMessage && !serverMessage.toLowerCase().includes('cannot')
          ? `${serverMessage} (HTTP 404)`
          : 'The game server activity service is not available (HTTP 404). Please ensure the latest backend server is running.';
      } else if (status === 401) {
        code = 'unauthorized';
        message = 'Your session has expired or is unauthorized. Please sign in again.';
      } else if (status === 400 || status === 422) {
        code = serverCode || 'invalid_request';
        message = serverMessage || 'Unable to prepare conquest due to an invalid request.';
      } else if (status >= 500) {
        code = 'server_error';
        message = serverMessage || `Game server error (HTTP ${status}). Please try again in a moment.`;
      } else if (
        error?.name === 'TypeError' ||
        error?.code === 'ECONNABORTED' ||
        (typeof error?.message === 'string' && (
          error.message.includes('Network') ||
          error.message.includes('fetch') ||
          error.message.includes('timeout')
        )) ||
        !error?.response
      ) {
        code = 'network_error';
        message = 'Cannot connect to the game server. Check your network connection and retry.';
      } else {
        message = serverMessage || error?.message || 'Could not prepare the run. Please retry.';
      }

      addAlert(message);
      return { ok: false, code, message };
    }
  }

  return function start(mode = 'claim', selectedRoute = null, isTest = false) {
    if (inFlight) return inFlight;
    let pending;
    pending = performStart(mode, selectedRoute, isTest).finally(() => {
      if (inFlight === pending) inFlight = null;
    });
    inFlight = pending;
    return pending;
  };
}
