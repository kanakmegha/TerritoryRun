import { Polygon, useMap } from 'react-leaflet';
import { cellToBoundary } from 'h3-js';
import { useGameStore } from '../../hooks/useGameStore';
import { useEffect, useState } from 'react';

const HexGrid = () => {
    const { claimedCells, contestedTiles } = useGameStore();
    const [hexagons, setHexagons] = useState([]);
    
    useEffect(() => {
        const hexagons = Object.entries(claimedCells).map(([index, data]) => {
            const boundary = cellToBoundary(index);
            // h3 returns [lat, lng], Leaflet expects [lat, lng]
            return {
                index,
                positions: boundary,
                color: data.color,
                glitch: data.glitch || false
            };
        });
        
        // Add contested tiles (red)
        const contestedHexagons = Object.entries(contestedTiles).map(([index, data]) => {
            const boundary = cellToBoundary(index);
            return {
                index,
                positions: boundary,
                color: '#ff0000', // Red for contested
                glitch: data.glitch || false,
                contested: true,
                key: `${index}-${data.originalOwner || 'rival'}`
            };
        });
        
        setHexagons([...hexagons, ...contestedHexagons]);
    }, [claimedCells, contestedTiles]);

    return (
        <>
            {hexagons.map(hex => (
                <Polygon 
                    key={hex.index}
                    positions={hex.positions}
                    pathOptions={{ 
                        color: hex.color, 
                        fillColor: hex.color, 
                        fillOpacity: hex.glitch ? 0.8 : (hex.contested ? 0.3 : 0.4),
                        weight: hex.glitch ? 4 : 2,
                        className: hex.glitch ? 'hex-glitch' : ''
                    }}
                />
            ))}
            
            {/* Glitch Animation CSS */}
            <style>{`
                @keyframes glitch {
                    0%, 100% { opacity: 0.8; filter: brightness(1.5); }
                    25% { opacity: 0.3; filter: brightness(0.5) hue-rotate(45deg); }
                    50% { opacity: 1; filter: brightness(2) hue-rotate(-45deg); }
                    75% { opacity: 0.5; filter: brightness(0.8) hue-rotate(90deg); }
                }
                
                .hex-glitch {
                    animation: glitch 0.5s ease-in-out;
                }
            `}</style>
        </>
    );
};

export default HexGrid;
