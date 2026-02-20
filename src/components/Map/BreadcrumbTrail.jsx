import { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl';
import { useGameStore } from '../../hooks/useGameStore';

const BreadcrumbTrail = () => {
    const { currentRun } = useGameStore();

    const geojsonData = useMemo(() => {
        if (!currentRun.isActive || currentRun.path.length === 0) {
            return null;
        }

        // Convert path to [lng, lat] format expected by GeoJSON
        const coordinates = currentRun.path.map(p => {
            if (Array.isArray(p) && p.length === 2) {
                if (typeof p[0] === 'number' && typeof p[1] === 'number' && !isNaN(p[0]) && !isNaN(p[1])) {
                    return [p[1], p[0]]; // [lng, lat]
                }
            } else if (typeof p === 'object' && p !== null && typeof p.lat === 'number' && typeof p.lng === 'number') {
                if (!isNaN(p.lat) && !isNaN(p.lng)) {
                    return [p.lng, p.lat];
                }
            }
            return null;
        }).filter(p => p !== null);

        if (coordinates.length < 2) return null;

        return {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates
            }
        };
    }, [currentRun.isActive, currentRun.path]);

    if (!geojsonData) return null;

    return (
        <Source id="breadcrumb-trail" type="geojson" data={geojsonData}>
            {/* Glowing effect polyline underneath */}
            <Layer 
                id="breadcrumb-glow"
                type="line"
                paint={{
                    'line-color': '#00ffea',
                    'line-width': 8,
                    'line-opacity': 0.15
                }}
                layout={{
                    'line-cap': 'round',
                    'line-join': 'round'
                }}
            />
            {/* Main Trail */}
            <Layer 
                id="breadcrumb-main"
                type="line"
                paint={{
                    'line-color': '#00ffea',
                    'line-width': 3,
                    'line-opacity': 0.8
                }}
                layout={{
                    'line-cap': 'round',
                    'line-join': 'round'
                }}
            />
        </Source>
    );
};

export default BreadcrumbTrail;
