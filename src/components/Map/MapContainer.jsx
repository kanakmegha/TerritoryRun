import { useState, useEffect } from 'react';
import { MapContainer, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import PlayerMarker from './PlayerMarker';
import HexGrid from './HexGrid';
import InvasionSimulator from './InvasionSimulator';
import ReclaimHandler from './ReclaimHandler';
import BreadcrumbTrail from './BreadcrumbTrail';
import GoogleMapsLayer from './GoogleMapsLayer';

const MapView = () => {
  const [googleReady, setGoogleReady] = useState(false);
  // Default position: San Francisco (placeholder)
  const defaultPosition = [37.7749, -122.4194];

  useEffect(() => {
    const checkGoogle = () => {
      if (window.google && window.google.maps) {
        setGoogleReady(true);
      } else {
        setTimeout(checkGoogle, 100);
      }
    };
    checkGoogle();
  }, []);

  if (!googleReady) {
    return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505', color: 'var(--neon-blue)' }}>INITIALIZING SATELLITE UPLINK...</div>;
  }
  return (
    <MapContainer 
      center={defaultPosition} 
      zoom={15} 
      maxZoom={21}
      style={{ height: '100%', width: '100%', background: '#050505' }}
      zoomControl={true}
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Google Satellite (Hybrid)">
          <GoogleMapsLayer type="hybrid" />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Google Roadmap">
          <GoogleMapsLayer type="roadmap" />
        </LayersControl.BaseLayer>
      </LayersControl>
      {/* Dark mode filter for tiles */}
      <style>{`
        .map-tiles {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
      `}</style>
      
      <PlayerMarker />
      <HexGrid />
      <BreadcrumbTrail />
      <InvasionSimulator />
      <ReclaimHandler />
    </MapContainer>
  );
};

export default MapView;
