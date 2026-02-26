import { useEffect, useState, useRef } from 'react';
import { Marker, useMap } from 'react-map-gl';
import { useGameStore } from '../../hooks/useGameStore';

// Custom hook to smoothly interpolate GPS coordinates for Mapbox GL JS
function useLerpPosition(targetLng, targetLat, durationMs = 1200) {
    const [current, setCurrent] = useState([targetLng, targetLat]);
    const startPos = useRef([targetLng, targetLat]);
    const targetPos = useRef([targetLng, targetLat]);
    const startTime = useRef(performance.now());
    const raf = useRef(null);

    useEffect(() => {
        // If the jump is massive (initial load), skip animation
        const dLat = Math.abs(targetLat - current[1]);
        const dLng = Math.abs(targetLng - current[0]);
        if (dLat > 0.01 || dLng > 0.01 || (current[0] === 0 && current[1] === 0)) {
            setCurrent([targetLng, targetLat]);
            return;
        }

        startPos.current = current;
        targetPos.current = [targetLng, targetLat];
        startTime.current = performance.now();

        const animate = (time) => {
            const elapsed = time - startTime.current;
            const progress = Math.min(elapsed / durationMs, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 4); // ease-out

            const newLng = startPos.current[0] + (targetPos.current[0] - startPos.current[0]) * easeProgress;
            const newLat = startPos.current[1] + (targetPos.current[1] - startPos.current[1]) * easeProgress;
            
            setCurrent([newLng, newLat]);

            if (progress < 1) {
                raf.current = requestAnimationFrame(animate);
            }
        };
        
        if (raf.current) cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(raf.current);
    }, [targetLng, targetLat]);

    return current;
}

const PlayerMarker = () => {
    const { current: map } = useMap();
    const { lastPosition, gpsStatus, isCameraLocked } = useGameStore();
    const hasCentered = useRef(false);

    const isValidPos = (pos) => pos && typeof pos.lat === 'number' && typeof pos.lng === 'number' && !isNaN(pos.lat) && !isNaN(pos.lng);

    // Initial positioning
    useEffect(() => {
        if (isValidPos(lastPosition) && !hasCentered.current && map) {
            // Check if map is loaded and ready before calling methods that require it
            try {
                map.flyTo({ center: [lastPosition.lng, lastPosition.lat], zoom: 18, duration: 1500 });
                hasCentered.current = true;
            } catch (e) {
                console.warn("Map not ready for flyTo yet");
            }
        }
    }, [lastPosition, map]);

    // Pro: Lazy Follow & Auto-centering
    useEffect(() => {
        if (!isValidPos(lastPosition)) return;
        
        const newPos = [lastPosition.lng, lastPosition.lat]; // Mapbox uses [lng, lat]
        
        // Handle Auto-follow with threshold (Lazy Follow)
        if (isCameraLocked && map) {
            try {
                const currentCenter = map.getCenter();
                if (currentCenter) {
                    // Quick distance check (approximate meter calculation)
                    // 1 degree lat ~ 111,320 meters
                    const dLat = (newPos[1] - currentCenter.lat) * 111320;
                    const dLng = (newPos[0] - currentCenter.lng) * 111320 * Math.cos(currentCenter.lat * Math.PI / 180);
                    const distance = Math.sqrt(dLat * dLat + dLng * dLng);

                    if (!hasCentered.current || distance > 15) {
                        map.panTo({ center: newPos, duration: 1200 });
                        hasCentered.current = true;
                    }
                } else {
                    map.panTo({ center: newPos, duration: 1200 });
                    hasCentered.current = true;
                }
            } catch (e) {
                console.warn("Map not ready for panTo yet");
            }
        }
    }, [lastPosition, map, isCameraLocked]);

    // Smooth Glide via coordinate interpolation, not CSS
    const animatedPos = useLerpPosition(
        isValidPos(lastPosition) ? lastPosition.lng : 0, 
        isValidPos(lastPosition) ? lastPosition.lat : 0
    );

    if (gpsStatus !== 'locked' || !isValidPos(lastPosition)) {
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
                style={{ zIndex: 1000 }}
            >
                <div className="gps-marker-container">
                    <div className="player-dot"></div>
                </div>
            </Marker>
            
            {/* CSS for glowing GPS marker - NO TRANSFORM TRANSITIONS */}
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
