import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { calculatePolygonArea, isPathClosed, isNearPolygonBoundary, calculateDistance } from '../utils/geometry';
import { checkIfOnRoad, resetRoadValidatorCache } from '../utils/roadValidator';

const GameContext = createContext();

// Replace this with your Vercel deployment URL after you deploy
// Example: 'https://territory-run-api.vercel.app'
const VERCEL_URL = ''; 

const API_URL = __DEV__ 
  ? 'http://localhost:5001' 
  : (VERCEL_URL || 'http://localhost:5001');

console.log(`[API] Connecting to: ${API_URL}`);
axios.defaults.baseURL = API_URL;

export const GameProvider = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  
  // New Array of Mappls GeoJSON Territories
  const [territories, setTerritories] = useState([]);
  
  const [alerts, setAlerts] = useState([]);
  const [activeGameMode, setActiveGameMode] = useState(null); // 'claim' | 'run' | 'fortify'
  const [attackTarget, setAttackTarget] = useState(null);
  
  // Mission Control & Route Suggestion State
  const [targetDistance, setTargetDistance] = useState(5); // Default 5km
  const [suggestedRoutes, setSuggestedRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [teams, setTeams] = useState([]);

  const [currentRun, setCurrentRun] = useState({ isActive: false, path: [], distance: 0, pace: 0, lastUpdateTime: 0 });
  const [lastPosition, setLastPosition] = useState(null);
  const [isLoopClosable, setIsLoopClosable] = useState(false);

  const [gpsStatus, setGpsStatus] = useState('idle');
  const [gpsError, setGpsError] = useState(null);
  const [isOffRoad, setIsOffRoad] = useState(false);
  const [isCameraLocked, setCameraLocked] = useState(true);

  // HYDRATE FROM ASYNC STORAGE
  useEffect(() => {
    const hydrate = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('token');
        if (savedToken) setToken(savedToken);

        const savedRun = await AsyncStorage.getItem('currentRun');
        if (savedRun) setCurrentRun(JSON.parse(savedRun));

        const savedPos = await AsyncStorage.getItem('lastPosition');
        if (savedPos) setLastPosition(JSON.parse(savedPos));
      } catch (e) {
        console.error("Hydration error", e);
      } finally {
        setIsReady(true);
      }
    };
    hydrate();
  }, []);


  useEffect(() => {
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        refreshMap();
        refreshLeaderboard();
        refreshTeams();
    }
  }, [token]);

  // Persistence Effects
  useEffect(() => {
    if (!isReady) return;
    if (lastPosition) AsyncStorage.setItem('lastPosition', JSON.stringify(lastPosition));
  }, [lastPosition, isReady]);

  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem('currentRun', JSON.stringify(currentRun));
    if (currentRun.isActive) {
        requestWakeLock();
    } else {
        releaseWakeLock();
    }
  }, [currentRun, isReady]);

  const requestWakeLock = async () => {
      try {
          await activateKeepAwakeAsync();
      } catch (err) {}
  };

  const releaseWakeLock = async () => {
      try {
          await deactivateKeepAwake();
      } catch (err) {}
  };

  const locationSubscriberRef = useRef(null);
  const processGPSUpdateRef = useRef();
  
  useEffect(() => {
      processGPSUpdateRef.current = processGPSUpdate;
  });

  const startGpsTracking = async () => {
    setGpsStatus('requesting');
    
    try {
        console.log("[GPS] Requesting Permissions...");
        let { status } = await Location.requestForegroundPermissionsAsync();
        console.log("[GPS] Permission Status:", status);
        
        if (status !== 'granted') {
            setGpsStatus('error');
            setGpsError('GPS Access Denied.');
            addAlert("❌ GPS Access Denied");
            return;
        }

        if (locationSubscriberRef.current) {
            locationSubscriberRef.current.remove();
        }

        console.log("[GPS] Starting Position Watcher...");
        locationSubscriberRef.current = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.BestForNavigation,
                timeInterval: 1000,
                distanceInterval: 0,
            },
            (position) => {
                const { latitude: lat, longitude: lng } = position.coords;
                console.log(`[GPS] Heartbeat: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
                setLastPosition({ lat, lng });
                setGpsStatus('locked');
                setGpsError(null);
                if (processGPSUpdateRef.current) {
                    processGPSUpdateRef.current(lat, lng);
                }
            }
        );
    } catch (err) {
        console.error("[GPS] Init Error:", err);
        setGpsStatus('error');
        setGpsError('Initialization failed.');
    }
  };

  useEffect(() => {
    return () => {
        if (locationSubscriberRef.current) {
            locationSubscriberRef.current.remove();
        }
    };
  }, []);

  const login = async (credentials) => {
    try {
        const res = await axios.post('/api/auth/login', credentials);
        const { user: userData, token: userToken } = res.data;
        setUser(userData);
        setToken(userToken);
        await AsyncStorage.setItem('token', userToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
        refreshMap();
        return { success: true };
    } catch (err) {
        console.error("Login Error:", err.message, err.response?.data);
        return { success: false, message: "Login failed" };
    }
  };

  const signup = async (userData) => {
    try {
        const res = await axios.post('/api/auth/register', userData);
        const { user: newUserData, token: newUserToken } = res.data;
        setUser(newUserData);
        setToken(newUserToken);
        await AsyncStorage.setItem('token', newUserToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newUserToken}`;
        refreshMap();
        return { success: true };
    } catch (err) {
        console.error("Signup Error:", err.message, err.response?.data);
        return { success: false, message: "Signup failed" };
    }
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    await AsyncStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  const refreshMap = async () => {
    try {
        const res = await axios.get('/api/game/territories');
        setTerritories(res.data.territories || []);
        
        // Refresh user stats if needed
        if (token) {
            try {
                const userRes = await axios.get('/api/auth/me');
                if (userRes.data.success) {
                    setUser(userRes.data.user);
                }
            } catch (authErr) {
                console.warn("User refresh failed", authErr.message);
            }
        }
    } catch (e) {
        console.error("Map Refresh Error:", e);
    }
  };

  const refreshLeaderboard = async () => {
    try {
        const res = await axios.get('/api/game/leaderboard');
        setLeaderboard(res.data.leaderboard || []);
    } catch (e) {
        console.error("Leaderboard Refresh Error:", e);
    }
  };

  const refreshTeams = async () => {
    try {
        const res = await axios.get('/api/game/teams');
        setTeams(res.data.teams || []);
    } catch (e) {
        console.error("Teams Refresh Error:", e);
    }
  };

  const startTracking = (mode) => {
      setActiveGameMode(mode);
      setCurrentRun({ isActive: true, path: [], distance: 0, pace: 0, lastUpdateTime: Date.now() });
      setAttackTarget(null);
      AsyncStorage.removeItem('currentRun');
      requestWakeLock();
      addAlert(`📡 ${mode.toUpperCase()} MODE ACTIVE`);
  };

  const stopTracking = async () => {
      const mode = activeGameMode;
      const runPath = [...currentRun.path];
      const runDistance = currentRun.distance || 0;
      
      setCurrentRun(prev => ({ ...prev, isActive: false }));
      AsyncStorage.removeItem('currentRun');
      releaseWakeLock();
      
      if (mode === 'claim') {
          const isClosed = isPathClosed(runPath, 50, calculateDistance);
          if (!isClosed) {
              addAlert("❌ Loop not closed. Return to start point.");
          } else if (runDistance < 100) {
              addAlert("❌ Area too small. Minimum 100m perimeter.");
          } else {
              const area = calculatePolygonArea(runPath);
              if (area < 50) {
                  addAlert("❌ Geometric area calculation failed. (Too narrow?)");
              } else {
                  addAlert(`🔥 SECURED! Area: ${area.toFixed(0)}m²`);
                  
                  // Convert coordinates to GeoJSON standard [lng, lat]
                  let exportPath = runPath.map(p => [p[1], p[0]]);
                  // Strictly close the polygon loop for GeoJSON specification
                  exportPath.push([...exportPath[0]]);
                  
                  try {
                      const res = await axios.post('/api/game/claim', {
                          boundary: exportPath,
                          area: Math.round(area),
                          perimeter: Math.round(runDistance),
                          reward: 1
                      });
                      
                      if(res.data.success) {
                          refreshMap();
                          setUser(prev => ({
                              ...prev,
                              stats: { ...prev.stats, territories: (prev.stats?.territories || 0) + 1 }
                          }));
                      }
                  } catch (e) {
                      console.error("Vector save error:", e);
                      addAlert("❌ Server rejected vector coordinates.");
                  }
              }
          }
      } else if (mode === 'run') {
          if (attackTarget && attackTarget.progress >= attackTarget.required) {
              try {
                  const res = await axios.post('/api/game/attack', {
                      territoryId: attackTarget.id,
                      attackDistance: attackTarget.progress
                  });
                  if (res.data.success) {
                      addAlert("🏆 TERRITORY CONQUERED!");
                      refreshMap();
                      // Optimistically increment stats
                      setUser(prev => ({
                          ...prev,
                          stats: { ...prev.stats, territories: (prev.stats?.territories || 0) + 1 }
                      }));
                  }
              } catch (e) {
                  console.error("Attack error", e);
                  addAlert("❌ Attack failed. Server rejected.");
              }
          } else if (attackTarget) {
              addAlert(`📉 Attack faded. Reached ${Math.floor((attackTarget.progress/attackTarget.required)*100)}%`);
          } else {
              addAlert("🏁 Run completed. No territories engaged.");
          }
          setAttackTarget(null);
      }
      
      setActiveGameMode(null);
  };


  const processGPSUpdate = async (lat, lng) => {
      try {
          if (!user) return;

          if (!currentRun.isActive) return;

          // ── Road Validation ──────────────────────────────────────────
          const { isOnRoad, roadName } = await checkIfOnRoad(lat, lng);
          if (!isOnRoad) {
              setIsOffRoad(true);
              addAlert('🚫 OFF-ROAD detected! Stay on roads to capture distance.');
              // Still record path point for visual continuity, but skip distance accumulation below.
          } else {
              if (isOffRoad) setIsOffRoad(false); // clear the warning once back on road
          }
          // ─────────────────────────────────────────────────────────────

      setCurrentRun(prev => {
          let distanceMoved = 0;
          const prevPos = prev.path[prev.path.length - 1];

          if (prevPos) {
              distanceMoved = calculateDistance(prevPos[0], prevPos[1], lat, lng);
          }

          let currentPace = prev.pace || 0;
          const nowTime = Date.now();
          let validDistance = 0;
          
          if (prev.lastUpdateTime && distanceMoved > 0) {
              const timeDiff = (nowTime - prev.lastUpdateTime) / 1000;
              if (timeDiff > 0) {
                  const speedMs = distanceMoved / timeDiff; // m/s
                  const speedKmh = speedMs * 3.6; // km/h
                  
                  if (speedMs > 0) currentPace = (1000 / speedMs) / 60; 

                  // Speed Validation Gate (4 km/h to 15 km/h limit)
                  // If outside bounds, we record the GPS coordinate to keep the path shape intact,
                  // but we DO NOT add the distance to their capturing stats to prevent cheating.
                  if (speedKmh >= 0.5 && speedKmh <= 15 && isOnRoad) {
                      validDistance = distanceMoved;
                  } else if (speedKmh > 15) {
                      addAlert("⚠️ SPEED LIMIT EXCEEDED. Distance Paused.");
                  }
              }
          }

          const newTotal = parseFloat(prev.distance || 0) + validDistance;
          
          if (activeGameMode === 'claim' && newTotal > 100 && prev.path.length > 5) {
              const startPos = prev.path[0];
              const distToStart = calculateDistance(startPos[0], startPos[1], lat, lng);
              if (distToStart <= 10) {
                  setIsLoopClosable(true);
              } else {
                  setIsLoopClosable(false);
              }
          }

          if ((activeGameMode === 'run' || activeGameMode === 'fortify') && validDistance > 0) {
              const userIdObj = user?.id || user?._id; 
              
              // If fortify, we look for OWN territories. If run, we look for ENEMY territories.
              const targetTerritories = territories.filter(t => 
                  activeGameMode === 'fortify' ? t.owner === userIdObj : t.owner !== userIdObj
              );
              
              const nearTerritory = targetTerritories.find(t => isNearPolygonBoundary(lat, lng, t.boundary, 15));
              
              if (nearTerritory) {
                  setAttackTarget(prevAttack => {
                      const prevProgress = (prevAttack?.id === nearTerritory._id) ? prevAttack.progress : 0;
                      const newProgress = prevProgress + validDistance;
                      
                      // For fortify, required is usually less or different, but using same formula for now
                      const required = nearTerritory.perimeter_m * (activeGameMode === 'fortify' ? 0.5 : nearTerritory.strength);
                      
                      const actionLabel = activeGameMode === 'fortify' ? '🛡️ Fortifying' : '⚔️ Siphoning';
                      
                      if (Math.floor(newProgress) % 50 === 0 && newProgress > prevProgress) {
                          addAlert(`${actionLabel}! ${Math.floor((newProgress/required)*100)}%`);
                      }
                      
                      return {
                          id: nearTerritory._id,
                          progress: newProgress,
                          required: required,
                          territory: nearTerritory
                      };
                  });
              }
          }

          return {
              ...prev,
              path: [...prev.path, [lat, lng]],
              distance: newTotal,
              pace: currentPace,
              lastUpdateTime: nowTime
          };
      });
    } catch (err) {
        console.error("[GPS] Update Error:", err);
    }
  };

  const addAlert = (message) => {
    setAlerts(prev => [{ id: Date.now(), message, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
  };

  if (!isReady) return null;

  return (
    <GameContext.Provider value={{ 
        user, token, login, signup, logout, 
        territories, 
        alerts, addAlert,
        currentRun, startTracking, stopTracking, processGPSUpdate, 
        lastPosition, gpsStatus, gpsError, startGpsTracking,
        activeGameMode, attackTarget,
        isCameraLocked, setCameraLocked,
        targetDistance, setTargetDistance,
        suggestedRoutes, setSuggestedRoutes,
        selectedRoute, setSelectedRoute,
        isLoopClosable, setIsLoopClosable,
        isOffRoad,
        leaderboard, refreshLeaderboard,
        teams, refreshTeams
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGameStore = () => useContext(GameContext);
