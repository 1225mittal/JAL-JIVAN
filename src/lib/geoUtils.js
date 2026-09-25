/**
 * Geospatial and ETA calculation utilities for Jal-Jivan Delivery Dispatch
 */

/**
 * Calculates Haversine distance between two coordinates in meters.
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (
    lat1 === null || lat1 === undefined ||
    lon1 === null || lon1 === undefined ||
    lat2 === null || lat2 === undefined ||
    lon2 === null || lon2 === undefined
  ) {
    return null;
  }
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLon = toRad(Number(lon2) - Number(lon1));
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(Number(lat1))) * Math.cos(toRad(Number(lat2))) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calculates Haversine distance between two coordinates in kilometers.
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const meters = calculateDistanceMeters(lat1, lon1, lat2, lon2);
  if (meters === null) return null;
  return Number((meters / 1000).toFixed(2));
}

/**
 * Calculates road speed ETA in minutes:
 * Uses 25 km/h city average speed + 1.3x road winding factor.
 * Optional prep/handover minutes can be added.
 */
export function calculateEtaMinutes(destLat, destLng, originLat, originLng, avgSpeedKmh = 25, prepMins = 0) {
  if (
    destLat === null || destLat === undefined ||
    destLng === null || destLng === undefined ||
    originLat === null || originLat === undefined ||
    originLng === null || originLng === undefined
  ) {
    return 15; // default safe fallback
  }

  const distKm = calculateDistanceKm(originLat, originLng, destLat, destLng);
  if (distKm === null) return 15;

  const drivingHours = (distKm * 1.3) / avgSpeedKmh;
  const totalMins = Math.round(drivingHours * 60) + prepMins;
  return Math.max(2, totalMins);
}

/**
 * Formats distance in meters or kilometers for human readability.
 */
export function formatDistance(meters) {
  if (meters === null || meters === undefined) return '--';
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Determines whether a rider is online based on is_online flag and last_seen_at timestamp.
 * Considers a driver ONLINE if is_online === true and last_seen_at was within 5 minutes.
 */
export function isDriverOnline(driverOrLastSeen, thresholdMs = 5 * 60 * 1000) {
  if (!driverOrLastSeen) return false;
  if (typeof driverOrLastSeen === 'object') {
    const d = driverOrLastSeen;
    if (d.is_online === false) return false;
    const timeStr = d.last_seen_at || d.last_active_at || d.updated_at;
    if (!timeStr) return Boolean(d.is_online);
    try {
      const diff = Date.now() - new Date(timeStr).getTime();
      return diff >= -60000 && diff < thresholdMs;
    } catch {
      return Boolean(d.is_online);
    }
  }
  try {
    const diff = Date.now() - new Date(driverOrLastSeen).getTime();
    return diff >= -60000 && diff < thresholdMs;
  } catch {
    return false;
  }
}

/**
 * Formats a relative time string (e.g. "Just now", "25 seconds ago", "2m ago").
 */
export function formatLastSeen(dateStr) {
  if (!dateStr) return 'Offline (No GPS signal)';
  try {
    const time = new Date(dateStr).getTime();
    if (isNaN(time)) return 'Offline (No GPS signal)';
    const diff = Math.floor((Date.now() - time) / 1000);
    if (diff < 10) return 'Just now';
    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return 'Offline (No GPS signal)';
  }
}
