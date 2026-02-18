import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import PlayerMarker from './PlayerMarker';
import HexGrid from './HexGrid';
import InvasionSimulator from './InvasionSimulator';
import ReclaimHandler from './ReclaimHandler';
import BreadcrumbTrail from './BreadcrumbTrail';

const MapView = () => {
  // Default position: San Francisco (placeholder)
  const defaultPosition = [37.7749, -122.4194];

  return (
    <MapContainer 
      center={defaultPosition} 
      zoom={15} 
      maxZoom={22}
      style={{ height: '100%', width: '100%', background: '#050505' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
        maxZoom={22}
        maxNativeZoom={20}
        className="map-tiles"
      />
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
