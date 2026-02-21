import { useEffect, useState, useRef } from 'react';
import { Marker, useMap } from 'react-map-gl';
import { useGameStore } from '../../hooks/useGameStore';

const PlayerMarker = () => {
    const { current: map } = useMap();
    const { lastPosition, gpsStatus, isCameraLocked } = useGameStore();
    const hasCentered = useRef(false);
    const [animatedPos, setAnimatedPos] = useState(null);

    const isValidPos = (pos) => pos && typeof pos.lat === 'number' && typeof pos.lng === 'number' && !isNaN(pos.lat) && !isNaN(pos.lng);

    // Initial positioning
    useEffect(() => {
        if (isValidPos(lastPosition) && !hasCentered.current && map) {
            // Check if map is loaded and ready before calling methods that require it
            try {
                map.flyTo({ center: [lastPosition.lng, lastPosition.lat], zoom: 18, duration: 1500 });
                setAnimatedPos([lastPosition.lng, lastPosition.lat]);
                hasCentered.current = true;
            } catch (e) {
                console.warn("Map not ready for flyTo yet");
            }
        }
    }, [lastPosition, map]);

    // Pro: Lazy Follow & Smooth Auto-centering
    useEffect(() => {
        if (!isValidPos(lastPosition)) return;
        
        const newPos = [lastPosition.lng, lastPosition.lat]; // Mapbox uses [lng, lat]
        
        // Handle Auto-follow with threshold (Lazy Follow)
        if (isCameraLocked && map) {
            try {
                map.panTo({ center: newPos, duration: 1200 });
                hasCentered.current = true;
            } catch (e) {
                console.warn("Map not ready for panTo yet");
            }
        }

        setAnimatedPos(newPos);
    }, [lastPosition, map, isCameraLocked]);

    if (gpsStatus !== 'locked' || !animatedPos) {
        return (
            <div className="locating-overlay">
                <div className="locating-spinner"></div>
                <span>LOCATING RUNNER...</span>
                <style>{`
                    .locating-overlay {
                        position: fixed;
                        bottom: 100px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: rgba(0, 0, 0, 0.8);
                        padding: 10px 20px;
                        border-radius: 20px;
                        border: 1px solid var(--neon-blue);
                        color: var(--neon-blue);
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        z-index: 9999;
                        font-family: monospace;
                        box-shadow: 0 0 15px rgba(0, 243, 255, 0.3);
                    }
                    .locating-spinner {
                        width: 15px;
                        height: 15px;
                        border: 2px solid var(--neon-blue);
                        border-top-color: transparent;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <>
            <Marker 
                longitude={animatedPos[0]}
                latitude={animatedPos[1]}
                anchor="center"
            >
                <div className="gps-marker-container">
                    <div className="player-dot"></div>
                </div>
            </Marker>
            
            {/* CSS for glowing GPS marker with Smooth Glide */}
            <style>{`
                .gps-marker-container {
                    background: transparent;
                    pointer-events: none;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .player-dot {
                    width: 20px;
                    height: 20px;
                    background: #00ffea;
                    border-radius: 50%;
                    box-shadow: 0 0 15px #00ffea, 0 0 30px #00ffea;
                    animation: gps-pulse 2s ease-in-out infinite;
                }
                
                @keyframes gps-pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.2); opacity: 0.8; }
                }
            `}</style>
        </>
    );
};

export default PlayerMarker;
