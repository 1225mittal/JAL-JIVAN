import React, { useState, useEffect } from 'react';
import {
  Truck,
  PackageX,
  Boxes,
  Activity,
  Users,
  ShieldCheck,
  TrendingUp,
  Clock,
  IndianRupee,
  ChevronRight,
  ArrowUpRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  RefreshCw,
  ExternalLink,
  Layers,
  FileText,
  Warehouse,
  Flame,
  Info
} from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';
import { isDriverOnline } from '../lib/geoUtils';

export default function AdminHub({
  onSelectModule,
  orders = [],
  drivers = [],
  damages = [],
  onOpenCreateTask,
  onOpenAddDriver,
  onRefreshAll
}) {
  // Live formatted date & time
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentDateTime.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const formattedTime = currentDateTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  // Calculate live statistics
  const pendingOrders = orders.filter((o) => o.status === 'Pending').length;
  const outForDeliveryOrders = orders.filter((o) => o.status === 'Out for Delivery').length;
  const deliveredOrders = orders.filter((o) => o.status === 'Delivered').length;
  const totalRevenue = orders
    .filter((o) => o.status === 'Delivered')
    .reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);

  // Online drivers (considered ONLINE if is_online === true and active within 5 minutes)
  const onlineDriversList = drivers.filter((d) => isDriverOnline(d));
  const onlineDrivers = onlineDriversList.length;

  const totalDamagedUnits = damages.reduce((sum, d) => sum + (Number(d.quantity) || 1), 0);
  const pendingDamageReplacements = damages.filter((d) => d.status === 'Pending').length;
  const totalDamageLoss = damages.reduce(
    (sum, d) => sum + (Number(d.estimated_value) || 0),
    0
  );

  // Quick inventory modal state
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300 w-full max-w-full overflow-x-hidden">
      {/* Top Header / Branding & Live Clock */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                Live Hub Active
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                Admin Central Operations
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800/80 text-slate-300 border border-slate-700">
                {isSupabaseConfigured ? '⚡ Supabase Synced' : '💾 Local Storage Mode'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              JAL-JIVAN Operations Hub
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Centralized command center for pure water dispatch, live fleet tracking, voice order processing, and returns & damages control.
            </p>
          </div>

          {/* Time & Quick Refresh */}
          <div className="flex flex-col sm:items-end justify-center bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 shrink-0 shadow-inner">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 animate-spin-slow" />
              <span>Real-Time Clock</span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-white mt-0.5 tracking-tight">
              {formattedTime}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">
              {formattedDate}
            </div>

            {onRefreshAll && (
              <button
                onClick={onRefreshAll}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 px-2.5 py-1 rounded-lg border border-slate-700 transition-all active:scale-95"
                title="Refresh All Real-Time Hub Data"
              >
                <RefreshCw className="w-3 h-3 text-emerald-400" />
                <span>Refresh Hub</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick KPI Stat Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Orders Today</span>
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-xl font-bold text-white mt-1">
              {orders.length}
              <span className="text-xs font-normal text-slate-400 ml-1.5">
                ({pendingOrders} pending)
              </span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Riders on Duty</span>
              <Users className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              {onlineDrivers}
              <span className="text-xs font-normal text-slate-400 ml-1.5">
                / {drivers.length} registered
              </span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Active Dispatches</span>
              <Truck className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-amber-400 mt-1">
              {outForDeliveryOrders}
              <span className="text-xs font-normal text-slate-400 ml-1.5">en-route</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>Damaged Reported</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-xl font-bold text-rose-400 mt-1">
              {totalDamagedUnits}
              <span className="text-xs font-normal text-slate-400 ml-1.5">units</span>
            </div>
          </div>
        </div>

        {/* Live Driver Fleet Roster with Glowing Green Dot */}
        <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Driver Fleet Status ({drivers.length} registered):</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {drivers.map((d) => {
              const isOnline = isDriverOnline(d);
              return (
                <span
                  key={d.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                    isOnline
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                      : 'bg-slate-900/90 text-slate-400 border-slate-800'
                  }`}
                >
                  {isOnline ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <span className="font-bold text-white">{d.name}</span>
                      <span className="text-[11px] text-emerald-400">- Online / On Road</span>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex rounded-full h-2 w-2 bg-slate-500" />
                      <span>{d.name}</span>
                      <span className="text-[10px] text-slate-500">- Offline</span>
                    </>
                  )}
                </span>
              );
            })}
            {drivers.length === 0 && (
              <span className="text-xs text-slate-500">No delivery drivers registered yet.</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Modular Navigation Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Operational Modules
            </h2>
            <p className="text-xs text-slate-400">
              Select a specialized dashboard module to dispatch orders, monitor deliveries, or handle damaged stock.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* ======================================================== */}
          {/* MODULE CARD 1: DELIVERY & DISPATCH SYSTEM */}
          {/* ======================================================== */}
          <div
            onClick={() => onSelectModule('delivery')}
            className="group relative cursor-pointer rounded-2xl bg-gradient-to-b from-slate-900/95 to-slate-950 border border-slate-800 hover:border-emerald-500/50 p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/10 flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 mt-4 mr-4">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-800/80 group-hover:bg-emerald-500 group-hover:text-slate-950 text-slate-300 transition-all shadow">
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>

            <div>
              {/* Icon & Category */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 shrink-0 group-hover:scale-105 transition-transform p-3">
                  <Truck className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Core System
                  </span>
                  <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors mt-0.5">
                    Delivery & Dispatch
                  </h3>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-300 leading-relaxed mb-5">
                Orders, live driver route tracking, IVR calls, voice notes & paper slips. Full dispatch pipeline with driver location radar.
              </p>

              {/* Key Features List */}
              <div className="space-y-1.5 mb-5 text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>AI Voice-to-Order with Hinglish Audio Notes</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Invoice & Handwritten Slip OCR Processing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Live GPS Rider Fleet Radar & Geoguard</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Proof of Delivery (POD) Photo & Cash Collection</span>
                </div>
              </div>
            </div>

            {/* Quick Stats Inside Card */}
            <div className="pt-4 border-t border-slate-800/80">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Pending</div>
                  <div className="text-sm font-bold text-amber-400">{pendingOrders}</div>
                </div>
                <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Dispatched</div>
                  <div className="text-sm font-bold text-indigo-400">{outForDeliveryOrders}</div>
                </div>
                <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Completed</div>
                  <div className="text-sm font-bold text-emerald-400">{deliveredOrders}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">
                <span>Open Dispatch Console</span>
                <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* MODULE CARD 2: DAMAGE & RETURNS MANAGEMENT */}
          {/* ======================================================== */}
          <div
            onClick={() => onSelectModule('damage')}
            className="group relative cursor-pointer rounded-2xl bg-gradient-to-b from-slate-900/95 to-slate-950 border border-slate-800 hover:border-rose-500/50 p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-rose-500/10 flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 mt-4 mr-4">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-800/80 group-hover:bg-rose-500 group-hover:text-white text-slate-300 transition-all shadow">
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>

            <div>
              {/* Icon & Category */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/25 shrink-0 group-hover:scale-105 transition-transform p-3">
                  <PackageX className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    Quality & Audit
                  </span>
                  <h3 className="text-lg font-bold text-white group-hover:text-rose-400 transition-colors mt-0.5">
                    Damage & Returns
                  </h3>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-300 leading-relaxed mb-5">
                Track cracked jars, leaking dispenser cans, transit damage, and stock write-offs. Maintain accountability with driver defect logs.
              </p>

              {/* Key Features List */}
              <div className="space-y-1.5 mb-5 text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Damaged Item Logging with Photo Attachments</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Driver & Handler Route Accountability</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Status Workflow: Pending → Replaced → Written Off</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Financial Loss & Replacement Valuation (₹)</span>
                </div>
              </div>
            </div>

            {/* Quick Stats Inside Card */}
            <div className="pt-4 border-t border-slate-800/80">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Damaged</div>
                  <div className="text-sm font-bold text-rose-400">{totalDamagedUnits}</div>
                </div>
                <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Pending Action</div>
                  <div className="text-sm font-bold text-amber-400">{pendingDamageReplacements}</div>
                </div>
                <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Est. Loss</div>
                  <div className="text-sm font-bold text-slate-200">₹{totalDamageLoss}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs font-semibold text-rose-400 group-hover:text-rose-300">
                <span>Open Damage Module</span>
                <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* MODULE CARD 3: STOCK & INVENTORY */}
          {/* ======================================================== */}
          <div
            onClick={() => setIsInventoryModalOpen(true)}
            className="group relative cursor-pointer rounded-2xl bg-gradient-to-b from-slate-900/95 to-slate-950 border border-slate-800 hover:border-cyan-500/50 p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-500/10 flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 mt-4 mr-4">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-800/80 group-hover:bg-cyan-500 group-hover:text-slate-950 text-slate-300 transition-all shadow">
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>

            <div>
              {/* Icon & Category */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 shrink-0 group-hover:scale-105 transition-transform p-3">
                  <Warehouse className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    Warehouse & Assets
                  </span>
                  <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors mt-0.5">
                    Stock & Inventory
                  </h3>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-300 leading-relaxed mb-5">
                Shows active stock of 20L jars, chillers, and dispensers. Monitor circulation, empty jar returns, and depot capacity.
              </p>

              {/* Key Features List */}
              <div className="space-y-1.5 mb-5 text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>20L Water Can Circulation & Depot Tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Empty Cans Awaiting Wash & Refill Buffer</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Cold Chillers, Stands & Tap Spares Balance</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Warehouse Re-Order Alerts & Shortage Warnings</span>
                </div>
              </div>
            </div>

            {/* Quick Stats Inside Card */}
            <div className="pt-4 border-t border-slate-800/80">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                  <div className="text-[10px] text-slate-400">In Circulation</div>
                  <div className="text-sm font-bold text-cyan-400">1,420</div>
                </div>
                <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Hub Ready</div>
                  <div className="text-sm font-bold text-emerald-400">380</div>
                </div>
                <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                  <div className="text-[10px] text-slate-400">Empties</div>
                  <div className="text-sm font-bold text-amber-400">165</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs font-semibold text-cyan-400 group-hover:text-cyan-300">
                <span>View Inventory Summary</span>
                <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Footer Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Dispatching orders or recording damages automatically updates reports across all connected devices in real-time.
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {onOpenCreateTask && (
            <button
              onClick={onOpenCreateTask}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all shadow-sm"
            >
              + Create Delivery
            </button>
          )}
          {onOpenAddDriver && (
            <button
              onClick={onOpenAddDriver}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-sm"
            >
              + Register Driver
            </button>
          )}
        </div>
      </div>

      {/* Stock & Inventory Quick Summary Modal */}
      {isInventoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Warehouse className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Warehouse Stock & Inventory</h3>
                  <p className="text-xs text-slate-400">Live equipment and 20L can asset balance</p>
                </div>
              </div>
              <button
                onClick={() => setIsInventoryModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">20L RO Water Cans (Filled & Ready)</div>
                  <div className="text-[11px] text-slate-400">Stored at Central Hub Ghaziabad depot</div>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-emerald-400">380 units</span>
                  <div className="text-[10px] text-emerald-500">Normal Stock Level</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">20L Cans in Circulation (With Customers)</div>
                  <div className="text-[11px] text-slate-400">Active deposits across residential & commercial</div>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-cyan-400">1,420 units</span>
                  <div className="text-[10px] text-slate-400">Under Active Rental</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Empty 20L Cans (Awaiting Wash / Refill)</div>
                  <div className="text-[11px] text-slate-400">Returned from morning driver delivery routes</div>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-amber-400">165 units</span>
                  <div className="text-[10px] text-amber-500">In Quality Sorting Queue</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white">Water Dispensers, Chillers & Tap Stands</div>
                  <div className="text-[11px] text-slate-400">Auxiliary equipment ready for dispatch</div>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-purple-400">52 units</span>
                  <div className="text-[10px] text-slate-400">In Stock</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-rose-300">Damaged & Written Off Cans</div>
                  <div className="text-[11px] text-rose-400/80">Pending scrap disposal or vendor return</div>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-rose-400">{totalDamagedUnits} units</span>
                  <div className="text-[10px] text-rose-400">Segregated in Yard</div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                onClick={() => {
                  setIsInventoryModalOpen(false);
                  onSelectModule('damage');
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all"
              >
                Inspect Damaged Assets →
              </button>
              <button
                onClick={() => setIsInventoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-all"
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
