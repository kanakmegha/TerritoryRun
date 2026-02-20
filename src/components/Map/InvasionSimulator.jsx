import { useEffect, useState, useMemo } from 'react';
import { Marker, Source, Layer, useMap } from 'react-map-gl';
import { useGameStore } from '../../hooks/useGameStore';
import { cellToLatLng, gridDisk } from 'h3-js';

const InvasionSimulator = () => {
    const { current: map } = useMap();
    const { 
        isSimulating, 
        claimedCells, 
        user, 
        claimTile,
        setIsSimulating,
        setShowMissionAlert,
        setGhostPath,
        setShowReclaimButton,
        setSimulationSubtitle,
        setSimulationProgress,
        simulationProgress
    } = useGameStore();
    
    const [currentInvasionPos, setCurrentInvasionPos] = useState(null);
    const [pathHistory, setPathHistory] = useState([]);
    const [targetTiles, setTargetTiles] = useState([]);
    const [currentTargetIndex, setCurrentTargetIndex] = useState(0);

    // Initial Setup
    useEffect(() => {
        if (isSimulating) {
            const userCellIndices = Object.entries(claimedCells)
                .filter(([_, data]) => data.ownerId === user?.id)
                .map(([index, _]) => index);

            if (userCellIndices.length === 0) {
                // Should show alert, but standard alert function isn't here, fallback to console or local state
                console.warn("No Blue Sectors to invade! Claim some first.");
                setIsSimulating(false);
                return;
            }

            const targetHex = userCellIndices[Math.floor(Math.random() * userCellIndices.length)];
            const neighbors = gridDisk(targetHex, 1);
            
            const outerHex = neighbors.find(n => n !== targetHex && !userCellIndices.includes(n)) || neighbors[1];
            const endHex = neighbors.find(n => n !== targetHex && n !== outerHex) || neighbors[4];

            // h3-js cellToLatLng returns [lat, lng]. Mapbox needs [lng, lat] for markers and geojson
            const startCoords = cellToLatLng(outerHex);
            const centerCoords = cellToLatLng(targetHex);
            const endCoords = cellToLatLng(endHex);

            const straightPath = [
                { lat: startCoords[0], lng: startCoords[1] },
                { lat: centerCoords[0], lng: centerCoords[1] },
                { lat: endCoords[0], lng: endCoords[1] }
            ];

            setTargetTiles(straightPath);
            setCurrentInvasionPos({ lng: startCoords[1], lat: startCoords[0] });
            setPathHistory([{ lng: startCoords[1], lat: startCoords[0] }]);
            setCurrentTargetIndex(1);
            setSimulationSubtitle("⚠️ INTRUDER DETECTED: A rival player is entering your sector!");
            setSimulationProgress(0);
            
            if (map) {
                map.flyTo({ center: [centerCoords[1], centerCoords[0]], zoom: 18 });
            }
            
        } else {
            setCurrentInvasionPos(null);
            setPathHistory([]);
            setTargetTiles([]);
            setCurrentTargetIndex(0);
            setSimulationProgress(0);
        }
    }, [isSimulating, user?.id, map]); // Added map to deps

    // Movement Loop
    useEffect(() => {
        if (!isSimulating || !currentInvasionPos || targetTiles.length === 0) return;

        const interval = setInterval(() => {
            setCurrentInvasionPos(prev => {
                if (!prev) return null;

                const target = targetTiles[currentTargetIndex] || targetTiles[0];
                
                const step = 0.0001; 
                // Note: target is {lat, lng}, prev is {lat, lng}
                const dLat = target.lat - prev.lat;
                const dLng = target.lng - prev.lng;
                const distance = Math.sqrt(dLat * dLat + dLng * dLng);

                let nextLat = prev.lat;
                let nextLng = prev.lng;

                if (distance < step) {
                    if (currentTargetIndex < targetTiles.length - 1) {
                        const nextIdx = currentTargetIndex + 1;
                        setCurrentTargetIndex(nextIdx);
                        
                        if (nextIdx === 2) {
                            setSimulationSubtitle("⚔️ ANALYSIS: They are attempting to bridge the maximum distance to override your claim.");
                        }
                    } else {
                        setSimulationSubtitle("🚫 SECTOR LOST: The path is complete. Territory has turned RED.");
                        setSimulationProgress(100);
                        
                        setTimeout(() => {
                            setIsSimulating(false);
                            setShowMissionAlert(true);
                            setShowReclaimButton(true);
                            // Store history as {lat, lng} array back to store if needed
                            setGhostPath(pathHistory.map(p => ({ lat: p.lat, lng: p.lng })));
                        }, 1000);
                        
                        clearInterval(interval);
                        return prev;
                    }
                } else {
                    nextLat += (dLat / distance) * step;
                    nextLng += (dLng / distance) * step;
                }

                const newPos = { lng: nextLng, lat: nextLat };
                setPathHistory(prevHistory => [...prevHistory, newPos]);
                
                const totalTargets = targetTiles.length;
                const progress = Math.min(95, Math.floor(((currentTargetIndex - 1) / (totalTargets - 1)) * 100 + (1 - distance/0.0005) * 30));
                setSimulationProgress(progress);

                claimTile(newPos.lat, newPos.lng, 'rival_bot', 'red');

                return newPos;
            });
        }, 300);

        return () => clearInterval(interval);
    }, [isSimulating, targetTiles, currentTargetIndex]);

    const isValidPos = currentInvasionPos && 
                     typeof currentInvasionPos.lat === 'number' && 
                     typeof currentInvasionPos.lng === 'number' &&
                     !isNaN(currentInvasionPos.lat) && 
                     !isNaN(currentInvasionPos.lng);

    const geojsonData = useMemo(() => {
        if (pathHistory.length < 2) return null;
        return {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: pathHistory.map(p => [p.lng, p.lat])
            }
        };
    }, [pathHistory]);

    if (!isSimulating || !isValidPos) return null;

    return (
        <>
            {/* Real-time Ghost Path */}
            {geojsonData && (
                <Source id="invasion-path" type="geojson" data={geojsonData}>
                    <Layer 
                        id="invasion-path-line"
                        type="line"
                        paint={{
                            'line-color': '#ff0000',
                            'line-width': 4,
                            'line-opacity': 0.6,
                            'line-dasharray': [1, 2] // approx 5, 8
                        }}
                    />
                </Source>
            )}

            {/* Red Dot Marker */}
            <Marker 
                longitude={currentInvasionPos.lng} 
                latitude={currentInvasionPos.lat}
                anchor="center"
            >
                <div className="attacker-container">
                    <div className="breach-label">BREACH PROGRESS</div>
                    <div className="progress-bar-wrap">
                        <div className="progress-fill" style={{ width: `${simulationProgress}%` }}></div>
                    </div>
                    <div className="attacker-pulse">
                        <div className="attacker-dot"></div>
                    </div>
                </div>
            </Marker>

            <style>{`
                .attacker-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }
                .breach-label {
                    color: #ff0000;
                    font-size: 8px;
                    font-weight: 900;
                    text-shadow: 0 0 5px black;
                    white-space: nowrap;
                }
                .progress-bar-wrap {
                    width: 40px;
                    height: 4px;
                    background: rgba(0,0,0,0.5);
                    border: 1px solid #ff0000;
                    border-radius: 2px;
                    overflow: hidden;
                }
                .progress-fill {
                    height: 100%;
                    background: #ff0000;
                    box-shadow: 0 0 10px #ff0000;
                    transition: width 0.3s ease;
                }
                .attacker-dot {
                    width: 18px;
                    height: 18px;
                    background: #ff0000;
                    border-radius: 50%;
                    box-shadow: 0 0 20px #ff0000, 0 0 10px #000;
                    border: 2px solid white;
                    animation: pulse-red 0.5s infinite alternate;
                }
                @keyframes pulse-red {
                    from { transform: scale(1); filter: brightness(1); }
                    to { transform: scale(1.2); filter: brightness(1.5); }
                }
            `}</style>
        </>
    );
};

export default InvasionSimulator;
