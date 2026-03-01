/**
 * This script tests the geometric logic used in TerritoryRun to decide
 * whether a closed loop should be stored as a territory.
 */

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6378137;
    const toRad = degree => (degree * Math.PI) / 180;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const calculatePolygonArea = (path) => {
    if (!path || path.length < 3) return 0;
    const R = 6378137;
    const toRad = degree => (degree * Math.PI) / 180;
    const refLat = toRad(path[0][0]);
    const metersPerLatDegree = (2 * Math.PI * R) / 360; 
    const metersPerLngDegree = metersPerLatDegree * Math.cos(refLat);
    let area = 0;
    const n = path.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const x1 = path[i][1] * metersPerLngDegree;
        const y1 = path[i][0] * metersPerLatDegree;
        const x2 = path[j][1] * metersPerLngDegree;
        const y2 = path[j][0] * metersPerLatDegree;
        area += (x1 * y2) - (y1 * x2);
    }
    return Math.abs(area / 2);
};

const isPathClosed = (path, maxGapMeters) => {
    if (path.length < 3) return false;
    const start = path[0];
    const end = path[path.length - 1];
    const gap = calculateDistance(start[0], start[1], end[0], end[1]);
    return gap <= maxGapMeters;
};

// --- TEST CASES ---

const testLoop = (name, path) => {
    console.log(`\n--- Testing: ${name} ---`);
    const isClosed = isPathClosed(path, 50);
    const perimeter = path.reduce((acc, curr, i) => {
        if (i === 0) return 0;
        return acc + calculateDistance(path[i-1][0], path[i-1][1], curr[0], curr[1]);
    }, 0);
    const area = calculatePolygonArea(path);

    console.log(`Closed (Threshold 50m): ${isClosed}`);
    console.log(`Perimeter: ${perimeter.toFixed(1)}m (Req: 100m)`);
    console.log(`Area: ${area.toFixed(1)}m² (Req: 50m²)`);

    if (!isClosed) console.log("❌ REJECTED: Loop not closed.");
    else if (perimeter < 100) console.log("❌ REJECTED: Perimeter too small.");
    else if (area < 50) console.log("❌ REJECTED: Area too small / Path too narrow.");
    else console.log("✅ ACCEPTED: Store as territory!");
};

// 1. Valid Square Loop (~110m perimeter, ~770m² area)
testLoop("Valid Square", [
    [28.6139, 77.2090],
    [28.6141, 77.2090],
    [28.6141, 77.2092],
    [28.6139, 77.2092],
    [28.61391, 77.20901] // Closed within <50m
]);

// 2. Open Loop (Start and end too far apart)
testLoop("Open Loop", [
    [28.6139, 77.2090],
    [28.6141, 77.2090],
    [28.6141, 77.2092],
    [28.6145, 77.2095] // Far away
]);

// 3. Tiny Loop (Perimeter 40m, Area 100m²)
testLoop("Tiny Loop", [
    [28.6139, 77.2090],
    [28.6140, 77.2090],
    [28.6140, 77.2091],
    [28.6139, 77.2091],
    [28.6139, 77.2090]
]);

// 4. Narrow Line (Area < 50)
testLoop("Narrow Line", [
    [28.6139, 77.2090],
    [28.6145, 77.2090], // Long vertical line
    [28.6145, 77.2090001], // Extremely close
    [28.6139, 77.2090],
]);
