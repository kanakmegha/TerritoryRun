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
    const { lastPosition, gpsStatus, isCameraLocked } = useGameStore();
    const hasCentered = useRef(false);
    const markerRef = useRef(null);
    const [animatedPos, setAnimatedPos] = useState(null);

    // Initial positioning
    useEffect(() => {
        if (lastPosition && !hasCentered.current) {
            map.flyTo([lastPosition.lat, lastPosition.lng], 18, { animate: true, duration: 1.5 });
            setAnimatedPos([lastPosition.lat, lastPosition.lng]);
            hasCentered.current = true;
        }
    }, [lastPosition, map]);

    // Smooth movement & Auto-follow with Jitter Prevention
    useEffect(() => {
        if (!lastPosition || typeof lastPosition.lat !== 'number' || typeof lastPosition.lng !== 'number' || isNaN(lastPosition.lat) || isNaN(lastPosition.lng)) return;
        
        const newPos = [lastPosition.lat, lastPosition.lng];
        
        // Handle Auto-follow with Jitter Prevention for Zoom 19+
        if (isCameraLocked) {
            const currentZoom = map.getZoom();
            const currentCenter = map.getCenter();
            
            // Calculate distance between map center and new position
            const distToCenter = map.distance(currentCenter, newPos);
            
            // At zoom 19+, don't jitter for small moves < 1.5m unless center is far
            const moveThreshold = currentZoom >= 19 ? 1.5 : 0.5;
            
            if (distToCenter > moveThreshold) {
                map.flyTo(newPos, currentZoom < 18 ? 18 : currentZoom, { 
                    animate: true, 
                    duration: currentZoom >= 19 ? 0.8 : 1.5 // Snappier at high zoom
                });
            }
        }

        setAnimatedPos(newPos);
    }, [lastPosition, map, isCameraLocked]);

    if (gpsStatus !== 'locked' || !animatedPos) return null;
    
    // Removed: Click-to-teleport functionality (real GPS only)

    // Removed: Manual GPS trigger button (centralized in App.jsx flow)

    return (
        <>
            <Marker 
                position={animatedPos}
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
