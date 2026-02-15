import { useEffect, useState, useRef } from 'react';
import { Marker, Popup, useMap, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { useGameStore } from '../../hooks/useGameStore';

// Fix for default marker icon in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const PlayerMarker = () => {
    const map = useMap();
    const { lastPosition, gpsStatus } = useGameStore();
    const hasCentered = useRef(false);
    const markerRef = useRef(null);

    // Auto-center on first valid position
    useEffect(() => {
        if (lastPosition && !hasCentered.current) {
            map.flyTo([lastPosition.lat, lastPosition.lng], 16);
            hasCentered.current = true;
        }
    }, [lastPosition, map]);

    if (gpsStatus !== 'locked' || !lastPosition) return null;
    
    // Removed: Click-to-teleport functionality (real GPS only)

    // Removed: Manual GPS trigger button (centralized in App.jsx flow)

    return (
        <>
            <Marker 
                position={[lastPosition.lat, lastPosition.lng]}
                ref={markerRef}
                icon={L.divIcon({
                    className: 'gps-marker',
                    html: '<div class="gps-dot"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })}
            >
                <Popup>Protocol Active: Tracking Runner</Popup>
            </Marker>
            
            {/* CSS for glowing GPS marker */}
            <style>{`
                .gps-marker {
                    background: transparent;
                }
                
                .gps-dot {
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
