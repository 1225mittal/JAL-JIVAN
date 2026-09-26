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
  LogOut,
  Receipt,
  FileSpreadsheet,
  Megaphone,
  Calculator,
  UserCheck,
  Settings,
  Quote,
  X,
  Layers,
  Flame,
  Check
} from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';
import { isDriverOnline } from '../lib/geoUtils';
import { getDailyBusinessQuote } from '../lib/businessQuotes';

export default function AdminHub({
  onSelectModule,
  orders = [],
  drivers = [],
  damages = [],
  onOpenCreateTask,
  onOpenAddDriver,
  onRefreshAll,
  onAdminLogout
}) {
  // 1. Digital Live Clock with Seconds & Full Date
  const [currentDateTime, setCurrentDateTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentDateTime.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const formattedTime = currentDateTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  // 2. Daily Auto-Rotating Motivational Business Quote (Shifts automatically at 00:00:00 midnight)
  const todayQuote = getDailyBusinessQuote(currentDateTime);

  // Day of year calculation for display
  const startOfYear = new Date(currentDateTime.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((currentDateTime - startOfYear) / (24 * 60 * 60 * 1000)) + 1;

  // 3. Operational KPIs for active cards
  const pendingOrders = orders.filter((o) => o.status === 'Pending').length;
  const outForDeliveryOrders = orders.filter((o) => o.status === 'Out for Delivery').length;
  const deliveredOrders = orders.filter((o) => o.status === 'Delivered').length;

  const onlineDriversList = drivers.filter((d) => isDriverOnline(d));
  const onlineDrivers = onlineDriversList.length;

  const totalDamagedUnits = damages.reduce((sum, d) => sum + (Number(d.quantity) || 1), 0);
  const pendingDamageReplacements = damages.filter((d) => d.status === 'Pending').length;
  const totalDamageLoss = damages.reduce(
    (sum, d) => sum + (Number(d.estimated_value) || 0),
    0
  );

  // 4. Modal state for Planned / Coming Soon Modules
  const [plannedModalModule, setPlannedModalModule] = useState(null);

  // Definition of the 8 enterprise modules
  const modulesList = [
    {
      id: 'sales',
      title: 'Sales & Billing',
      category: 'Commercial',
      tag: 'Coming Soon / Planned',
      isLive: false,
      icon: Receipt,
      accentColor: 'from-blue-600 to-indigo-600',
      tagColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      description: 'POS, Invoices, Thermal Receipts, Customer Returns, E-Way Bill',
      features: [
        'Counter POS & Barcode Quick Scan Billing',
        'GST Compliant 3-Inch Thermal Invoices',
        'Customer Return Bottle Deposit Adjustments',
        'Automated Government E-Way Bill Generation'
      ]
    },
    {
      id: 'purchase',
      title: 'Purchase & Inward',
      category: 'Procurement',
      tag: 'Coming Soon / Planned',
      isLive: false,
      icon: FileSpreadsheet,
      accentColor: 'from-amber-600 to-orange-600',
      tagColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      description: 'OCR Bill Extraction, Multi-Vendor Price Compare, Purchase Returns',
      features: [
        'AI OCR Extraction from Supplier Tax Invoices',
        'Multi-Vendor Price Comparison Matrix',
        'Raw Material & Cap/Jar Stock Inward Logging',
        'Damaged Inward Consignment Returns'
      ]
    },
    {
      id: 'delivery',
      title: 'Delivery Management',
      category: 'Core Operations',
      tag: 'Active / Live',
      isLive: true,
      icon: Truck,
      accentColor: 'from-emerald-500 to-teal-600',
      tagColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20',
      description: 'Live Fleet Radar, Quick Grok/Groq Voice Orders, Dispatch',
      features: [
        'Live GPS Fleet Radar with Real-Time Rider Telemetry',
        'Hinglish AI Voice-to-Order Processing (Groq Whisper)',
        'Paper Slips & WhatsApp Image Order Extraction',
        'Doorstep Proof-of-Delivery (POD) & Cash Settlement'
      ],
      stats: {
        item1: { label: 'Pending', value: pendingOrders, color: 'text-amber-400' },
        item2: { label: 'En Route', value: outForDeliveryOrders, color: 'text-cyan-400' },
        item3: { label: 'Delivered', value: deliveredOrders, color: 'text-emerald-400' }
      }
    },
    {
      id: 'damage',
      title: 'Damage Management',
      category: 'Quality & Audit',
      tag: 'Active / Live',
      isLive: true,
      icon: PackageX,
      accentColor: 'from-rose-600 to-pink-600',
      tagColor: 'bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-500/20',
      description: 'Loss Tracker, Expiry Returns, Bottle Write-Offs',
      features: [
        'Damaged Jar Logging with Photo Camera Proof',
        'Route Rider Defect & Leakage Accountability',
        'Replacement Workflow: Pending → Swapped → Written Off',
        'Financial Leakage & Inventory Loss Valuation (₹)'
      ],
      stats: {
        item1: { label: 'Damaged', value: totalDamagedUnits, color: 'text-rose-400' },
        item2: { label: 'Pending Swap', value: pendingDamageReplacements, color: 'text-amber-400' },
        item3: { label: 'Loss Value', value: `₹${totalDamageLoss}`, color: 'text-slate-200' }
      }
    },
    {
      id: 'marketing',
      title: 'Marketing & Broadcasts',
      category: 'Growth & CRM',
      tag: 'Coming Soon / Planned',
      isLive: false,
      icon: Megaphone,
      accentColor: 'from-violet-600 to-purple-600',
      tagColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      description: 'WhatsApp API Broadcasting, Campaign Automations, Meta Ads',
      features: [
        'Official Meta WhatsApp Business Cloud API Integration',
        'Neighborhood Festival & Hot Summer Broadcast Campaigns',
        'Automated Water Refill Reminder Notifications',
        'Hyperlocal Meta Ad Campaign ROI Tracking'
      ]
    },
    {
      id: 'finance',
      title: 'Bahi Khata & Finance',
      category: 'Accounts & Tax',
      tag: 'Coming Soon / Planned',
      isLive: false,
      icon: Calculator,
      accentColor: 'from-emerald-700 to-cyan-800',
      tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      description: 'P&L Statements, GST Return Sheets, CA Data Export, Balance Sheet',
      features: [
        'Automated Daily Profit & Loss Balance Sheet',
        'GSTR-1 & GSTR-3B Excel Sheet Export for CA',
        'Customer Jar Deposit Ledger (Bahi Khata)',
        'Vehicle Fuel, Tyre & Maintenance Expense Logging'
      ]
    },
    {
      id: 'staff',
      title: 'Staff & Attendance',
      category: 'Human Resources',
      tag: 'Coming Soon / Planned',
      isLive: false,
      icon: UserCheck,
      accentColor: 'from-cyan-600 to-blue-700',
      tagColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      description: 'Attendance, Biometric Sync, Salary/Payroll, Role Permissions',
      features: [
        'GPS Geofence Hub Attendance Punch Cards',
        'Monthly Driver Commission & Salary Payroll Calculation',
        'Staff Permission Grants (Delivery, Sales, Damage)',
        'Biometric Device USB/Network Sync Integration'
      ]
    },
    {
      id: 'config',
      title: 'Store & System Config',
      category: 'Administration',
      tag: 'Coming Soon / Planned',
      isLive: false,
      icon: Settings,
      accentColor: 'from-slate-700 to-slate-900',
      tagColor: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      description: 'Catalog Masters, Thermal Printer Settings, Integrations',
      features: [
        'Product & Bottle Catalog Pricing Configurations',
        'ESC/POS Bluetooth & USB Thermal Printer Settings',
        'Store GPS Hub Geofence Radius Setup',
        'Supabase Database Backup & Secret Key Vault'
      ]
    }
  ];

  const handleCardClick = (mod) => {
    if (mod.isLive) {
      if (onSelectModule) {
        onSelectModule(mod.id);
      }
    } else {
      setPlannedModalModule(mod);
    }
  };

  return (
    <div className="space-y-6 pb-14 animate-in fade-in duration-300 w-full max-w-full overflow-x-hidden">
      {/* ======================================================== */}
      {/* 1. MASTER HEADER: LIVE DIGITAL CLOCK, MOTIVATIONAL QUOTE & LOGOUT */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#0d1633] to-slate-950 border border-slate-800/90 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
        {/* Glow Accents */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Left: Branding & Status Badges */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>Master Admin Command Hub</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                Owner Access Active
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800/80 text-slate-300 border border-slate-700">
                {isSupabaseConfigured ? '⚡ Cloud Synchronized' : '💾 Local Storage'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              JAL-JIVAN Central Command
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Unified enterprise control center. Manage fleet logistics, damage claims, and upcoming business pipelines from a single master hub.
            </p>
          </div>

          {/* Right: Real-time Digital Clock & Quick Logout */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Live Digital Clock */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 shadow-inner min-w-[210px] flex flex-col justify-center">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 tracking-wider">
                <span className="flex items-center gap-1.5 uppercase">
                  <Clock className="w-3.5 h-3.5 animate-spin-slow text-emerald-400" />
                  Digital Clock
                </span>
                <span className="text-[10px] text-slate-500 font-mono">IST</span>
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-black text-white mt-1 tracking-tight">
                {formattedTime}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                {formattedDate}
              </div>
            </div>

            {/* Hub Actions: Refresh & Quick Logout */}
            <div className="flex flex-row sm:flex-col gap-2 justify-center">
              {onRefreshAll && (
                <button
                  type="button"
                  onClick={onRefreshAll}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-2.5 rounded-xl border border-slate-700/80 transition-all active:scale-95 shadow-sm"
                  title="Refresh Live Data"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold">Refresh</span>
                </button>
              )}

              {onAdminLogout && (
                <button
                  type="button"
                  id="admin-hub-quick-logout-btn"
                  onClick={onAdminLogout}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 text-xs text-white bg-red-600 hover:bg-red-500 px-3.5 py-2.5 rounded-xl font-bold shadow-md shadow-red-600/30 hover:shadow-red-600/50 transition-all active:scale-95"
                  title="Sign Out of Admin Console"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* DAILY AUTO-ROTATING MOTIVATIONAL BUSINESS QUOTE CARD */}
        {/* ======================================================== */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/70 via-slate-900/90 to-purple-950/50 border border-indigo-500/20 p-4 sm:p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                  <Quote className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-md border border-indigo-500/30">
                      Daily Business Motivation
                    </span>
                    <span className="text-[10px] font-medium text-slate-400">
                      Day {dayOfYear} of 365 • Topic: <strong className="text-slate-200">{todayQuote.topic}</strong>
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-slate-100 italic leading-snug">
                    "{todayQuote.quote}"
                  </p>
                  <p className="text-xs text-indigo-300 font-bold mt-1">
                    — {todayQuote.author}
                  </p>
                </div>
              </div>

              <div className="shrink-0 self-end sm:self-center">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Auto-shifts at Midnight</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Fleet Glance Strip */}
        <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-300">
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Active Fleet Status:</span>
            <span className="text-emerald-400 font-bold">{onlineDrivers} Riders Online</span>
            <span className="text-slate-500">({drivers.length} registered)</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {drivers.slice(0, 4).map((d) => {
              const isOnline = isDriverOnline(d);
              return (
                <span
                  key={d.id}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                    isOnline
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                  <span>{d.name}</span>
                </span>
              );
            })}
            {drivers.length > 4 && (
              <span className="text-[10px] text-slate-500">+{drivers.length - 4} more</span>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. ENTERPRISE MODULES GRID: 8 DISTINCT CARDS */}
      {/* ======================================================== */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <span>Operations & Enterprise Pipeline</span>
            </h2>
            <p className="text-xs text-slate-400">
              Select an active console to manage live operations, or inspect upcoming enterprise modules.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              <strong className="text-slate-200">2 Active</strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
              <span>6 Planned</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {modulesList.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                onClick={() => handleCardClick(mod)}
                className={`group relative cursor-pointer rounded-2xl p-5 shadow-xl transition-all duration-300 flex flex-col justify-between ${
                  mod.isLive
                    ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-emerald-500/50 hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-1.5'
                    : 'bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/95 hover:-translate-y-0.5'
                }`}
              >
                {/* Active Card Glowing Pulse Effect */}
                {mod.isLive && (
                  <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 blur opacity-60 group-hover:opacity-100 transition-opacity -z-10" />
                )}

                {/* Top Corner Action Indicator */}
                <div className="absolute top-0 right-0 mt-4 mr-4">
                  {mod.isLive ? (
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                      <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-800/80 text-slate-400 group-hover:text-slate-200 transition-colors">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                <div>
                  {/* Icon & Category Tag */}
                  <div className="flex items-center gap-3 mb-3.5">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${mod.accentColor} flex items-center justify-center text-white shadow-lg shrink-0 group-hover:scale-105 transition-transform`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        {mod.category}
                      </span>
                      <h3 className="text-base font-extrabold text-white group-hover:text-emerald-400 transition-colors">
                        {mod.title}
                      </h3>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${mod.tagColor}`}
                    >
                      {mod.isLive && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                      )}
                      <span>{mod.tag}</span>
                    </span>
                  </div>

                  {/* Module Short Summary */}
                  <p className="text-xs text-slate-300 leading-relaxed mb-4 min-h-[36px]">
                    {mod.description}
                  </p>

                  {/* Feature Bullets */}
                  <div className="space-y-1.5 mb-4 text-[11px] text-slate-400">
                    {mod.features.slice(0, 2).map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${mod.isLive ? 'text-emerald-400' : 'text-slate-500'}`} />
                        <span className="leading-tight text-slate-300">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Card Footer: Stats for Live or Action Button */}
                <div className="pt-3.5 border-t border-slate-800/80">
                  {mod.isLive && mod.stats ? (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <div className="bg-slate-950/70 rounded-lg p-1.5 border border-slate-800">
                          <div className="text-[9px] text-slate-400">{mod.stats.item1.label}</div>
                          <div className={`text-xs font-black ${mod.stats.item1.color}`}>
                            {mod.stats.item1.value}
                          </div>
                        </div>
                        <div className="bg-slate-950/70 rounded-lg p-1.5 border border-slate-800">
                          <div className="text-[9px] text-slate-400">{mod.stats.item2.label}</div>
                          <div className={`text-xs font-black ${mod.stats.item2.color}`}>
                            {mod.stats.item2.value}
                          </div>
                        </div>
                        <div className="bg-slate-950/70 rounded-lg p-1.5 border border-slate-800">
                          <div className="text-[9px] text-slate-400">{mod.stats.item3.label}</div>
                          <div className={`text-xs font-black ${mod.stats.item3.color}`}>
                            {mod.stats.item3.value}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:text-emerald-300">
                        <span>Launch Console</span>
                        <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-slate-200">
                      <span>View Roadmap Specs</span>
                      <ChevronRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform text-slate-500" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. MODAL FOR PLANNED / COMING SOON MODULES */}
      {/* ======================================================== */}
      {plannedModalModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-7 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${plannedModalModule.accentColor} flex items-center justify-center text-white shadow-lg shrink-0`}
                >
                  {React.createElement(plannedModalModule.icon, { className: 'w-6 h-6' })}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {plannedModalModule.category}
                  </span>
                  <h3 className="text-xl font-black text-white">
                    {plannedModalModule.title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPlannedModalModule(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Standard Notice Message Requested */}
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs sm:text-sm font-semibold flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
              <span>Module pipeline initialized. Configurable in upcoming update.</span>
            </div>

            {/* Features Planned */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Planned Capabilities in Roadmap:
              </h4>
              <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                {plannedModalModule.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Architecture Status Tag */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <span>Status: <strong>Phase 2 Deployment</strong></span>
              <button
                type="button"
                onClick={() => setPlannedModalModule(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
