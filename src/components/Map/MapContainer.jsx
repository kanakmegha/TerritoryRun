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
    const defaultPosition = [37.7749, -122.4194];

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    const [googleFailed, setGoogleFailed] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        if (!apiKey) {
            setGoogleReady(true);
            return;
        }

        // Pro: 5-second safety timeout for fallback
        const timeout = setTimeout(() => {
            if (!window.google || !window.google.maps) {
                console.warn("Google Maps failed to load within 5s. Falling back to OSM.");
                setGoogleFailed(true);
                setGoogleReady(true);
            }
        }, 5000);

        const checkGoogle = () => {
            if (window.google && window.google.maps) {
                setGoogleReady(true);
                clearTimeout(timeout);
            } else {
                setTimeout(checkGoogle, 100);
            }
        };
        checkGoogle();

        return () => clearTimeout(timeout);
    }, [apiKey]);

    const { lastPosition } = useGameStore();
    const mapCenter = lastPosition ? [lastPosition.lat, lastPosition.lng] : defaultPosition;

    if (!isMounted) return null;

    return (
        <div style={{ height: '100vh', width: '100%', position: 'relative', background: '#050505' }}>
            {!googleReady && apiKey && (
                <div style={{ 
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 1000,
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    background: 'rgba(5, 5, 5, 0.8)', 
                    color: 'var(--neon-blue)',
                    fontFamily: 'monospace',
                    pointerEvents: 'none'
                }}>
                    ESTABLISHING SATELLITE LINK...
                </div>
            )}
            <MapContainer 
                center={mapCenter} 
                zoom={lastPosition ? 18 : 15} 
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

            {/* Global Map Overrides */}
            <style jsx="true">{`
                .leaflet-container {
                    background: #050505 !important;
                }
                .map-tiles {
                    filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
                }
            `}</style>
        </div>
    );
};

export default MapView;
