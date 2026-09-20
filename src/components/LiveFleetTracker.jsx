import React, { useState, useMemo } from 'react';
import {
  Navigation,
  Phone,
  ExternalLink,
  MapPin,
  Clock,
  Truck,
  Building2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Package,
  Home,
  Radio,
  Search,
  Filter,
  User,
  Activity,
  ArrowRight
} from 'lucide-react';
import {
  calculateDistanceKm,
  calculateDistanceMeters,
  calculateEtaMinutes,
  isDriverOnline,
  formatLastSeen,
  formatDistance
} from '../lib/geoUtils';

export default function LiveFleetTracker({
  drivers = [],
  orders = [],
  driverLocations = [],
  storeSettings = {},
  onRefresh,
  loading = false,
  onOpenStoreSettings
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ONLINE' | 'ON_ROUTE' | 'IDLE' | 'OFFLINE'

  const storeLat = Number(storeSettings.latitude) || 28.6692;
  const storeLng = Number(storeSettings.longitude) || 77.4538;
  const storeName = storeSettings.store_name || 'Store Central Hub (Ghaziabad)';
  const storeRadius = storeSettings.radius_meters || 150;

  // Build enriched rider data
  const riderCards = useMemo(() => {
    return drivers.map((driver) => {
      // Find latest location record
      const loc = driverLocations.find(
        (l) => l.driver_id === driver.id || l.driver_name === driver.name
      );

      const lat = loc?.latitude !== undefined && loc?.latitude !== null
        ? Number(loc.latitude)
        : (driver.current_lat !== undefined && driver.current_lat !== null ? Number(driver.current_lat) : null);

      const lng = loc?.longitude !== undefined && loc?.longitude !== null
        ? Number(loc.longitude)
        : (driver.current_lng !== undefined && driver.current_lng !== null ? Number(driver.current_lng) : null);

      const hasCoords = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng);
      const lastSeenAt = loc?.updated_at || loc?.last_seen_at || driver.updated_at || driver.last_seen_at || null;
      // Calculate 'Online' if (new Date() - new Date(driver.updated_at || driver.last_seen_at)) < 3 * 60 * 1000 (within 3 minutes)
      const isOnline = Boolean(
        lastSeenAt && (new Date() - new Date(lastSeenAt)) < 3 * 60 * 1000
      );

      // Active order currently being delivered by this rider
      const activeOrder = orders.find(
        (o) => (o.assigned_driver_id === driver.id || o.driver_id === driver.id) && o.status === 'Out for Delivery'
      );

      // Other pending/assigned orders
      const pendingAssigned = orders.filter(
        (o) => (o.assigned_driver_id === driver.id || o.driver_id === driver.id) && o.status === 'Pending'
      );

      // Completed today
      const completedToday = orders.filter(
        (o) => (o.assigned_driver_id === driver.id || o.driver_id === driver.id) && o.status === 'Delivered'
      );

      // 1. Pickup ETA (Rider GPS -> Store Hub)
      let pickupEtaMins = 10;
      let pickupDistKm = null;
      if (hasCoords) {
        pickupDistKm = calculateDistanceKm(lat, lng, storeLat, storeLng);
        pickupEtaMins = calculateEtaMinutes(storeLat, storeLng, lat, lng, 25, 0);
      }

      // 2. Delivery ETA (Rider GPS -> Saved Customer Address)
      let deliveryEtaMins = null;
      let deliveryDistKm = null;
      let hasCustomerCoords = false;

      if (activeOrder) {
        if (
          activeOrder.latitude !== null &&
          activeOrder.latitude !== undefined &&
          activeOrder.longitude !== null &&
          activeOrder.longitude !== undefined &&
          !isNaN(activeOrder.latitude) &&
          !isNaN(activeOrder.longitude)
        ) {
          hasCustomerCoords = true;
          if (hasCoords) {
            deliveryDistKm = calculateDistanceKm(lat, lng, activeOrder.latitude, activeOrder.longitude);
            // 25 km/h city average + 3 min doorstep handover
            deliveryEtaMins = calculateEtaMinutes(
              activeOrder.latitude,
              activeOrder.longitude,
              lat,
              lng,
              25,
              3
            );
          } else {
            deliveryEtaMins = activeOrder.estimated_minutes || 15;
          }
        } else {
          deliveryEtaMins = activeOrder.estimated_minutes || 15;
        }
      }

      return {
        ...driver,
        lat,
        lng,
        hasCoords,
        lastSeenAt,
        isOnline,
        activeOrder,
        pendingAssignedCount: pendingAssigned.length,
        completedTodayCount: completedToday.length,
        pickupEtaMins,
        pickupDistKm,
        deliveryEtaMins,
        deliveryDistKm,
        hasCustomerCoords
      };
    });
  }, [drivers, driverLocations, orders, storeLat, storeLng]);

  // Filter riders based on search and status
  const filteredRiders = useMemo(() => {
    return riderCards.filter((rider) => {
      // Status Filter
      if (statusFilter === 'ONLINE' && !rider.isOnline) return false;
      if (statusFilter === 'OFFLINE' && rider.isOnline) return false;
      if (statusFilter === 'ON_ROUTE' && (!rider.activeOrder || !rider.isOnline)) return false;
      if (statusFilter === 'IDLE' && (rider.activeOrder || !rider.isOnline)) return false;

      // Search Query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchesName = rider.name.toLowerCase().includes(q);
      const matchesPhone = rider.phone.includes(q);
      const matchesOrder = rider.activeOrder?.order_number.toLowerCase().includes(q);
      const matchesAddress = rider.activeOrder?.address.toLowerCase().includes(q);

      return matchesName || matchesPhone || matchesOrder || matchesAddress;
    });
  }, [riderCards, statusFilter, searchQuery]);

  // Fleet Summary Metrics
  const metrics = useMemo(() => {
    const total = riderCards.length;
    const online = riderCards.filter((r) => r.isOnline).length;
    const onRoute = riderCards.filter((r) => r.isOnline && r.activeOrder).length;
    const idle = riderCards.filter((r) => r.isOnline && !r.activeOrder).length;
    const offline = total - online;
    return { total, online, onRoute, idle, offline };
  }, [riderCards]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top Banner & Hub Status Bar */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  Live Fleet Radar & Dispatch ETAs
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitoring active riders, store hub return ETAs, and customer rooftop dropoffs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenStoreSettings && (
              <button
                onClick={onOpenStoreSettings}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-1.5"
                title="Configure Store Geofence & Hub Location"
              >
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Store Hub Settings</span>
              </button>
            )}

            <button
              onClick={onRefresh}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition flex items-center gap-1.5"
              title="Refresh Rider Locations"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Current Active Store Hub Info Ribbon */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-slate-500 font-medium">Active Store Hub:</span>
            <span className="font-bold text-white flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              {storeName}
            </span>
            <span className="font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
              {storeLat.toFixed(4)}, {storeLng.toFixed(4)}
            </span>
            <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Radius: {storeRadius}m
            </span>
          </div>

          <span className="text-[11px] text-slate-500">
            Road speed calculations use 25 km/h city average
          </span>
        </div>
      </div>

      {/* Fleet Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="glass-card p-3 rounded-xl border border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Fleet</span>
          <p className="text-xl font-black text-white mt-0.5">{metrics.total}</p>
          <span className="text-[10px] text-slate-500">Registered riders</span>
        </div>

        <div className="glass-card p-3 rounded-xl border border-emerald-500/20 bg-emerald-950/20">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Online (Active)
          </span>
          <p className="text-xl font-black text-emerald-400 mt-0.5">{metrics.online}</p>
          <span className="text-[10px] text-emerald-500/80">Heartbeat &lt; 3 mins</span>
        </div>

        <div className="glass-card p-3 rounded-xl border border-sky-500/20 bg-sky-950/20">
          <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">On Delivery Run</span>
          <p className="text-xl font-black text-sky-400 mt-0.5">{metrics.onRoute}</p>
          <span className="text-[10px] text-slate-500">En route to customer</span>
        </div>

        <div className="glass-card p-3 rounded-xl border border-amber-500/20 bg-amber-950/20">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Idle / Returning</span>
          <p className="text-xl font-black text-amber-400 mt-0.5">{metrics.idle}</p>
          <span className="text-[10px] text-slate-500">Ready for dispatch</span>
        </div>

        <div className="col-span-2 sm:col-span-1 glass-card p-3 rounded-xl border border-slate-800">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Offline</span>
          <p className="text-xl font-black text-slate-400 mt-0.5">{metrics.offline}</p>
          <span className="text-[10px] text-slate-600">Off duty / no signal</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search rider by name, phone, order #, or delivery address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {[
            { id: 'ALL', label: `All (${metrics.total})` },
            { id: 'ONLINE', label: `🟢 Online (${metrics.online})` },
            { id: 'ON_ROUTE', label: `🚚 En Route (${metrics.onRoute})` },
            { id: 'IDLE', label: `🟡 Idle (${metrics.idle})` },
            { id: 'OFFLINE', label: `⚪ Offline (${metrics.offline})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rider Cards Grid */}
      {filteredRiders.length === 0 ? (
        <div className="glass-card p-10 text-center rounded-2xl border border-slate-800">
          <Radio className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-300 font-semibold text-sm">No riders match the current filter</p>
          <p className="text-slate-500 text-xs mt-1">
            Try switching the filter to "All" or clearing the search query.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredRiders.map((rider) => {
            const hasCoords = rider.hasCoords;
            const isOnline = rider.isOnline;
            const activeOrder = rider.activeOrder;

            return (
              <div
                key={driverIdOrDefault(rider.id)}
                className={`glass-card p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3.5 ${
                  isOnline
                    ? activeOrder
                      ? 'border-sky-500/30 bg-slate-900/90 hover:border-sky-500/50'
                      : 'border-emerald-500/30 bg-slate-900/90 hover:border-emerald-500/50'
                    : 'border-slate-800/90 bg-slate-950/60 opacity-80 hover:opacity-100'
                }`}
              >
                {/* Rider Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm border ${
                          isOnline
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {rider.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <span>{rider.name}</span>
                        </h4>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <a
                            href={`tel:${rider.phone}`}
                            className="hover:text-emerald-300 transition-colors"
                          >
                            {rider.phone}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Online / Offline Status Badge */}
                    <div className="text-right">
                      {isOnline ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Online</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          <span>Offline</span>
                        </span>
                      )}
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {formatLastSeen(rider.lastSeenAt)}
                      </p>
                    </div>
                  </div>

                  {/* Current Coordinates & Google Maps Link */}
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      {hasCoords ? (
                        <span className="font-mono text-slate-300 font-semibold text-[11px]">
                          {rider.lat.toFixed(5)}, {rider.lng.toFixed(5)}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">
                          No GPS coordinates recorded
                        </span>
                      )}
                    </div>

                    {hasCoords && (
                      <a
                        href={`https://www.google.com/maps?q=${rider.lat},${rider.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-semibold transition"
                        title="View Rider Rooftop Pin on Google Maps"
                      >
                        <ExternalLink className="w-3 h-3 text-emerald-400" />
                        <span>Maps</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Active Delivery Order Snapshot (if on delivery) */}
                {activeOrder ? (
                  <div className="p-2.5 rounded-xl bg-sky-950/30 border border-sky-500/20 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        Active Delivery: #{activeOrder.order_number}
                      </span>
                      <span className="font-bold text-emerald-400">
                        ₹{activeOrder.amount}
                      </span>
                    </div>
                    <p className="text-slate-300 line-clamp-1 font-medium text-[11px]">
                      {activeOrder.address}
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs flex items-center justify-between text-slate-400">
                    <span className="text-[11px]">
                      {isOnline ? '🟢 Available for new order pickup' : '⚪ Rider is currently off duty'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Today: {rider.completedTodayCount} deliv
                    </span>
                  </div>
                )}

                {/* DUAL ETAS SECTION: Pickup ETA + Delivery ETA */}
                <div className="space-y-2 pt-1 border-t border-slate-800/80">
                  {/* 1. Pickup ETA (Rider GPS -> Store Hub) */}
                  <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-500/25 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <div>
                        <span className="font-bold text-indigo-300 block text-[11px]">
                          📦 Pickup ETA:
                        </span>
                        <span className="text-[10px] text-indigo-400/80">
                          To Store Hub {rider.pickupDistKm !== null ? `(${rider.pickupDistKm} km)` : ''}
                        </span>
                      </div>
                    </div>
                    <span className="font-black text-indigo-200 text-xs px-2 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                      ~{rider.pickupEtaMins} mins
                    </span>
                  </div>

                  {/* 2. Delivery ETA (Rider GPS -> Customer) */}
                  <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/25 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Home className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-bold text-emerald-300 block text-[11px]">
                          🏠 Delivery ETA:
                        </span>
                        <span className="text-[10px] text-emerald-400/80">
                          {activeOrder
                            ? `To #${activeOrder.order_number} ${rider.deliveryDistKm !== null ? `(${rider.deliveryDistKm} km)` : ''}`
                            : 'No active delivery run'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`font-black text-xs px-2 py-1 rounded-lg border ${
                        activeOrder
                          ? 'text-emerald-200 bg-emerald-500/20 border-emerald-500/30'
                          : 'text-slate-400 bg-slate-800/50 border-slate-700/50 font-medium'
                      }`}
                    >
                      {activeOrder
                        ? `~${rider.deliveryEtaMins || 15} mins`
                        : 'Idle'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function driverIdOrDefault(id) {
  return id || 'drv-' + Math.random().toString(36).slice(2);
}
