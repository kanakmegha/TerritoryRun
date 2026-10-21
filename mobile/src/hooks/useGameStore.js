import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { calculateDistance } from '../utils/geometry';
import { currentTimestamp } from '../utils/activityId';
import { createActivityDraftStore } from '../utils/activityDraftStore';
import { createGpsTrackingController } from '../utils/gpsTracking';
import { createActivityRunStarter } from '../utils/activityRunStarter';
import { processGPSUpdate as processGPSUpdatePure } from '../utils/gpsFilter';
import { useAuth, useSession } from '@clerk/clerk-expo';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

const GameContext = createContext();
const activityDrafts = createActivityDraftStore(AsyncStorage);
const EMPTY_RUN = { isActive: false, path: [], samples: [], distance: 0, pace: 0, lastUpdateTime: 0 };

// --- Simulated location helpers (module-level, development-only indoor testing) ---
const SIMULATED_METERS_PER_LAT_DEGREE = 111320;
const simulatedMetersToLatOffset = (meters) => meters / SIMULATED_METERS_PER_LAT_DEGREE;
const simulatedMetersToLngOffset = (meters, lat) => meters / (SIMULATED_METERS_PER_LAT_DEGREE * Math.cos((lat * Math.PI) / 180));

const generateSimulatedLoopPositions = (origin, totalDistanceMeters, samplesPerSide = 8) => {
  const side = totalDistanceMeters / 4;
  const latOffset = simulatedMetersToLatOffset(side);
  const lngOffset = simulatedMetersToLngOffset(side, origin.lat);
  const positions = [];
  let lat = origin.lat;
  let lng = origin.lng;
  // North
  for (let i = 0; i <= samplesPerSide; i += 1) {
    positions.push({ lat: lat + (latOffset * i) / samplesPerSide, lng, accuracy: 5 });
  }
  // East
  for (let i = 1; i <= samplesPerSide; i += 1) {
    positions.push({ lat: lat + latOffset, lng: lng + (lngOffset * i) / samplesPerSide, accuracy: 5 });
  }
  // South
  for (let i = 1; i <= samplesPerSide; i += 1) {
    positions.push({ lat: lat + latOffset - (latOffset * i) / samplesPerSide, lng: lng + lngOffset, accuracy: 5 });
  }
  // West (back to origin)
  for (let i = 1; i <= samplesPerSide; i += 1) {
    positions.push({ lat, lng: lng + lngOffset - (lngOffset * i) / samplesPerSide, accuracy: 5 });
  }
  return positions;
};

export const GameProvider = ({ children }) => {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const { session } = useSession();
  const [isReady, setIsReady] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileRetryKey, setProfileRetryKey] = useState(0);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const [territories, setTerritories] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activeGameMode, setActiveGameMode] = useState(null);
  const attackTarget = null;

  const [targetDistance, setTargetDistance] = useState(5);
  const [suggestedRoutes, setSuggestedRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  // --- Development-only indoor test mode ---
  // Disabled by default. Only meaningful in non-production builds; the server
  // independently enforces that test mode cannot be activated in production.
  const [indoorTestMode, setIndoorTestMode] = useState(false);
  const [testDistanceMeters, setTestDistanceMeters] = useState(20);
  const [simulatedLocation, setSimulatedLocation] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const indoorTestModeRef = useRef(false);
  const simulatedLocationRef = useRef(false);
  const testDistanceRef = useRef(20);
  const simulatedOriginRef = useRef(null);
  const simulatedSampleIndexRef = useRef(0);
  const simulatedTimerRef = useRef(null);
  const simulatedPositionsRef = useRef([]);

  const [currentRun, setCurrentRun] = useState(EMPTY_RUN);
  const currentRunRef = useRef(currentRun);
  const ownerIdRef = useRef(null);
  const authIdentityRef = useRef(null);
  const lastSampleRef = useRef(null);
  const retryAttemptedRef = useRef(null);
  const profileAttemptsRef = useRef(0);
  const MAX_PROFILE_ATTEMPTS = 3;
  const lastProcessedRetryKeyRef = useRef(-1);
  const sampleLimitAlertRef = useRef(false);
  const draftSaveErrorRef = useRef(false);
  const lastPositionRef = useRef(null);
  const processGPSUpdateRef = useRef(null);
  const gpsControllerRef = useRef(null);
  const runStarterRef = useRef(null);
  const [lastPosition, setLastPosition] = useState(null);
  const [isLoopClosable, setIsLoopClosable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [gpsStatus, setGpsStatus] = useState('idle');
  const [isCameraLocked, setCameraLocked] = useState(true);

  // Dedicated refs for clean separation of concerns:
  // - cumulativeDistanceRef: strictly monotonic, never decreases during a run
  // - acceptedRouteRef: route points used for map visualization (separate from raw samples)
  const cumulativeDistanceRef = useRef(0);
  // Movement buffer for GPS jitter filtering:
  // Small movements within GPS accuracy are buffered. They are only committed
  // to cumulative distance when direction is consistent over multiple samples
  // (stationary jitter changes direction randomly; real walking is consistent).
  const movementBufferRef = useRef(0);
  const movementDirectionRef = useRef(null);
  const movementConfidenceRef = useRef(0);

  // --- Indoor test mode persistence and toggles ---
  const loadIndoorTestSettings = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('indoorTestSettings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.indoorTestMode === 'boolean') setIndoorTestMode(parsed.indoorTestMode);
        if (typeof parsed.testDistanceMeters === 'number') setTestDistanceMeters(parsed.testDistanceMeters);
        if (typeof parsed.simulatedLocation === 'boolean') setSimulatedLocation(parsed.simulatedLocation);
      }
    } catch { /* intentionally ignore storage read errors */ }
    indoorTestModeRef.current = indoorTestMode;
    simulatedLocationRef.current = simulatedLocation;
    testDistanceRef.current = testDistanceMeters;
  }, [indoorTestMode, simulatedLocation, testDistanceMeters, setIndoorTestMode, setSimulatedLocation]);

  const saveIndoorTestSettings = useCallback(async () => {
    try {
      await AsyncStorage.setItem('indoorTestSettings', JSON.stringify({
        indoorTestMode,
        testDistanceMeters,
        simulatedLocation,
      }));
    } catch { /* intentionally ignore storage write errors */ }
    indoorTestModeRef.current = indoorTestMode;
    simulatedLocationRef.current = simulatedLocation;
    testDistanceRef.current = testDistanceMeters;
  }, [indoorTestMode, testDistanceMeters, simulatedLocation]);

  const toggleIndoorTestMode = useCallback(async (enabled) => {
    setIndoorTestMode(enabled);
    await saveIndoorTestSettings();
    if (enabled) {
      addAlert('🏠 INDOOR TEST MODE ACTIVE — test distance: ' + testDistanceMeters + ' m');
    } else {
      addAlert('Indoor test mode disabled.');
    }
  }, [testDistanceMeters, addAlert, saveIndoorTestSettings]);

  const setTestDistance = useCallback(async (meters) => {
    const clamped = Math.min(100, Math.max(5, Math.floor(meters)));
    setTestDistanceMeters(clamped);
    await saveIndoorTestSettings();
  }, [saveIndoorTestSettings]);

  const toggleSimulatedLocation = useCallback(async (enabled) => {
    if (!indoorTestMode) {
      addAlert('Indoor test mode must be enabled first.');
      return;
    }
    setSimulatedLocation(enabled);
    await saveIndoorTestSettings();
    if (enabled && simulatedOriginRef.current) {
      simulatedSampleIndexRef.current = 0;
    }
    addAlert(enabled ? 'Simulated location active (synthetic GPS loop).' : 'Simulated location off.');
  }, [indoorTestMode, addAlert, saveIndoorTestSettings]);

  const startSimulatedLocation = useCallback((origin) => {
    if (simulatedTimerRef.current) return;
    simulatedOriginRef.current = origin;
    simulatedPositionsRef.current = generateSimulatedLoopPositions(origin, testDistanceRef.current);
    simulatedSampleIndexRef.current = 0;
    const intervalMs = 1000; // one sample per second
    simulatedTimerRef.current = setInterval(() => {
      const pos = simulatedPositionsRef.current[simulatedSampleIndexRef.current];
      if (!pos) {
        stopSimulatedLocation();
        return;
      }
      processGPSUpdateRef.current?.(pos.lat, pos.lng, currentTimestamp(), pos.accuracy);
      simulatedSampleIndexRef.current += 1;
      if (simulatedSampleIndexRef.current >= simulatedPositionsRef.current.length) {
        simulatedSampleIndexRef.current = 0; // loop continuously
      }
    }, intervalMs);
  }, [stopSimulatedLocation]);

  const stopSimulatedLocation = useCallback(() => {
    if (simulatedTimerRef.current) {
      clearInterval(simulatedTimerRef.current);
      simulatedTimerRef.current = null;
    }
    simulatedSampleIndexRef.current = 0;
    simulatedPositionsRef.current = [];
  }, []);

  const refreshMap = useCallback(async () => {
    try {
        const res = await api.get('/api/game/territories');
        setTerritories(res.data.territories || []);
    } catch { /* Preserve the last successful map on transient API errors. */ }
  }, []);

  const refreshLeaderboard = useCallback(async () => {
    try {
        const res = await api.get('/api/game/leaderboard');
        setLeaderboard(res.data.leaderboard || []);
    } catch { /* Preserve the last successful leaderboard on transient API errors. */ }
  }, []);

useEffect(() => {
  let cancelled = false;
  const initAuth = async () => {
    setIsReady(false);
    setProfileError(null);
    if (!isLoaded) return;
    if (!isSignedIn) {
      delete api.defaults.headers.common.Authorization;
      setUser(null);
      setToken(null);
      ownerIdRef.current = null;
      authIdentityRef.current = null;
      currentRunRef.current = EMPTY_RUN;
      cumulativeDistanceRef.current = 0;
      lastSampleRef.current = null;
      lastPositionRef.current = null;
      setCurrentRun(EMPTY_RUN);
      setSelectedRoute(null);
      setActiveGameMode(null);
      await gpsControllerRef.current?.stop();
      setGpsStatus('idle');
      await AsyncStorage.multiRemove(['currentRun', 'lastPosition', 'pendingActivityStart']).catch(() => {});
      setIsReady(true);
      return;
    }

    const identity = session?.userId || null;
    if (identity && authIdentityRef.current && identity !== authIdentityRef.current) {
      ownerIdRef.current = null;
      currentRunRef.current = EMPTY_RUN;
      lastSampleRef.current = null;
      lastPositionRef.current = null;
      setCurrentRun(EMPTY_RUN);
      setSelectedRoute(null);
      setActiveGameMode(null);
    }
    if (identity) authIdentityRef.current = identity;
    delete api.defaults.headers.common.Authorization;
    setToken(null);
    setUser(null);
    ownerIdRef.current = null;

    if (!session || session.status !== 'active') {
      if (!cancelled) {
        setProfileError('Your sign-in session is not active. Retry after Clerk finishes signing in.');
        setIsReady(true);
      }
      return;
    }

    // Reset the attempt counter when the user explicitly retries (profileRetryKey changes).
    if (profileRetryKey !== lastProcessedRetryKeyRef.current) {
      profileAttemptsRef.current = 0;
      lastProcessedRetryKeyRef.current = profileRetryKey;
    }

    // Prevent unbounded automatic retry loops: cap consecutive failed profile loads.
    profileAttemptsRef.current += 1;
    if (profileAttemptsRef.current > MAX_PROFILE_ATTEMPTS) {
      if (!cancelled) {
        setProfileError('Unable to load your profile after multiple attempts. Tap Retry to try again.');
        setIsReady(true);
      }
      return;
    }

    try {
      const clerkToken = await session.getToken();
      if (cancelled) return;
      if (!clerkToken) throw new Error('token_unavailable');
      setToken(clerkToken);
      api.defaults.headers.common.Authorization = `Bearer ${clerkToken}`;
      console.log('[AuthTrace] Stage 9: Profile API request started');
      const res = await api.get('/api/auth/profile');
      const profile = res.data.user || res.data;
      console.log('[AuthTrace] Stage 9: Profile API request completed', { status: res.status });
      console.info('[Profile] GET /api/auth/profile', {
        status: res.status,
        hasUser: Boolean(profile),
        hasDatabaseId: Boolean(profile?._id),
      });
      const ownerId = String(profile._id || '');
      if (!ownerId) throw new Error('Authenticated profile has no database user ID.');
      const recovered = await activityDrafts.loadLatest(ownerId);
      if (cancelled) return;
      const restored = recovered || EMPTY_RUN;
      currentRunRef.current = restored;
      lastSampleRef.current = restored.samples?.[restored.samples.length - 1] || null;
      setCurrentRun(restored);
      setSelectedRoute(restored.selectedRoute || null);
      setActiveGameMode(restored.isActive ? 'claim' : null);
      setUser(profile);
      ownerIdRef.current = ownerId;
      authIdentityRef.current = identity;
      draftSaveErrorRef.current = false;
      profileAttemptsRef.current = 0;
      // The legacy global key has no trustworthy owner metadata and is never migrated.
      await AsyncStorage.multiRemove(['currentRun', 'lastPosition', 'pendingActivityStart']).catch(() => {});
      refreshMap();
      refreshLeaderboard();
      setProfileError(null);
      setIsReady(true);
    } catch (error) {
      if (!cancelled) {
        const status = Number(error?.response?.status);
        console.log('[AuthTrace] Stage 9: Profile API request failed', { status: Number.isInteger(status) ? status : null });
        console.warn('[Profile] GET /api/auth/profile failed', { status: Number.isInteger(status) ? status : null });
        delete api.defaults.headers.common.Authorization;
        setToken(null);
        setUser(null);
        ownerIdRef.current = null;
        setProfileError(status ? `Profile request failed (HTTP ${status}). Check your connection or retry.` : 'Could not load your profile. Check your connection or retry.');
        setIsReady(true);
      }
    }
  };
  initAuth();
  return () => { cancelled = true; };
}, [isLoaded, isSignedIn, session, refreshMap, refreshLeaderboard, profileRetryKey]);

  const logout = async () => {
    setIsReady(false);
    setUser(null);
    setToken(null);
    ownerIdRef.current = null;
    delete api.defaults.headers.common.Authorization;
    currentRunRef.current = EMPTY_RUN;
    cumulativeDistanceRef.current = 0;
    lastSampleRef.current = null;
    lastPositionRef.current = null;
    setCurrentRun(EMPTY_RUN);
    setSelectedRoute(null);
    setActiveGameMode(null);
    await gpsControllerRef.current?.stop();
    setGpsStatus('idle');
    await AsyncStorage.multiRemove(['currentRun', 'lastPosition', 'pendingActivityStart']).catch(() => {});
    await signOut();
  };

  const addAlert = useCallback((message) => {
    setAlerts(prev => [{ id: Date.now(), message, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
  }, []);

  if (!gpsControllerRef.current) {
    gpsControllerRef.current = createGpsTrackingController({
      location: Location,
      onStatus: setGpsStatus,
      onPosition: (position) => {
        lastPositionRef.current = position;
        setLastPosition(position);
        processGPSUpdateRef.current?.(position.lat, position.lng, position.timestamp, position.accuracy);
      },
    });
  }
  const startGpsTracking = useCallback(() => gpsControllerRef.current.start(), []);

  useEffect(() => () => {
    gpsControllerRef.current?.stop();
  }, []);

  const updateRun = async (next) => {
    currentRunRef.current = next;
    setCurrentRun(next);
    if (ownerIdRef.current && next.activityId) await activityDrafts.save(ownerIdRef.current, next.activityId, next);
  };

  useEffect(() => {
    if (!isReady || !user?._id || !currentRun.activityId) return;
    activityDrafts.save(String(user._id), currentRun.activityId, currentRun).then(() => {
      draftSaveErrorRef.current = false;
    }).catch(() => {
      if (!draftSaveErrorRef.current) addAlert('⚠️ Activity draft could not be saved to this device. Keep the app open.');
      draftSaveErrorRef.current = true;
    });
    currentRun.isActive ? activateKeepAwakeAsync() : deactivateKeepAwake();
  }, [currentRun, isReady, user?._id, addAlert]);

  const stopTracking = async () => {
      if (isSubmitting) return false;
      stopSimulatedLocation();
      // Stop GPS watcher immediately — no new points during finalization.
      await gpsControllerRef.current?.stop();
      setGpsStatus('idle');
      setIsSubmitting(true);
      const run = currentRunRef.current;
      const stopped = { ...run, isActive: false, submissionStatus: 'uploading' };
      setActiveGameMode(null);
      try { await updateRun(stopped); }
      catch {
          addAlert('❌ Could not save this activity on this device. Keep the app open and retry ending the run.');
          setIsSubmitting(false);
          return false;
      }
      await retryActivitySubmission();
      return true;
  };

  const retryActivitySubmission = useCallback(async () => {
      const run = currentRunRef.current;
      if (!run.activityId || !Array.isArray(run.samples)) return { status: 'none' };
      if (isSubmitting) return { status: 'pending' };

      // Obtain a fresh Clerk token before every authenticated submission attempt.
      // If the session itself has expired, preserve the pending activity and
      // ask the user to sign in again instead of retrying indefinitely.
      let clerkToken = null;
      try {
          clerkToken = await session.getToken();
          if (!clerkToken) throw new Error('token_unavailable');
          setToken(clerkToken);
          api.defaults.headers.common.Authorization = `Bearer ${clerkToken}`;
      } catch {
          delete api.defaults.headers.common.Authorization;
          setToken(null);
          setProfileError('Your sign-in session has expired. Please sign in again.');
          setIsSubmitting(false);
          return { status: 'pending' };
      }

      const uploading = { ...run, isActive: false, submissionStatus: 'uploading' };
      try { await updateRun(uploading); }
      catch {
          const pending = { ...run, isActive: false, submissionStatus: 'pending' };
          currentRunRef.current = pending;
          setCurrentRun(pending);
          addAlert('⏳ Activity remains on this device; retry when local storage is available.');
          setIsSubmitting(false);
          return { status: 'pending' };
      }

      const submitWithToken = async (token) => {
          api.defaults.headers.common.Authorization = `Bearer ${token}`;
          return api.post(`/api/game/activities/${run.activityId}/submit`, { samples: run.samples, isTest: indoorTestModeRef.current });
      };

      let response;
      try {
          response = await submitWithToken(clerkToken);
      } catch (error) {
          // On 401 (expired token), refresh once and retry with the same activity ID
          // so the idempotency mechanism prevents duplicate submissions.
          if (error?.response?.status === 401) {
              try {
                  clerkToken = await session.getToken();
                  if (!clerkToken) throw new Error('token_unavailable');
                  setToken(clerkToken);
                  response = await submitWithToken(clerkToken);
              } catch {
                  delete api.defaults.headers.common.Authorization;
                  setToken(null);
                  setProfileError('Your sign-in session has expired. Please sign in again.');
                  setIsSubmitting(false);
                  return { status: 'pending' };
              }
          } else {
              // Non-401 errors (including 422 validation failures): do not retry.
              // Log the server's validation response in development for debugging.
              // eslint-disable-next-line no-undef
              if (typeof __DEV__ !== 'undefined' && __DEV__) {
                console.warn('[Submit] submission failed', {
                  status: error?.response?.status,
                  code: error?.response?.data?.code,
                  message: error?.response?.data?.message,
                  body: error?.response?.data,
                });
              }
              const serverCode = error?.response?.data?.code;
              const serverMessage = error?.response?.data?.message || error?.message || 'Submission failed.';
              setIsSubmitting(false);
              // Treat validation rejections as terminal — show the reason, don't retry.
              if (error?.response?.status === 422 || serverCode === 'distance_too_short' ||
                  serverCode === 'loop_not_closed' || serverCode === 'area_too_small' ||
                  serverCode === 'invalid_geometry') {
                  const rejected = { ...uploading, submissionStatus: 'rejected',
                      outcome: { code: serverCode, message: serverMessage }, samples: [], path: [] };
                  await updateRun(rejected);
                  addAlert(`❌ Activity rejected: ${serverMessage}`);
                  return { status: 'rejected', reason: { code: serverCode, message: serverMessage } };
              }
              // For network/transient errors, mark pending so user can retry manually.
              const pending = { ...uploading, submissionStatus: 'pending' };
              await updateRun(pending);
              addAlert(`⏳ ${serverMessage}`);
              return { status: 'pending' };
          }
      }

      const data = response.data;
      if (data.status === 'rejected') {
          const rejected = { ...uploading, submissionStatus: 'rejected', outcome: data.reason, samples: [], path: [] };
          await updateRun(rejected);
          addAlert(`❌ Activity rejected: ${data.reason?.message || 'GPS trace did not meet claim rules.'}`);
          setIsSubmitting(false);
          return { status: 'rejected', reason: data.reason };
      } else if (data.status === 'processed') {
          const validatedDistance = data.metrics?.distance_m ?? uploading.distance;
          const validatedPace = validatedDistance > 0 && data.metrics?.duration_ms
              ? (data.metrics.duration_ms / 60000) / (validatedDistance / 1000) : uploading.pace;
          const processed = { ...uploading, distance: validatedDistance, pace: validatedPace,
              submissionStatus: 'processed', outcome: data.outcome, samples: [], path: [] };
          await updateRun(processed);
          refreshMap();
          refreshLeaderboard();
          addAlert('✅ Territory result saved.');
          setIsSubmitting(false);
          return { status: 'processed', outcome: data.outcome };
      } else {
          const pending = { ...uploading, submissionStatus: 'pending' };
          await updateRun(pending);
          setIsSubmitting(false);
          return { status: 'pending' };
      }
  }, [addAlert, refreshMap, refreshLeaderboard, session, isSubmitting]);

  const processGPSUpdate = (lat, lng, timestamp = currentTimestamp(), accuracy = null) => {
      const run = currentRunRef.current;
      if (!ownerIdRef.current || !run.isActive || !Number.isFinite(lat) || !Number.isFinite(lng) ||
          !Number.isFinite(timestamp) || !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 30) return;
      setGpsAccuracy(accuracy);
      if (run.samples?.length >= 5000) {
          if (!sampleLimitAlertRef.current) addAlert('⚠️ Maximum trace length reached. End this activity to submit it.');
          sampleLimitAlertRef.current = true;
          return;
      }
      const previous = lastSampleRef.current;
      const sample = { lat, lng, timestamp, accuracy };
      const moved = previous ? calculateDistance(previous.lat, previous.lng, lat, lng) : 0;

      // Diagnostic logging — GPS sample metadata only, no secrets or tokens.
      // eslint-disable-next-line no-undef
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        const speedMps = previous && timestamp > previous.timestamp
          ? moved / ((timestamp - previous.timestamp) / 1000)
          : 0;
        console.log('[GPS Update] sample', {
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          accuracy,
          timestamp,
          previous: previous ? {
            lat: Number(previous.lat.toFixed(6)),
            lng: Number(previous.lng.toFixed(6)),
            accuracy: previous.accuracy,
            timestamp: previous.timestamp,
          } : null,
          moved_m: Number(moved.toFixed(3)),
          speed_mps: Number(speedMps.toFixed(3)),
          cumulative_m: Number(cumulativeDistanceRef.current.toFixed(3)),
        });
      }

      if (previous) {
        // Delegate filtering logic to pure function from gpsFilter.js.
        const { distanceIncrement, newState } = processGPSUpdatePure(previous, sample, {
          buffer: movementBufferRef.current,
          direction: movementDirectionRef.current,
          confidence: movementConfidenceRef.current,
        });
        movementBufferRef.current = newState.buffer;
        movementDirectionRef.current = newState.direction;
        movementConfidenceRef.current = newState.confidence;
        cumulativeDistanceRef.current += distanceIncrement;

        // Skip adding filtered-out samples (duplicates/jitter) to the submitted
        // trace. Only samples that contribute to distance are sent to the backend,
        // preventing HTTP 422 duplicate_sample rejection from the server.
        if (distanceIncrement === 0) return;
      }

      const updatedPath = previous ? [...run.path, [lat, lng]] : run.path;
      const updatedSamples = previous ? [...(run.samples || []), sample] : [sample];

      const updated = { ...run,
          path: updatedPath,
          samples: updatedSamples,
          distance: cumulativeDistanceRef.current,
          lastUpdateTime: timestamp };
      currentRunRef.current = updated;
      lastSampleRef.current = sample;
      setCurrentRun(updated);
      if (updated.activityId) {
          activityDrafts.save(String(ownerIdRef.current), updated.activityId, updated).catch(() => {
              if (!draftSaveErrorRef.current) addAlert('⚠️ Activity draft could not be saved to this device. Keep the app open.');
              draftSaveErrorRef.current = true;
          });
      }
  };

  processGPSUpdateRef.current = processGPSUpdate;

  if (!runStarterRef.current) {
    runStarterRef.current = createActivityRunStarter({
      getCurrentRun: () => currentRunRef.current,
      getOwnerId: () => ownerIdRef.current,
      ensureLocation: () => gpsControllerRef.current.start(),
      stopLocation: () => gpsControllerRef.current.stop(),
      storage: AsyncStorage,
      api,
      activityDrafts,
      addAlert,
      onRunCreated: (run, mode, initialSample) => {
        currentRunRef.current = run;
        lastSampleRef.current = initialSample;
        cumulativeDistanceRef.current = 0;
        movementBufferRef.current = 0;
        movementDirectionRef.current = null;
        movementConfidenceRef.current = 0;
        sampleLimitAlertRef.current = false;
        setCurrentRun(run);
        setSelectedRoute(run.selectedRoute);
        setActiveGameMode(mode);
        if (simulatedLocationRef.current && initialSample) {
          startSimulatedLocation(initialSample);
        }
      },
    });
  }
  const startTracking = useCallback((mode, selectedRoute) => runStarterRef.current(mode, selectedRoute, indoorTestModeRef.current), []);
  const startContinuousRun = useCallback(() => startTracking('claim', selectedRoute), [startTracking, selectedRoute]);
  const stopContinuousRun = stopTracking;

  useEffect(() => {
    if (!isReady || currentRun.submissionStatus !== 'pending' || retryAttemptedRef.current === currentRun.activityId) return;
    retryAttemptedRef.current = currentRun.activityId;
    retryActivitySubmission();
  }, [isReady, currentRun.submissionStatus, currentRun.activityId, retryActivitySubmission]);

  useEffect(() => {
    loadIndoorTestSettings();
    return () => {
      stopSimulatedLocation();
    };
  }, [loadIndoorTestSettings, stopSimulatedLocation]);

  if (!isReady) {
    return (
      <View accessibilityRole="progressbar" style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <ActivityIndicator size="large" color="#00f3ff" />
        <Text style={{ color: '#00f3ff', marginTop: 16, fontSize: 13, letterSpacing: 1.5, fontWeight: 'bold' }}>
          INITIALIZING TERRITORY RUN...
        </Text>
      </View>
    );
  }

  if (isSignedIn && !user) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#ff4444', fontSize: 18, fontWeight: 'bold', marginBottom: 12, textAlign: 'center', letterSpacing: 1 }}>
          ⚠️ CONNECTION ISSUE
        </Text>
        <Text style={{ color: '#ccc', fontSize: 13, textAlign: 'center', marginBottom: 12, lineHeight: 20 }}>
          {profileError || 'Could not connect to the TerritoryRun server. Ensure the backend server is running.'}
        </Text>
        <Text style={{ color: '#666', fontSize: 11, textAlign: 'center', marginBottom: 24 }}>
          API Target: {api.defaults.baseURL}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setProfileRetryKey((value) => value + 1)}
          style={{ backgroundColor: '#00f3ff', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 8, marginBottom: 16 }}
        >
          <Text style={{ color: '#000', fontWeight: 'bold', letterSpacing: 1 }}>RETRY CONNECTION</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => signOut()}
          style={{ paddingHorizontal: 16, paddingVertical: 8 }}
        >
          <Text style={{ color: '#888', fontSize: 12 }}>SIGN OUT / SWITCH ACCOUNT</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <GameContext.Provider value={{
        user, token, logout, territories, alerts, addAlert,
        currentRun, startTracking, stopTracking, startContinuousRun, stopContinuousRun, retryActivitySubmission, processGPSUpdate,
        lastPosition, gpsStatus, gpsAccuracy, startGpsTracking,
        activeGameMode, attackTarget, isCameraLocked, setCameraLocked,
        targetDistance, setTargetDistance, suggestedRoutes, setSuggestedRoutes,
        selectedRoute, setSelectedRoute, isLoopClosable, setIsLoopClosable,
        indoorTestMode, setIndoorTestMode: toggleIndoorTestMode, toggleIndoorTestMode, testDistanceMeters, setTestDistance,
        simulatedLocation, setSimulatedLocation: toggleSimulatedLocation, toggleSimulatedLocation,
        isSubmitting, setIsSubmitting,
        leaderboard, refreshLeaderboard
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGameStore = () => useContext(GameContext);
