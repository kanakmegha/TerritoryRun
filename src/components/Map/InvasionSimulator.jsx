import { useEffect, useState, useRef } from 'react';
import { Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useGameStore } from '../../hooks/useGameStore';
import { cellToLatLng, gridDisk, latLngToCell } from 'h3-js';

const InvasionSimulator = () => {
    const map = useMap();
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
        setSimulationProgress
    } = useGameStore();
    
    const [currentInvasionPos, setCurrentInvasionPos] = useState(null);
    const [pathHistory, setPathHistory] = useState([]);
    const [targetTiles, setTargetTiles] = useState([]);
    const [currentTargetIndex, setCurrentTargetIndex] = useState(0);

    // Initial Setup: "Longest Path" straight line across a blue hexagon
    useEffect(() => {
        if (isSimulating) {
            const userCellIndices = Object.entries(claimedCells)
                .filter(([_, data]) => data.ownerId === user?.id)
                .map(([index, _]) => index);

            if (userCellIndices.length === 0) {
                addAlert("No Blue Sectors to invade! Claim some first.");
                setIsSimulating(false);
                return;
            }

            // Pick a random user hex to be the "Target Sector"
            const targetHex = userCellIndices[Math.floor(Math.random() * userCellIndices.length)];
            const neighbors = gridDisk(targetHex, 1);
            
            // Pick a start neighbor (ideally one that is NOT the user's)
            const outerHex = neighbors.find(n => n !== targetHex && !userCellIndices.includes(n)) || neighbors[1];
            
            // Pick an end neighbor that is roughly 180 degrees from the start
            // Neighbors are 0-6 in order? gridDisk doesn't guarantee order.
            // Let's just pick one that isn't the start.
            const endHex = neighbors.find(n => n !== targetHex && n !== outerHex) || neighbors[4];

            const startCoords = cellToLatLng(outerHex);
            const centerCoords = cellToLatLng(targetHex);
            const endCoords = cellToLatLng(endHex);

            // Path: Outside -> Center -> Far Edge
            const straightPath = [
                { lat: startCoords[0], lng: startCoords[1] },
                { lat: centerCoords[0], lng: centerCoords[1] },
                { lat: endCoords[0], lng: endCoords[1] }
            ];

            setTargetTiles(straightPath);
            setCurrentInvasionPos(straightPath[0]);
            setPathHistory([straightPath[0]]);
            setCurrentTargetIndex(1);
            setSimulationSubtitle("⚠️ INTRUDER DETECTED: A rival player is entering your sector!");
            setSimulationProgress(0);
            
            map.setView([centerCoords[0], centerCoords[1]], 18);
            
        } else {
            setCurrentInvasionPos(null);
            setPathHistory([]);
            setTargetTiles([]);
            setCurrentTargetIndex(0);
            setSimulationProgress(0);
        }
    }, [isSimulating, user?.id]);

    // Movement Loop (800ms for tighter mission feel)
    useEffect(() => {
        if (!isSimulating || !currentInvasionPos || targetTiles.length === 0) return;

        const interval = setInterval(() => {
            setCurrentInvasionPos(prev => {
                if (!prev) return null;

                const target = targetTiles[currentTargetIndex] || targetTiles[0];
                
                // Move by small increment towards target
                const step = 0.0001; 
                const dLat = target.lat - prev.lat;
                const dLng = target.lng - prev.lng;
                const distance = Math.sqrt(dLat * dLat + dLng * dLng);

                let nextLat = prev.lat;
                let nextLng = prev.lng;

                if (distance < step) {
                    if (currentTargetIndex < targetTiles.length - 1) {
                        const nextIdx = currentTargetIndex + 1;
                        setCurrentTargetIndex(nextIdx);
                        
                        // Step Logic Transitions
                        if (nextIdx === 2) {
                            setSimulationSubtitle("⚔️ ANALYSIS: They are attempting to bridge the maximum distance to override your claim.");
                        }
                    } else {
                        // End of Invasion: Sector Lost
                        setSimulationSubtitle("🚫 SECTOR LOST: The path is complete. Territory has turned RED.");
                        setSimulationProgress(100);
                        
                        // Wait a second before finishing
                        setTimeout(() => {
                            setIsSimulating(false);
                            setShowMissionAlert(true);
                            setShowReclaimButton(true);
                            setGhostPath(pathHistory);
                        }, 1000);
                        
                        clearInterval(interval);
                        return prev;
                    }
                } else {
                    nextLat += (dLat / distance) * step;
                    nextLng += (dLng / distance) * step;
                }

                const newPos = { lat: nextLat, lng: nextLng };
                setPathHistory(prevHistory => [...prevHistory, newPos]);
                
                // Calculate Progress (approximate based on index and distance to final)
                const totalTargets = targetTiles.length;
                const progress = Math.min(95, Math.floor(((currentTargetIndex - 1) / (totalTargets - 1)) * 100 + (1 - distance/0.0005) * 30));
                setSimulationProgress(progress);

                // Flip tiles Red as it passes
                claimTile(newPos.lat, newPos.lng, 'rival_bot', 'red');

                return newPos;
            });
        }, 300); // Faster simulation

        return () => clearInterval(interval);
    }, [isSimulating, targetTiles, currentTargetIndex, map]);

    // Final defensive check before rendering Leaflet layers
    const isValidPos = currentInvasionPos && 
                     typeof currentInvasionPos.lat === 'number' && 
                     typeof currentInvasionPos.lng === 'number' &&
                     !isNaN(currentInvasionPos.lat) && 
                     !isNaN(currentInvasionPos.lng);

    if (!isSimulating || !isValidPos) return null;

    const attackerIcon = L.divIcon({
        className: 'attacker-marker',
        html: `
            <div class="attacker-container">
                <div class="breach-label">BREACH PROGRESS</div>
                <div class="progress-bar-wrap">
                    <div class="progress-fill" style="width: ${simulationProgress}%"></div>
                </div>
                <div class="attacker-pulse">
                    <div class="attacker-dot"></div>
                </div>
            </div>
        `,
        iconSize: [100, 60],
        iconAnchor: [50, 50]
    });

    return (
        <>
            {/* Real-time Ghost Path */}
            {pathHistory.length > 1 && (
                <Polyline 
                    positions={pathHistory.map(p => {
                        if (Array.isArray(p) && p.length === 2) {
                            if (typeof p[0] === 'number' && typeof p[1] === 'number' && !isNaN(p[0]) && !isNaN(p[1])) {
                                return p;
                            }
                        } else if (typeof p === 'object' && p !== null && typeof p.lat === 'number' && typeof p.lng === 'number') {
                            if (!isNaN(p.lat) && !isNaN(p.lng)) {
                                return [p.lat, p.lng];
                            }
                        }
                        return null;
                    }).filter(p => p !== null)} 
                    pathOptions={{ 
                        color: 'red', 
                        weight: 4, 
                        dashArray: '5, 8',
                        opacity: 0.6
                    }} 
                />
            )}

            {/* Red Dot (High Z-Index) */}
            <Marker 
                position={[currentInvasionPos.lat, currentInvasionPos.lng]} 
                icon={attackerIcon} 
                zIndexOffset={1000}
            />

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
