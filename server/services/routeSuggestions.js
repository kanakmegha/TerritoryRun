import process from 'node:process';

const EARTH_RADIUS_METERS = 6378137;
const HEADINGS = [0, 90, 180, 270];
const ROUTE_TYPES = ['Urban grid', 'Mainline', 'Park perimeter', 'Mixed terrain'];

function toRadians(degrees) { return degrees * Math.PI / 180; }

function computeDestinationPoint(lat, lng, distanceMeters, bearingDegrees) {
  const lat1 = toRadians(lat);
  const lng1 = toRadians(lng);
  const bearing = toRadians(bearingDegrees);
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing));
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
  );
  return { lat: lat2 * 180 / Math.PI, lng: lng2 * 180 / Math.PI };
}

function decodePolyline(encoded) {
  if (typeof encoded !== 'string' || !encoded) return [];
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    const decodeValue = () => {
      let result = 0;
      let shift = 0;
      let byte;
      do {
        if (index >= encoded.length || shift > 30) throw new Error('Malformed polyline');
        byte = encoded.charCodeAt(index++) - 63;
        if (byte < 0 || byte > 63) throw new Error('Malformed polyline');
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      return (result & 1) ? ~(result >> 1) : result >> 1;
    };
    lat += decodeValue();
    lng += decodeValue();
    const point = { lat: lat / 1e5, lng: lng / 1e5 };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || point.lat < -90 || point.lat > 90 ||
        point.lng < -180 || point.lng > 180) return [];
    points.push(point);
  }
  return points;
}

function calculateClosedPathAreaKm2(points) {
  if (points.length < 4) return null;
  const origin = points[0];
  const latScale = Math.PI * EARTH_RADIUS_METERS / 180;
  const lngScale = latScale * Math.cos(toRadians(origin.lat));
  const projected = points.map(({ lat, lng }) => [(lng - origin.lng) * lngScale, (lat - origin.lat) * latScale]);
  let twiceArea = 0;
  for (let index = 0; index < projected.length; index += 1) {
    const next = (index + 1) % projected.length;
    twiceArea += projected[index][0] * projected[next][1] - projected[next][0] * projected[index][1];
  }
  return Number((Math.abs(twiceArea / 2) / 1_000_000).toFixed(2));
}

function fallbackRoutes(targetDistance) {
  return HEADINGS.map((_, index) => ({
    id: `estimated-${index + 1}`,
    name: `Loop idea ${index + 1}`,
    type: ROUTE_TYPES[index],
    distance: targetDistance,
    area: null,
    polyline: null,
    source: 'estimate',
    verified: false,
    description: 'Approximate distance idea only. Walking directions are unavailable; this route does not follow verified roads.',
  }));
}

function validRequest(body) {
  const { lat, lng, targetDistance } = body || {};
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
      typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { status: 400, body: { success: false, code: 'invalid_coordinates', message: 'Latitude and longitude must be valid numbers.' } };
  }
  if (typeof targetDistance !== 'number' || !Number.isFinite(targetDistance) || targetDistance <= 0) {
    return { status: 400, body: { success: false, code: 'invalid_target_distance', message: 'Target distance must be a positive number.' } };
  }
  return { lat, lng, targetDistance };
}

export async function createRouteSuggestionResult({
  body,
  apiKey = process.env.GOOGLE_CONSOLE_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY,
  fetchImpl = globalThis.fetch,
}) {
  const parsed = validRequest(body);
  if (parsed.status) return parsed;
  const { lat, lng, targetDistance } = parsed;
  if (!apiKey || typeof fetchImpl !== 'function') {
    return { status: 200, body: { success: true, source: 'estimate', routes: fallbackRoutes(targetDistance) } };
  }

  const routes = await Promise.all(HEADINGS.map(async (heading, index) => {
    const legLength = targetDistance * 1000 / 3.2;
    const firstWaypoint = computeDestinationPoint(lat, lng, legLength, heading);
    const secondWaypoint = computeDestinationPoint(firstWaypoint.lat, firstWaypoint.lng, legLength, heading + 120);
    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.set('origin', `${lat},${lng}`);
    url.searchParams.set('destination', `${lat},${lng}`);
    url.searchParams.set('waypoints', `${firstWaypoint.lat},${firstWaypoint.lng}|${secondWaypoint.lat},${secondWaypoint.lng}`);
    url.searchParams.set('mode', 'walking');
    url.searchParams.set('key', apiKey);

    try {
      const response = await fetchImpl(url);
      const data = await response.json();
      const route = data?.status === 'OK' ? data.routes?.[0] : null;
      const polyline = route?.overview_polyline?.points;
      let points;
      try { points = decodePolyline(polyline); } catch { points = []; }
      const meters = route?.legs?.reduce((sum, leg) => sum + (Number(leg?.distance?.value) || 0), 0);
      if (!response.ok || !route || points.length < 2 || !Number.isFinite(meters) || meters <= 0) {
        return fallbackRoutes(targetDistance)[index];
      }
      return {
        id: `walking-${index + 1}`,
        name: `Walking route ${index + 1}`,
        type: ROUTE_TYPES[index],
        distance: Number((meters / 1000).toFixed(1)),
        area: calculateClosedPathAreaKm2(points),
        polyline,
        source: 'google_directions',
        verified: true,
        description: 'Walking directions from Google Maps.',
      };
    } catch {
      return fallbackRoutes(targetDistance)[index];
    }
  }));

  return { status: 200, body: { success: true, source: 'mixed', routes } };
}
