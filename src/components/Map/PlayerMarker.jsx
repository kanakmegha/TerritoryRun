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
    const [position, setPosition] = useState(null);
    const map = useMap();
    const { processGPSUpdate, currentRun } = useGameStore();
    const hasCentered = useRef(false);
    const markerRef = useRef(null);

    useEffect(() => {
        const onLocationFound = (e) => {
            const newLat = e.latlng.lat;
            const newLng = e.latlng.lng;
            
            // Smooth marker animation
            if (markerRef.current) {
                markerRef.current.setLatLng([newLat, newLng]);
            } else {
                setPosition(e.latlng);
            }
            
            // Process GPS update for painting mechanic
            processGPSUpdate(newLat, newLng);
            
            // Smart Zoom: Only auto-zoom if we are too far out (world view)
            // or if it's the very first load. 
            // Otherwise, respect the user's manual zoom.
            if (!hasCentered.current) {
                const currentZoom = map.getZoom();
                const targetZoom = currentZoom < 15 ? 16 : currentZoom;
                map.flyTo(e.latlng, targetZoom);
                hasCentered.current = true;
            }
        };

        map.locate({ watch: true, enableHighAccuracy: true });
        map.on("locationfound", onLocationFound);

        return () => {
            map.stopLocate();
            map.off("locationfound", onLocationFound);
        };
    }, [map, processGPSUpdate]); // Re-bind if processGPSUpdate changes
    
    // Removed: Click-to-teleport functionality (real GPS only)

    return position === null ? null : (
        <>
            <Marker 
                position={position}
                ref={markerRef}
                icon={L.divIcon({
                    className: 'gps-marker',
                    html: '<div class="gps-dot"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })}
            >
                <Popup>You are here</Popup>
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
