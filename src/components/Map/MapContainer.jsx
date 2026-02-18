import { useState, useEffect } from 'react';
import { MapContainer, LayersControl, TileLayer } from 'react-leaflet';
import PlayerMarker from './PlayerMarker';
import HexGrid from './HexGrid';
import InvasionSimulator from './InvasionSimulator';
import ReclaimHandler from './ReclaimHandler';
import BreadcrumbTrail from './BreadcrumbTrail';
import GoogleLayer from 'react-leaflet-google-layer';
import { useGameStore } from '../../hooks/useGameStore';

const MapView = () => {
    const [isMounted, setIsMounted] = useState(false);
    const [googleReady, setGoogleReady] = useState(false);
    const [googleFailed, setGoogleFailed] = useState(false);
    const defaultPosition = [37.7749, -122.4194];

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;



    useEffect(() => {
        setIsMounted(true);
        if (!apiKey) {
            setGoogleReady(true);
            return;
        }

        // 5-second safety timeout for Google Maps load
        const timeout = setTimeout(() => {
            if (!window.google || !window.google.maps) {
                console.warn("🚨 Google Maps failed to load (timeout). Switching to OSM.");
                setGoogleFailed(true);
                setGoogleReady(true);
            }
        }, 5000);

        const checkGoogle = () => {
            if (window.google && window.google.maps) {
                console.log("✅ Google Maps API connected.");
                setGoogleReady(true);
                clearTimeout(timeout);
            } else {
                setTimeout(checkGoogle, 200);
            }
        };
        checkGoogle();

        return () => clearTimeout(timeout);
    }, [apiKey]);

    const { lastPosition } = useGameStore();
    
    // Robust coordinate validation to prevent Leaflet crashes
    const isValidPos = (pos) => pos && typeof pos.lat === 'number' && typeof pos.lng === 'number' && !isNaN(pos.lat) && !isNaN(pos.lng);
    const mapCenter = isValidPos(lastPosition) ? [lastPosition.lat, lastPosition.lng] : defaultPosition;

    if (!isMounted) return null;

    return (
        <div style={{ height: '100vh', width: '100%', position: 'relative', background: '#050505' }}>
            <style>{`
                .leaflet-container {
                    background: #050505 !important;
                    height: 100vh !important;
                    width: 100% !important;
                }
                .map-tiles {
                    filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
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

            {!googleReady && apiKey && (
                <div className="sat-overlay">
                    <div style={{ marginBottom: '10px', fontSize: '1.2rem', letterSpacing: '2px' }}>ESTABLISHING SATELLITE LINK...</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>VERIFYING GEO-ENCRYPTION...</div>
                </div>
            )}
            
            <MapContainer 
                center={mapCenter} 
                zoom={isValidPos(lastPosition) ? 18 : 15} 
                maxZoom={21}
                style={{ height: '100vh', width: '100%', background: '#050505' }}
                zoomControl={true}
            >
                {(apiKey && !googleFailed) ? (
                    <LayersControl position="topright">
                        <LayersControl.BaseLayer checked name="Google Satellite (Hybrid)">
                            <GoogleLayer 
                                apiKey={apiKey} 
                                type="hybrid" 
                            />
                        </LayersControl.BaseLayer>
                        <LayersControl.BaseLayer name="Google Roadmap">
                            <GoogleLayer 
                                apiKey={apiKey} 
                                type="roadmap" 
                            />
                        </LayersControl.BaseLayer>
                    </LayersControl>
                ) : (
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        className="map-tiles"
                    />
                )}

                {/* Overlays */}
                <PlayerMarker />
                <HexGrid />
                <BreadcrumbTrail />
                <InvasionSimulator />
                <ReclaimHandler />
            </MapContainer>
        </div>
    );
};

export default MapView;
