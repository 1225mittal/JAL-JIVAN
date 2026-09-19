import React, { useState, useMemo, useEffect } from 'react';
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
  LogOut,
  BarChart3,
  Award,
  Star,
  TrendingUp,
  Check,
  BookOpen,
  Building2
} from 'lucide-react';
import { fetchRewardSettings, saveRewardSettings } from '../lib/supabase';
import AddressBook, { AddressDetailModal, aggregateAddressesFromOrders } from './AddressBook';

export function AdminPanel({
  orders = [],
  drivers = [],
  onOpenAddDriver,
  onOpenCreateTask,
  onUpdateStatus,
  onAssignDriver,
  onRefresh,
  loading,
  onLogout
}) {
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'Pending' | 'Out for Delivery' | 'Delivered'
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'drivers' | 'addresses' | 'analytics'
  const [viewProofOrder, setViewProofOrder] = useState(null);
  const [selectedAddressForDetail, setSelectedAddressForDetail] = useState(null);

  // Aggregated addresses from orders for address book & badges
  const addresses = useMemo(() => aggregateAddressesFromOrders(orders), [orders]);

  // Reward Rules State
  const [rewardMinDeliv, setRewardMinDeliv] = useState(5);
  const [rewardStars, setRewardStars] = useState(1);
  const [rewardSaved, setRewardSaved] = useState(false);
  const [savingReward, setSavingReward] = useState(false);

  useEffect(() => {
    async function loadRewards() {
      const res = await fetchRewardSettings();
      if (res) {
        setRewardMinDeliv(res.min_deliveries || 5);
        setRewardStars(res.stars_rewarded || 1);
      }
    }
    loadRewards();
  }, []);

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
    <div className="space-y-5 pb-12">
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
            id="admin-add-driver-btn"
            onClick={onOpenAddDriver}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white text-xs sm:text-sm font-semibold transition-all shadow-sm"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>Add Delivery Boy</span>
          </button>

          <button
            id="admin-create-task-btn"
            onClick={onOpenCreateTask}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-emerald-600/25"
          >
            <PackagePlus className="w-4 h-4" />
            <span>Create Task</span>
          </button>

          {onLogout && (
            <button
              id="admin-panel-logout-btn"
              onClick={onLogout}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs sm:text-sm font-semibold transition-all shadow-sm"
              title="Sign Out Admin"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Cards Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Total Orders */}
        <div className="glass-card p-3.5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Tasks</span>
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

      {/* Main Tabs (Live Orders vs Drivers Roster) */}
      <div className="flex items-center justify-between border-b border-slate-800 pt-1">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('orders')}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
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
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'drivers'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Delivery Boys ({drivers.length})</span>
          </button>

          <button
            id="admin-addresses-tab"
            onClick={() => setActiveTab('addresses')}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'addresses'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Address Book ({addresses.length})</span>
          </button>

          <button
            id="admin-analytics-tab"
            onClick={() => setActiveTab('analytics')}
            className={`pb-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'analytics'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Delivery Analytics</span>
          </button>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="pb-3 text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
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
              <p className="text-slate-300 font-semibold text-sm">No delivery tasks found</p>
              <p className="text-slate-500 text-xs mt-1">
                {searchQuery
                  ? 'Try clearing the search query or changing filters'
                  : 'Click "Create Task" above to dispatch your first order'}
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
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white tracking-wide">
                          #{order.order_number}
                        </span>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-emerald-400">
                          ₹{order.amount}
                        </span>
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

          {drivers.length === 0 ? (
            <div className="glass-card p-8 text-center rounded-2xl border border-slate-800">
              <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-300 font-semibold text-sm">No drivers registered yet</p>
              <p className="text-slate-500 text-xs mt-1">
                Add your first delivery boy with name, phone, and 4-digit PIN.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {drivers.map((driver) => {
                const assignedCount = orders.filter(
                  (o) => o.assigned_driver_id === driver.id && o.status !== 'Delivered'
                ).length;
                const completedCount = orders.filter(
                  (o) => o.assigned_driver_id === driver.id && o.status === 'Delivered'
                ).length;

                return (
                  <div
                    key={driver.id}
                    className="glass-card p-4 rounded-2xl border border-slate-800 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white">{driver.name}</h4>
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{driver.phone}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                        {driver.status || 'Active'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                        <span>Driver PIN:</span>
                      </div>
                      <span className="font-mono font-bold tracking-widest text-amber-300 px-2 py-0.5 bg-amber-500/10 rounded-md border border-amber-500/20">
                        {driver.pin}
                      </span>
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ADDRESS BOOK DIRECTORY */}
      {activeTab === 'addresses' && (
        <AddressBook
          orders={orders}
          onViewProof={(order) => setViewProofOrder(order)}
        />
      )}

      {/* TAB 4: DELIVERY ANALYTICS & VARIANCE */}
      {activeTab === 'analytics' && (
        <div className="space-y-5 animate-fade-in">
          {/* 1. Driver Star Reward Rules Configuration */}
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
    </div>
  );
}

export const AdminDashboard = AdminPanel;
export default AdminPanel;
