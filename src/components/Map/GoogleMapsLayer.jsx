import { createLayerComponent } from '@react-leaflet/core';
import L from 'leaflet';
import 'leaflet.gridlayer.googlemutant';

const createGoogleLayer = (props, context) => {
    if (!L.gridLayer.googleMutant) {
        console.error("L.gridLayer.googleMutant is not defined. Ensure leaflet.gridlayer.googlemutant is loaded.");
        // Fallback to a standard grid layer or throw
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
