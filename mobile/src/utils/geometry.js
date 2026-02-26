// Calculate area using the Shoelace Formula
// Inputs are arrays of [lat, lng]
// Note: Earth's surface is curved, so standard Shoelace on lat/lng needs projection.
// For small game loops, we approximate meters per degree at the given latitude.

const R = 6378137; // Earth radius in meters

// Helper to convert degrees to radians
export const toRad = (degree) => (degree * Math.PI) / 180;

/**
 * Calculates the approximate area of a polygon defined by lat/lng coordinates
 * using the Shoelace formula projected to meters.
 * @param {Array<Array<number>>} path - Array of [lat, lng] coordinates
 * @returns {number} Area in square meters (m²)
 */
export const calculatePolygonArea = (path) => {
    if (!path || path.length < 3) return 0;

    // Use the first point as the reference latitude for projection scaling
    const refLat = toRad(path[0][0]);
    
    // Conversion factors: degrees to meters
    const metersPerLatDegree = (2 * Math.PI * R) / 360; 
    const metersPerLngDegree = metersPerLatDegree * Math.cos(refLat);

    let area = 0;
    const n = path.length;

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        
        // Convert lat/lng to projected X/Y in meters (relative to 0,0)
        const x1 = path[i][1] * metersPerLngDegree;
        const y1 = path[i][0] * metersPerLatDegree;
        
        const x2 = path[j][1] * metersPerLngDegree;
        const y2 = path[j][0] * metersPerLatDegree;

        // Shoelace step
        area += (x1 * y2) - (y1 * x2);
    }

    return Math.abs(area / 2);
};

/**
 * Check if the loop is effectively closed.
 * @param {Array<Array<number>>} path - Array of [lat, lng]
 * @param {number} maxGapMeters - Max allowable distance between start and end
 * @param {function} distanceCalc - Distance function (e.g. Haversine)
 */
export const isPathClosed = (path, maxGapMeters, distanceCalc) => {
    if (path.length < 3) return false;
    const start = path[0];
    const end = path[path.length - 1];
    
    const gap = distanceCalc(start[0], start[1], end[0], end[1]);
    return gap <= maxGapMeters;
};

/**
 * Standard Haversine distance
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2-lat1);
    const Δλ = toRad(lon2-lon1);
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

/**
 * Returns minimum distance in meters from a point to a line segment 
 * defined by [lat1, lng1] and [lat2, lng2].
 * Approximation uses Pythagorean on Equirectangular projection for speed locally.
 */
export const distanceToSegment = (pLat, pLng, vLat, vLng, wLat, wLng) => {
    // Convert to pseudo-meters relative to point V
    const refLat = toRad(vLat);
    const mLat = (2 * Math.PI * R) / 360; 
    const mLng = mLat * Math.cos(refLat);

    const px = (pLng - vLng) * mLng;
    const py = (pLat - vLat) * mLat;
    const wx = (wLng - vLng) * mLng;
    const wy = (wLat - vLat) * mLat;

    const l2 = wx*wx + wy*wy; // Length squared
    if (l2 === 0) return Math.sqrt(px*px + py*py); // v == w

    // Consider the line extending the segment, parameterized as v + t (w - v).
    // Find projection of point p onto the line.
    let t = ((px * wx) + (py * wy)) / l2;
    t = Math.max(0, Math.min(1, t)); // constrain to segment bounds

    const projX = t * wx;
    const projY = t * wy;

    const dx = px - projX;
    const dy = py - projY;
    return Math.sqrt(dx*dx + dy*dy);
};

/**
 * Checks if a coordinate is within thresholdMeters of ANY edge of a GeoJSON Polygon
 * boundary: [[[lng, lat], [lng, lat]...]]
 */
export const isNearPolygonBoundary = (lat, lng, boundary, thresholdMeters = 20) => {
    if (!boundary || !boundary.coordinates || !boundary.coordinates[0]) return false;
    
    const ring = boundary.coordinates[0]; // [lng, lat]
    for (let i = 0; i < ring.length - 1; i++) {
        // Note: GeoJSON is lng, lat. We need lat, lng for our math.
        const vLng = ring[i][0];
        const vLat = ring[i][1];
        const wLng = ring[i+1][0];
        const wLat = ring[i+1][1];
        
        const dist = distanceToSegment(lat, lng, vLat, vLng, wLat, wLng);
        if (dist <= thresholdMeters) return true;
    }
    return false;
};
