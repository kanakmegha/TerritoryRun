import React, { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl';
import { useGameStore } from '../../hooks/useGameStore';

const TerritoryOverlay = () => {
    const { territories } = useGameStore();

    const geoJSONData = useMemo(() => {
        if (!Array.isArray(territories) || territories.length === 0) {
            return { type: 'FeatureCollection', features: [] };
        }

        const features = territories.map(t => {
            // MongoDB schemas can represent Polygons slightly differently,
            // but the canonical GeoJSON is what we structured:
            // { type: "Polygon", coordinates: [[[lng, lat], ...]] }
            return {
                type: 'Feature',
                properties: {
                    id: t._id,
                    owner: t.owner,
                    color: t.ownerColor || '#00f3ff',
                    strength: t.strength || 1
                },
                geometry: t.boundary
            };
        });

        // Some invalid boundaries might slip through testing, let's filter them just in case
        return {
            type: 'FeatureCollection',
            features: features.filter(f => f.geometry && f.geometry.coordinates)
        };
    }, [territories]);

    return (
        <Source id="territories-source" type="geojson" data={geoJSONData}>
            <Layer
                id="territories-fill"
                type="fill"
                paint={{
                    'fill-color': ['get', 'color'],
                    'fill-opacity': 0.4
                }}
            />
            <Layer
                id="territories-line"
                type="line"
                paint={{
                    'line-color': ['get', 'color'],
                    'line-width': 2,
                    'line-opacity': 0.8
                }}
            />
        </Source>
    );
};

export default TerritoryOverlay;
