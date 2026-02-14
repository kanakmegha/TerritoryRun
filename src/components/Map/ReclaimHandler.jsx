import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { useGameStore } from '../../hooks/useGameStore';

/**
 * Invisible component that listens for reclaim events and centers the map
 */
const ReclaimHandler = () => {
    const map = useMap();
    const { showReclaimButton, centerOnLostTiles, lostTiles, startContinuousRun, contestedTiles } = useGameStore();

    useEffect(() => {
        // When reclaim button becomes visible, we can optionally auto-center
        // For now, we'll let the user click the button to center
    }, [showReclaimButton]);

    // Expose centerAndStartReclaim function globally for Dashboard
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.territoryRun_centerOnLostTiles = () => {
                const center = centerOnLostTiles();
                if (center && map) {
                    map.flyTo(center, 16, { duration: 1.5 });
                    
                    // Auto-start GPS tracking for reclaiming
                    if (Object.keys(contestedTiles).length > 0) {
                        setTimeout(() => {
                            startContinuousRun();
                        }, 1600); // Start after map animation completes
                    }
                }
            };
        }
    }, [map, centerOnLostTiles, lostTiles, startContinuousRun, contestedTiles]);

    return null;
};

export default ReclaimHandler;
