import { useEffect, useMemo } from 'react';
import { Source, Layer } from 'react-map-gl';
import { cellToBoundary } from 'h3-js';
import { useGameStore } from '../../hooks/useGameStore';

const HexGrid = () => {
    const { claimedCells, contestedTiles } = useGameStore();
    
    // Memoize the GeoJSON to prevent unnecessary re-computes on every minor state change
    const { claimedGeoJSON, contestedGeoJSON, glitchGeoJSON } = useMemo(() => {
        const claimedFeatures = [];
        const contestedFeatures = [];
        const glitchFeatures = [];

        // Build Claimed Cells
        Object.entries(claimedCells).forEach(([index, data]) => {
            try {
                if (!index || index === 'undefined') return;
                // cellToBoundary(index, true) returns [lng, lat] for GeoJSON
                const boundary = cellToBoundary(index, true);
                if (!boundary || boundary.length === 0) return;
                
                // GeoJSON polygons need to close the loop (first point === last point)
                const coordinates = [...boundary, boundary[0]];
                
                const feature = {
                    type: 'Feature',
                    properties: { color: data.color || '#00f3ff' },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [coordinates]
                    }
                };
                
                if (data.glitch) {
                    glitchFeatures.push(feature);
                } else {
                    claimedFeatures.push(feature);
                }
            } catch (e) {
                console.warn("Invalid H3 index in claimedCells:", index);
            }
        });
        
        // Build Contested Tiles
        Object.entries(contestedTiles).forEach(([index, data]) => {
            try {
                if (!index || index === 'undefined') return;
                const boundary = cellToBoundary(index, true);
                if (!boundary || boundary.length === 0) return;
                
                const coordinates = [...boundary, boundary[0]];
                
                const feature = {
                    type: 'Feature',
                    properties: { color: '#ff0000' },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [coordinates]
                    }
                };
                
                if (data.glitch) {
                    glitchFeatures.push(feature); // Treat contested glitches like normal glitches visually, or separate them
                } else {
                    contestedFeatures.push(feature);
                }
            } catch (e) {
                console.warn("Invalid H3 index in contestedTiles:", index);
            }
        });
        
        return {
            claimedGeoJSON: { type: 'FeatureCollection', features: claimedFeatures },
            contestedGeoJSON: { type: 'FeatureCollection', features: contestedFeatures },
            glitchGeoJSON: { type: 'FeatureCollection', features: glitchFeatures },
        };
    }, [claimedCells, contestedTiles]);

    return (
        <>
            {/* Claimed Cells (Blue mostly) */}
            <Source id="claimed-hexes" type="geojson" data={claimedGeoJSON}>
                <Layer 
                    id="claimed-hexes-fill"
                    type="fill"
                    paint={{
                        'fill-color': ['get', 'color'],
                        'fill-opacity': 0.4
                    }}
                />
                <Layer 
                    id="claimed-hexes-line"
                    type="line"
                    paint={{
                        'line-color': ['get', 'color'],
                        'line-width': 2
                    }}
                />
            </Source>
            
            {/* Contested Cells (Red) */}
            <Source id="contested-hexes" type="geojson" data={contestedGeoJSON}>
                <Layer 
                    id="contested-hexes-fill"
                    type="fill"
                    paint={{
                        'fill-color': ['get', 'color'],
                        'fill-opacity': 0.3
                    }}
                />
                <Layer 
                    id="contested-hexes-line"
                    type="line"
                    paint={{
                        'line-color': ['get', 'color'],
                        'line-width': 2
                    }}
                />
            </Source>

            {/* Glitch Cells (Animated/Bright) */}
            <Source id="glitch-hexes" type="geojson" data={glitchGeoJSON}>
                <Layer 
                    id="glitch-hexes-fill"
                    type="fill"
                    paint={{
                        'fill-color': ['get', 'color'],
                        'fill-opacity': 0.8
                    }}
                />
                <Layer 
                    id="glitch-hexes-line"
                    type="line"
                    paint={{
                        'line-color': ['get', 'color'],
                        'line-width': 4
                    }}
                />
            </Source>
        </>
    );
};

export default HexGrid;
