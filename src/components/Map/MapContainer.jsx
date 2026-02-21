import { useState, useRef, useEffect } from 'react';
import Map, { MapProvider } from 'react-map-gl';
import PlayerMarker from './PlayerMarker';
import HexGrid from './HexGrid';
import InvasionSimulator from './InvasionSimulator';
import ReclaimHandler from './ReclaimHandler';
import BreadcrumbTrail from './BreadcrumbTrail';
import { useGameStore } from '../../hooks/useGameStore';

const MapView = () => {
    const { lastPosition } = useGameStore();

    const apiKey = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    
    // Default Mapbox Style
    // mapbox://styles/mapbox/satellite-v9 for satellite
    // mapbox://styles/mapbox/dark-v11 for dark mode
    const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/dark-v11');

    // Robust coordinate validation
    const isValidPos = (pos) => pos && typeof pos.lat === 'number' && typeof pos.lng === 'number' && !isNaN(pos.lat) && !isNaN(pos.lng);
    
    // Initialize view state
    const initialViewState = {
        longitude: isValidPos(lastPosition) ? lastPosition.lng : -122.4194,
        latitude: isValidPos(lastPosition) ? lastPosition.lat : 37.7749,
        zoom: isValidPos(lastPosition) ? 18 : 15,
        pitch: 45, // Mapbox allows tilting the camera
        bearing: 0
    };

    return (
        <MapProvider>
            <div style={{ height: '100vh', width: '100%', position: 'relative', background: '#050505' }}>
                <style>{`
                    .mapboxgl-canvas {
                        z-index: 1 !important;
                    }
                    .sat-overlay {
                        position: absolute;
                        top: 0; left: 0; right: 0; bottom: 0;
                        z-index: 9999;
                        display: flex; 
                        flex-direction: column;
                        align-items: center; 
                        justify-content: center; 
                        background: rgba(5, 5, 5, 0.9); 
                        color: #00f3ff;
                        font-family: monospace;
                        pointer-events: none;
                    }
                `}</style>
                
                {!apiKey && (
                    <div style={{ 
                        position: 'absolute', 
                        top: '80px', left: '50%', transform: 'translateX(-50%)',
                        zIndex: 10000, 
                        background: 'rgba(255, 0, 0, 0.2)', 
                        border: '1px solid #ff0055',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        color: '#ff0055',
                        fontSize: '0.7rem',
                        pointerEvents: 'none',
                        textAlign: 'center'
                    }}>
                        MAPBOX TOKEN MISSING: PLEASE ADD TO .ENV
                    </div>
                )}

                <Map
                    id="main-map"
                    initialViewState={initialViewState}
                    mapStyle={mapStyle}
                    mapboxAccessToken={apiKey}
                    style={{ width: '100%', height: '100%' }}
                    maxZoom={22}
                >
                    {/* Overlays */}
                    <PlayerMarker />
                    <HexGrid />
                    <BreadcrumbTrail />
                    <InvasionSimulator />
                    <ReclaimHandler />
                </Map>
            </div>
        </MapProvider>
    );
};

export default MapView;
