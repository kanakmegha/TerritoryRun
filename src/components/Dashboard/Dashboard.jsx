import React from 'react';
import { useGameStore } from '../../hooks/useGameStore';
import StatsCard from './StatsCard';
import { Trophy, Map, Activity, AlertTriangle } from 'lucide-react';

const Dashboard = () => {
  const { 
    user, alerts, logout, isSimulating,
    startInvasionSimulation, showReclaimButton,
    showMissionAlert, setShowMissionAlert, startContinuousRun,
    currentRun, addAlert
  } = useGameStore();
  
  // 1. Safety Guard: Prevent crash if user stats haven't loaded yet
  if (!user || !user.stats) {
    return (
      <div className="loading-overlay">
        <div className="cyber-spinner"></div>
        <p>INITIALIZING PROTOCOL...</p>
      </div>
    );
  }

  const handleReclaim = () => {
      try {
        addAlert("⚔️ Reclaim activated! GPS tracking starting...");
        startContinuousRun(); 
        
        // Use a safer check for global window functions
        if (typeof window !== 'undefined' && window.territoryRun_centerOnLostTiles) {
            window.territoryRun_centerOnLostTiles();
        }
      } catch (err) {
        console.error("Reclaim error:", err);
      }
  };

  // 2. Rank Calculation Logic with fallback to avoid Division by Zero
  const territories = user.stats?.territories || 0;
  const rankValue = territories > 0 
    ? `#${Math.floor(1000 / (territories + 1))}` 
    : "N/A";

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1 className="cyber-glitch" data-text="TERRITORY RUN">TERRITORY RUN</h1>
        <div className="user-profile">
            <div className="avatar" style={{ background: user.color || 'var(--neon-blue)' }}></div>
            <div className="user-info">
                <span>{user.name || user.username || "Agent"}</span>
                <button className="logout-btn" onClick={logout}>LOGOUT</button>
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
            icon={Map} 
        />
        <StatsCard 
            label="Distance" 
            value={`${(territories * 0.1).toFixed(1)} km`} 
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
        
        {!showReclaimButton && !isSimulating && (
            <button 
              className="sim-btn" 
              onClick={() => {
                try {
                  startInvasionSimulation();
                } catch(e) {
                  console.error("Simulation failed:", e);
                }
              }}
            >
              🔴 TEST INVASION
            </button>
        )}
        
        {showReclaimButton && (
            <button className="reclaim-btn" onClick={handleReclaim}>
                ⚔️ START RECLAIM
            </button>
        )}
      </div>

      {showMissionAlert && (
          <div className="mission-alert-overlay">
              <div className="mission-content">
                  <div className="mission-header">
                      <AlertTriangle size={24} color="var(--neon-pink)" />
                      <h2>MISSION CRITICAL</h2>
                  </div>
                  <p>Territory Compromised! Follow the Red Path to Reclaim.</p>
                  <button className="mission-btn" onClick={() => setShowMissionAlert(false)}>DISMISS</button>
              </div>
          </div>
      )}

      {/* Mobile Floating Action Button (FAB) */}
      {!currentRun.isActive && !isSimulating && (
        <div className="mobile-fab-container">
          <button className="fab-btn" onClick={startContinuousRun}>
            🏃 START TRACKING
          </button>
        </div>
      )}

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
          padding: 1.5rem;
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
        
        .sim-btn {
            margin-top: 15px; /* Increased margin */
            width: 100%;
            background: rgba(255, 0, 85, 0.2);
            border: 1px solid var(--neon-pink);
            color: var(--neon-pink);
            padding: 15px; /* Better touch target */
            font-size: 1rem; /* Easier to read */
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            cursor: pointer;
            z-index: 9999;
        }

        .reclaim-btn {
            width: 100%;
            background: var(--neon-blue);
            color: black;
            padding: 18px; /* Massive touch target */
            font-size: 1.1rem;
            font-weight: 900;
            border: none;
            box-shadow: 0 0 20px var(--neon-blue);
            animation: pulse-reclaim 1.5s infinite;
            z-index: 9999;
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
        @media (max-height: 700px) {
          .stats-grid {
            max-height: 80px;
            overflow-y: auto;
            margin-top: 0.5rem;
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

        .mobile-fab-container {
          display: none;
          position: fixed;
          bottom: 25px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 2000;
          width: 80%;
          max-width: 300px;
          pointer-events: auto;
        }

        .fab-btn {
          width: 100%;
          background: var(--neon-blue);
          color: black;
          border: none;
          padding: 15px 25px;
          font-weight: 900;
          font-family: inherit;
          border-radius: 30px;
          box-shadow: 0 0 20px var(--neon-blue);
          cursor: pointer;
          font-size: 1rem;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .fab-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 0 30px var(--neon-blue);
        }

        @media (max-width: 768px) {
          .mobile-fab-container {
            display: block;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;