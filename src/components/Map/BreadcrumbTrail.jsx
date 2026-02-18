import { Polyline } from 'react-leaflet';
import { useGameStore } from '../../hooks/useGameStore';

const BreadcrumbTrail = () => {
    const { currentRun } = useGameStore();

    if (!currentRun.isActive || currentRun.path.length === 0) {
        return null;
    }

    // Convert path to position format expected by Leaflet
    // Store uses [lat, lng] arrays, but sometimes objects {lat, lng} might be present.
    // Ensure each point is a valid coordinate pair [lat, lng].
    const positions = currentRun.path.map(p => {
        if (Array.isArray(p) && p.length === 2) {
            if (typeof p[0] === 'number' && typeof p[1] === 'number' && !isNaN(p[0]) && !isNaN(p[1])) {
                return p;
            }
        } else if (typeof p === 'object' && p !== null && typeof p.lat === 'number' && typeof p.lng === 'number') {
            if (!isNaN(p.lat) && !isNaN(p.lng)) {
                return [p.lat, p.lng];
            }
        }
        return null;
    }).filter(p => p !== null);

    return (
        <>
            <Polyline 
                positions={positions}
                pathOptions={{ 
                    color: '#00ffea', 
                    weight: 3, 
                    opacity: 0.4,
                    lineCap: 'round',
                    lineJoin: 'round'
                }} 
            />
            
            {/* Glowing effect polyline underneath */}
            <Polyline 
                positions={positions}
                pathOptions={{ 
                    color: '#00ffea', 
                    weight: 8, 
                    opacity: 0.15,
                    lineCap: 'round',
                    lineJoin: 'round'
                }} 
            />
        </>
    );
};

export default BreadcrumbTrail;
