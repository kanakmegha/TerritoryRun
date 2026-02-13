import { Polygon, useMap } from 'react-leaflet';
import { cellToBoundary } from 'h3-js';
import { useGameStore } from '../../hooks/useGameStore';
import { useEffect, useState } from 'react';

const HexGrid = () => {
    const { claimedCells } = useGameStore();
    const [hexagons, setHexagons] = useState([]);
    
    useEffect(() => {
        const newHexagons = Object.entries(claimedCells).map(([index, data]) => {
            const boundary = cellToBoundary(index);
            // h3 returns [lat, lng], Leaflet expects [lat, lng]
            return {
                index,
                positions: boundary,
                color: data.color
            };
        });
        setHexagons(newHexagons);
    }, [claimedCells]);

    return (
        <>
            {hexagons.map(hex => (
                <Polygon 
                    key={hex.index}
                    positions={hex.positions}
                    pathOptions={{ 
                        color: hex.color, 
                        fillColor: hex.color, 
                        fillOpacity: 0.4,
                        weight: 2
                    }}
                />
            ))}
        </>
    );
};

export default HexGrid;
