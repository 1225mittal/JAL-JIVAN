import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  UserPlus,
  PackagePlus,
  Clock,
  Truck,
  CheckCircle2,
  Users,
  Search,
  IndianRupee,
  MapPin,
  Landmark,
  ExternalLink,
  ChevronRight,
  Eye,
  Filter,
  RefreshCw,
  Phone,
  KeyRound,
  BarChart3,
  Award,
  Star,
  TrendingUp,
  Check,
  BookOpen,
  Building2,
  Radio,
  Crosshair,
  Navigation,
  Package,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  FileText
} from 'lucide-react';
import {
  fetchRewardSettings,
  saveRewardSettings,
  fetchStoreSettings,
  saveStoreSettings,
  fetchDriverLocations,
  fetchDeliveryBoys,
  defaultStoreSettings,
  supabase,
  isSupabaseConfigured,
  updateDeliveryBoy,
  deleteDeliveryBoy,
  updateOrder,
  deleteOrder,
  updateProduct,
  updateSavedAddress,
  deleteSavedAddress
} from '../lib/supabase';
import { isDriverOnline, formatLastSeen } from '../lib/geoUtils';
import AddressBook, { AddressDetailModal, aggregateAddressesFromOrders } from './AddressBook';
import LiveFleetTracker from './LiveFleetTracker';
import ProductCatalog from './ProductCatalog';
import SlipViewerModal from './SlipViewerModal';

export function AdminPanel({
  orders = [],
  drivers = [],
  products = [],
  onOpenAddDriver,
  onOpenCreateTask,
  onUpdateStatus,
  onAssignDriver,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onUpdateOrder,
  onDeleteOrder,
  onUpdateDriver,
  onDeleteDriver,
  onUpdateAddress,
  onDeleteAddress,
  onRefresh,
  loading,
  onLogout
}) {
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'Pending' | 'Out for Delivery' | 'Delivered'
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'drivers' | 'fleet' | 'addresses' | 'products' | 'analytics'
  const [viewProofOrder, setViewProofOrder] = useState(null);
  const [selectedAddressForDetail, setSelectedAddressForDetail] = useState(null);

  // Aggregated addresses from orders for address book & badges
  const addresses = useMemo(() => aggregateAddressesFromOrders(orders), [orders]);

  // Reward Rules State
  const [rewardMinDeliv, setRewardMinDeliv] = useState(5);
  const [rewardStars, setRewardStars] = useState(1);
  const [rewardSaved, setRewardSaved] = useState(false);
  const [savingReward, setSavingReward] = useState(false);

  // Store Hub Settings State
  const [storeSettings, setStoreSettings] = useState(defaultStoreSettings);
  const [storeName, setStoreName] = useState('Store Central Hub (Ghaziabad)');
  const [storeLat, setStoreLat] = useState(28.6692);
  const [storeLng, setStoreLng] = useState(77.4538);
  const [storeRadius, setStoreRadius] = useState(150);
  const [savingStore, setSavingStore] = useState(false);
  const [storeSaved, setStoreSaved] = useState(false);
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [gpsMessage, setGpsMessage] = useState('');

  // Driver Edit & Delete State
  const [editingDriver, setEditingDriver] = useState(null);
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverPhone, setEditDriverPhone] = useState('');
  const [editDriverPin, setEditDriverPin] = useState('');
  const [editDriverStatus, setEditDriverStatus] = useState('active');
  const [editDriverIsOnline, setEditDriverIsOnline] = useState(false);
  const [editDriverLat, setEditDriverLat] = useState('');
  const [editDriverLng, setEditDriverLng] = useState('');
  const [editDriverRadius, setEditDriverRadius] = useState(150);
  const [isDriverSubmitting, setIsDriverSubmitting] = useState(false);
  const [driverFormError, setDriverFormError] = useState('');
  const [isDetectingDriverGps, setIsDetectingDriverGps] = useState(false);
  const [deleteConfirmDriver, setDeleteConfirmDriver] = useState(null);
  const [isDriverDeleting, setIsDriverDeleting] = useState(false);

  // Order Edit & Delete State
  const [editingOrder, setEditingOrder] = useState(null);
  const [editOrderAmount, setEditOrderAmount] = useState('');
  const [editOrderPhone, setEditOrderPhone] = useState('');
  const [editOrderName, setEditOrderName] = useState('');
  const [editOrderAddress, setEditOrderAddress] = useState('');
  const [editOrderLandmark, setEditOrderLandmark] = useState('');
  const [editOrderDriverId, setEditOrderDriverId] = useState('');
  const [editOrderStatus, setEditOrderStatus] = useState('Pending');
  const [editOrderLat, setEditOrderLat] = useState('');
  const [editOrderLng, setEditOrderLng] = useState('');
  const [isOrderSubmitting, setIsOrderSubmitting] = useState(false);
  const [orderFormError, setOrderFormError] = useState('');
  const [isDetectingOrderGps, setIsDetectingOrderGps] = useState(false);
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState(null);
  const [isOrderDeleting, setIsOrderDeleting] = useState(false);

  // Handwritten Slip Viewer State
  const [selectedSlipOrder, setSelectedSlipOrder] = useState(null);

  // Driver edit handlers
  const handleOpenEditDriver = (rider) => {
    setEditingDriver(rider);
    setEditDriverName(rider.name || '');
    setEditDriverPhone(rider.phone || '');
    setEditDriverPin(rider.pin || '');
    setEditDriverStatus(rider.status || 'active');
    setEditDriverIsOnline(Boolean(rider.is_online));
    setEditDriverLat(rider.current_lat !== null && rider.current_lat !== undefined ? String(rider.current_lat) : '');
    setEditDriverLng(rider.current_lng !== null && rider.current_lng !== undefined ? String(rider.current_lng) : '');
    setEditDriverRadius(rider.geofence_radius || 150);
    setDriverFormError('');
  };

  const handleDetectDriverGps = () => {
    if (!navigator.geolocation) {
      setDriverFormError('Geolocation is not supported by your browser');
      return;
    }
    setIsDetectingDriverGps(true);
    setDriverFormError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEditDriverLat(pos.coords.latitude.toFixed(6));
        setEditDriverLng(pos.coords.longitude.toFixed(6));
        setIsDetectingDriverGps(false);
      },
      (err) => {
        setIsDetectingDriverGps(false);
        setDriverFormError('GPS detection failed: ' + (err.message || 'Permission denied'));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmitEditDriver = async (e) => {
    e.preventDefault();
    setDriverFormError('');
    if (!editDriverName.trim()) {
      setDriverFormError('Driver name is required');
      return;
    }
    if (!editDriverPhone.trim()) {
      setDriverFormError('Phone number is required');
      return;
    }

    try {
      setIsDriverSubmitting(true);
      const payload = {
        id: editingDriver.id,
        name: editDriverName.trim(),
        phone: editDriverPhone.trim(),
        pin: editDriverPin.trim() || '1234',
        status: editDriverStatus,
        is_online: editDriverIsOnline,
        current_lat: editDriverLat !== '' ? parseFloat(editDriverLat) : null,
        current_lng: editDriverLng !== '' ? parseFloat(editDriverLng) : null,
        base_lat: editDriverLat !== '' ? parseFloat(editDriverLat) : null,
        base_lng: editDriverLng !== '' ? parseFloat(editDriverLng) : null,
        geofence_radius: Number(editDriverRadius) || 150
      };

      if (onUpdateDriver) {
        await onUpdateDriver(payload);
      } else {
        await updateDeliveryBoy(editingDriver.id, payload);
      }

      setDeliveryBoys((prev) =>
        prev.map((d) => (d.id === editingDriver.id ? { ...d, ...payload } : d))
      );
      setEditingDriver(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      setDriverFormError(err.message || 'Failed to update delivery boy');
    } finally {
      setIsDriverSubmitting(false);
    }
  };

  const handleConfirmDeleteDriver = async () => {
    if (!deleteConfirmDriver) return;
    try {
      setIsDriverDeleting(true);
      if (onDeleteDriver) {
        await onDeleteDriver(deleteConfirmDriver.id);
      } else {
        await deleteDeliveryBoy(deleteConfirmDriver.id);
      }

      setDeliveryBoys((prev) => prev.filter((d) => d.id !== deleteConfirmDriver.id));
      setDeleteConfirmDriver(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error removing delivery boy', err);
    } finally {
      setIsDriverDeleting(false);
    }
  };

  // Order edit handlers
  const handleOpenEditOrder = (order) => {
    setEditingOrder(order);
    setEditOrderAmount(order.amount !== undefined ? String(order.amount) : '');
    setEditOrderPhone(order.customer_phone || '');
    setEditOrderName(order.customer_name || '');
    setEditOrderAddress(order.address || '');
    setEditOrderLandmark(order.landmark || '');
    setEditOrderDriverId(order.assigned_driver_id || '');
    setEditOrderStatus(order.status || 'Pending');
    setEditOrderLat(order.latitude !== null && order.latitude !== undefined ? String(order.latitude) : '');
    setEditOrderLng(order.longitude !== null && order.longitude !== undefined ? String(order.longitude) : '');
    setOrderFormError('');
  };

  const handleDetectOrderGps = () => {
    if (!navigator.geolocation) {
      setOrderFormError('Geolocation is not supported by your browser');
      return;
    }
    setIsDetectingOrderGps(true);
    setOrderFormError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEditOrderLat(pos.coords.latitude.toFixed(6));
        setEditOrderLng(pos.coords.longitude.toFixed(6));
        setIsDetectingOrderGps(false);
      },
      (err) => {
        setIsDetectingOrderGps(false);
        setOrderFormError('GPS detection failed: ' + (err.message || 'Permission denied'));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmitEditOrder = async (e) => {
    e.preventDefault();
    setOrderFormError('');

    if (!editOrderAddress.trim()) {
      setOrderFormError('Delivery address is required');
      return;
    }
    const amt = parseFloat(editOrderAmount);
    if (isNaN(amt) || amt < 0) {
      setOrderFormError('Please enter a valid amount');
      return;
    }

    try {
      setIsOrderSubmitting(true);
      const selectedDriver = drivers.find((d) => d.id === editOrderDriverId) ||
        deliveryBoys.find((d) => d.id === editOrderDriverId);

      const payload = {
        amount: amt,
        address: editOrderAddress.trim(),
        landmark: editOrderLandmark.trim(),
        customer_phone: editOrderPhone.trim(),
        customer_name: editOrderName.trim(),
        assigned_driver_id: editOrderDriverId || null,
        driver_name: selectedDriver ? selectedDriver.name : (editOrderDriverId ? 'Assigned' : 'Unassigned'),
        status: editOrderStatus,
        latitude: editOrderLat !== '' ? parseFloat(editOrderLat) : null,
        longitude: editOrderLng !== '' ? parseFloat(editOrderLng) : null
      };

      if (onUpdateOrder) {
        await onUpdateOrder(editingOrder.id, payload);
      } else {
        await updateOrder(editingOrder.id, payload);
      }

      setEditingOrder(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      setOrderFormError(err.message || 'Failed to update order');
    } finally {
      setIsOrderSubmitting(false);
    }
  };

  const handleConfirmDeleteOrder = async () => {
    if (!deleteConfirmOrder) return;
    try {
      setIsOrderDeleting(true);
      if (onDeleteOrder) {
        await onDeleteOrder(deleteConfirmOrder.id);
      } else {
        await deleteOrder(deleteConfirmOrder.id);
      }

      setDeleteConfirmOrder(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error deleting order', err);
    } finally {
      setIsOrderDeleting(false);
    }
  };

  // Fallbacks for address & product operations if parent didn't provide props
  const handleUpdateAddressFallback = async (oldAddress, newAddressData) => {
    await updateSavedAddress(oldAddress, newAddressData);
    if (onRefresh) onRefresh();
  };

  const handleDeleteAddressFallback = async (addressStr, opts) => {
    await deleteSavedAddress(addressStr, opts);
    if (onRefresh) onRefresh();
  };

  const handleUpdateProductFallback = async (productData) => {
    await updateProduct(productData);
    if (onRefresh) onRefresh();
  };

  // Helper to ensure valid rider objects are included
  const filterRealRiders = useCallback((list) => {
    return Array.isArray(list) ? list.filter((r) => r && r.id && r.name) : [];
  }, []);

  // Live Driver Locations & Delivery Boys List (only real delivery team, defaults to empty array)
  const [driverLocations, setDriverLocations] = useState([]);
  const [deliveryBoys, setDeliveryBoys] = useState([]);
  const [deliveryBoysLoading, setDeliveryBoysLoading] = useState(true);

  // Sync if parent drivers prop updates with real drivers
  useEffect(() => {
    if (drivers && drivers.length > 0) {
      const real = filterRealRiders(drivers);
      if (real.length > 0) {
        setDeliveryBoys((prev) => {
          const map = new Map(prev.map((d) => [d.id, d]));
          real.forEach((d) => {
            const live = map.get(d.id);
            map.set(d.id, live ? { ...d, ...live } : d);
          });
          return Array.from(map.values());
        });
      }
    }
  }, [drivers, filterRealRiders]);

  useEffect(() => {
    async function loadAdminData() {
      try {
        const [res, hub, locs, dBoys] = await Promise.all([
          fetchRewardSettings(),
          fetchStoreSettings(),
          fetchDriverLocations(),
          fetchDeliveryBoys()
        ]);
        if (res) {
          setRewardMinDeliv(res.min_deliveries || 5);
          setRewardStars(res.stars_rewarded || 1);
        }
        if (hub) {
          setStoreSettings(hub);
          setStoreName(hub.store_name || 'Store Central Hub (Ghaziabad)');
          setStoreLat(Number(hub.latitude) || 28.6692);
          setStoreLng(Number(hub.longitude) || 77.4538);
          setStoreRadius(Number(hub.radius_meters) || 150);
        }
        if (locs) {
          setDriverLocations(locs);
        }
        if (Array.isArray(dBoys)) {
          setDeliveryBoys(filterRealRiders(dBoys));
        }
      } finally {
        setDeliveryBoysLoading(false);
      }
    }
    loadAdminData();

    // 10-second auto-poll interval for live radar refresh
    const pollInterval = setInterval(async () => {
      const [locs, dBoys] = await Promise.all([
        fetchDriverLocations(),
        fetchDeliveryBoys()
      ]);
      if (locs) setDriverLocations(locs);
      if (Array.isArray(dBoys)) setDeliveryBoys(filterRealRiders(dBoys));
    }, 10000);

    // Supabase Realtime subscription on delivery_boys
    let channel = null;
    if (isSupabaseConfigured) {
      try {
        channel = supabase
          .channel('public:delivery_boys_admin')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'delivery_boys' },
            async () => {
              const dBoys = await fetchDeliveryBoys();
              if (Array.isArray(dBoys)) setDeliveryBoys(filterRealRiders(dBoys));
            }
          )
          .subscribe();
      } catch (e) {
        console.warn('Realtime subscription on delivery_boys failed:', e);
      }
    }

    return () => {
      clearInterval(pollInterval);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [filterRealRiders]);

  const handleSaveRewardSettings = async (e) => {
    e?.preventDefault();
    setSavingReward(true);
    try {
      await saveRewardSettings({
        minDeliveries: rewardMinDeliv,
        starsRewarded: rewardStars
      });
      setRewardSaved(true);
      setTimeout(() => setRewardSaved(false), 2500);
    } catch (err) {
      console.error('Failed saving reward settings', err);
    } finally {
      setSavingReward(false);
    }
  };

  // Save Store Location & Geofence
  const handleSaveStoreLocation = async (e) => {
    e?.preventDefault();
    setSavingStore(true);
    try {
      const updated = await saveStoreSettings({
        storeName,
        latitude: storeLat,
        longitude: storeLng,
        radiusMeters: storeRadius
      });
      setStoreSettings(updated);
      setStoreSaved(true);
      setTimeout(() => setStoreSaved(false), 2500);
    } catch (err) {
      console.error('Failed saving store settings', err);
    } finally {
      setSavingStore(false);
    }
  };

  // Use Current Admin GPS
  const handleUseAdminGps = () => {
    if (!navigator.geolocation) {
      setGpsMessage('Geolocation is not supported by your browser.');
      return;
    }
    setGpsDetecting(true);
    setGpsMessage('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setStoreLat(lat);
        setStoreLng(lng);
        setGpsDetecting(false);
        setGpsMessage(`📍 Detected Admin GPS: ${lat}, ${lng}`);
        setTimeout(() => setGpsMessage(''), 4000);
      },
      (err) => {
        setGpsDetecting(false);
        setGpsMessage('GPS detection failed: ' + (err.message || 'Permission denied'));
        setTimeout(() => setGpsMessage(''), 4000);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Online drivers count for badge (using exact rider status formula)
  const onlineDriversCount = useMemo(() => {
    return deliveryBoys.filter((rider) => isDriverOnline(rider)).length;
  }, [deliveryBoys]);

  // Computed Metrics
  const metrics = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.status === 'Pending').length;
    const outForDelivery = orders.filter((o) => o.status === 'Out for Delivery').length;
    const delivered = orders.filter((o) => o.status === 'Delivered').length;
    const totalRevenue = orders
      .filter((o) => o.status === 'Delivered')
      .reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);

    return { total, pending, outForDelivery, delivered, totalRevenue };
  }, [orders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesFilter =
        activeFilter === 'ALL' ? true : order.status === activeFilter;

      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        order.order_number.toLowerCase().includes(q) ||
        order.address.toLowerCase().includes(q) ||
        (order.landmark && order.landmark.toLowerCase().includes(q)) ||
        (order.driver_name && order.driver_name.toLowerCase().includes(q));

      return matchesFilter && matchesSearch;
    });
  }, [orders, activeFilter, searchQuery]);

  // Status Badge Helper
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'Out for Delivery':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
            <Truck className="w-3 h-3" /> Out for Delivery
          </span>
        );
      case 'Delivered':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Delivered
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-700 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 pb-12 w-full max-w-full overflow-x-hidden">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Dispatch Command Center
          </h1>
          <p className="text-xs text-slate-400">
            Monitor real-time deliveries, dispatch drivers, and view live status
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="admin-create-task-btn"
            onClick={onOpenCreateTask}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-emerald-600/25"
          >
            <PackagePlus className="w-4 h-4" />
            <span>Create Delivery</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Total Orders */}
        <div className="glass-card p-3.5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Deliveries</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Filter className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-white mt-1.5">{metrics.total}</p>
          <span className="text-[10px] text-slate-500 font-medium">All recorded orders</span>
        </div>

        {/* Pending */}
        <div className="glass-card p-3.5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Pending</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-300 mt-1.5">{metrics.pending}</p>
          <span className="text-[10px] text-slate-500 font-medium">Awaiting dispatch</span>
        </div>

        {/* Out for Delivery */}
        <div className="glass-card p-3.5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">On Route</span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <Truck className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-sky-300 mt-1.5">{metrics.outForDelivery}</p>
          <span className="text-[10px] text-slate-500 font-medium">With delivery boy</span>
        </div>

        {/* Delivered */}
        <div className="glass-card p-3.5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Delivered</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-1.5">{metrics.delivered}</p>
          <span className="text-[10px] text-slate-500 font-medium">Successfully completed</span>
        </div>

        {/* Total Collected ₹ */}
        <div className="col-span-2 sm:col-span-4 lg:col-span-1 glass-card p-3.5 rounded-2xl border border-emerald-900/40 bg-gradient-to-br from-emerald-950/40 to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">Collected</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
              <IndianRupee className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-300 mt-1.5">₹{metrics.totalRevenue.toFixed(0)}</p>
          <span className="text-[10px] text-emerald-500/80 font-medium">Delivered order revenue</span>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pt-1 gap-2">
        <div className="overflow-x-auto w-full no-scrollbar min-w-0">
          <div className="flex items-center space-x-2 min-w-max pb-1">
            <button
              onClick={() => setActiveTab('orders')}
              className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === 'orders'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Live Status Board ({orders.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('drivers')}
              className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === 'drivers'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Delivery Boys ({drivers.length})</span>
            </button>

            <button
              id="admin-fleet-tab"
              onClick={() => setActiveTab('fleet')}
              className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === 'fleet'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Live Fleet Tracker</span>
              {onlineDriversCount > 0 ? (
                <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {onlineDriversCount}
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 font-normal">({drivers.length})</span>
              )}
            </button>

            <button
              id="admin-addresses-tab"
              onClick={() => setActiveTab('addresses')}
              className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === 'addresses'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Address Book ({addresses.length})</span>
            </button>

            <button
              id="admin-products-tab"
              onClick={() => setActiveTab('products')}
              className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === 'products'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Products ({products.length})</span>
            </button>

            <button
              id="admin-analytics-tab"
              onClick={() => setActiveTab('analytics')}
              className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === 'analytics'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Settings & Analytics</span>
            </button>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="pb-3 text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors flex-shrink-0"
          title="Refresh live data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* TAB 1: LIVE STATUS BOARD */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Controls: Search & Filter Pills */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Filter Pills */}
            <div className="flex overflow-x-auto pb-1 sm:pb-0 gap-1.5 no-scrollbar">
              {['ALL', 'Pending', 'Out for Delivery', 'Delivered'].map((status) => (
                <button
                  key={status}
                  onClick={() => setActiveFilter(status)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    activeFilter === status
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order #, address, driver..."
                className="w-full pl-9 pr-4 py-2 bg-slate-800/70 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Orders List / Cards */}
          {filteredOrders.length === 0 ? (
            <div className="glass-card p-12 text-center rounded-2xl border border-slate-800">
              <Truck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 font-semibold text-sm">No deliveries found</p>
              <p className="text-slate-500 text-xs mt-1">
                {searchQuery
                  ? 'Try clearing the search query or changing filters'
                  : 'Click "Create Delivery" above to dispatch your first order'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="glass-card p-4 rounded-2xl border border-slate-800/90 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3"
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-white tracking-wide">
                          #{order.order_number}
                        </span>
                        {getStatusBadge(order.status)}
                        {order.slip_image_url && (
                          <button
                            type="button"
                            onClick={() => setSelectedSlipOrder(order)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 text-[11px] font-semibold transition-all shadow-sm group"
                            title="View handwritten slip photo"
                          >
                            <Eye className="w-3 h-3 text-amber-400 group-hover:scale-110 transition-transform" />
                            <span>View Slip</span>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-emerald-400">
                          ₹{order.amount}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenEditOrder(order)}
                          className="p-1 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                          title="Edit Delivery / Order"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmOrder(order)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Cancel / Delete Delivery"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Address & Landmark */}
                    <div className="mt-2.5 space-y-1 text-xs">
                      <div
                        onClick={() => {
                          const matchingAddr = addresses.find(
                            (a) => a.key === (order.address || '').trim().toLowerCase()
                          );
                          if (matchingAddr) {
                            setSelectedAddressForDetail(matchingAddr);
                          } else {
                            setSelectedAddressForDetail({
                              id: order.id,
                              fullAddress: order.address,
                              landmark: order.landmark || '',
                              customerNames: order.customer_name ? [order.customer_name] : [],
                              customerPhones: order.customer_phone ? [order.customer_phone] : [],
                              latitude: order.latitude,
                              longitude: order.longitude,
                              isPinned: order.latitude !== null && order.longitude !== null,
                              totalOrders: 1,
                              deliveredCount: order.status === 'Delivered' ? 1 : 0,
                              totalSpent: parseFloat(order.amount) || 0,
                              orders: [order]
                            });
                          }
                        }}
                        className="flex items-start gap-1.5 text-slate-300 hover:text-emerald-300 cursor-pointer group/addr transition-colors"
                        title="Click to view full address details & order history"
                      >
                        <MapPin className="w-3.5 h-3.5 text-slate-500 group-hover/addr:text-emerald-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2 underline decoration-slate-700/60 group-hover/addr:decoration-emerald-400 font-medium">
                          {order.address}
                        </span>
                        {order.latitude !== null && order.latitude !== undefined && order.longitude !== null && order.longitude !== undefined ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 ml-1">
                            📍 Pinned
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0 ml-1">
                            ⚠️ Not Pinned
                          </span>
                        )}
                        <ChevronRight className="w-3 h-3 text-slate-600 group-hover/addr:text-emerald-400 shrink-0 mt-0.5 ml-auto" />
                      </div>

                      {order.landmark && (
                        <div className="flex items-center gap-1.5 text-slate-400 pl-5">
                          <Landmark className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="italic">{order.landmark}</span>
                        </div>
                      )}

                      {order.customer_phone && (
                        <div className="text-[11px] text-slate-400 pl-5">
                          Customer Phone (Admin): <span className="text-slate-300">{order.customer_phone}</span>
                        </div>
                      )}

                      {/* Voice Note Audio Player */}
                      {(order.audio_url || order.audioUrl) && (
                        <div className="mt-2.5 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center gap-2 overflow-hidden">
                          <span className="text-[11px] text-emerald-400 font-medium whitespace-nowrap shrink-0">🎙️ Voice Note:</span>
                          <audio controls className="w-full h-7 rounded outline-none min-w-0" src={order.audio_url || order.audioUrl}>
                            Your browser does not support audio playback.
                          </audio>
                        </div>
                      )}

                      {/* Order Items Badge */}
                      {Array.isArray(order.items) && order.items.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pl-5 pt-1">
                          {order.items.map((item, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/80 text-[10px] font-semibold text-emerald-300"
                            >
                              {item.quantity}x {item.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Driver Assignment & Quick Status Changer */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                    {/* Driver Selector / Display */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 font-medium">Driver:</span>
                      <select
                        value={order.assigned_driver_id || ''}
                        onChange={(e) => {
                          const targetDriver = drivers.find((d) => d.id === e.target.value);
                          onAssignDriver(order.id, e.target.value || null, targetDriver?.name || null);
                        }}
                        className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">Unassigned</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {order.status === 'Pending' && (
                        <button
                          onClick={() => onUpdateStatus(order.id, 'Out for Delivery')}
                          className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 text-[11px] font-semibold transition-all"
                        >
                          Dispatch &rarr;
                        </button>
                      )}

                      {order.status === 'Out for Delivery' && (
                        <button
                          onClick={() => onUpdateStatus(order.id, 'Delivered')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-[11px] font-semibold transition-all"
                        >
                          Mark Delivered
                        </button>
                      )}

                      {order.status === 'Delivered' && (order.delivery_proof_url || order.payment_method) && (
                        <button
                          onClick={() => setViewProofOrder(order)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium"
                        >
                          <Eye className="w-3 h-3 text-emerald-400" />
                          <span>View POD</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DELIVERY BOYS ROSTER */}
      {activeTab === 'drivers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Registered Delivery Boys ({drivers.length})
            </h3>
            <button
              onClick={onOpenAddDriver}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Add New Driver</span>
            </button>
          </div>

          {deliveryBoys.length === 0 ? (
            <div className="glass-card p-8 text-center rounded-2xl border border-slate-800">
              <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-300 font-semibold text-sm">No delivery boys registered yet</p>
              <p className="text-slate-500 text-xs mt-1">
                Add your first delivery boy with name, phone, and 4-digit PIN.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {deliveryBoys.map((rider) => {
                const assignedCount = orders.filter(
                  (o) => o.assigned_driver_id === rider.id && o.status !== 'Delivered'
                ).length;
                const completedCount = orders.filter(
                  (o) => o.assigned_driver_id === rider.id && o.status === 'Delivered'
                ).length;

                const activeTime = rider.last_seen_at || rider.last_active_at;
                const diffMinutes = activeTime 
                  ? (Date.now() - new Date(activeTime).getTime()) / (1000 * 60) 
                  : 999;
                const isOnline = isDriverOnline(rider);

                const lat = rider.current_lat !== undefined && rider.current_lat !== null
                  ? Number(rider.current_lat)
                  : null;
                const lng = rider.current_lng !== undefined && rider.current_lng !== null
                  ? Number(rider.current_lng)
                  : null;
                const hasCoords = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng);
                const lastSeenText = diffMinutes < 1 ? 'Just now' : `${Math.floor(diffMinutes)}m ago`;

                return (
                  <div
                    key={rider.id}
                    className={`glass-card p-4 rounded-2xl border space-y-3 transition-all ${
                      isOnline ? 'border-emerald-500/40 bg-slate-900/90 shadow-lg shadow-emerald-500/5' : 'border-slate-800 bg-slate-950/60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base">{isOnline ? '🟢' : '⚪'}</span>
                          <h4 className="text-sm font-bold text-white">
                            {rider.name} {isOnline && <span className="text-emerald-400 text-xs font-semibold">- Online / On Road</span>}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-1 ml-6">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{rider.phone}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            <span>🟢 Online / On Road</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            <span className="inline-flex rounded-full h-2 w-2 bg-slate-500" />
                            <span>⚪ Offline</span>
                          </span>
                        )}
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {activeTime ? lastSeenText : 'No heartbeat recorded'}
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                        <span>Driver PIN:</span>
                      </div>
                      <span className="font-mono font-bold tracking-widest text-amber-300 px-2 py-0.5 bg-amber-500/10 rounded-md border border-amber-500/20">
                        {rider.pin || '••••'}
                      </span>
                    </div>

                    {/* Coordinates & Maps */}
                    <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                        <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                        {hasCoords ? (
                          <span className="font-mono text-slate-300">
                            {lat.toFixed(4)}, {lng.toFixed(4)}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">No GPS signal</span>
                        )}
                      </div>
                      {hasCoords && (
                        <a
                          href={`https://www.google.com/maps?q=${lat},${lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-0.5"
                          title="Open in Google Maps"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Maps</span>
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-2 rounded-xl bg-slate-800/40">
                        <p className="text-[10px] text-slate-400 uppercase">Active Orders</p>
                        <p className="text-base font-bold text-sky-400 mt-0.5">{assignedCount}</p>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-800/40">
                        <p className="text-[10px] text-slate-400 uppercase">Delivered</p>
                        <p className="text-base font-bold text-emerald-400 mt-0.5">{completedCount}</p>
                      </div>
                    </div>

                    {/* Rider Card Edit & Remove Buttons */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditDriver(rider)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-semibold transition"
                      >
                        <Pencil className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Edit Details</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmDriver(rider)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-semibold transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Boy</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LIVE FLEET TRACKER */}
      {activeTab === 'fleet' && (
        <LiveFleetTracker
          drivers={deliveryBoys}
          orders={orders}
          driverLocations={driverLocations}
          storeSettings={storeSettings}
          onRefresh={async () => {
            const [locs, dBoys] = await Promise.all([
              fetchDriverLocations(),
              fetchDeliveryBoys()
            ]);
            if (locs) setDriverLocations(locs);
            if (Array.isArray(dBoys)) setDeliveryBoys(filterRealRiders(dBoys));
          }}
          loading={loading || deliveryBoysLoading}
          onOpenStoreSettings={() => {
            setActiveTab('analytics');
            setTimeout(() => {
              const el = document.getElementById('store-hub-settings-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }}
        />
      )}

      {/* TAB 4: ADDRESS BOOK DIRECTORY */}
      {activeTab === 'addresses' && (
        <AddressBook
          orders={orders}
          onViewProof={(order) => setViewProofOrder(order)}
          onUpdateAddress={onUpdateAddress || handleUpdateAddressFallback}
          onDeleteAddress={onDeleteAddress || handleDeleteAddressFallback}
        />
      )}

      {/* TAB 5: PRODUCT CATALOG MANAGEMENT */}
      {activeTab === 'products' && (
        <ProductCatalog
          products={products}
          onAddProduct={onAddProduct}
          onUpdateProduct={onUpdateProduct || handleUpdateProductFallback}
          onDeleteProduct={onDeleteProduct}
          loading={loading}
        />
      )}

      {/* TAB 5: DELIVERY ANALYTICS & STORE SETTINGS */}
      {activeTab === 'analytics' && (
        <div className="space-y-5 animate-fade-in">
          {/* Section A: Store Hub & Attendance Geofence Settings */}
          <div id="store-hub-settings-section" className="glass-card p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Store Hub Location & Attendance Geofence</h3>
                  <p className="text-xs text-slate-400">
                    Configure central store GPS coordinates and punch-in radius threshold (persisted in store_settings).
                  </p>
                </div>
              </div>

              {storeSaved && (
                <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 rounded-full flex items-center gap-1 animate-fade-in">
                  <Check className="w-3.5 h-3.5" />
                  <span>Store Location Saved & Active!</span>
                </span>
              )}
            </div>

            {gpsMessage && (
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-emerald-300 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{gpsMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveStoreLocation} className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Store Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Store Hub Name
                  </label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="e.g. Ghaziabad Central Store"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Latitude */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={storeLat}
                    onChange={(e) => setStoreLat(parseFloat(e.target.value) || 0)}
                    placeholder="28.6692"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-emerald-400 font-mono font-bold focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Longitude */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={storeLng}
                    onChange={(e) => setStoreLng(parseFloat(e.target.value) || 0)}
                    placeholder="77.4538"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-emerald-400 font-mono font-bold focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Radius in Meters */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Geofence Radius (Meters)
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="10000"
                    required
                    value={storeRadius}
                    onChange={(e) => setStoreRadius(parseInt(e.target.value) || 150)}
                    placeholder="150"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-amber-400 font-mono font-bold focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleUseAdminGps}
                  disabled={gpsDetecting}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                >
                  <Crosshair className={`w-3.5 h-3.5 text-emerald-400 ${gpsDetecting ? 'animate-spin' : ''}`} />
                  <span>{gpsDetecting ? 'Detecting Admin GPS...' : 'Use Current Admin GPS'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <a
                    href={`https://www.google.com/maps?q=${storeLat},${storeLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Hub on Maps</span>
                  </a>

                  <button
                    id="admin-save-store-settings-btn"
                    type="submit"
                    disabled={savingStore}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{savingStore ? 'Saving...' : 'Save Store Location'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Section B: Driver Star Reward Rules Configuration */}
          <div className="glass-card p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Driver Star Reward Milestone Rules</h3>
                  <p className="text-xs text-slate-400">
                    Configure the delivery milestone formula stored in reward_settings for driver awards.
                  </p>
                </div>
              </div>

              {rewardSaved && (
                <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 rounded-full flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Rule Saved & Active!</span>
                </span>
              )}
            </div>

            <form onSubmit={handleSaveRewardSettings} className="flex flex-wrap items-center gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="font-medium">Every</span>
                <input
                  id="admin-reward-min-deliv"
                  type="number"
                  min="1"
                  required
                  value={rewardMinDeliv}
                  onChange={(e) => setRewardMinDeliv(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-center font-bold focus:border-emerald-500 focus:outline-none"
                />
                <span className="font-medium">Deliveries =</span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  id="admin-reward-stars-count"
                  type="number"
                  min="1"
                  required
                  value={rewardStars}
                  onChange={(e) => setRewardStars(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-amber-400 text-center font-bold focus:border-emerald-500 focus:outline-none"
                />
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <span>Star(s)</span>
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                </span>
              </div>

              <button
                id="admin-save-reward-rule-btn"
                type="submit"
                disabled={savingReward}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50"
              >
                {savingReward ? 'Saving...' : 'Save Rule'}
              </button>
            </form>
          </div>

          {/* 2. Comparative Table for Delivery Performance & ETA Variance */}
          {(() => {
            const deliveredOrders = orders.filter((o) => o.status === 'Delivered');

            return (
              <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl space-y-4">
                <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span>Delivery Performance & ETA Variance Analysis</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Actual delivery completion duration (delivered_at - accepted_at) compared against calculated road speed ETA.
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                    {deliveredOrders.length} completed tasks
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="p-3.5">Order #</th>
                        <th className="p-3.5">Driver</th>
                        <th className="p-3.5">Estimated Time</th>
                        <th className="p-3.5">Actual Time</th>
                        <th className="p-3.5">Variance</th>
                        <th className="p-3.5">Completed At</th>
                        <th className="p-3.5 text-right">Proof</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {deliveredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-500">
                            No delivered orders recorded yet. As orders are completed, comparative performance data will display here.
                          </td>
                        </tr>
                      ) : (
                        deliveredOrders.map((order) => {
                          const start = order.accepted_at
                            ? new Date(order.accepted_at).getTime()
                            : new Date(order.created_at).getTime();
                          const end = order.delivered_at
                            ? new Date(order.delivered_at).getTime()
                            : Date.now();
                          const actualMins = Math.max(1, Math.round((end - start) / 60000));
                          const estMins = order.estimated_minutes || 15;
                          const variance = actualMins - estMins;

                          return (
                            <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="p-3.5 font-bold text-white">#{order.order_number}</td>
                              <td className="p-3.5 font-semibold text-slate-200">
                                {order.driver_name || 'Unassigned'}
                              </td>
                              <td className="p-3.5 text-slate-300">~{estMins} mins</td>
                              <td className="p-3.5 font-bold text-white">{actualMins} mins</td>
                              <td className="p-3.5">
                                {variance <= 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold text-[11px]">
                                    {variance === 0 ? 'On time' : `${Math.abs(variance)} mins early`}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold text-[11px]">
                                    +{variance} mins late
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 text-slate-400">
                                {order.delivered_at
                                  ? new Date(order.delivered_at).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : '-'}
                              </td>
                              <td className="p-3.5 text-right">
                                {order.delivery_proof_url ? (
                                  <button
                                    onClick={() => setViewProofOrder(order)}
                                    className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-xs font-semibold inline-flex items-center gap-1"
                                    title="View Delivery Proof"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Proof</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-600 text-[11px]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Address Detail Viewer Modal for Admin */}
      {selectedAddressForDetail && (
        <AddressDetailModal
          address={selectedAddressForDetail}
          onClose={() => setSelectedAddressForDetail(null)}
          onViewProof={(order) => {
            setSelectedAddressForDetail(null);
            setViewProofOrder(order);
          }}
        />
      )}

      {/* Proof of Delivery Viewer Modal for Admin */}
      {viewProofOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950">
              <div>
                <h4 className="font-bold text-white text-sm">Delivery Proof • #{viewProofOrder.order_number}</h4>
                <p className="text-[11px] text-slate-400">Amount: ₹{viewProofOrder.amount} • {viewProofOrder.driver_name}</p>
              </div>
              <button
                onClick={() => setViewProofOrder(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                &times;
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60">
                <span className="text-slate-400">Payment Method:</span>
                <span className="font-bold text-emerald-400">{viewProofOrder.payment_method || 'N/A'}</span>
              </div>

              {viewProofOrder.delivery_proof_url && (
                <div>
                  <p className="font-semibold text-slate-300 mb-1.5">Package Photo Proof:</p>
                  <img
                    src={viewProofOrder.delivery_proof_url}
                    alt="Package Proof"
                    className="w-full h-48 object-cover rounded-xl border border-slate-700"
                  />
                </div>
              )}

              {viewProofOrder.payment_proof_url && (
                <div>
                  <p className="font-semibold text-slate-300 mb-1.5">UPI Payment Screenshot:</p>
                  <img
                    src={viewProofOrder.payment_proof_url}
                    alt="UPI Screenshot"
                    className="w-full h-48 object-contain bg-slate-950 rounded-xl border border-slate-700"
                  />
                </div>
              )}

              {viewProofOrder.notes && (
                <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800">
                  <p className="text-slate-400 font-medium">Driver Notes:</p>
                  <p className="text-slate-200 mt-0.5 italic">{viewProofOrder.notes}</p>
                </div>
              )}

              <button
                onClick={() => setViewProofOrder(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-white rounded-xl font-semibold mt-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 animate-scale-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">
                    Edit Delivery #{editingOrder.order_number}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Update delivery details, amount, address, and assigned driver
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingOrder(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEditOrder} className="p-5 space-y-4">
              {orderFormError && (
                <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{orderFormError}</span>
                </div>
              )}

              {/* Amount & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Amount (₹) *
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={editOrderAmount}
                      onChange={(e) => setEditOrderAmount(e.target.value)}
                      required
                      className="w-full pl-10 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm font-semibold text-emerald-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Order Status
                  </label>
                  <select
                    value={editOrderStatus}
                    onChange={(e) => setEditOrderStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Out for Delivery">Out for Delivery</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Customer Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={editOrderName}
                    onChange={(e) => setEditOrderName(e.target.value)}
                    placeholder="e.g. Ramesh Singh"
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Customer Phone
                  </label>
                  <input
                    type="tel"
                    value={editOrderPhone}
                    onChange={(e) => setEditOrderPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Delivery Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Delivery Address *
                </label>
                <textarea
                  rows={2}
                  value={editOrderAddress}
                  onChange={(e) => setEditOrderAddress(e.target.value)}
                  required
                  placeholder="Doorstep address..."
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Landmark & Driver Assignment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Landmark
                  </label>
                  <input
                    type="text"
                    value={editOrderLandmark}
                    onChange={(e) => setEditOrderLandmark(e.target.value)}
                    placeholder="Near water tank, etc."
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Assigned Driver
                  </label>
                  <select
                    value={editOrderDriverId}
                    onChange={(e) => setEditOrderDriverId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Unassigned</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.phone})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Coordinates */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    GPS Coordinates
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectOrderGps}
                    disabled={isDetectingOrderGps}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 disabled:opacity-50"
                  >
                    <Navigation className={`w-3 h-3 ${isDetectingOrderGps ? 'animate-spin' : ''}`} />
                    <span>{isDetectingOrderGps ? 'Detecting...' : 'Use Current GPS'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    step="0.000001"
                    value={editOrderLat}
                    onChange={(e) => setEditOrderLat(e.target.value)}
                    placeholder="Latitude"
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="number"
                    step="0.000001"
                    value={editOrderLng}
                    onChange={(e) => setEditOrderLng(e.target.value)}
                    placeholder="Longitude"
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Attached Slip Preview Link if order has slip */}
              {editingOrder?.slip_image_url && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-amber-300 font-medium">Handwritten slip attached</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSlipOrder(editingOrder)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    <span>View Slip</span>
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  disabled={isOrderSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-300 text-sm font-medium hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isOrderSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
                >
                  {isOrderSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Save Order Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Order Confirmation Modal */}
      {deleteConfirmOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Cancel & Delete Delivery?</h3>
                <p className="text-xs text-slate-400">Order #{deleteConfirmOrder.order_number}</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              Are you sure you want to permanently delete order <strong className="text-white">#{deleteConfirmOrder.order_number}</strong> (₹{deleteConfirmOrder.amount}) for <span className="text-emerald-300">{deleteConfirmOrder.address}</span>?
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOrder(null)}
                disabled={isOrderDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-300 text-sm font-medium hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteOrder}
                disabled={isOrderDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
              >
                {isOrderDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Delivery</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Driver Modal */}
      {editingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 animate-scale-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">
                    Edit Delivery Boy: {editingDriver.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Modify profile, contact, 4-digit PIN, active status, and geofence
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingDriver(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEditDriver} className="p-5 space-y-4">
              {driverFormError && (
                <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{driverFormError}</span>
                </div>
              )}

              {/* Name & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={editDriverName}
                    onChange={(e) => setEditDriverName(e.target.value)}
                    required
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={editDriverPhone}
                    onChange={(e) => setEditDriverPhone(e.target.value)}
                    required
                    placeholder="9876543210"
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* PIN & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    4-Digit Login PIN *
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      maxLength={4}
                      value={editDriverPin}
                      onChange={(e) => setEditDriverPin(e.target.value)}
                      placeholder="1234"
                      required
                      className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs font-mono font-bold text-amber-300 tracking-widest focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Rider Status
                  </label>
                  <select
                    value={editDriverStatus}
                    onChange={(e) => setEditDriverStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="active">Active (Eligible)</option>
                    <option value="inactive">Inactive (Disabled)</option>
                  </select>
                </div>
              </div>

              {/* Online Status Toggle & Geofence Radius */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-slate-800/60 border border-slate-700/70 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white block">Online Status</span>
                    <span className="text-[10px] text-slate-400">Heartbeat override</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editDriverIsOnline}
                      onChange={(e) => setEditDriverIsOnline(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Geofence Radius (m)
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="5000"
                    value={editDriverRadius}
                    onChange={(e) => setEditDriverRadius(e.target.value)}
                    placeholder="150"
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Base Coordinates */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Base / Current Coordinates
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectDriverGps}
                    disabled={isDetectingDriverGps}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 disabled:opacity-50"
                  >
                    <Navigation className={`w-3 h-3 ${isDetectingDriverGps ? 'animate-spin' : ''}`} />
                    <span>{isDetectingDriverGps ? 'Detecting...' : 'Use Current GPS'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    step="0.000001"
                    value={editDriverLat}
                    onChange={(e) => setEditDriverLat(e.target.value)}
                    placeholder="Latitude"
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="number"
                    step="0.000001"
                    value={editDriverLng}
                    onChange={(e) => setEditDriverLng(e.target.value)}
                    placeholder="Longitude"
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDriver(null)}
                  disabled={isDriverSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-300 text-sm font-medium hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDriverSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
                >
                  {isDriverSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Driver Details</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Driver Confirmation Modal */}
      {deleteConfirmDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Remove Delivery Boy?</h3>
                <p className="text-xs text-slate-400">Permanently removes driver from fleet</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              Are you sure you want to remove <strong className="text-white">{deleteConfirmDriver.name}</strong> ({deleteConfirmDriver.phone})?
              <br /><br />
              <span className="text-amber-300">⚠️ Any active tasks assigned to this driver will be automatically reset to Unassigned (Pending).</span>
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmDriver(null)}
                disabled={isDriverDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-300 text-sm font-medium hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDriver}
                disabled={isDriverDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
              >
                {isDriverDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <span>Remove Boy</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Handwritten Slip Viewer Modal */}
      <SlipViewerModal
        isOpen={!!selectedSlipOrder}
        onClose={() => setSelectedSlipOrder(null)}
        imageUrl={selectedSlipOrder?.slip_image_url}
        orderNumber={selectedSlipOrder?.order_number}
      />
    </div>
  );
}

export const AdminDashboard = AdminPanel;
export default AdminPanel;
