import { useGameStore } from '../../hooks/useGameStore';
import StatsCard from './StatsCard';
import { Trophy, Map, Activity, AlertTriangle } from 'lucide-react';
import { latLngToCell, cellToLatLng, cellToBoundary } from 'h3-js';

const Dashboard = () => {
  const { user, claimedCells, claimCell, alerts, addAlert } = useGameStore();

  const simulateRival = () => {
    // Simulate losing a territory
    const claimedKeys = Object.keys(claimedCells);
    if (claimedKeys.length > 0) {
       const randomKey = claimedKeys[Math.floor(Math.random() * claimedKeys.length)];
       // Check if cellToBoundary works
       try {
           // We are just simulating an alert for now as we don't have a backend to actually change ownership
           addAlert(`Territory at ${randomKey.substring(0, 8)}... under attack!`);
       } catch (e) {
           console.error(e);
       }
    } else {
        addAlert("No territories to attack yet!");
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1 className="cyber-glitch" data-text="TERRITORY RUN">TERRITORY RUN</h1>
        <div className="user-profile">
            <div className="avatar" style={{ background: user.color }}></div>
            <span>{user.name}</span>
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
        <button className="sim-btn" onClick={simulateRival}>SIMULATE ATTACK</button>
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
            margin-top: 10px;
            width: 100%;
            background: rgba(255, 0, 255, 0.2);
            border: 1px solid var(--neon-pink);
            color: var(--neon-pink);
            padding: 5px;
            cursor: pointer;
            font-family: inherit;
            font-size: 0.7rem;
            border-radius: 4px;
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
