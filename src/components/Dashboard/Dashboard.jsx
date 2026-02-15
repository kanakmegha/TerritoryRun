import { useGameStore } from '../../hooks/useGameStore';
import StatsCard from './StatsCard';
import { Trophy, Map, Activity, AlertTriangle } from 'lucide-react';
import { latLngToCell, cellToLatLng, cellToBoundary } from 'h3-js';
import { useMap } from 'react-leaflet';

const Dashboard = () => {
  const { 
    user, claimedCells, claimCell, alerts, addAlert, logout, isSimulating,
    startInvasionSimulation, showReclaimButton, centerOnLostTiles,
    showMissionAlert, setShowMissionAlert, startContinuousRun
  } = useGameStore();
  
  const handleReclaim = () => {
      addAlert("⚔️ Reclaim activated! GPS tracking starting...");
      startContinuousRun(); // Activate real GPS tracking
      // Call global function exposed by ReclaimHandler  
      if (typeof window !== 'undefined' && window.territoryRun_centerOnLostTiles) {
          window.territoryRun_centerOnLostTiles();
      }
  };

  if (!user) {
      // Fallback if user is missing but token exists (rare race condition)
      return null; 
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1 className="cyber-glitch" data-text="TERRITORY RUN">TERRITORY RUN</h1>
        <div className="user-profile">
            <div className="avatar" style={{ background: user.color }}></div>
            <div className="user-info">
                <span>{user.name || user.username}</span>
                <button className="logout-btn" onClick={logout}>LOGOUT</button>
            </div>
        </div>
      </header>

      <div className="stats-grid">
        <StatsCard 
            label="Rank" 
            value={`#${Math.floor(1000 / (user.stats.territories + 1))}`} 
            icon={Trophy} 
        />
        <StatsCard 
            label="Territories" 
            value={user.stats.territories} 
            icon={Map} 
        />
        <StatsCard 
            label="Distance" 
            value={`${(user.stats.territories * 0.1).toFixed(1)} km`} 
            icon={Activity} 
        />
      </div>

      <div className="defend-list">
        <h3><AlertTriangle size={16} color="var(--neon-pink)" /> DEFEND ALERTS</h3>
        <ul>
            {alerts.length === 0 ? <li className="empty-alert">No active threats</li> : alerts.map(alert => (
                <li key={alert.id}>
                    <span className="alert-time">{alert.time}</span>
                    <span className="alert-msg">{alert.message}</span>
                </li>
            ))}
        </ul>
        
        
        {!showReclaimButton && !isSimulating && (
            <button className="sim-btn" onClick={startInvasionSimulation}>🔴 TEST INVASION</button>
        )}
        
        {showReclaimButton && (
            <button className="reclaim-btn" onClick={handleReclaim}>
                ⚔️ START RECLAIM
            </button>
        )}
      </div>

      {/* Mission Alert Overlay */}
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

      {/* Aesthetic decorative elements */}
      <div className="scanner-line"></div>

      <style>{`
        .dashboard-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none; /* Let clicks pass through */
          padding: 2rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-sizing: border-box;
          z-index: 1000;
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
            background: rgba(0,0,0,0.6);
            padding: 8px 16px;
            border-radius: 20px;
            border: 1px solid var(--neon-blue);
        }
        
        .avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            box-shadow: 0 0 10px var(--neon-blue);
        }

        .user-info {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }

        .user-info span {
            font-size: 0.9rem;
            font-weight: bold;
        }

        .logout-btn {
            background: transparent;
            border: none;
            color: var(--neon-pink);
            font-size: 0.7rem;
            cursor: pointer;
            padding: 0;
            text-decoration: underline;
        }
        .logout-btn:hover {
            color: white;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            pointer-events: auto;
            margin-bottom: auto; /* Push to top */
            margin-top: 2rem;
        }

        .defend-list {
            pointer-events: auto;
            background: rgba(20, 0, 0, 0.6);
            border: 1px solid var(--neon-pink);
            border-radius: 12px;
            padding: 1rem;
            margin-top: 1rem;
            max-width: 300px;
        }
        
        .defend-list h3 {
            margin: 0 0 10px 0;
            font-size: 0.9rem;
            color: var(--neon-pink);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .defend-list ul {
            list-style: none;
            padding: 0;
            margin: 0;
            font-size: 0.8rem;
        }
        
        .defend-list li {
            margin-bottom: 5px;
            border-bottom: 1px solid rgba(255, 0, 255, 0.2);
            padding-bottom: 5px;
        }

        .alert-time {
            color: #888;
            margin-right: 8px;
            font-size: 0.7rem;
        }


        .sim-btn {
            margin-top: 20px;
            width: 100%;
            background: rgba(255, 0, 255, 0.1);
            border: 1px solid var(--neon-pink);
            color: var(--neon-pink);
            padding: 8px;
            cursor: pointer;
            font-family: inherit;
            font-size: 0.7rem;
            border-radius: 4px;
        }
        
        .reclaim-btn {
            margin-top: 10px;
            width: 100%;
            background: rgba(0, 255, 234, 0.2);
            border: 2px solid var(--neon-blue);
            color: var(--neon-blue);
            padding: 12px;
            cursor: pointer;
            font-family: inherit;
            font-size: 0.8rem;
            font-weight: bold;
            border-radius: 4px;
            box-shadow: 0 0 10px var(--neon-blue);
            animation: pulse-reclaim 2s ease-in-out infinite;
        }
        
        @keyframes pulse-reclaim {
            0%, 100% { box-shadow: 0 0 10px var(--neon-blue); }
            50% { box-shadow: 0 0 20px var(--neon-blue), 0 0 30px var(--neon-blue); }
        }
        
        .run-controls {
            margin-top: 15px;
            width: 100%;
        }

        .run-btn {
            width: 100%;
            padding: 12px;
            font-family: inherit;
            font-weight: bold;
            font-size: 1rem;
            cursor: pointer;
            border: none;
            clip-path: polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%);
            transition: all 0.2s;
        }

        .run-btn.start {
            background: var(--neon-blue);
            color: black;
            box-shadow: 0 0 15px var(--neon-blue);
        }
        
        .run-btn.finish {
            background: var(--neon-pink);
            color: white;
            box-shadow: 0 0 15px var(--neon-pink);
        }

        .run-btn:active {
            transform: scale(0.98);
        }

        .blink {
            animation: blinker 1s linear infinite;
        }

        @keyframes blinker {
            50% { opacity: 0; }
        }
        .sim-btn:hover {
            background: rgba(255, 0, 255, 0.4);
        }

        .sim-v2-btn {
            margin-top: 8px;
            width: 100%;
            background: rgba(0, 255, 234, 0.1);
            border: 1px solid var(--neon-blue);
            color: var(--neon-blue);
            padding: 8px;
            cursor: pointer;
            font-family: inherit;
            font-size: 0.7rem;
            border-radius: 4px;
        }

        .sim-v2-btn:hover {
            background: rgba(0, 255, 234, 0.3);
        }

        h1 {
            margin: 0;
            font-size: 2rem;
            font-weight: 900;
            letter-spacing: 2px;
            text-shadow: 2px 2px 0px var(--neon-pink);
        }
        
        /* Scanline effect */
        .dashboard-container::before {
            content: " ";
            display: block;
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            right: 0;
            background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
            z-index: 2;
            background-size: 100% 2px, 3px 100%;
            pointer-events: none;
        }

        .mission-alert-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 5000;
            pointer-events: auto;
            backdrop-filter: blur(5px);
        }

        .mission-content {
            background: rgba(20, 0, 0, 0.9);
            border: 2px solid var(--neon-pink);
            padding: 2.5rem;
            border-radius: 8px;
            text-align: center;
            max-width: 400px;
            box-shadow: 0 0 50px rgba(255, 0, 85, 0.3);
            animation: mission-emerge 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes mission-emerge {
            from { transform: scale(0.8) translateY(50px); opacity: 0; }
            to { transform: scale(1) translateY(0); opacity: 1; }
        }

        .mission-header {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin-bottom: 1rem;
        }

        .mission-header h2 {
            margin: 0;
            color: var(--neon-pink);
            letter-spacing: 4px;
            font-size: 1.5rem;
        }

        .mission-content p {
            color: #ddd;
            margin-bottom: 2rem;
            line-height: 1.5;
        }

        .mission-btn {
            background: var(--neon-pink);
            color: white;
            border: none;
            padding: 12px 30px;
            font-family: inherit;
            font-weight: bold;
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.2s;
        }

        .mission-btn:hover {
            background: white;
            color: var(--neon-pink);
            box-shadow: 0 0 20px white;
        }

      `}</style>
    </div>
  );
};

export default Dashboard;
