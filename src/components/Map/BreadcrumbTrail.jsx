import { Polyline } from 'react-leaflet';
import { useGameStore } from '../../hooks/useGameStore';

const BreadcrumbTrail = () => {
    const { currentRun } = useGameStore();

    if (!currentRun.isActive || currentRun.path.length === 0) {
        return null;
    }

    // Convert path to position format expected by Leaflet
    const positions = currentRun.path.map(p => [p.lat, p.lng]);

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
