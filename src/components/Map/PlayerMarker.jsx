import { useEffect, useState } from 'react';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
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
    const { claimCell } = useGameStore();

    useEffect(() => {
        // Simple geolocation for now
        map.locate().on("locationfound", function (e) {
            setPosition(e.latlng);
            map.flyTo(e.latlng, map.getZoom());
            claimCell(e.latlng.lat, e.latlng.lng);
        });
    }, [map]);
    
    // Debug: Click to teleport and claim
    useMapEvents({
        click(e) {
            setPosition(e.latlng);
            claimCell(e.latlng.lat, e.latlng.lng);
        }
    });

    return position === null ? null : (
        <Marker position={position}>
            <Popup>You are here</Popup>
        </Marker>
    );
};

export default PlayerMarker;
