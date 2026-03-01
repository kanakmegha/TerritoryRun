import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { calculatePolygonArea, isPathClosed, isNearPolygonBoundary, calculateDistance } from '../utils/geometry';
import { checkIfOnRoad, resetRoadValidatorCache } from '../utils/roadValidator';
import { useAuth, useSession } from '@clerk/clerk-expo';

const GameContext = createContext();

export const GameProvider = ({ children }) => {
  const { isLoaded, isSignedIn, signOut } = useAuth();
const { session } = useSession();
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  
  const [territories, setTerritories] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activeGameMode, setActiveGameMode] = useState(null); 
  const [attackTarget, setAttackTarget] = useState(null);
  
  const [targetDistance, setTargetDistance] = useState(5);
  const [suggestedRoutes, setSuggestedRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  const [currentRun, setCurrentRun] = useState({ isActive: false, path: [], distance: 0, pace: 0, lastUpdateTime: 0 });
  const [lastPosition, setLastPosition] = useState(null);
  const [isLoopClosable, setIsLoopClosable] = useState(false);

  const [gpsStatus, setGpsStatus] = useState('idle');
  const [gpsError, setGpsError] = useState(null);
  const [isOffRoad, setIsOffRoad] = useState(false);
  const isOffRoadRef = useRef(false);
  const isSpeedAlertRef = useRef(false);
  const prevHeartbeatRef = useRef(null);
  const [isCameraLocked, setCameraLocked] = useState(true);

useEffect(() => {
  const initAuth = async () => {

    // wait for clerk to load
    if (!isLoaded) return;

    // user signed out
    if (!isSignedIn) {
      console.log("User signed out");
      setUser(null);
      setToken(null);
      setIsReady(true);
      return;
    }

    // THIS is the missing condition
    if (!session || session.status !== "active") {
      console.log("Waiting for active Clerk session...");
      return;
    }

    try {
      console.log("Clerk session active, requesting token...");

      const clerkToken = await session.getToken({
        template: "clerk"
      });

      if (!clerkToken) {
        console.log("Token not ready yet...");
        return;
      }

      console.log("TOKEN RECEIVED");

      setToken(clerkToken);

      api.defaults.headers.common["Authorization"] = `Bearer ${clerkToken}`;

      const res = await api.get("/api/auth/profile");

      console.log("PROFILE RESPONSE:", res.data);

      setUser(res.data.user || res.data);

      refreshMap();
      refreshLeaderboard();

      setIsReady(true);

    } catch (e) {
      console.error("AUTH ERROR:", e?.response?.data || e.message);
    }
  };

  initAuth();
}, [isLoaded, isSignedIn, session]);
  // Persistence
  useEffect(() => {
    const hydrate = async () => {
      try {
        const savedRun = await AsyncStorage.getItem('currentRun');
        if (savedRun) setCurrentRun(JSON.parse(savedRun));
        const savedPos = await AsyncStorage.getItem('lastPosition');
        if (savedPos) setLastPosition(JSON.parse(savedPos));
      } catch (e) {}
    };
    hydrate();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (lastPosition) AsyncStorage.setItem('lastPosition', JSON.stringify(lastPosition));
  }, [lastPosition, isReady]);

  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem('currentRun', JSON.stringify(currentRun));
    currentRun.isActive ? activateKeepAwakeAsync() : deactivateKeepAwake();
  }, [currentRun, isReady]);

  const locationSubscriberRef = useRef(null);
  const startGpsTracking = async () => {
    try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return setGpsStatus('error');

        if (locationSubscriberRef.current) locationSubscriberRef.current.remove();

        locationSubscriberRef.current = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
            (position) => {
                const { latitude: lat, longitude: lng } = position.coords;
                setLastPosition({ lat, lng });
                setGpsStatus('locked');
                processGPSUpdate(lat, lng);
            }
        );
    } catch (err) { setGpsStatus('error'); }
  };

  const refreshMap = async () => {
    try {
        const res = await api.get('/api/game/territories');
        setTerritories(res.data.territories || []);
    } catch (e) {}
  };

  const refreshLeaderboard = async () => {
    try {
        const res = await api.get('/api/game/leaderboard');
        setLeaderboard(res.data.leaderboard || []);
    } catch (e) {}
  };

  const logout = async () => { await signOut(); };

  const startTracking = (mode) => {
      setActiveGameMode(mode);
      setCurrentRun({ isActive: true, path: [], distance: 0, pace: 0, lastUpdateTime: Date.now() });
      addAlert(`📡 ${mode.toUpperCase()} MODE ACTIVE`);
  };

  const stopTracking = async () => {
      const mode = activeGameMode;
      const runPath = [...currentRun.path];
      const runDistance = currentRun.distance || 0;
      setCurrentRun(prev => ({ ...prev, isActive: false }));
      resetRoadValidatorCache();

      if (mode === 'claim') {
          const isClosed = isPathClosed(runPath, 50, calculateDistance);
          if (isClosed && runDistance >= 100) {
              const area = calculatePolygonArea(runPath);
              let exportPath = runPath.map(p => [p[1], p[0]]);
              exportPath.push([...exportPath[0]]);
              try {
                  await api.post('/api/game/claim', { boundary: exportPath, area: Math.round(area), perimeter: Math.round(runDistance), reward: 1 });
                  refreshMap();
              } catch (e) { addAlert("❌ Claim rejected by server."); }
          } else {
            addAlert("❌ Requirements not met (Closed loop + 100m).");
          }
      }
      setActiveGameMode(null);
  };

  const processGPSUpdate = async (lat, lng) => {
      if (!user || !currentRun.isActive) return;
      const nowTime = Date.now();
      
      let distanceMoved = 0;
      const prevPos = currentRun.path[currentRun.path.length - 1];
      if (prevPos) distanceMoved = calculateDistance(prevPos[0], prevPos[1], lat, lng);

      // Simple road check integration
      const { isOnRoad } = await checkIfOnRoad(lat, lng);
      if (!isOnRoad && !isOffRoadRef.current) {
          setIsOffRoad(true);
          isOffRoadRef.current = true;
          addAlert('🚫 OFF-ROAD detected!');
      } else if (isOnRoad && isOffRoadRef.current) {
          setIsOffRoad(false);
          isOffRoadRef.current = false;
          addAlert('✅ Back on road!');
      }

      setCurrentRun(prev => ({
          ...prev,
          path: [...prev.path, [lat, lng]],
          distance: prev.distance + (isOnRoad ? distanceMoved : 0),
          lastUpdateTime: nowTime
      }));
  };

  const addAlert = (message) => {
    setAlerts(prev => [{ id: Date.now(), message, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
  };

  if (!isReady) return null;

  return (
    <GameContext.Provider value={{ 
        user, token, logout, territories, alerts, addAlert,
        currentRun, startTracking, stopTracking, processGPSUpdate, 
        lastPosition, gpsStatus, startGpsTracking,
        activeGameMode, attackTarget, isCameraLocked, setCameraLocked,
        targetDistance, setTargetDistance, suggestedRoutes, setSuggestedRoutes,
        selectedRoute, setSelectedRoute, isLoopClosable, setIsLoopClosable,
        isOffRoad, leaderboard, refreshLeaderboard
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGameStore = () => useContext(GameContext);