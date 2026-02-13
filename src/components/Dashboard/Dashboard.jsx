import { useGameStore } from '../../hooks/useGameStore';
import StatsCard from './StatsCard';
import { Trophy, Map, Activity, AlertTriangle } from 'lucide-react';
import { latLngToCell, cellToLatLng, cellToBoundary } from 'h3-js';

const Dashboard = () => {
  const { user, claimedCells, claimCell, alerts, addAlert, logout, isRunning, startRun, finishRun, currentPath, simulateAttack } = useGameStore();

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

        {/* Run Controls */}
        <div className="run-controls">
            {!isRunning ? (
                <button className="run-btn start" onClick={startRun}>START RUN</button>
            ) : (
                <button className="run-btn finish" onClick={finishRun}>
                    FINISH RUN <span className="blink">●</span>
                </button>
            )}
        </div>
        
        <button className="sim-btn" onClick={simulateAttack}>SIMULATE RIVAL ATTACK</button>
      </div>

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
      `}</style>
    </div>
  );
};

export default Dashboard;
