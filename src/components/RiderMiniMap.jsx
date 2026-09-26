import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Eye, EyeOff } from 'lucide-react';

export default function RiderMiniMap({
  rider,
  movementStatus,
  baseCoords = { lat: 28.667, lng: 77.385 }
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersGroupRef = useRef(null);

  if (!rider) return null;

  const riderLat = rider?.current_lat !== undefined && rider?.current_lat !== null
    ? Number(rider.current_lat)
    : null;
  const riderLng = rider?.current_lng !== undefined && rider?.current_lng !== null
    ? Number(rider.current_lng)
    : null;
  const hasRiderCoords = riderLat !== null && riderLng !== null && !isNaN(riderLat) && !isNaN(riderLng);

  const destCoords = movementStatus?.destinationCoords;
  const hasDestCoords = destCoords && destCoords.lat !== null && destCoords.lng !== null && !isNaN(destCoords.lat) && !isNaN(destCoords.lng);

  useEffect(() => {
    if (isCollapsed) return;
    if (!mapContainerRef.current) return;
    if (!hasRiderCoords && !hasDestCoords) return;

    const container = mapContainerRef.current;

    // Check if Leaflet instance needs creation
    if (!mapInstanceRef.current) {
      if (container._leaflet_id) {
        delete container._leaflet_id;
      }

      try {
        const map = L.map(container, {
          zoomControl: false,
          attributionControl: false,
          dragging: true,
          scrollWheelZoom: false,
          touchZoom: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(map);

        const layersGroup = L.layerGroup().addTo(map);
        layersGroupRef.current = layersGroup;
        mapInstanceRef.current = map;
      } catch (mapInitErr) {
        console.warn('RiderMiniMap Leaflet init warning:', mapInitErr);
      }
    }

    const map = mapInstanceRef.current;
    const layers = layersGroupRef.current;
    if (!map || !layers) return;

    layers.clearLayers();

    const points = [];

    // Marker 1: Rider's current GPS location
    if (hasRiderCoords) {
      points.push([riderLat, riderLng]);

      const riderIcon = L.divIcon({
        className: 'custom-minimap-rider-icon',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 32px; height: 32px; background: rgba(16, 185, 129, 0.35); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="background: linear-gradient(135deg, #10b981, #059669); width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.45); font-size: 13px; z-index: 2;">
              🛵
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18]
      });

      const riderMarker = L.marker([riderLat, riderLng], { icon: riderIcon }).addTo(layers);
      riderMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 11px; color: #0f172a; min-width: 130px;">
          <strong style="color: #059669; font-size: 12px;">🛵 ${rider.name}</strong><br/>
          <span style="color: #64748b;">${rider.phone || 'Active Rider'}</span><br/>
          <span style="color: #0284c7; font-weight: bold; font-size: 10px;">${movementStatus?.status || 'Active'}</span>
        </div>
      `);
    }

    // Marker 2: Destination Marker (Customer dropoff OR Base Hub)
    if (hasDestCoords) {
      points.push([destCoords.lat, destCoords.lng]);

      const isEnRoute = movementStatus?.type === 'EN_ROUTE';

      const destIcon = L.divIcon({
        className: 'custom-minimap-dest-icon',
        html: isEnRoute ? `
          <div style="background: #f59e0b; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.5); font-size: 13px;">
            📍
          </div>
        ` : `
          <div style="background: #0d9488; width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 2px 8px rgba(13, 148, 136, 0.5); font-size: 13px;">
            🏪
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -16]
      });

      const destMarker = L.marker([destCoords.lat, destCoords.lng], { icon: destIcon }).addTo(layers);
      destMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 11px; color: #0f172a; min-width: 140px;">
          <strong style="color: ${isEnRoute ? '#d97706' : '#0d9488'}; font-size: 12px;">
            ${isEnRoute ? '📍 Dropoff Destination' : '🏪 Store Central Hub'}
          </strong><br/>
          <span style="color: #475569; font-size: 10px;">
            ${isEnRoute ? (movementStatus?.targetAddress || 'Customer Address') : 'Central Dispatch Hub'}
          </span>
        </div>
      `);

      // Polyline: Draw subtle dashed route line between rider and destination
      if (hasRiderCoords) {
        L.polyline([[riderLat, riderLng], [destCoords.lat, destCoords.lng]], {
          color: isEnRoute ? '#f59e0b' : '#06b6d4',
          weight: 3,
          dashArray: '5, 8',
          opacity: 0.85
        }).addTo(layers);
      }
    }

    // Auto-fit bounds
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [25, 25], maxZoom: 16 });
    } else if (points.length === 1) {
      map.setView(points[0], 15);
    }

    // Performance Optimization: Invalidate map size on render
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [riderLat, riderLng, hasRiderCoords, destCoords, hasDestCoords, movementStatus?.type, movementStatus?.status, movementStatus?.targetAddress, isCollapsed]);

  // Clean up Leaflet on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const containerId = `rider-map-${rider.id}`;

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
        <span className="flex items-center gap-1">
          <Navigation className="w-3 h-3 text-emerald-400" />
          <span>Live Mini-Radar</span>
        </span>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 transition"
        >
          {isCollapsed ? (
            <>
              <Eye className="w-3 h-3 text-emerald-400" />
              <span>Show Map</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3 h-3 text-slate-500" />
              <span>Hide Map</span>
            </>
          )}
        </button>
      </div>

      {!isCollapsed && (
        <div className="relative w-full h-[160px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950/80 shadow-inner">
          {hasRiderCoords || hasDestCoords ? (
            <div
              id={containerId}
              ref={mapContainerRef}
              className="w-full h-full z-0"
              style={{ minHeight: '160px', height: '160px' }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-1">
              <MapPin className="w-5 h-5 text-slate-600" />
              <span className="font-semibold text-slate-400">No Live GPS Available</span>
              <span className="text-[10px] text-slate-600">Awaiting location fix from rider</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
