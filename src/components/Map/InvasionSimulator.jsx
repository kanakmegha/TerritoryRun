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
        setShowReclaimButton 
    } = useGameStore();
    
    const [currentInvasionPos, setCurrentInvasionPos] = useState(null);
    const [pathHistory, setPathHistory] = useState([]);
    const [targetTiles, setTargetTiles] = useState([]);
    const [currentTargetIndex, setCurrentTargetIndex] = useState(0);

    // Initial Setup: Spawn at the EDGE of territory
    useEffect(() => {
        if (isSimulating) {
            const userCellIndices = Object.entries(claimedCells)
                .filter(([_, data]) => data.ownerId === user?.id)
                .map(([index, _]) => index);

            let startPos = null;

            if (userCellIndices.length > 0) {
                // Find "Edge" tiles: Neighbors of user tiles that are NOT user tiles
                const edgeCandidates = new Set();
                userCellIndices.forEach(cell => {
                    const neighbors = gridDisk(cell, 1);
                    neighbors.forEach(n => {
                        if (!userCellIndices.includes(n)) {
                            edgeCandidates.add(n);
                        }
                    });
                });

                let spawnCell;
                if (edgeCandidates.size > 0) {
                    const candidatesArray = Array.from(edgeCandidates);
                    spawnCell = candidatesArray[Math.floor(Math.random() * candidatesArray.length)];
                } else {
                    // If surrounded or something, just pick a user tile
                    spawnCell = userCellIndices[Math.floor(Math.random() * userCellIndices.length)];
                }

                const coords = cellToLatLng(spawnCell);
                startPos = { lat: coords[0], lng: coords[1] };
            } else {
                // Fallback SF
                startPos = { lat: 37.7749, lng: -122.4194 };
            }

            // Create a path that "hunts" - weaving through user tiles
            const huntPath = [startPos];
            const numPoints = 12 + Math.floor(Math.random() * 8); // 12-20 points
            
            for (let i = 0; i < numPoints; i++) {
                if (userCellIndices.length > 0) {
                    const targetCell = userCellIndices[Math.floor(Math.random() * userCellIndices.length)];
                    const coords = cellToLatLng(targetCell);
                    huntPath.push({ lat: coords[0], lng: coords[1] });
                } else {
                    // Random wander if no tiles
                    const last = huntPath[huntPath.length - 1];
                    huntPath.push({ 
                        lat: last.lat + (Math.random() - 0.5) * 0.005, 
                        lng: last.lng + (Math.random() - 0.5) * 0.005 
                    });
                }
            }

            setTargetTiles(huntPath);
            setCurrentInvasionPos(huntPath[0]);
            setPathHistory([huntPath[0]]);
            setCurrentTargetIndex(1);
            
            // Initial focus
            map.setView([huntPath[0].lat, huntPath[0].lng], 16);
            
        } else {
            setCurrentInvasionPos(null);
            setPathHistory([]);
            setTargetTiles([]);
            setCurrentTargetIndex(0);
        }
    }, [isSimulating, user?.id]);

    // Movement Loop (1000ms)
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
                    // Close enough to pivot to next target
                    if (currentTargetIndex < targetTiles.length - 1) {
                        setCurrentTargetIndex(prevIdx => prevIdx + 1);
                    } else {
                        // End of Invasion
                        setIsSimulating(false);
                        setShowMissionAlert(true);
                        setShowReclaimButton(true);
                        setGhostPath(pathHistory);
                        clearInterval(interval);
                        return prev;
                    }
                } else {
                    nextLat += (dLat / distance) * step;
                    nextLng += (dLng / distance) * step;
                }

                const newPos = { lat: nextLat, lng: nextLng };
                setPathHistory(prevHistory => [...prevHistory, newPos]);
                
                // Rule: Map Tracking
                map.setView([newPos.lat, newPos.lng], map.getZoom());

                // Rule: FLIP TILES RED IMMEDIATELY
                claimTile(newPos.lat, newPos.lng, 'rival_bot', 'red');

                return newPos;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isSimulating, targetTiles, currentTargetIndex, map]);

    if (!isSimulating || !currentInvasionPos) return null;

    const attackerIcon = L.divIcon({
        className: 'attacker-marker',
        html: `
            <div class="attacker-pulse">
                <div class="attacker-dot"></div>
            </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    return (
        <>
            {/* Real-time Ghost Path */}
            {pathHistory.length > 1 && (
                <Polyline 
                    positions={pathHistory.map(p => [p.lat, p.lng])} 
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
                .attacker-dot {
                    width: 18px;
                    height: 18px;
                    background: #ff0000;
                    border-radius: 50%;
                    box-shadow: 0 0 20px #ff0000, 0 0 10px #000;
                    border: 2px solid white;
                    animation: pulse-red 1s infinite alternate;
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
