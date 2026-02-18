import { useGameStore } from '../../hooks/useGameStore';
import { Navigation, Activity, MapPin } from 'lucide-react';

const LiveRunCard = () => {
    const { currentRun, startContinuousRun, stopContinuousRun } = useGameStore();

    if (!currentRun.isActive) {
        return (
            <div className="live-run-card">
                <button className="start-tracking-btn" onClick={startContinuousRun}>
                    <Navigation size={20} />
                    START TRACKING
                </button>

                <style>{`
                    .live-run-card {
                        position: fixed;
                        bottom: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        z-index: 2000;
                        padding: 15px 30px;
                        background: rgba(0, 0, 0, 0.85);
                        border: 2px solid var(--neon-blue);
                        border-radius: 12px;
                        backdrop-filter: blur(10px);
                        box-shadow: 0 0 20px rgba(0, 255, 234, 0.3);
                        width: auto;
                        min-width: 250px;
                        max-width: 90%;
                    }

                    .start-tracking-btn {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        background: var(--neon-blue);
                        color: black;
                        border: none;
                        padding: 12px 24px;
                        font-size: 1rem;
                        font-weight: bold;
                        cursor: pointer;
                        border-radius: 8px;
                        font-family: inherit;
                        box-shadow: 0 0 15px var(--neon-blue);
                        transition: all 0.2s;
                    }

                    .start-tracking-btn:hover {
                        transform: scale(1.05);
                        box-shadow: 0 0 25px var(--neon-blue);
                    }

                    .start-tracking-btn:active {
                        transform: scale(0.98);
                    }
                `}</style>
            </div>
        );
    }

    const formatDistance = (meters) => {
        if (meters < 50) return `${(meters * 100).toFixed(0)} cm`;
        if (meters < 500) return `${meters.toFixed(1)} m`;
        return `${(meters / 1000).toFixed(2)} km`;
    };

    const distanceDisplay = formatDistance(currentRun.distance || 0);
    const paceMinKm = currentRun.pace > 0 ? currentRun.pace.toFixed(1) : '--';

    return (
        <div className="live-run-card active">
            <div className="run-stats">
                <div className="stat-item">
                    <Activity size={16} className="stat-icon" />
                    <div className="stat-content">
                        <div className="stat-label">Distance</div>
                        <div className="stat-value">{distanceDisplay}</div>
                    </div>
                </div>

                <div className="stat-divider"></div>

                <div className="stat-item">
                    <Navigation size={16} className="stat-icon" />
                    <div className="stat-content">
                        <div className="stat-label">Pace</div>
                        <div className="stat-value">{paceMinKm} min/km</div>
                    </div>
                </div>

                <div className="stat-divider"></div>

                <div className="stat-item">
                    <MapPin size={16} className="stat-icon" />
                    <div className="stat-content">
                        <div className="stat-label">Tiles</div>
                        <div className="stat-value">{currentRun.tilesCaptured}</div>
                    </div>
                </div>
            </div>

            <button className="stop-tracking-btn" onClick={stopContinuousRun}>
                STOP RUN
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
                    min-width: unset;
                }

                .live-run-card.active {
                    border-color: var(--neon-blue);
                    animation: card-pulse 2s ease-in-out infinite;
                }

                @keyframes card-pulse {
                    0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 234, 0.3); }
                    50% { box-shadow: 0 0 40px rgba(0, 255, 234, 0.6); }
                }

                .run-stats {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }

                .stat-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .stat-icon {
                    color: var(--neon-blue);
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
                    font-size: 1.1rem;
                    font-weight: bold;
                    color: var(--neon-blue);
                }

                .stat-divider {
                    width: 1px;
                    height: 40px;
                    background: rgba(0, 255, 234, 0.2);
                }

                .stop-tracking-btn {
                    width: 100%;
                    background: rgba(255, 0, 85, 0.2);
                    color: var(--neon-pink);
                    border: 2px solid var(--neon-pink);
                    padding: 10px;
                    font-size: 0.9rem;
                    font-weight: bold;
                    cursor: pointer;
                    border-radius: 8px;
                    font-family: inherit;
                    transition: all 0.2s;
                }

                .stop-tracking-btn:hover {
                    background: rgba(255, 0, 85, 0.4);
                    box-shadow: 0 0 15px var(--neon-pink);
                }

                .stop-tracking-btn:active {
                    transform: scale(0.98);
                }

                @media (max-width: 768px) {
                    /* Hide the default card button on mobile since we have the FAB in Dashboard */
                    .live-run-card:not(.active) {
                        display: none;
                    }
                    .live-run-card.active {
                        bottom: 10px;
                        padding: 15px;
                    }
                    .run-stats {
                        flex-direction: column;
                        gap: 10px;
                    }
                    .stat-divider {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
};

export default LiveRunCard;
