import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Search,
  Filter,
  Package,
  IndianRupee,
  Calendar,
  Clock,
  User,
  Phone,
  Landmark,
  Eye,
  X,
  ChevronRight,
  CheckCircle2,
  Truck,
  Building2,
  Navigation,
  ArrowUpDown
} from 'lucide-react';

/**
 * Aggregates addresses from an orders array.
 * Groups by normalized address string, extracts latest coordinates,
 * collects customer names/phones, order count, and past orders.
 */
export function aggregateAddressesFromOrders(orders = []) {
  const addressMap = new Map();

  for (const order of orders) {
    if (!order.address || !order.address.trim()) continue;
    const key = order.address.trim().toLowerCase();

    if (!addressMap.has(key)) {
      addressMap.set(key, {
        id: `addr-${key.replace(/[^a-z0-9]/g, '-').slice(0, 32)}`,
        key,
        fullAddress: order.address.trim(),
        landmark: order.landmark ? order.landmark.trim() : '',
        customerNames: new Set(),
        customerPhones: new Set(),
        latitude: null,
        longitude: null,
        orders: []
      });
    }

    const entry = addressMap.get(key);
    if (order.customer_name && order.customer_name.trim()) {
      entry.customerNames.add(order.customer_name.trim());
    }
    if (order.customer_phone && order.customer_phone.trim()) {
      entry.customerPhones.add(order.customer_phone.trim());
    }
    if (order.landmark && order.landmark.trim() && !entry.landmark) {
      entry.landmark = order.landmark.trim();
    }

    // Capture valid coordinates if available
    if (
      order.latitude !== null &&
      order.latitude !== undefined &&
      order.longitude !== null &&
      order.longitude !== undefined &&
      !isNaN(order.latitude) &&
      !isNaN(order.longitude)
    ) {
      // Prioritize the latest order with coordinates
      if (entry.latitude === null) {
        entry.latitude = Number(order.latitude);
        entry.longitude = Number(order.longitude);
      }
    }

    entry.orders.push(order);
  }

  return Array.from(addressMap.values()).map((entry) => {
    // Sort orders newest first
    const sortedOrders = [...entry.orders].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    // If an order has coordinates, pick the most recent one's coordinates
    const orderWithCoords = sortedOrders.find(
      (o) =>
        o.latitude !== null &&
        o.latitude !== undefined &&
        o.longitude !== null &&
        o.longitude !== undefined &&
        !isNaN(o.latitude) &&
        !isNaN(o.longitude)
    );

    const lat = orderWithCoords ? Number(orderWithCoords.latitude) : entry.latitude;
    const lng = orderWithCoords ? Number(orderWithCoords.longitude) : entry.longitude;
    const isPinned = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng);

    const deliveredOrders = sortedOrders.filter((o) => o.status === 'Delivered');
    const totalSpent = deliveredOrders.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);

    return {
      id: entry.id,
      key: entry.key,
      fullAddress: entry.fullAddress,
      landmark: entry.landmark,
      customerNames: Array.from(entry.customerNames),
      customerPhones: Array.from(entry.customerPhones),
      latitude: isPinned ? lat : null,
      longitude: isPinned ? lng : null,
      isPinned,
      totalOrders: sortedOrders.length,
      deliveredCount: deliveredOrders.length,
      totalSpent,
      latestOrder: sortedOrders[0],
      orders: sortedOrders
    };
  });
}

/**
 * Address Detail Modal / Window
 */
export function AddressDetailModal({
  address,
  onClose,
  onViewProof
}) {
  const [copiedCoords, setCopiedCoords] = useState(false);

  if (!address) return null;

  const lat = address.latitude;
  const lng = address.longitude;
  const isPinned = address.isPinned && lat !== null && lng !== null;

  const handleCopyCoordinates = async () => {
    if (!isPinned) return;
    const textToCopy = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 2000);
    } catch (e) {
      console.error('Failed to copy coordinates', e);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Delivered':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Delivered
          </span>
        );
      case 'Out for Delivery':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
            <Truck className="w-3 h-3" /> Out for Delivery
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
            {status}
          </span>
        );
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 animate-scale-up flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-start gap-3 max-w-[85%]">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                  {address.fullAddress}
                </h3>
                {isPinned ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    📍 Pinned
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    ⚠️ Not Pinned
                  </span>
                )}
              </div>

              {address.landmark && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                  <Landmark className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Landmark: {address.landmark}</span>
                </div>
              )}

              {address.customerPhones && address.customerPhones.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                  <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>
                    Contacts: {address.customerPhones.join(', ')}
                    {address.customerNames && address.customerNames.length > 0 && (
                      <span className="text-slate-500"> ({address.customerNames.join(', ')})</span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Section: GPS Coordinates / Pin Status */}
          {isPinned ? (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-emerald-500/20 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Verified Doorstep GPS Coordinates
                  </span>
                  <p className="text-sm sm:text-base font-mono font-bold text-emerald-400 mt-0.5">
                    Lat: {lat.toFixed(6)} | Lng: {lng.toFixed(6)}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleCopyCoordinates}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-all shadow-sm"
                  >
                    {copiedCoords ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copy Coordinates</span>
                      </>
                    )}
                  </button>

                  <a
                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-lg shadow-emerald-600/20"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Google Maps</span>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold text-sm text-amber-200">Doorstep GPS Not Available</h5>
                <p className="text-xs text-amber-300/90 mt-0.5">
                  No GPS coordinates saved yet. Waiting for a rider to pin the doorstep location.
                </p>
              </div>
            </div>
          )}

          {/* Section: Lifetime Delivery Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="glass-card p-3 rounded-xl border border-slate-800 bg-slate-950/40">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Lifetime Deliveries
              </span>
              <p className="text-xl font-black text-emerald-400 mt-1">
                {address.deliveredCount}
              </p>
              <span className="text-[10px] text-slate-500 font-medium">Successfully completed</span>
            </div>

            <div className="glass-card p-3 rounded-xl border border-slate-800 bg-slate-950/40">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Orders Sent
              </span>
              <p className="text-xl font-black text-white mt-1">
                {address.totalOrders}
              </p>
              <span className="text-[10px] text-slate-500 font-medium">All recorded orders</span>
            </div>

            <div className="col-span-2 sm:col-span-1 glass-card p-3 rounded-xl border border-slate-800 bg-slate-950/40">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Value Delivered
              </span>
              <p className="text-xl font-black text-emerald-300 mt-1">
                ₹{address.totalSpent.toFixed(0)}
              </p>
              <span className="text-[10px] text-slate-500 font-medium">Paid order volume</span>
            </div>
          </div>

          {/* Section: Past Order History Table */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Order History ({address.orders.length})</span>
              </h4>
              <span className="text-[11px] text-slate-400">
                Sorted by most recent
              </span>
            </div>

            {address.orders.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs bg-slate-950/40 rounded-xl border border-slate-800">
                No orders recorded for this address yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/50">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3">Date & Time</th>
                      <th className="p-3">Order #</th>
                      <th className="p-3">Amount (₹)</th>
                      <th className="p-3">Delivery Boy</th>
                      <th className="p-3">Payment Mode</th>
                      <th className="p-3">Status</th>
                      {onViewProof && <th className="p-3 text-right">Proof</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {address.orders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 whitespace-nowrap text-slate-400 font-medium">
                          {formatDateTime(order.created_at)}
                        </td>
                        <td className="p-3 whitespace-nowrap font-bold text-white">
                          #{order.order_number}
                        </td>
                        <td className="p-3 whitespace-nowrap font-bold text-emerald-400">
                          ₹{order.amount}
                        </td>
                        <td className="p-3 whitespace-nowrap text-slate-200">
                          {order.driver_name || 'Unassigned'}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {order.payment_method ? (
                            <span className="font-semibold text-slate-300">
                              {order.payment_method}
                            </span>
                          ) : (
                            <span className="text-slate-500">Pending / N/A</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {getStatusBadge(order.status)}
                        </td>
                        {onViewProof && (
                          <td className="p-3 whitespace-nowrap text-right">
                            {order.delivery_proof_url ? (
                              <button
                                onClick={() => onViewProof(order)}
                                className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-semibold inline-flex items-center gap-1"
                                title="View Delivery Proof"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Proof</span>
                              </button>
                            ) : (
                              <span className="text-slate-600 text-[11px]">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>{address.deliveredCount} lifetime deliveries sent to this address</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-xl font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Address Book Component
 */
export default function AddressBook({
  orders = [],
  onViewProof
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [pinFilter, setPinFilter] = useState('ALL'); // 'ALL' | 'PINNED' | 'NOT_PINNED'
  const [sortBy, setSortBy] = useState('orders'); // 'orders' | 'recent' | 'address'
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Aggregate addresses from orders
  const addresses = useMemo(() => {
    return aggregateAddressesFromOrders(orders);
  }, [orders]);

  // Filter and sort addresses
  const filteredAddresses = useMemo(() => {
    return addresses
      .filter((addr) => {
        // Pin filter
        if (pinFilter === 'PINNED' && !addr.isPinned) return false;
        if (pinFilter === 'NOT_PINNED' && addr.isPinned) return false;

        // Search query
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const matchesAddress = addr.fullAddress.toLowerCase().includes(q);
        const matchesLandmark = addr.landmark && addr.landmark.toLowerCase().includes(q);
        const matchesCustomer = addr.customerNames.some((n) => n.toLowerCase().includes(q));
        const matchesPhone = addr.customerPhones.some((p) => p.includes(q));

        return matchesAddress || matchesLandmark || matchesCustomer || matchesPhone;
      })
      .sort((a, b) => {
        if (sortBy === 'orders') {
          return b.totalOrders - a.totalOrders;
        }
        if (sortBy === 'recent') {
          const aTime = a.latestOrder?.created_at ? new Date(a.latestOrder.created_at).getTime() : 0;
          const bTime = b.latestOrder?.created_at ? new Date(b.latestOrder.created_at).getTime() : 0;
          return bTime - aTime;
        }
        if (sortBy === 'address') {
          return a.fullAddress.localeCompare(b.fullAddress);
        }
        return 0;
      });
  }, [addresses, pinFilter, searchQuery, sortBy]);

  // Summary counts
  const stats = useMemo(() => {
    const total = addresses.length;
    const pinned = addresses.filter((a) => a.isPinned).length;
    const notPinned = total - pinned;
    return { total, pinned, notPinned };
  }, [addresses]);

  const handleQuickCopy = async (e, addr) => {
    e.stopPropagation(); // prevent opening the detail modal
    if (!addr.isPinned) return;
    const coordText = `${addr.latitude.toFixed(5)}, ${addr.longitude.toFixed(5)}`;
    try {
      await navigator.clipboard.writeText(coordText);
      setCopiedId(addr.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed copying coords', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <span>Customer Address Book</span>
          </h2>
          <p className="text-xs text-slate-400">
            Verified doorstep locations, rooftop coordinates, and delivery history
          </p>
        </div>

        {/* Stats Pills */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 font-medium">
            Total: <strong className="text-white">{stats.total}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
            📍 Pinned: <strong>{stats.pinned}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium">
            ⚠️ Not Pinned: <strong>{stats.notPinned}</strong>
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search address, landmark, customer name, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter and Sort Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-0.5 text-xs">
            <button
              onClick={() => setPinFilter('ALL')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                pinFilter === 'ALL'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setPinFilter('PINNED')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                pinFilter === 'PINNED'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📍 Pinned ({stats.pinned})
            </button>
            <button
              onClick={() => setPinFilter('NOT_PINNED')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                pinFilter === 'NOT_PINNED'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚠️ Not Pinned ({stats.notPinned})
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-slate-300 font-medium focus:outline-none"
            >
              <option value="orders" className="bg-slate-900 text-slate-200">
                Most Orders
              </option>
              <option value="recent" className="bg-slate-900 text-slate-200">
                Most Recent
              </option>
              <option value="address" className="bg-slate-900 text-slate-200">
                Alphabetical
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Address Cards List */}
      {filteredAddresses.length === 0 ? (
        <div className="glass-card p-10 text-center rounded-2xl border border-slate-800">
          <MapPin className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-300 font-semibold text-sm">No matching addresses found</p>
          <p className="text-slate-500 text-xs mt-1">
            {searchQuery
              ? 'Try adjusting your search terms or clearing filters'
              : 'Addresses will appear automatically as tasks are created'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredAddresses.map((addr) => {
            const isPinned = addr.isPinned && addr.latitude !== null && addr.longitude !== null;
            const isCopied = copiedId === addr.id;

            return (
              <div
                key={addr.id}
                onClick={() => setSelectedAddress(addr)}
                className="glass-card p-4 rounded-2xl border border-slate-800/90 hover:border-emerald-500/40 hover:bg-slate-850/60 cursor-pointer transition-all flex flex-col justify-between space-y-3 group"
              >
                {/* Header: Address & Badges */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-500/20 transition-colors">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                          {addr.fullAddress}
                        </h3>

                        {addr.landmark && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                            <Landmark className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="italic">{addr.landmark}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Total Order Count Badge */}
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shrink-0">
                      <Package className="w-3 h-3" />
                      {addr.totalOrders} {addr.totalOrders === 1 ? 'Order' : 'Orders'}
                    </span>
                  </div>

                  {/* Customer Preview */}
                  {(addr.customerNames.length > 0 || addr.customerPhones.length > 0) && (
                    <div className="text-[11px] text-slate-400 pl-9 flex items-center gap-2 flex-wrap">
                      {addr.customerNames.length > 0 && (
                        <span className="text-slate-300 font-medium">
                          {addr.customerNames.slice(0, 2).join(', ')}
                        </span>
                      )}
                      {addr.customerPhones.length > 0 && (
                        <span className="text-slate-500 font-mono">
                          ({addr.customerPhones[0]})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer: GPS Status Badge & Quick Coordinate Preview */}
                <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {/* GPS Status Badge */}
                  <div>
                    {isPinned ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        📍 Pinned
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        ⚠️ Not Pinned
                      </span>
                    )}
                  </div>

                  {/* Quick Coordinate Preview (if pinned) */}
                  {isPinned ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-slate-300 bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700/80">
                        {addr.latitude.toFixed(5)}, {addr.longitude.toFixed(5)}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => handleQuickCopy(e, addr)}
                        className="p-1 rounded-md bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                        title="Copy coordinates"
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">
                      Awaiting rider pin
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Address Detail Modal */}
      {selectedAddress && (
        <AddressDetailModal
          address={selectedAddress}
          onClose={() => setSelectedAddress(null)}
          onViewProof={onViewProof}
        />
      )}
    </div>
  );
}
