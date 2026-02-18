import { createLayerComponent } from '@react-leaflet/core';
import L from 'leaflet';
window.L = L; // Fix for plugins that expect global L
import 'leaflet.gridlayer.googlemutant';

const createGoogleLayer = (props, context) => {
    if (!L.gridLayer.googleMutant) {
        console.error("L.gridLayer.googleMutant is not defined. Ensure leaflet.gridlayer.googlemutant is loaded.");
        return null;
    }

    if (typeof google === 'undefined' || !google.maps) {
        console.error("Google Maps API not loaded. Check script in index.html and API key.");
        return null;
    }
    const instance = L.gridLayer.googleMutant({
        type: props.type || 'satellite',
        maxZoom: 21,
        maxNativeZoom: 21,
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    });
    return { instance, context };
};

const updateGoogleLayer = (instance, props, prevProps) => {
    if (props.type !== prevProps.type) {
        instance.setElement(props.type);
    }
};

const GoogleMapsLayer = createLayerComponent(createGoogleLayer, updateGoogleLayer);

export default GoogleMapsLayer;
