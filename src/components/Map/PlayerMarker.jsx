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
    const { updatePosition, currentPath, isRunning } = useGameStore();
    const hasCentered = useRef(false);

    useEffect(() => {
        const onLocationFound = (e) => {
            setPosition(e.latlng);
            updatePosition(e.latlng.lat, e.latlng.lng);
            
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
    }, [map, isRunning]); // Re-bind if running state changes? Actually updatePosition handles the check.
    
    // Debug: Click to teleport and claim
    // Debug: Click to teleport and add point to path
    useMapEvents({
        click(e) {
            setPosition(e.latlng);
            updatePosition(e.latlng.lat, e.latlng.lng);
        }
    });

    return position === null ? null : (
        <>
            <Marker position={position}>
                <Popup>You are here</Popup>
            </Marker>
            {currentPath.length > 0 && (
                <Polyline 
                    positions={currentPath} 
                    pathOptions={{ color: '#00ffea', weight: 4, opacity: 0.8, dashArray: '5, 10' }} 
                />
            )}
        </>
    );
};

export default PlayerMarker;
