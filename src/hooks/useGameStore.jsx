import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { latLngToCell, cellToLatLng } from 'h3-js';

const GameContext = createContext();

// 1. DYNAMIC API URL: Detects if you're on local machine or deployed
/* const API_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:5001' 
    : (typeof window !== 'undefined' ? window.location.origin : ''); */
    // This ensures that on Vercel, the app talks to itself correctly
const API_URL = window.location.origin; 


axios.defaults.baseURL = API_URL;

// DEVELOPER TESTING MODE CONSTANTS
const H3_RESOLUTION = 15; // Level 15 = Micro-precision (~1m hexes) for indoor testing
const CLAIM_THRESHOLD = 0.2; // 0.2 meters = 20cm sensitivity for indoor testing

export const GameProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [claimedCells, setClaimedCells] = useState({});
  const [alerts, setAlerts] = useState([]);
  // Hydrate currentRun from localStorage on init
  const [currentRun, setCurrentRun] = useState(() => {
    try {
        const saved = localStorage.getItem('currentRun');
        if (saved && saved !== 'undefined') {
            const parsed = JSON.parse(saved);
            // Extra safety: ensure required fields exist
            return {
                isActive: !!parsed.isActive,
                path: Array.isArray(parsed.path) ? parsed.path : [],
                distance: typeof parsed.distance === 'number' ? parsed.distance : 0,
                pace: typeof parsed.pace === 'number' ? parsed.pace : 0
            };
        }
    } catch (e) {
        console.error("Failed to parse currentRun from localStorage", e);
    }
    return { isActive: false, path: [], distance: 0, pace: 0 };
  });
  
  const [tileDistanceMap, setTileDistanceMap] = useState(() => {
    try {
        const saved = localStorage.getItem('tileDistanceMap');
        if (saved && saved !== 'undefined') {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error("Failed to parse tileDistanceMap from localStorage", e);
    }
    return {};
  }); // { hexIndex: metersWithinTile }
  const [lastPosition, setLastPosition] = useState(() => {
    try {
        const saved = localStorage.getItem('lastPosition');
        if (saved) return JSON.parse(saved);
    } catch (e) {
        console.error("Failed to parse lastPosition from localStorage", e);
    }
    return null;
  });

  useEffect(() => {
    if (lastPosition) {
        localStorage.setItem('lastPosition', JSON.stringify(lastPosition));
    }
  }, [lastPosition]);

  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle', 'requesting', 'locked', 'error'
  const [gpsError, setGpsError] = useState(null);

  // Unified Invasion Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [lostTiles, setLostTiles] = useState([]);
  const [showReclaimButton, setShowReclaimButton] = useState(false);
  const [contestedTiles, setContestedTiles] = useState({}); // Tiles taken during invasion (red)
  const [ghostPath, setGhostPath] = useState([]); // Attacker's route for visualization
  const [reclaimedPathSegments, setReclaimedPathSegments] = useState([]); 
  const [showMissionAlert, setShowMissionAlert] = useState(false);
  const [isCameraLocked, setCameraLocked] = useState(true);
  
  // Mission Logic States
  const [simulationSubtitle, setSimulationSubtitle] = useState("");
  const [simulationProgress, setSimulationProgress] = useState(0); // 0-100

  // Mock Rival Data
  const Rival_User = {
      id: 'rival_bot',
      username: 'Rival_Runner',
      color: '#ff0000',
      stats: { territories: 88 }
  };

  // 2. UPDATED AUTH HEADER & GPS INIT
  useEffect(() => {
    // Immediate GPS Trigger for permissions
    startGpsTracking();
  }, []);

  useEffect(() => {
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        refreshMap();
    }
    
    // Visibility Change Handler for Wake Lock
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

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('currentRun', JSON.stringify(currentRun));
    if (currentRun.isActive) {
        requestWakeLock();
    } else {
        releaseWakeLock();
    }
  }, [currentRun]);

  useEffect(() => {
    localStorage.setItem('tileDistanceMap', JSON.stringify(tileDistanceMap));
  }, [tileDistanceMap]);

  // Wake Lock Helpers
  const wakeLockRef = useRef(null);
  
  const requestWakeLock = async () => {
      if ('wakeLock' in navigator && !wakeLockRef.current) {
          try {
              wakeLockRef.current = await navigator.wakeLock.request('screen');
              console.log('Wake Lock is active');
          } catch (err) {
              console.error(`${err.name}, ${err.message}`);
          }
      }
  };

  const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
          console.log('Wake Lock released');
      }
  };

  const startGpsTracking = () => {
    console.log('🛰️ Checking Permissions and initializing GPS...');
    if (!navigator.geolocation) {
        setGpsStatus('error');
        setGpsError('Geolocation is not supported by your browser.');
        return;
    }

    setGpsStatus('requesting');
    
    const options = {
        enableHighAccuracy: true,
        timeout: 5000, // Pro: Lower timeout for faster updates
        maximumAge: 0   // Pro: No cached positions
    };

    const success = (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setLastPosition({ lat, lng });
        setGpsStatus('locked');
        setGpsError(null);
        processGPSUpdate(lat, lng);
    };

    const error = (err) => {
        console.error("GPS Watcher Error:", err);
        if (err.code === 1) {
            setGpsStatus('error');
            setGpsError('GPS Access Denied. Please enable location in browser settings to play.');
            addAlert("❌ GPS Access Denied");
        } else if (gpsStatus === 'requesting') {
            // Only show error if we haven't locked yet
            addAlert("⚠️ GPS Signal Weak...");
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
        addAlert(`👋 Welcome back, ${userData.username}!`);
        return { success: true, user: userData, token: userToken };
    } catch (err) {
        const msg = err.response?.data?.message || "Login failed";
        addAlert(`❌ ${msg}`);
        return { success: false, message: msg };
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
        addAlert(`✨ Account created! Welcome, ${newUserData.username}.`);
        return { success: true, user: newUserData, token: newUserToken };
    } catch (err) {
        const msg = err.response?.data?.error || err.response?.data?.message || "Signup failed";
        const debug = err.response?.data?.debug_info ? ` (${err.response.data.debug_info})` : "";
        addAlert(`❌ ${msg}${debug}`);
        return { success: false, message: `${msg}${debug}` };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  const refreshMap = async (bbox = null) => {
      try {
          const url = bbox ? `/api/game/map?bbox=${bbox}` : '/api/game/map';
          const res = await axios.get(url);
          const cells = res.data;
          
          setClaimedCells(cells);
          
          if (!user && token) {
            const userRes = await axios.get('/api/auth/me');
            setUser(userRes.data);
          }
      } catch (err) {
          console.error("Failed to load map:", err);
      }
  };

  const startContinuousRun = () => {
      setCurrentRun({ isActive: true, path: [], distance: 0 });
      setTileDistanceMap({});
      localStorage.removeItem('currentRun');
      localStorage.removeItem('tileDistanceMap');
      requestWakeLock();
      addAlert("🏃 Run started! Territory acquisition active.");
  };

  const stopContinuousRun = () => {
      setCurrentRun(prev => ({ ...prev, isActive: false }));
      localStorage.removeItem('currentRun');
      localStorage.removeItem('tileDistanceMap');
      releaseWakeLock();
      addAlert("🏁 Run stopped.");
  };

  const processGPSUpdate = (lat, lng) => {
      if (!user) return;
      setLastPosition({ lat, lng });

      if (!currentRun.isActive) return;

      const currentHex = latLngToCell(lat, lng, H3_RESOLUTION);
      const prevPos = currentRun.path[currentRun.path.length - 1];
      let distanceMoved = 0;

      if (prevPos) {
          // Simple haversine-ish or just distance check
          const dLat = (lat - prevPos[0]) * 111320;
          const dLng = (lng - prevPos[1]) * 111320 * Math.cos(lat * Math.PI / 180);
          distanceMoved = Math.sqrt(dLat * dLat + dLng * dLng);
      }

      setCurrentRun(prev => ({
          ...prev,
          path: [...prev.path, [lat, lng]],
          distance: (prev.distance || 0) + distanceMoved
      }));

      const now = Date.now();
      const tileDistance = (tileDistanceMap[currentHex] || 0) + distanceMoved;
      
      // RECLAIM MECHANIC: Priority 'Blue' overwrite
      const isContested = contestedTiles[currentHex] !== undefined;
      
      if (tileDistance >= CLAIM_THRESHOLD || isContested) {
          if (isContested) {
              claimTile(lat, lng, user.id, user.color);
              addAlert(`⚔️ Sector RECLAIMED from Rival!`);
              
              // Update stats
              setUser(prev => ({
                  ...prev,
                  stats: { ...prev.stats, territories: (prev.stats?.territories || 0) + 1 }
              }));
          } else if (claimedCells[currentHex]?.ownerId !== user.id) {
              claimTile(lat, lng, user.id, user.color);
              
              // Update local state for stats
              setUser(prev => ({
                  ...prev,
                  stats: { ...prev.stats, territories: (prev.stats?.territories || 0) + 1 }
              }));
              
              addAlert(`✨ New territory claimed! Index: ${currentHex.substring(0,6)}...`);
          }
          setTileDistanceMap(prev => ({ ...prev, [currentHex]: 0 }));
      } else {
          setTileDistanceMap(prev => ({ ...prev, [currentHex]: tileDistance }));
      }
  };

  /**
   * Explicitly claim a tile for a specific owner/color
   * Used by simulation for Rival takeover and Priority Reclaim
   */
  const claimTile = async (lat, lng, ownerId = 'rival_bot', color = '#ff0000', forceIndex = null) => {
      const cellIndex = forceIndex || latLngToCell(lat, lng, H3_RESOLUTION);
      const now = Date.now();

      // Rule: Priority Reclaim
      if (ownerId === user?.id) {
          setClaimedCells(prev => ({
              ...prev,
              [cellIndex]: { ownerId: user.id, color: user.color, timestamp: now }
          }));
          setContestedTiles(prev => {
              const updated = { ...prev };
              delete updated[cellIndex];
              return updated;
          });
          return;
      }

      // If it's a Rival taking over a User's tile
      if (ownerId === 'rival_bot' && claimedCells[cellIndex]?.ownerId === user?.id) {
          setLostTiles(prev => [...prev, { index: cellIndex, position: [lat, lng] }]);
          
          setUser(prev => ({
              ...prev,
              stats: { 
                  ...prev.stats, 
                  territories: Math.max(0, (prev.stats?.territories || 1) - 1) 
              }
          }));

          setContestedTiles(prevContested => ({
              ...prevContested,
              [cellIndex]: {
                  ownerId: 'rival_bot',
                  color: '#ff0000',
                  timestamp: now,
                  glitch: true
              }
          }));

          setClaimedCells(prev => {
              const updated = { ...prev };
              delete updated[cellIndex];
              return updated;
          });
          
          addAlert(`⚠️ Sector compromised by Rival_Runner!`);
          
          setTimeout(() => {
              setContestedTiles(prev => {
                  const updated = { ...prev };
                  if (updated[cellIndex]) updated[cellIndex].glitch = false;
                  return updated;
              });
          }, 500);
      } else {
          // Normal Rival claim
          if (ownerId === 'rival_bot') {
              setContestedTiles(prev => ({ 
                  ...prev, 
                  [cellIndex]: { ownerId: 'rival_bot', color: '#ff0000', timestamp: now } 
              }));
          }
      }
  };

  const addAlert = (message) => {
    setAlerts(prev => [{ id: Date.now(), message, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
  };

  /**
   * Start the invasion simulation (test_invasion unified flow)
   */
  const startInvasionSimulation = () => {
      setLostTiles([]);
      setGhostPath([]);
      setContestedTiles({});
      setReclaimedPathSegments([]);
      setShowMissionAlert(false);
      setIsSimulating(true);
      setShowReclaimButton(false);
      setSimulationSubtitle("");
      setSimulationProgress(0);
      addAlert("⚠️ INVASION TEST STARTING...");
  };

  /**
   * Center map on lost tiles for reclaim
   */
  const centerOnLostTiles = () => {
      if (lostTiles.length === 0) return null;
      const avgLat = lostTiles.reduce((sum, tile) => sum + tile.position[0], 0) / lostTiles.length;
      const avgLng = lostTiles.reduce((sum, tile) => sum + tile.position[1], 0) / lostTiles.length;
      return [avgLat, avgLng];
  };

  /**
   * DEVELOPER MODE: Nudge coordinates to test tracking without walking
   */
  const simulateStep = () => {
      if (!lastPosition) return;
      // Nudge by approx 10 meters
      const nextLat = lastPosition.lat + (Math.random() - 0.5) * 0.0002;
      const nextLng = lastPosition.lng + (Math.random() - 0.5) * 0.0002;
      
      addAlert("🛠️ SIMULATED STEP: Coordinate nudge applied");
      processGPSUpdate(nextLat, nextLng);
  };

  return (
    <GameContext.Provider value={{ 
        user, token, login, signup, logout, 
        claimedCells, 
        alerts, addAlert,
        // Real-time GPS tracking
        currentRun, startContinuousRun, stopContinuousRun, processGPSUpdate, 
        lastPosition, gpsStatus, gpsError, startGpsTracking,
        // Invasion simulation
        isSimulating, claimTile, setIsSimulating,
        startInvasionSimulation, lostTiles, showReclaimButton, centerOnLostTiles,
        contestedTiles, ghostPath, setGhostPath, reclaimedPathSegments, setReclaimedPathSegments, 
        showMissionAlert, setShowMissionAlert, setShowReclaimButton, Rival_User,
        simulateStep, H3_RESOLUTION,
        isCameraLocked, setCameraLocked,
        simulationSubtitle, setSimulationSubtitle,
        simulationProgress, setSimulationProgress
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGameStore = () => useContext(GameContext);