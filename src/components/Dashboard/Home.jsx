import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../hooks/useGameStore';
import { Map, Flag, Play } from 'lucide-react';

const Home = () => {
    const navigate = useNavigate();
    const { user, logout } = useGameStore();

    if (!user) return null;

    return (
        <div className="home-wrapper">
            <header className="dashboard-header">
                <h1 className="cyber-glitch" data-text="TERRITORY RUN">TERRITORY RUN</h1>
                <div className="user-profile">
                    <div className="avatar" style={{ background: user.color || 'var(--neon-blue)' }}></div>
                    <div className="user-info">
                        <span>{user.name || user.username || "Agent"}</span>
                        <button className="logout-btn" onClick={() => {
                            logout();
                            navigate('/');
                        }}>LOGOUT</button>
                    </div>
                </div>
            </header>

            <div className="hub-content">
                <div className="stat-card giant-stat">
                    <h3>Territories Controlled</h3>
                    <div className="value">{user.stats?.territories || 0}</div>
                </div>

                <div className="action-grid">
                    <button className="action-btn claim-mode" onClick={() => navigate('/map?mode=claim')}>
                        <Flag size={32} />
                        <h2>CLAIM TERRITORY</h2>
                        <p>Map a new polygon vector manually</p>
                    </button>

                    <button className="action-btn run-mode" onClick={() => navigate('/map?mode=run')}>
                        <Play size={32} />
                        <h2>START RUN</h2>
                        <p>Aggressive territory acquisition protocol</p>
                    </button>
                    
                    <button className="action-btn view-map" onClick={() => navigate('/map?mode=view')}>
                        <Map size={32} />
                        <h2>VIEW MAP</h2>
                        <p>Analyze global vectors</p>
                    </button>
                </div>
            </div>

            <style>{`
                .home-wrapper {
                    height: 100vh;
                    background: #050505;
                    color: var(--neon-blue);
                    display: flex;
                    flex-direction: column;
                    padding: 20px;
                    box-sizing: border-box;
                }
                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 40px;
                }
                .user-profile {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    background: rgba(0,255,234,0.05);
                    padding: 10px 20px;
                    border: 1px solid var(--neon-blue);
                    border-radius: 8px;
                }
                .avatar { width: 35px; height: 35px; border-radius: 50%; box-shadow: 0 0 15px var(--neon-blue); }
                .hub-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 40px;
                    max-width: 800px;
                    margin: 0 auto;
                    width: 100%;
                }
                .giant-stat {
                    text-align: center;
                    padding: 40px;
                    background: rgba(0, 0, 0, 0.6);
                    border: 2px solid var(--neon-blue);
                    box-shadow: 0 0 40px rgba(0, 255, 234, 0.2);
                    width: 100%;
                }
                .giant-stat h3 { color: var(--neon-pink); font-size: 1.2rem; letter-spacing: 2px; }
                .giant-stat .value { font-size: 4rem; font-weight: 900; filter: drop-shadow(0 0 10px var(--neon-blue)); }
                
                .action-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    width: 100%;
                }
                .action-btn {
                    background: rgba(10, 10, 10, 0.9);
                    border: 1px solid var(--neon-blue);
                    color: var(--neon-blue);
                    padding: 30px 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 15px;
                    cursor: pointer;
                    transition: all 0.3s;
                    text-align: center;
                }
                .action-btn h2 { font-size: 1.2rem; margin: 0; }
                .action-btn p { font-size: 0.8rem; opacity: 0.7; margin: 0; }
                
                .action-btn:hover {
                    background: rgba(0, 255, 234, 0.1);
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(0, 255, 234, 0.2);
                }
                .claim-mode { border-color: var(--neon-pink); color: var(--neon-pink); }
                .claim-mode:hover { background: rgba(255, 0, 85, 0.1); box-shadow: 0 10px 30px rgba(255, 0, 85, 0.2); }
                .run-mode { background: #00f3ff; color: #000; border: none; }
                .run-mode:hover { background: #fff; box-shadow: 0 0 30px #00f3ff; }
            `}</style>
        </div>
    );
};

export default Home;
