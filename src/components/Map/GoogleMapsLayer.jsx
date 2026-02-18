import { createLayerComponent } from '@react-leaflet/core';
import L from 'leaflet';
import 'leaflet.gridlayer.googlemutant';

const createGoogleLayer = (props, context) => {
    const instance = L.gridLayer.googleMutant({
        type: props.type || 'satellite',
        maxZoom: 21,
        maxNativeZoom: 21
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
