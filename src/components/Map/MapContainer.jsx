import { useState, useRef, useEffect } from 'react';
import Map, { MapProvider, Marker, useMap } from 'react-map-gl';
import PlayerMarker from './PlayerMarker';
import BreadcrumbTrail from './BreadcrumbTrail';
import TerritoryOverlay from './TerritoryOverlay';
import { useGameStore } from '../../hooks/useGameStore';

// Dynamic Camera Controller Component
const MapCameraController = () => {
    const { current } = useMap(); // Get mapbox instance safely inside context
    const { lastPosition, activeGameMode, isCameraLocked } = useGameStore();
    
    useEffect(() => {
        if (!current || !lastPosition || !isCameraLocked) return;

        // Force rigorous zoom during active run modes
        if (activeGameMode === 'claim' || activeGameMode === 'run') {
            current.flyTo({
                center: [lastPosition.lng, lastPosition.lat],
                zoom: 18,
                duration: 1000,
                essential: true
            });
        }
    }, [lastPosition, activeGameMode, current, isCameraLocked]);

    return null;
};

// Use free Carto DB Dark Matter tiles to bypass Mapbox 403 block
const cartoDarkStyle = {
    version: 8,
    sources: {
        'carto-dark': {
            type: 'raster',
            tiles: [
                'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }
    },
    layers: [
        {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 22
        }
    ]
};

const MapContainer = () => {
    const { lastPosition } = useGameStore();

    const apiKey = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    
    const [mapStyle] = useState(cartoDarkStyle);

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
                        z-index: 999 !important; /* MapmyIndia Sync: Overlay hexes clearly over base satellite */
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
                    <MapCameraController />
                    
                    {/* Overlays */}
                    <TerritoryOverlay />
                    <BreadcrumbTrail />
                    <PlayerMarker />
                </Map>
            </div>
        </MapProvider>
    );
};

export default MapContainer;
