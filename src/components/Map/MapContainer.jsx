import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import PlayerMarker from './PlayerMarker';
import HexGrid from './HexGrid';

const MapView = () => {
  // Default position: San Francisco (placeholder)
  const defaultPosition = [37.7749, -122.4194];

  return (
    <MapContainer 
      center={defaultPosition} 
      zoom={15} 
      style={{ height: '100%', width: '100%', background: '#050505' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
    </MapContainer>
  );
};

export default MapView;
