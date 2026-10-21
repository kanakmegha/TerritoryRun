const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

export function hasUsableCoordinates(position) {
  const { lat, lng } = position || {};
  return isFiniteNumber(lat) && lat >= -90 && lat <= 90 &&
    isFiniteNumber(lng) && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
}

export function buildRouteSuggestionRequest(position, targetDistance) {
  if (!hasUsableCoordinates(position) || !isFiniteNumber(targetDistance) || targetDistance <= 0) return null;
  return { targetDistance, lat: position.lat, lng: position.lng };
}

export function decodeRoutePolyline(encoded) {
  if (typeof encoded !== 'string' || encoded.length === 0) return [];
  const coordinates = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  try {
    while (index < encoded.length) {
      let result = 0;
      let shift = 0;
      let byte;
      do {
        if (index >= encoded.length || shift > 30) return [];
        byte = encoded.charCodeAt(index++) - 63;
        if (byte < 0 || byte > 63) return [];
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      latitude += (result & 1) ? ~(result >> 1) : result >> 1;

      result = 0;
      shift = 0;
      do {
        if (index >= encoded.length || shift > 30) return [];
        byte = encoded.charCodeAt(index++) - 63;
        if (byte < 0 || byte > 63) return [];
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      longitude += (result & 1) ? ~(result >> 1) : result >> 1;

      const lat = latitude / 1e5;
      const lng = longitude / 1e5;
      if (!isFiniteNumber(lat) || !isFiniteNumber(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return [];
      coordinates.push({ latitude: lat, longitude: lng });
    }
  } catch {
    return [];
  }
  return coordinates;
}

export function normalizeSuggestedRoute(route) {
  if (!route || typeof route !== 'object' || typeof route.id !== 'string') return null;
  const distance = Number(route.distance);
  if (!Number.isFinite(distance) || distance <= 0) return null;
  const coordinates = decodeRoutePolyline(route.polyline);
  const verified = route.source === 'google_directions' && route.verified === true && coordinates.length >= 2;
  return {
    ...route,
    distance,
    area: Number.isFinite(Number(route.area)) && route.area != null ? Number(route.area) : null,
    coordinates: verified ? coordinates : [],
    verified,
  };
}

export function normalizeSuggestedRoutes(routes) {
  if (!Array.isArray(routes)) return [];
  return routes.map(normalizeSuggestedRoute).filter(Boolean);
}
