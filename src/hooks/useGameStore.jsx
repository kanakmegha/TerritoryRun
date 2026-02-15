import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { latLngToCell, cellToLatLng } from 'h3-js';

const GameContext = createContext();

// 1. DYNAMIC API URL: Detects if you're on local machine or deployed
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5001' 
    : window.location.origin;

axios.defaults.baseURL = API_URL;

export const GameProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  
  // ... (Keep all your other state variables exactly as they are)
  const [claimedCells, setClaimedCells] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [currentRun, setCurrentRun] = useState({ isActive: false, path: [] });
  const [tileDistanceMap, setTileDistanceMap] = useState({});
  const [lastPosition, setLastPosition] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [lostTiles, setLostTiles] = useState([]);
  const [showReclaimButton, setShowReclaimButton] = useState(false);
  const [contestedTiles, setContestedTiles] = useState({});
  const [ghostPath, setGhostPath] = useState([]);
  const [reclaimedPathSegments, setReclaimedPathSegments] = useState([]); 
  const [showMissionAlert, setShowMissionAlert] = useState(false);

  // 2. UPDATED AUTH HEADER: Automatically applies token when found
  useEffect(() => {
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        refreshMap();
    }
  }, [token]);

  const login = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('token', userToken);
    // Explicitly set header for current session
    axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
    refreshMap();
  };

  // ... (Keep the rest of your refreshMap, startContinuousRun, processGPSUpdate, and claimTile logic)
  // They will now work perfectly because axios.defaults.baseURL is set
}