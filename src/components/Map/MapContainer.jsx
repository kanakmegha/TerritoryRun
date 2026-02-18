import { MapContainer, LayersControl, TileLayer } from 'react-leaflet';
import PlayerMarker from './PlayerMarker';
import HexGrid from './HexGrid';
import InvasionSimulator from './InvasionSimulator';
import ReclaimHandler from './ReclaimHandler';
import BreadcrumbTrail from './BreadcrumbTrail';
import GoogleLayer from 'react-leaflet-google-layer';

const MapView = () => {
    const [googleReady, setGoogleReady] = useState(false);
    const defaultPosition = [37.7749, -122.4194];

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    useEffect(() => {
        if (!apiKey) {
            setGoogleReady(true); // Skip loading if no API key
            return;
        }
        const checkGoogle = () => {
            if (window.google && window.google.maps) {
                setGoogleReady(true);
            } else {
                setTimeout(checkGoogle, 100);
            }
        };
        checkGoogle();
    }, [apiKey]);

    if (!googleReady) {
        return (
            <div style={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                background: '#050505', 
                color: 'var(--neon-blue)',
                fontFamily: 'monospace'
            }}>
                INITIALIZING SATELLITE UPLINK...
            </div>
        );
    }

    return (
        <div style={{ height: '100%', width: '100%', position: 'relative' }}>
            <MapContainer 
                center={defaultPosition} 
                zoom={15} 
                maxZoom={21}
                style={{ height: '100vh', width: '100%', background: '#050505' }}
                zoomControl={true}
            >
                {apiKey ? (
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
