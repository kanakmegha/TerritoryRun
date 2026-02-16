import React, { createContext, useContext, useState, useEffect } from 'react';
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
const H3_RESOLUTION = 11; // Level 11 = ~25m hexes (Perfect for backyard testing)
const CLAIM_THRESHOLD = 1; // 1 meter = Instant claim for testing

export const GameProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [claimedCells, setClaimedCells] = useState({});
  const [alerts, setAlerts] = useState([]);
  // Hydrate currentRun from localStorage on init
  const [currentRun, setCurrentRun] = useState(() => {
    const saved = localStorage.getItem('currentRun');
    return saved ? JSON.parse(saved) : { isActive: false, path: [], distance: 0 };
  });
  
  const [tileDistanceMap, setTileDistanceMap] = useState(() => {
    const saved = localStorage.getItem('tileDistanceMap');
    return saved ? JSON.parse(saved) : {};
  }); // { hexIndex: metersWithinTile }
  const [lastPosition, setLastPosition] = useState(null);
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

  // Mock Rival Data
  const Rival_User = {
      id: 'rival_bot',
      username: 'Rival_Runner',
      color: '#ff0000',
      stats: { territories: 88 }
  };

  // 2. UPDATED AUTH HEADER & GPS INIT
  useEffect(() => {
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        refreshMap();
        startGpsTracking();
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
  const wakeLockRef = React.useRef(null);
  
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
    if (!navigator.geolocation) {
        setGpsStatus('error');
        setGpsError('Geolocation is not supported by your browser.');
        return;
    }

    setGpsStatus('requesting');
    
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
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

  const refreshMap = async () => {
      try {
          const res = await axios.get('/api/game/map');
          const cells = {};
          
          // Ensure res.data is expected format (map object or array)
          if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
              // It's already the Map object from game.js
              setClaimedCells(res.data);
          } else if (Array.isArray(res.data)) {
              res.data.forEach(tile => {
                  cells[tile.cellIndex || tile.index] = {
                      ownerId: tile.ownerId || tile.owner,
                      color: tile.color || tile.ownerColor,
                      timestamp: tile.timestamp
                  };
              });
              setClaimedCells(cells);
          }
          
          if (!user) {
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
        simulateStep, H3_RESOLUTION
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGameStore = () => useContext(GameContext);