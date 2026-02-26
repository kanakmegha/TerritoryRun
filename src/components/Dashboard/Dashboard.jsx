import React, { useEffect } from 'react';
import { useGameStore } from '../../hooks/useGameStore';
import { useNavigate, useLocation } from 'react-router-dom';
import StatsCard from './StatsCard';
import { Trophy, Map as MapIcon, Activity, AlertTriangle, ArrowLeft } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { 
    user, alerts, logout, activeGameMode, startTracking,
    currentRun, addAlert, simulateStep,
    isCameraLocked, setCameraLocked
  } = useGameStore();

  // Check URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    
    if (mode === 'claim' || mode === 'run') {
        if (!currentRun.isActive) {
            startTracking(mode);
        }
    }
  }, [location, startTracking, currentRun.isActive]);
  
  // 1. Safety Guard: Prevent crash if user stats haven't loaded yet
  if (!user || !user.stats) {
    return (
      <div className="loading-overlay">
        <div className="cyber-spinner"></div>
        <p>INITIALIZING PROTOCOL...</p>
      </div>
    );
  }



  // 2. Rank Calculation Logic with fallback to avoid Division by Zero
  const territories = user.stats?.territories || 0;
  const rankValue = territories > 0 
    ? `#${Math.floor(1000 / (territories + 1))}` 
    : "N/A";

  // 3. Unit Formatting: CMS if < 50m for indoor testing
  const formatDistanceValue = (meters) => {
    if (meters < 50) {
      return `${(meters * 100).toFixed(0)} cm`;
    }
    if (meters < 500) {
      return `${meters.toFixed(1)} m`;
    }
    return `${(meters / 1000).toFixed(2)} km`;
  };


  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="left-controls">
            <button className="back-btn" onClick={() => navigate('/home')}>
                <ArrowLeft size={24} />
            </button>
            <h1 className="cyber-glitch" data-text="TERRITORY RUN">TERRITORY RUN</h1>
        </div>
        <div className="user-profile">
            <button 
              className={`camera-toggle ${isCameraLocked ? 'locked' : ''}`}
              onClick={() => setCameraLocked(!isCameraLocked)}
              title={isCameraLocked ? "Unlock Camera" : "Lock Camera to Player"}
            >
              {isCameraLocked ? "🔒" : "🔓"}
            </button>
            <div className="avatar" style={{ background: user.color || 'var(--neon-blue)' }}></div>
            <div className="user-info">
                <span>{user.name || user.username || "Agent"}</span>
            </div>
        </div>
      </header>

      <div className="stats-grid">
        <StatsCard 
            label="Rank" 
            value={rankValue} 
            icon={Trophy} 
        />
        <StatsCard 
            label="Territories" 
            value={territories} 
            icon={MapIcon} 
        />
        <StatsCard 
            label="Distance" 
            value={formatDistanceValue(territories * 1)} // Updated for level 15 (~1m)
            icon={Activity} 
        />
      </div>

      <div className="defend-list">
        <h3><AlertTriangle size={16} color="var(--neon-pink)" /> DEFEND ALERTS</h3>
        <ul>
            {alerts && alerts.length === 0 ? (
                <li className="empty-alert">No active threats</li>
            ) : (
                alerts.map((alert, index) => (
                    // FIX: Unique key using index + timestamp to prevent React duplicate key errors
                    <li key={`alert-${alert.id}-${index}`}>
                        <span className="alert-time">{alert.time}</span>
                        <span className="alert-msg">{alert.message}</span>
                    </li>
                ))
            )}
        </ul>
        


        {/* DEVELOPER DEBUG BUTTON */}
        <button 
          className="debug-step-btn" 
          onClick={simulateStep}
          title="Nudge GPS coordinates by ~10m"
        >
          🛠️ SIMULATE STEP
        </button>
      </div>





      <div className="scanner-line"></div>

      <style>{`
        /* Added Loading Spinner styles for Blank Screen prevention */
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: black;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          color: var(--neon-blue);
        }
        .cyber-spinner {
          width: 50px;
          height: 50px;
          border: 3px solid transparent;
          border-top: 3px solid var(--neon-blue);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .dashboard-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100svh; /* Fix for mobile address bar */
          pointer-events: none;
          padding: 10px; /* Reduced padding for mobile edges */
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          z-index: 1000;
        }

        .dashboard-container > * {
          pointer-events: auto;
        }

        .dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            pointer-events: auto;
        }
        
        .left-controls {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .back-btn {
            background: rgba(0,0,0,0.8);
            border: 1px solid var(--neon-blue);
            color: var(--neon-blue);
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: all 0.2s;
        }

        .back-btn:hover {
            background: var(--neon-blue);
            color: black;
            box-shadow: 0 0 15px var(--neon-blue);
        }

        .user-profile {
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(0,0,0,0.8);
            padding: 8px 16px;
            border-radius: 20px;
            border: 1px solid var(--neon-blue);
        }
        
        .avatar {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            box-shadow: 0 0 10px var(--neon-blue);
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0.5rem;
            pointer-events: auto;
            margin-top: 1.5rem;
            position: relative; /* Added for z-index */
            z-index: 10000; /* Force to top */
        }

        .defend-list {
            pointer-events: auto;
            background: rgba(20, 0, 0, 0.8);
            border: 1px solid var(--neon-pink);
            border-radius: 8px;
            padding: 1.5rem; /* Increased padding */
            margin-top: auto; 
            margin-bottom: 20px;
            max-width: 100%;
            z-index: 9999; /* Ensure it stays on top */
        }
        


        .camera-toggle {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 1.2rem;
            padding: 5px;
            filter: drop-shadow(0 0 5px var(--neon-blue));
            transition: transform 0.2s;
        }

        .camera-toggle.locked {
            filter: drop-shadow(0 0 8px var(--neon-blue));
        }

        .camera-toggle:hover {
            transform: scale(1.1);
        }

        .debug-step-btn {
            margin-top: 10px;
            width: 100%;
            background: rgba(0, 255, 234, 0.1);
            border: 1px dashed var(--neon-blue);
            color: var(--neon-blue);
            padding: 8px;
            font-size: 0.8rem;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.2s;
        }

        .debug-step-btn:hover {
            opacity: 1;
            background: rgba(0, 255, 234, 0.2);
        }

        @keyframes pulse-reclaim {
            0% { opacity: 0.8; }
            50% { opacity: 1; transform: scale(1.02); }
            100% { opacity: 0.8; }
        }

        .scanner-line {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: rgba(0, 255, 234, 0.3);
          box-shadow: 0 0 10px var(--neon-blue);
          animation: scan 4s linear infinite;
        }

        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }

        /* Mobile Adjustments */
        @media (max-width: 600px) {
          .stats-grid {
            display: flex;
            flex-direction: column;
            gap: 10px;
            height: auto;
            max-height: unset;
            overflow: visible;
          }
          .stats-grid > * {
            width: 100%;
          }
        }

        @media (max-height: 700px) {
          .stats-grid {
            /* Keep scrollable only if height is very small and NOT in column mode */
          }
          .defend-list {
            max-height: 150px;
            overflow-y: auto;
            margin-bottom: 70px; /* Space for FAB */
          }
          .defend-list ul {
            max-height: 80px;
            overflow-y: auto;
          }
        }


      `}</style>
    </div>
  );
};

export default Dashboard;