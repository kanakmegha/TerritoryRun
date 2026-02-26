import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { calculatePolygonArea, isPathClosed, isNearPolygonBoundary } from '../utils/geometry';

const GameContext = createContext();

const API_URL = window.location.origin; 
axios.defaults.baseURL = API_URL;

export const GameProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  
  // New Array of Mappls GeoJSON Territories
  const [territories, setTerritories] = useState([]);
  
  const [alerts, setAlerts] = useState([]);
  const [activeGameMode, setActiveGameMode] = useState(null); // 'claim' or 'run'
  const [attackTarget, setAttackTarget] = useState(null);

  const [currentRun, setCurrentRun] = useState(() => {
    try {
        const saved = localStorage.getItem('currentRun');
        if (saved && saved !== 'undefined') {
            const parsed = JSON.parse(saved);
            return {
                isActive: !!parsed.isActive,
                path: Array.isArray(parsed.path) ? parsed.path : [],
                distance: typeof parsed.distance === 'number' ? parsed.distance : 0,
                pace: typeof parsed.pace === 'number' ? parsed.pace : 0
            };
        }
    } catch (e) {
        console.error("Failed to parse", e);
    }
    return { isActive: false, path: [], distance: 0, pace: 0, lastUpdateTime: 0 };
  });
  
  const [lastPosition, setLastPosition] = useState(() => {
    try {
        const saved = localStorage.getItem('lastPosition');
        if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  useEffect(() => {
    if (lastPosition) localStorage.setItem('lastPosition', JSON.stringify(lastPosition));
  }, [lastPosition]);

  const [gpsStatus, setGpsStatus] = useState('idle'); 
  const [gpsError, setGpsError] = useState(null);
  const [isCameraLocked, setCameraLocked] = useState(true);

  // Auth & Init
  useEffect(() => {
    startGpsTracking();
  }, []);

  useEffect(() => {
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        refreshMap();
    }
    
    // Wake Lock handling
    const handleVisibilityChange = async () => {
        if (document.visibilityState === 'visible' && currentRun.isActive) {
            requestWakeLock();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (window.gpsWatcherId) {
            navigator.geolocation.clearWatch(window.gpsWatcherId);
        }
        releaseWakeLock();
    };
  }, [token, currentRun.isActive]);

  useEffect(() => {
    localStorage.setItem('currentRun', JSON.stringify(currentRun));
    if (currentRun.isActive) {
        requestWakeLock();
    } else {
        releaseWakeLock();
    }
  }, [currentRun]);

  const wakeLockRef = useRef(null);
  
  const requestWakeLock = async () => {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
          try {
              wakeLockRef.current = await navigator.wakeLock.request('screen');
          } catch (err) {}
      }
  };

  const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
      }
  };

  const processGPSUpdateRef = useRef();
  useEffect(() => {
      processGPSUpdateRef.current = processGPSUpdate;
  });

  const startGpsTracking = () => {
    if (!navigator.geolocation) {
        setGpsStatus('error');
        setGpsError('Geolocation is not supported by your browser.');
        return;
    }

    setGpsStatus('requesting');
    
    const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
    };

    const success = (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setLastPosition({ lat, lng });
        setGpsStatus('locked');
        setGpsError(null);
        if (processGPSUpdateRef.current) {
            processGPSUpdateRef.current(lat, lng);
        }
    };

    const error = (err) => {
        if (err.code === 1) {
            setGpsStatus('error');
            setGpsError('GPS Access Denied. Please enable location in browser settings to play.');
            addAlert("❌ GPS Access Denied");
        }
    };

    window.gpsWatcherId = navigator.geolocation.watchPosition(success, error, options);
  };

  const login = async (credentials) => {
    try {
        const res = await axios.post('/api/auth/login', credentials);
        const { user: userData, token: userToken } = res.data;
        setUser(userData);
        setToken(userToken);
        localStorage.setItem('token', userToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
        refreshMap();
        return { success: true };
    } catch (err) {
        return { success: false, message: "Login Failed" };
    }
  };

  const signup = async (userData) => {
    try {
        const res = await axios.post('/api/auth/register', userData);
        const { user: newUserData, token: newUserToken } = res.data;
        setUser(newUserData);
        setToken(newUserToken);
        localStorage.setItem('token', newUserToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newUserToken}`;
        refreshMap();
        return { success: true };
    } catch (err) {
        return { success: false, message: "Signup Failed" };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  const refreshMap = async () => {
      try {
          const res = await axios.get('/api/game/map');
          setTerritories(res.data); // array of geojson polygons
          
          if (!user && token) {
              try {
                  const userRes = await axios.get('/api/auth/me');
                  setUser(userRes.data);
              } catch (authErr) {
                  // If token is expired/invalid, silently clear it so App.jsx routes user to login
                  if (authErr.response && authErr.response.status === 401) {
                      setToken(null);
                      setUser(null);
                      localStorage.removeItem('token');
                      delete axios.defaults.headers.common['Authorization'];
                  }
              }
          }
      } catch (err) {}
  };

  const startTracking = (mode) => {
      setActiveGameMode(mode);
      setCurrentRun({ isActive: true, path: [], distance: 0, pace: 0, lastUpdateTime: Date.now() });
      setAttackTarget(null);
      localStorage.removeItem('currentRun');
      requestWakeLock();
      addAlert(`📡 ${mode.toUpperCase()} MODE ACTIVE`);
  };

  const stopTracking = async () => {
      const mode = activeGameMode;
      const runPath = [...currentRun.path];
      const runDistance = currentRun.distance || 0;
      
      setCurrentRun(prev => ({ ...prev, isActive: false }));
      localStorage.removeItem('currentRun');
      releaseWakeLock();
      
      if (mode === 'claim') {
          // Geometry evaluation 
          const isClosed = isPathClosed(runPath, 50, calculateDistance); // 50m max gap
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
                      // We don't strictly have user._id in frontend easily if user is shaped differently, 
                      // but refreshMap() gets new items. Stats won't hurt to optimistically increment.
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

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371e3; 
      const φ1 = lat1 * Math.PI/180;
      const φ2 = lat2 * Math.PI/180;
      const Δφ = (lat2-lat1) * Math.PI/180;
      const Δλ = (lon2-lon1) * Math.PI/180;
      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
      return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  };

  const processGPSUpdate = (lat, lng) => {
      if (!user) return;
      setLastPosition({ lat, lng });

      if (!currentRun.isActive) return;

      // Update native GPS Vector path array
      setCurrentRun(prev => {
          let distanceMoved = 0;
          const prevPos = prev.path[prev.path.length - 1];

          if (prevPos) {
              distanceMoved = calculateDistance(prevPos[0], prevPos[1], lat, lng);
          }

          const newTotal = parseFloat(prev.distance || 0) + distanceMoved;
          
          if (activeGameMode === 'run' && distanceMoved > 0) {
              // Find enemy territories (assuming user string id or _id matching)
              const userIdObj = user?.id || user?._id; 
              const enemyTerritories = territories.filter(t => t.owner !== userIdObj);
              
              const nearTerritory = enemyTerritories.find(t => isNearPolygonBoundary(lat, lng, t.boundary, 30));
              
              if (nearTerritory) {
                  setAttackTarget(prevAttack => {
                      const prevProgress = (prevAttack?.id === nearTerritory._id) ? prevAttack.progress : 0;
                      const newProgress = prevProgress + distanceMoved;
                      const required = nearTerritory.perimeter * nearTerritory.strength;
                      
                      if (Math.floor(newProgress) % 50 === 0 && newProgress > prevProgress) {
                          addAlert(`⚔️ Attacking! ${Math.floor((newProgress/required)*100)}%`);
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

          let currentPace = prev.pace || 0;
          const nowTime = Date.now();
          
          if (prev.lastUpdateTime && distanceMoved > 0) {
              const timeDiff = (nowTime - prev.lastUpdateTime) / 1000;
              if (timeDiff > 0) {
                  const speed = distanceMoved / timeDiff;
                  if (speed > 0) currentPace = (1000 / speed) / 60; 
              }
          }

          return {
              ...prev,
              path: [...prev.path, [lat, lng]], // Store raw polygon vertices
              distance: newTotal,
              pace: currentPace,
              lastUpdateTime: nowTime
          };
      });
  };

  const addAlert = (message) => {
    setAlerts(prev => [{ id: Date.now(), message, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
  };

  return (
    <GameContext.Provider value={{ 
        user, token, login, signup, logout, 
        territories, 
        alerts, addAlert,
        currentRun, startTracking, stopTracking, processGPSUpdate, 
        lastPosition, gpsStatus, gpsError, startGpsTracking,
        activeGameMode, attackTarget,
        isCameraLocked, setCameraLocked
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGameStore = () => useContext(GameContext);