import { useEffect, useState, useRef } from 'react';
import { Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useGameStore } from '../../hooks/useGameStore';
import { cellToLatLng } from 'h3-js';

const InvasionSimulator = () => {
    const map = useMap();
    const { 
        isSimulating, 
        claimedCells, 
        user, 
        claimTile,
        lastPosition,
        setIsSimulating,
        setShowMissionAlert,
        setGhostPath,
        setShowReclaimButton
    } = useGameStore();
    
    const [currentInvasionPos, setCurrentInvasionPos] = useState(null);
    const [pathHistory, setPathHistory] = useState([]);
    const [targetTiles, setTargetTiles] = useState([]);
    const [currentTargetIndex, setCurrentTargetIndex] = useState(0);

    // Initial Setup: Define coordinate source
    useEffect(() => {
        if (isSimulating) {
            // Rule 1: Coordinate Source - Filter user territories
            const userTerritories = Object.entries(claimedCells)
                .filter(([_, cell]) => cell.ownerId === user?.id)
                .map(([index, _]) => {
                    const coords = cellToLatLng(index);
                    return { lat: coords[0], lng: coords[1] };
                });

            if (userTerritories.length > 0) {
                setTargetTiles(userTerritories);
                setCurrentInvasionPos(userTerritories[0]);
                setPathHistory([userTerritories[0]]);
                setCurrentTargetIndex(1);
            } else {
                // Fallback to Browser Geolocation
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const start = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        setTargetTiles([start]);
                        setCurrentInvasionPos(start);
                        setPathHistory([start]);
                    },
                    (err) => {
                        // SF Fallback
                        const start = { lat: 37.7749, lng: -122.4194 };
                        setTargetTiles([start]);
                        setCurrentInvasionPos(start);
                        setPathHistory([start]);
                    }
                );
            }
        } else {
            // Reset when not simulating
            setCurrentInvasionPos(null);
            setPathHistory([]);
            setTargetTiles([]);
            setCurrentTargetIndex(0);
        }
    }, [isSimulating, user?.id]); // Re-run when simulation starts

    // The Movement Loop
    useEffect(() => {
        if (!isSimulating || !currentInvasionPos || targetTiles.length === 0) return;

        const interval = setInterval(() => {
            setCurrentInvasionPos(prev => {
                if (!prev) return null;

                let nextLat = prev.lat;
                let nextLng = prev.lng;

                // Rule: Small increment towards next tile
                const target = targetTiles[currentTargetIndex] || targetTiles[0];
                const deltaLat = target.lat > prev.lat ? 0.0001 : -0.0001;
                const deltaLng = target.lng > prev.lng ? 0.0001 : -0.0001;

                // Stop incrementing if we are very close to the target
                if (Math.abs(target.lat - prev.lat) < 0.0001 && Math.abs(target.lng - prev.lng) < 0.0001) {
                    if (currentTargetIndex < targetTiles.length - 1) {
                        setCurrentTargetIndex(prevIdx => prevIdx + 1);
                    } else {
                        // END OF SIMULATION
                        setIsSimulating(false);
                        setShowMissionAlert(true);
                        setShowReclaimButton(true);
                        setGhostPath(pathHistory);
                        clearInterval(interval);
                        return prev;
                    }
                } else {
                    nextLat += deltaLat;
                    nextLng += deltaLng;
                }

                const newPos = { lat: nextLat, lng: nextLng };

                // Rule: Update Ghost Path
                setPathHistory(prevPath => [...prevPath, newPos]);

                // Rule: Map Tracking
                map.setView([newPos.lat, newPos.lng], map.getZoom());

                // Rule: Tile Flipping
                claimTile(newPos.lat, newPos.lng, 'Rival', 'red');

                return newPos;
            });
        }, 1000); // 1000ms interval as requested

        return () => clearInterval(interval);
    }, [isSimulating, targetTiles, currentTargetIndex, map]);

    if (!isSimulating || !currentInvasionPos) {
        // Still render ghost path if it was recently active (optional, but keep for visual)
        return null;
    }

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
            {/* Rule: Ghost Trail */}
            {pathHistory.length > 1 && (
                <Polyline 
                    positions={pathHistory.map(p => [p.lat, p.lng])} 
                    pathOptions={{ 
                        color: 'red', 
                        weight: 5, 
                        dashArray: '5, 10' 
                    }} 
                />
            )}

            <Marker position={[currentInvasionPos.lat, currentInvasionPos.lng]} icon={attackerIcon} />

            <style>{`
                .attacker-dot {
                    width: 16px;
                    height: 16px;
                    background: red;
                    border-radius: 50%;
                    box-shadow: 0 0 15px red;
                    animation: pulse 1s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.3); opacity: 0.7; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </>
    );
};

export default InvasionSimulator;
