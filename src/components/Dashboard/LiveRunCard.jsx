import { useGameStore } from '../../hooks/useGameStore';
import { Navigation, Activity, X } from 'lucide-react';

const LiveRunCard = () => {
    const { currentRun, stopTracking, activeGameMode } = useGameStore();

    if (!currentRun.isActive || !activeGameMode) {
        return null; // Hidden when not tracking
    }

    const formatDistance = (meters) => {
        if (meters < 1000) return `${meters.toFixed(0)} m`;
        return `${(meters / 1000).toFixed(2)} km`;
    };

    const distanceDisplay = formatDistance(currentRun.distance || 0);
    const paceMinKm = currentRun.pace > 0 ? currentRun.pace.toFixed(1) : '--';
    const modeLabel = activeGameMode === 'claim' ? 'CLAIM SECURE' : 'END ATTACK';

    return (
        <div className="live-run-card active">
            <div className="run-header">
                <h3>{activeGameMode === 'claim' ? 'MAPPING TERRITORY VECTOR' : 'ATTACK PROTOCOL ACTIVE'}</h3>
            </div>
            
            <div className="run-stats">
                <div className="stat-item">
                    <Activity size={16} className="stat-icon" />
                    <div className="stat-content">
                        <div className="stat-label">Vector Length</div>
                        <div className="stat-value">{distanceDisplay}</div>
                    </div>
                </div>

                <div className="stat-divider"></div>

                <div className="stat-item">
                    <Navigation size={16} className="stat-icon" />
                    <div className="stat-content">
                        <div className="stat-label">Velocity</div>
                        <div className="stat-value">{paceMinKm} min/km</div>
                    </div>
                </div>
            </div>

            <button className="stop-tracking-btn" onClick={stopTracking}>
                <X size={18} /> {modeLabel}
            </button>

            <style>{`
                .live-run-card {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 2000;
                    padding: 20px;
                    background: rgba(0, 0, 0, 0.9);
                    border: 2px solid var(--neon-blue);
                    border-radius: 16px;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 0 30px rgba(0, 255, 234, 0.5);
                    width: 90%;
                    max-width: 450px;
                }

                .run-header {
                    text-align: center;
                    margin-bottom: 15px;
                    border-bottom: 1px solid rgba(0, 255, 234, 0.3);
                    padding-bottom: 10px;
                }
                
                .run-header h3 {
                    margin: 0;
                    font-size: 0.9rem;
                    color: var(--neon-pink);
                    letter-spacing: 2px;
                    animation: blink 2s infinite;
                }
                
                /* Dynamic color based on mode */
                ${activeGameMode === 'claim' ? `
                    .live-run-card { border-color: var(--neon-blue); box-shadow: 0 0 30px rgba(0, 255, 234, 0.3); }
                    .run-header h3 { color: var(--neon-blue); }
                    .stat-icon { color: var(--neon-blue); }
                    .stat-value { color: var(--neon-blue); }
                ` : `
                    .live-run-card { border-color: var(--neon-pink); box-shadow: 0 0 30px rgba(255, 0, 85, 0.3); }
                    .run-header h3 { color: var(--neon-pink); }
                    .stat-icon { color: var(--neon-pink); }
                    .stat-value { color: var(--neon-pink); }
                `}

                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }

                .run-stats {
                    display: flex;
                    justify-content: space-around;
                    align-items: center;
                    margin-bottom: 20px;
                }

                .stat-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .stat-content {
                    display: flex;
                    flex-direction: column;
                }

                .stat-label {
                    font-size: 0.7rem;
                    color: #888;
                    text-transform: uppercase;
                }

                .stat-value {
                    font-size: 1.2rem;
                    font-weight: bold;
                }

                .stat-divider {
                    width: 1px;
                    height: 40px;
                    background: rgba(255, 255, 255, 0.2);
                }

                .stop-tracking-btn {
                    width: 100%;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    padding: 12px;
                    font-size: 1rem;
                    font-weight: bold;
                    cursor: pointer;
                    border-radius: 8px;
                    font-family: inherit;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.2s;
                }

                .stop-tracking-btn:hover {
                    background: white;
                    color: black;
                }

                .stop-tracking-btn:active {
                    transform: scale(0.98);
                }
            `}</style>
        </div>
    );
};

export default LiveRunCard;
