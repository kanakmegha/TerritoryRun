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
    const [gpsActive, setGpsActive] = useState(false);
    const hasCentered = useRef(false);
    const markerRef = useRef(null);

    useEffect(() => {
        if (!gpsActive) return;

        const onLocationFound = (e) => {
            const newLat = e.latlng.lat;
            const newLng = e.latlng.lng;
            
            if (markerRef.current) {
                markerRef.current.setLatLng([newLat, newLng]);
            } else {
                setPosition(e.latlng);
            }
            
            processGPSUpdate(newLat, newLng);
            
            if (!hasCentered.current) {
                const currentZoom = map.getZoom();
                const targetZoom = currentZoom < 15 ? 16 : currentZoom;
                map.flyTo(e.latlng, targetZoom);
                hasCentered.current = true;
            }
        };

        const onLocationError = (e) => {
            console.error("Geolocation error:", e.message);
            setGpsActive(false);
        };

        map.locate({ watch: true, enableHighAccuracy: true });
        map.on("locationfound", onLocationFound);
        map.on("locationerror", onLocationError);

        return () => {
            map.stopLocate();
            map.off("locationfound", onLocationFound);
            map.off("locationerror", onLocationError);
        };
    }, [map, gpsActive, processGPSUpdate]); 
    
    // Removed: Click-to-teleport functionality (real GPS only)

    if (!gpsActive && !position) {
        return (
            <div className="gps-init-overlay">
                <button className="gps-btn" onClick={() => setGpsActive(true)}>
                    🛰️ INITIALIZE GPS
                </button>
                <style>{`
                    .gps-init-overlay {
                        position: absolute;
                        bottom: 100px;
                        right: 20px;
                        z-index: 1000;
                    }
                    .gps-btn {
                        background: rgba(0,0,0,0.8);
                        color: #00ffea;
                        border: 1px solid #00ffea;
                        padding: 10px 15px;
                        cursor: pointer;
                        font-family: inherit;
                        font-weight: bold;
                        box-shadow: 0 0 10px rgba(0,255,234,0.3);
                        border-radius: 4px;
                    }
                    .gps-btn:hover {
                        background: #00ffea;
                        color: black;
                        box-shadow: 0 0 20px #00ffea;
                    }
                `}</style>
            </div>
        );
    }

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
