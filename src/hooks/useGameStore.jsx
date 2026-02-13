import { createContext, useContext, useState, useEffect } from 'react';
import { latLngToCell } from 'h3-js';

const GameContext = createContext();

const STORAGE_KEY = 'territory-run-data';

export const GameProvider = ({ children }) => {
  const [user, setUser] = useState({
    id: 'user-1',
    name: 'Runner One',
    color: '#00f3ff', // Default Neon Blue
    stats: {
      distance: 0,
      territories: 0
    }
  });

  const [claimedCells, setClaimedCells] = useState({});
  const [alerts, setAlerts] = useState([]); // List of recent territory losses or attacks

  // Load data on mount and check for decay
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      if (data.user) setUser(data.user);
      
      if (data.claimedCells) {
        // Implement Decay: Remove cells older than 72 hours
        const now = Date.now();
        const decayTime = 72 * 60 * 60 * 1000; // 72 hours in ms
        
        const activeCells = Object.entries(data.claimedCells).reduce((acc, [key, cell]) => {
            if (now - cell.timestamp < decayTime) {
                acc[key] = cell;
            }
            return acc;
        }, {});
        
        setClaimedCells(activeCells);
      }
    }
  }, []);

  // Save data on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, claimedCells }));
  }, [user, claimedCells]);

  const claimCell = (lat, lng) => {
    // Resolution 9 is roughly city block size (~0.1km^2 edge length)
    const cellIndex = latLngToCell(lat, lng, 9);
    
    // If not already owned by us, claim it
    if (claimedCells[cellIndex]?.ownerId !== user.id) {
      const newClaim = {
        ownerId: user.id,
        color: user.color,
        timestamp: Date.now()
      };
      
      setClaimedCells(prev => ({
        ...prev,
        [cellIndex]: newClaim
      }));

      // Update stats
      setUser(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          territories: Object.keys(claimedCells).length + 1 // crude count
        }
      }));
      
      return true; // Claim successful
    }
    return false;
  };

  const addAlert = (message) => {
    setAlerts(prev => [{ id: Date.now(), message, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 5));
  };

  return (
    <GameContext.Provider value={{ user, claimedCells, claimCell, alerts, addAlert }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGameStore = () => useContext(GameContext);
