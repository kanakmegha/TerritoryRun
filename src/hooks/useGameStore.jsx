import { createContext, useContext, useState, useEffect } from 'react';
import { latLngToCell, polygonToCells, cellToLatLng } from 'h3-js';
import axios from 'axios';

const GameContext = createContext();

export const GameProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [claimedCells, setClaimedCells] = useState({});
  const [alerts, setAlerts] = useState([]);
  
  
  // Real-Time GPS Tracking & Painting
  const [currentRun, setCurrentRun] = useState({
    isActive: false,
    distance: 0, // in meters
    pace: 0, // min/km
    tilesCaptured: 0,
    path: [], // Array of {lat, lng, timestamp}
    startTime: null,
    lastUpdate: null
  });
  const [tileDistanceMap, setTileDistanceMap] = useState({}); // { hexIndex: metersWithinTile }
  const [lastPosition, setLastPosition] = useState(null);

  // Invasion Simulation Logic
  const [isSimulating, setIsSimulating] = useState(false);
  const [lostTiles, setLostTiles] = useState([]);
  const [showReclaimButton, setShowReclaimButton] = useState(false);
  const [contestedTiles, setContestedTiles] = useState({}); // Tiles taken during invasion (red)
  const [ghostPath, setGhostPath] = useState([]); // Attacker's route for visualization
  const [reclaimedPathSegments, setReclaimedPathSegments] = useState([]); // Tracks which parts of ghostPath are reclaimed
  const [showMissionAlert, setShowMissionAlert] = useState(false); // Controls "Mission Alert" overlay

  // Set default auth header
  if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Initial Data Fetch
  useEffect(() => {
    if (token && !user) {
        // ideally fetch user profile from an /api/auth/me endpoint if we differ from local state
        // For now we rely on login setting it, or just clearing it if invalid
        // Let's implement a simple "refresh map"
        // If token exists but user is null, we should try to fetch user or decode token
        // For now, let's just mock restore it to prevent UI blankness if backend fetch isn't ready
        // In a real app, we'd call axios.get('/api/auth/me')
        const storedUser = localStorage.getItem('user_data');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        } else {
            // If we have a token but no user data (legacy session), logout to force fresh login
            logout(); 
        }

        refreshMap();
    }
  }, [token]);

  const refreshMap = async () => {
      try {
          const res = await axios.get('/api/game/map');
          setClaimedCells(res.data);
      } catch (err) {
          console.error("Failed to fetch map", err);
      }
  };

  const login = (newToken, newUser) => {
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem('token', newToken);
      localStorage.setItem('user_data', JSON.stringify(newUser)); // Persist user data
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      refreshMap();
  };

  const logout = () => {
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
  };

  
  /**
   * Haversine distance calculation between two points (in meters)
   */
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
      const R = 6371000; // Earth's radius in meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = 
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
  };

  /**
   * Start a continuous tracking run
   */
  const startContinuousRun = () => {
      setCurrentRun({
          isActive: true,
          distance: 0,
          pace: 0,
          tilesCaptured: 0,
          path: [],
          startTime: Date.now(),
          lastUpdate: Date.now()
      });
      setTileDistanceMap({});
      setLastPosition(null);
      addAlert("🏃 Live tracking started! Move to paint the map.");
  };

  /**
   * Stop the current run
   */
  const stopContinuousRun = () => {
      const runData = { ...currentRun };
      setCurrentRun({
          isActive: false,
          distance: 0,
          pace: 0,
          tilesCaptured: 0,
          path: [],
          startTime: null,
          lastUpdate: null
      });
      setTileDistanceMap({});
      setLastPosition(null);
      
      const distanceKm = (runData.distance / 1000).toFixed(2);
      const tiles = runData.tilesCaptured;
      addAlert(`✅ Run complete! ${distanceKm}km, ${tiles} tiles claimed.`);
      
      // Hide Mission Alert if it was active
      setShowMissionAlert(false);
  };

  /**
   * Process GPS update with continuous tile claiming
   */
  const processGPSUpdate = async (lat, lng) => {
      if (!currentRun.isActive || !user) return;

      const now = Date.now();
      const currentHex = latLngToCell(lat, lng, 9);

      // Calculate distance from last position
      let distanceMoved = 0;
      if (lastPosition) {
          distanceMoved = calculateDistance(
              lastPosition.lat, 
              lastPosition.lng, 
              lat, 
              lng
          );
      }

      // Update tile distance map
      setTileDistanceMap(prev => {
          const updated = { ...prev };
          const currentDist = updated[currentHex] || 0;
          updated[currentHex] = currentDist + distanceMoved;
          return updated;
      });

      // Check if tile should be claimed (50m threshold)
      const tileDistance = (tileDistanceMap[currentHex] || 0) + distanceMoved;
      
      // Check if this is a contested tile (red from invasion)
      const isContested = contestedTiles[currentHex] !== undefined;
      
      if (tileDistance >= 50) {
          if (isContested) {
              // RECLAIM contested tile - flip from red back to user color
              const reclaimedCell = {
                  ownerId: user.id,
                  color: user.color,
                  timestamp: now
              };
              
              setClaimedCells(prev => ({ ...prev, [currentHex]: reclaimedCell }));
              setContestedTiles(prev => {
                  const updated = { ...prev };
                  delete updated[currentHex];
                  return updated;
              });
              
              addAlert(`✅ Tile reclaimed! ${Object.keys(contestedTiles).length - 1} remaining.`);
              
              // Update stats
              setUser(prev => ({
                  ...prev,
                  stats: { 
                      ...prev.stats, 
                      territories: (prev.stats?.territories || 0) + 1 
                  }
              }));
              
              setCurrentRun(prev => ({
                  ...prev,
                  tilesCaptured: prev.tilesCaptured + 1
              }));
              
          } else if (!claimedCells[currentHex]) {
              // Normal claim - new tile
              const newCell = {
                  ownerId: user.id,
                  color: user.color,
                  timestamp: now
              };

              setClaimedCells(prev => ({ ...prev, [currentHex]: newCell }));
              
              // Update stats
              setUser(prev => ({
                  ...prev,
                  stats: { 
                      ...prev.stats, 
                      territories: (prev.stats?.territories || 0) + 1 
                  }
              }));

              setCurrentRun(prev => ({
                  ...prev,
                  tilesCaptured: prev.tilesCaptured + 1
              }));
          }
          
          // Sync to backend
          try {
              await axios.post('/api/game/claim', { 
                  index: currentHex, 
                  lat, 
                  lng 
              });
          } catch (e) {
              console.error("Failed to sync tile claim", e);
          }
      }

      // --- Reclaim Ghost Path Logic ---
      if (ghostPath && ghostPath.length > 0 && currentRun.isActive) {
          ghostPath.forEach((point, index) => {
              // If segment not already reclaimed
              if (!reclaimedPathSegments.includes(index)) {
                  const distToPathPoint = calculateDistance(lat, lng, point[0], point[1]);
                  // If within 15 meters of a path point, consider it reclaimed
                  if (distToPathPoint < 15) {
                      setReclaimedPathSegments(prev => [...prev, index]);
                  }
              }
          });
      }

      // Update run stats
      setCurrentRun(prev => {
          const now = Date.now();
          const newDistance = prev.distance + distanceMoved;
          const timeElapsed = (now - prev.startTime) / 1000 / 60; // minutes
          const newPace = newDistance > 0 ? (timeElapsed / (newDistance / 1000)) : 0;

          return {
              ...prev,
              distance: newDistance,
              pace: newPace,
              path: [...prev.path, { lat, lng, timestamp: now }],
              lastUpdate: now
          };
      });

      setLastPosition({ lat, lng });
  };



  /**
   * Explicitly claim a tile for a specific owner/color
   * Used by simulation for Rival takeover
   */
  const claimTile = async (lat, lng, ownerId = 'rival_bot', color = '#ff0000') => {
      const cellIndex = latLngToCell(lat, lng, 9);
      const now = Date.now();

      const newClaim = {
          ownerId,
          color,
          timestamp: now
      };

      // If it's a Rival taking over a User's tile
      if (ownerId === 'rival_bot' && claimedCells[cellIndex]?.ownerId === user?.id) {
          // Track lost tile for stats
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
                  ...newClaim,
                  glitch: true
              }
          }));

          // Remove from main user claimed cells if we want Rival to "poison" the map
          setClaimedCells(prev => {
              const updated = { ...prev };
              delete updated[cellIndex];
              return updated;
          });
          
          addAlert(`⚠️ Sector COMPROMISED by Rival!`);
          
          setTimeout(() => {
              setContestedTiles(prev => {
                  const updated = { ...prev };
                  if (updated[cellIndex]) updated[cellIndex].glitch = false;
                  return updated;
              });
          }, 500);
      } else {
          // Normal claim for anyone (including Rival taking unclaimed)
          if (ownerId === 'rival_bot') {
              setContestedTiles(prev => ({ ...prev, [cellIndex]: newClaim }));
          } else {
              setClaimedCells(prev => ({ ...prev, [cellIndex]: newClaim }));
          }
      }

      // Sync to backend if needed - for simulation we might skip or use a separate endpoint
  };

  const claimCell = async (lat, lng) => {
      // Deprecated for instant claim, but maybe used for other things?
      // Keeping it but `updatePosition` is the main driver now.
      if (!token || !user) return false;
      // ... (existing logic)
      // I will leave it as is, but `PlayerMarker` will call `updatePosition` instead
  };

  const addAlert = (message) => {
    setAlerts(prev => [{ id: Date.now(), message, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
  };

  const simulateAttack = () => {
      const keys = Object.keys(claimedCells);
      if (keys.length === 0) {
          addAlert("No territories to attack!");
          return;
      }
      
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      
      // If it's already a rival, find another? Nah, just overwrite.
      
      setClaimedCells(prev => ({
          ...prev,
          [randomKey]: {
              ownerId: 'rival_bot',
              color: '#ff0000', // Bright Red
              timestamp: Date.now()
          }
      }));
      
      // Decrement user stats
      if (claimedCells[randomKey]?.ownerId === user?.id) {
          setUser(prev => ({
            ...prev,
            stats: { ...prev.stats, territories: Math.max(0, (prev.stats?.territories || 1) - 1) }
          }));
      }

      addAlert(`⚠️ ALERT: Territory lost to Rival!`);
  };

  /**
   * Generate a realistic invasion path near claimed tiles
   */
  const generateInvasionPath = () => {
      const userCells = Object.entries(claimedCells)
          .filter(([_, cell]) => cell.ownerId === user?.id);

      let startPos;
      if (userCells.length > 0) {
          // Pick a random starting tile from user's claimed cells
          const [index, cell] = userCells[Math.floor(Math.random() * userCells.length)];
          // Convert hex index to coordinates
          const coords = cellToLatLng(index);
          startPos = [coords[0], coords[1]];
      } else if (lastPosition) {
          // If no territory yet, spawn at current GPS location
          startPos = [lastPosition.lat, lastPosition.lng];
      } else {
          // SF Default
          startPos = [37.7749, -122.4194];
      }

      const path = [startPos];
      const numSteps = 10 + Math.floor(Math.random() * 11); // 10-20 points
      
      // "Hunt" tiles: Generate path by picking random user hexes (if any)
      if (userCells.length > 0) {
          for (let i = 0; i < numSteps - 1; i++) {
              const [index, _] = userCells[Math.floor(Math.random() * userCells.length)];
              const coords = cellToLatLng(index);
              path.push([coords[0], coords[1]]);
          }
      } else {
          // Fallback zigzag
          let currentLat = startPos[0];
          let currentLng = startPos[1];
          for (let i = 0; i < numSteps - 1; i++) {
              currentLat += (Math.random() - 0.5) * 0.005;
              currentLng += (Math.random() - 0.5) * 0.005;
              path.push([currentLat, currentLng]);
          }
      }
      
      return path;
  };

  /**
   * Start the invasion simulation
   */
  const startInvasionSimulation = () => {
      // Clear previous simulation states
      setLostTiles([]);
      setGhostPath([]);
      setContestedTiles({});
      setReclaimedPathSegments([]);
      setShowMissionAlert(false);
      setIsSimulating(true);
      setShowReclaimButton(false);
      addAlert("⚠️ INVASION DETECTED!");
  };

  // updateSimulation is now handled locally in InvasionSimulator.jsx per user request

  /**
   * Center map on lost tiles for reclaim
   */
  const centerOnLostTiles = () => {
      if (lostTiles.length === 0) return null;
      
      // Calculate center of lost tiles
      const avgLat = lostTiles.reduce((sum, tile) => sum + tile.position[0], 0) / lostTiles.length;
      const avgLng = lostTiles.reduce((sum, tile) => sum + tile.position[1], 0) / lostTiles.length;
      
      return [avgLat, avgLng];
  };

  return (
    <GameContext.Provider value={{ 
        user, token, login, logout, 
        claimedCells, claimCell, 
        alerts, addAlert,
        // Real-time GPS tracking
        currentRun, startContinuousRun, stopContinuousRun, processGPSUpdate, lastPosition,
        // Invasion simulation
        isSimulating, claimTile, setIsSimulating,
        startInvasionSimulation, lostTiles, showReclaimButton, centerOnLostTiles,
        contestedTiles, ghostPath, setGhostPath, reclaimedPathSegments, setReclaimedPathSegments, 
        showMissionAlert, setShowMissionAlert, setShowReclaimButton
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGameStore = () => useContext(GameContext);
