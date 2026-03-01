/**
 * Road Validation Utility
 * 
 * Uses Google Reverse Geocoding to determine whether the user's
 * current GPS position is on a road/route.
 * 
 * Road types we consider valid:
 *   - route         (main street name)
 *   - street_address
 *   - intersection
 *
 * If none of these types appear in the reverse geocode result,
 * the user is considered off-road (park, field, building interior, etc.)
 */

const GOOGLE_API_KEY = 'AIzaSyA5s3Vt45Ix0mHN19g59ozhWtpsRQ-_uOQ';

// Cache the last result to avoid burning API quota on every GPS tick.
// We only re-check if the user has moved more than 15m OR every 5 seconds.
let lastCheckResult = { isOnRoad: true, lat: null, lng: null, timestamp: 0 };
const MIN_DISTANCE_FOR_RECHECK = 15; // metres
const MIN_TIME_FOR_RECHECK = 5000;   // milliseconds

const haversineM = (lat1, lng1, lat2, lng2) => {
    const R = 6378137;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Returns { isOnRoad: boolean, roadName: string | null }
 * isOnRoad = true  → position is on a drivable/walkable road
 * isOnRoad = false → position is off-road (field, park, building, etc.)
 */
export const checkIfOnRoad = async (lat, lng) => {
    const now = Date.now();
    const timeSinceLast = now - lastCheckResult.timestamp;

    // Only re-hit the API if enough time/distance has passed
    if (lastCheckResult.lat !== null) {
        const dist = haversineM(lastCheckResult.lat, lastCheckResult.lng, lat, lng);
        if (dist < MIN_DISTANCE_FOR_RECHECK && timeSinceLast < MIN_TIME_FOR_RECHECK) {
            return { isOnRoad: lastCheckResult.isOnRoad, roadName: lastCheckResult.roadName };
        }
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}&result_type=route|street_address|intersection`;
        const response = await fetch(url);
        const data = await response.json();

        let isOnRoad = false;
        let roadName = null;

        if (data.status === 'OK' && data.results.length > 0) {
            // The API returns results ordered by specificity.
            // Check if any top result has a road-related type.
            const roadTypes = ['route', 'street_address', 'intersection'];
            for (const result of data.results.slice(0, 3)) {
                const hasRoadType = result.types.some(t => roadTypes.includes(t));
                if (hasRoadType) {
                    isOnRoad = true;
                    // Extract the street name from address components
                    const routeComponent = result.address_components?.find(c => c.types.includes('route'));
                    roadName = routeComponent?.long_name || result.formatted_address?.split(',')[0];
                    break;
                }
            }
        } else {
            // Strictly enforce road visibility. 
            // If Google can't find a route/street at this point, it's off-road.
            isOnRoad = false;
        }

        // Cache the result
        lastCheckResult = { isOnRoad, roadName, lat, lng, timestamp: now };
        return { isOnRoad, roadName };

    } catch (err) {
        console.warn('[RoadValidator] API call failed, assuming on-road:', err.message);
        // Fail open: if network/API error, don't block the user
        return { isOnRoad: true, roadName: null };
    }
};

/** Reset the cache (call when tracking stops) */
export const resetRoadValidatorCache = () => {
    lastCheckResult = { isOnRoad: true, lat: null, lng: null, timestamp: 0 };
};
