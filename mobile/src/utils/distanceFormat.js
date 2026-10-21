/**
 * Format a distance in metres for display.
 *
 * Rules:
 * - < 10 m: show centimetres (e.g. "245 cm")
 * - 10 m – 999 m: show metres with one decimal (e.g. "12.4 m")
 * - >= 1000 m: show kilometres with two decimals (e.g. "1.23 km")
 *
 * Distance is always in metres internally; this is purely a display transform.
 */
export function formatDistance(meters) {
  const m = Number(meters) || 0;
  if (m < 0) return { value: '0 cm', unit: 'cm' };
  if (m < 10) return { value: `${Math.round(m * 100)} cm`, unit: 'cm' };
  if (m < 1000) return { value: `${m.toFixed(1)} m`, unit: 'm' };
  return { value: `${(m / 1000).toFixed(2)} km`, unit: 'km' };
}
