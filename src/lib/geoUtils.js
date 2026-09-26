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
 * Safely parses any date/time string into a UTC epoch timestamp in milliseconds.
 * Prevents local timezone parsing discrepancies (e.g. UTC stored timestamps without 'Z' being parsed as local time).
 */
export function parseUtcTimestamp(timeInput) {
  if (!timeInput) return NaN;
  if (typeof timeInput === 'number') return timeInput;
  if (timeInput instanceof Date) return timeInput.getTime();

  let str = String(timeInput).trim();
  if (!str) return NaN;

  // If format is like "YYYY-MM-DD HH:mm:ss...", replace space with T
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) {
    str = str.replace(/\s+/, 'T');
  }

  // If no timezone offset (Z or +/-HH or +/-HH:mm), append Z so it parses strictly as UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(str)) {
    str = str + 'Z';
  } else if (!/[zZ]|([+-]\d{2}(:?\d{2})?)$/.test(str)) {
    str = str + 'Z';
  }

  const parsed = new Date(str).getTime();
  if (!isNaN(parsed)) return parsed;

  return new Date(timeInput).getTime();
}

/**
 * Determines whether a rider is online based on status/is_online flag and last_seen timestamp.
 * Considers a driver ONLINE if status === 'online' (or is_online === true) and last_seen was within 10 minutes.
 * Uses strict UTC timestamp parsing to eliminate client timezone mismatches.
 */
export function isDriverOnline(driverOrLastSeen, thresholdMs = 10 * 60 * 1000) {
  if (!driverOrLastSeen) return false;

  if (typeof driverOrLastSeen === 'object') {
    const rider = driverOrLastSeen;
    // Explicit offline check
    if (rider.status === 'offline' || (rider.is_online === false && rider.status !== 'online')) {
      return false;
    }

    const timeStr = rider.last_seen || rider.last_seen_at || rider.last_active_at || rider.updated_at;
    if (!timeStr) {
      return rider.status === 'online' || Boolean(rider.is_online);
    }

    const utcTime = parseUtcTimestamp(timeStr);
    if (isNaN(utcTime)) {
      return rider.status === 'online' || Boolean(rider.is_online);
    }

    const diffMinutes = (Date.now() - utcTime) / (1000 * 60);
    const isStatusOnline = rider.status === 'online' || Boolean(rider.is_online) || rider.status === 'active';
    // Allow a reasonable 10-minute grace window (diffMinutes < 10) with clock drift tolerance
    return isStatusOnline && diffMinutes >= -1 && diffMinutes < (thresholdMs / 60000);
  }

  const utcTime = parseUtcTimestamp(driverOrLastSeen);
  if (isNaN(utcTime)) return false;
  const diffMinutes = (Date.now() - utcTime) / (1000 * 60);
  return diffMinutes >= -1 && diffMinutes < (thresholdMs / 60000);
}

/**
 * Formats a relative time string (e.g. "Just now", "25 seconds ago", "2m ago") with UTC safety.
 */
export function formatLastSeen(dateStr) {
  if (!dateStr) return 'Offline (No GPS signal)';
  try {
    const time = parseUtcTimestamp(dateStr);
    if (isNaN(time)) return 'Offline (No GPS signal)';
    const diff = Math.floor((Date.now() - time) / 1000);
    if (diff < 10) return 'Just now';
    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(time).toLocaleDateString();
  } catch {
    return 'Offline (No GPS signal)';
  }
}
