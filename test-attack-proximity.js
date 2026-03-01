/**
 * This script tests the proximity logic used in TerritoryRun to detect
 * when a user is running near a territory boundary to trigger an attack.
 */

const distanceToSegment = (pLat, pLng, vLat, vLng, wLat, wLng) => {
    const R = 6378137;
    const toRad = degree => (degree * Math.PI) / 180;
    const mLat = (2 * Math.PI * R) / 360; 
    const mLng = mLat * Math.cos(toRad(vLat));
    const px = (pLng - vLng) * mLng;
    const py = (pLat - vLat) * mLat;
    const wx = (wLng - vLng) * mLng;
    const wy = (wLat - vLat) * mLat;
    const l2 = wx*wx + wy*wy;
    if (l2 === 0) return Math.sqrt(px*px + py*py);
    let t = ((px * wx) + (py * wy)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = t * wx;
    const projY = t * wy;
    return Math.sqrt((px - projX)**2 + (py - projY)**2);
};

const isNearPolygonBoundary = (lat, lng, boundary, thresholdMeters = 15) => {
    const ring = boundary.coordinates[0]; 
    for (let i = 0; i < ring.length - 1; i++) {
        const vLng = ring[i][0];
        const vLat = ring[i][1];
        const wLng = ring[i+1][0];
        const wLat = ring[i+1][1];
        const dist = distanceToSegment(lat, lng, vLat, vLng, wLat, wLng);
        if (dist <= thresholdMeters) return { near: true, distance: dist.toFixed(2) };
    }
    return { near: false };
};

// --- MOCK TERRITORY ---
const mockBoundary = {
    coordinates: [[
        [77.2090, 28.6139],
        [77.2090, 28.6145],
        [77.2092, 28.6145],
        [77.2092, 28.6139],
        [77.2090, 28.6139]
    ]]
};

const testProximity = (name, lat, lng) => {
    console.log(`\n--- Testing Proximity: ${name} ---`);
    console.log(`User at: ${lat}, ${lng}`);
    const result = isNearPolygonBoundary(lat, lng, mockBoundary, 15);
    console.log(`Near Boundary? ${result.near} ${result.near ? `(Dist: ${result.distance}m)` : ''}`);
    if (result.near) {
        console.log("✅ TRIGGER: User is close enough to siphon/attack!");
    } else {
        console.log("❌ IGNORED: User is too far from boundary.");
    }
};

// 1. Right on the edge
testProximity("On Edge", 28.6142, 77.2090);

// 2. Just outside (10m away)
testProximity("Close Outside", 28.6142, 77.2089);

// 3. Far away (50m)
testProximity("Far Away", 28.6142, 77.2085);

// 4. Inside the territory but NOT near boundary
testProximity("Inside Center", 28.6142, 77.2091);
