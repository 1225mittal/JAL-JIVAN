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

/**
 * Calculates a rider's movement status based on active tasks, recent deliveries, and base hub proximity:
 * - "🚀 En Route to Delivery" (Amber/Orange) if assigned order in 'out_for_delivery', 'in_transit', or 'dispatched'
 * - "🏠 Returning to Base" (Cyan/Blue) if order marked 'delivered' in last 45m and rider not within 50m of hub
 * - "🟢 Available at Base Hub" (Green) if rider is online and within 50m of base coordinates (28.667, 77.385)
 * - "⚪ Offline / Idle" (Slate) otherwise
 */
export function calculateRiderMovementStatus(rider, orders = [], baseCoords = { lat: 28.667, lng: 77.385 }) {
  if (!rider) {
    return {
      type: 'OFFLINE_IDLE',
      status: '⚪ Offline / Idle',
      badgeColor: 'slate',
      targetAddress: null,
      destinationCoords: null
    };
  }

  const riderOrders = orders.filter(
    (o) => o.assigned_driver_id === rider.id || o.driver_id === rider.id
  );

  const lat = rider.current_lat !== undefined && rider.current_lat !== null
    ? Number(rider.current_lat)
    : null;
  const lng = rider.current_lng !== undefined && rider.current_lng !== null
    ? Number(rider.current_lng)
    : null;
  const hasRiderCoords = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng);

  const baseLat = baseCoords?.lat || 28.667;
  const baseLng = baseCoords?.lng || 77.385;

  const distToBase = hasRiderCoords
    ? calculateDistanceMeters(lat, lng, baseLat, baseLng)
    : null;

  // 1. Active delivery check ('out_for_delivery', 'in_transit', or 'dispatched')
  const activeDelivery = riderOrders.find((o) => {
    const s = (o.status || '').toLowerCase().replace(/\s+/g, '_');
    return s === 'out_for_delivery' || s === 'in_transit' || s === 'dispatched';
  });

  if (activeDelivery) {
    const targetAddress = activeDelivery.address || activeDelivery.landmark || 'Customer Address';
    const destCoords = (activeDelivery.latitude !== null && activeDelivery.latitude !== undefined && activeDelivery.longitude !== null && activeDelivery.longitude !== undefined && !isNaN(activeDelivery.latitude) && !isNaN(activeDelivery.longitude))
      ? { lat: Number(activeDelivery.latitude), lng: Number(activeDelivery.longitude) }
      : null;

    return {
      type: 'EN_ROUTE',
      status: '🚀 En Route to Delivery',
      badgeColor: 'amber',
      targetAddress,
      activeOrder: activeDelivery,
      destinationCoords: destCoords,
      distToBase
    };
  }

  // 2. Returning to base check: delivered within last 45 minutes and not at central hub (> 50m)
  const isAtHub = distToBase !== null && distToBase <= 50;

  const deliveredOrders = riderOrders.filter((o) => {
    const s = (o.status || '').toLowerCase();
    return s === 'delivered';
  });

  let recentDeliveredOrder = null;
  let minDeliveredDiffMins = 9999;

  deliveredOrders.forEach((o) => {
    const deliveredTimeStr = o.delivered_at || o.delivered_time || o.completed_at || o.updated_at;
    if (deliveredTimeStr) {
      const utcTime = parseUtcTimestamp(deliveredTimeStr);
      if (!isNaN(utcTime)) {
        const diffMins = (Date.now() - utcTime) / (1000 * 60);
        if (diffMins >= 0 && diffMins <= 45 && diffMins < minDeliveredDiffMins) {
          minDeliveredDiffMins = diffMins;
          recentDeliveredOrder = o;
        }
      }
    }
  });

  if (recentDeliveredOrder && !isAtHub) {
    return {
      type: 'RETURNING',
      status: '🏠 Returning to Base',
      badgeColor: 'cyan',
      targetAddress: null,
      recentOrder: recentDeliveredOrder,
      destinationCoords: { lat: baseLat, lng: baseLng },
      distToBase
    };
  }

  // 3. Available at Base Hub check: online and within 50m of base coordinates
  const isOnline = isDriverOnline(rider);
  if (isOnline && isAtHub) {
    return {
      type: 'AT_BASE',
      status: '🟢 Available at Base Hub',
      badgeColor: 'green',
      targetAddress: null,
      destinationCoords: { lat: baseLat, lng: baseLng },
      distToBase
    };
  }

  // 4. Otherwise: Offline / Idle
  return {
    type: 'OFFLINE_IDLE',
    status: '⚪ Offline / Idle',
    badgeColor: 'slate',
    targetAddress: null,
    destinationCoords: null,
    distToBase
  };
}
