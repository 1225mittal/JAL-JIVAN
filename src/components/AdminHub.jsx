import React, { useState, useEffect } from 'react';
import {
  Truck,
  PackageX,
  FileSpreadsheet,
  Receipt,
  Megaphone,
  Calculator,
  UserCheck,
  Settings,
  Clock,
  Quote,
  Sparkles,
  ArrowUpRight,
  Check,
  Layers,
  Calendar
} from 'lucide-react';
import { getDailyBusinessQuote } from '../lib/businessQuotes';

export default function AdminHub({ onNavigate }) {
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

  // Dynamic time-based greeting
  const hour = currentDateTime.getHours();
  const greeting =
    hour < 12
      ? 'Good Morning'
      : hour < 17
      ? 'Good Afternoon'
      : 'Good Evening';

  // 2. Daily Auto-Rotating Motivational Business Quote (changes at midnight automatically)
  const todayQuote = getDailyBusinessQuote(currentDateTime);

  // Day of year calculation
  const startOfYear = new Date(currentDateTime.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((currentDateTime - startOfYear) / (24 * 60 * 60 * 1000)) + 1;

  // 3. Clean 8 Enterprise Modules Definition with Dedicated Paths
  const modulesList = [
    {
      id: 'sales',
      path: '/admin/sales',
      title: 'Sales & Billing',
      category: 'Commercial',
      tag: 'Planned',
      isLive: false,
      icon: Receipt,
      accentColor: 'from-blue-600 to-indigo-600',
      tagColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      description: 'Counter POS, Invoices, Thermal Receipts, Customer Returns, E-Way Bill',
      features: [
        'Counter POS & Barcode Quick Scan Billing',
        'GST Compliant 3-Inch Thermal Invoices',
        'Customer Return Bottle Deposit Adjustments'
      ]
    },
    {
      id: 'purchase',
      path: '/admin/purchase',
      title: 'Purchase & Inward',
      category: 'Procurement',
      tag: 'Active / Live',
      isLive: true,
      icon: FileSpreadsheet,
      accentColor: 'from-amber-600 to-orange-600',
      tagColor: 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20',
      description: 'Groq Vision OCR, Barcode Scanning, Vendor Inward Entry',
      features: [
        'Groq Vision LPU OCR Extraction from Bills',
        'PDF Multi-Page & Camera Upload Drop-Zone',
        'GST Breakdown, HSN & Landed Cost Computation'
      ]
    },
    {
      id: 'delivery',
      path: '/admin/delivery',
      title: 'Delivery & Dispatch',
      category: 'Core Operations',
      tag: 'Active / Live',
      isLive: true,
      icon: Truck,
      accentColor: 'from-emerald-500 to-teal-600',
      tagColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20',
      description: 'Live Fleet Radar, Quick Groq Voice Orders, Dispatch Console',
      features: [
        'Live GPS Fleet Radar with Real-Time Telemetry',
        'Hinglish AI Voice-to-Order Processing (Groq Whisper)',
        'Doorstep Proof-of-Delivery (POD) & Cash Settlement'
      ]
    },
    {
      id: 'damage',
      path: '/admin/damage',
      title: 'Damage & Returns',
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
        'Financial Leakage & Inventory Loss Valuation (₹)'
      ]
    },
    {
      id: 'marketing',
      path: '/admin/marketing',
      title: 'Marketing & Broadcasts',
      category: 'Growth & CRM',
      tag: 'Planned',
      isLive: false,
      icon: Megaphone,
      accentColor: 'from-violet-600 to-purple-600',
      tagColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      description: 'WhatsApp API Broadcasting, Campaign Automations, Meta Ads',
      features: [
        'Official Meta WhatsApp Business Cloud API',
        'Neighborhood Festival & Refill Reminder Broadcasts',
        'Hyperlocal Customer Re-Engagement Tracking'
      ]
    },
    {
      id: 'finance',
      path: '/admin/finance',
      title: 'Bahi Khata & Finance',
      category: 'Accounts & Tax',
      tag: 'Planned',
      isLive: false,
      icon: Calculator,
      accentColor: 'from-emerald-700 to-cyan-800',
      tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      description: 'P&L Statements, GST Return Sheets, CA Data Export, Balance Sheet',
      features: [
        'Automated Daily Profit & Loss Balance Sheet',
        'GSTR-1 & GSTR-3B Excel Sheet Export for CA',
        'Customer Jar Deposit Ledger (Bahi Khata)'
      ]
    },
    {
      id: 'staff',
      path: '/admin/staff',
      title: 'Staff & Attendance',
      category: 'Human Resources',
      tag: 'Planned',
      isLive: false,
      icon: UserCheck,
      accentColor: 'from-cyan-600 to-blue-700',
      tagColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      description: 'Attendance, Biometric Sync, Salary/Payroll, Role Permissions',
      features: [
        'GPS Geofence Hub Attendance Punch Cards',
        'Monthly Driver Commission & Salary Payroll Calculation',
        'Staff Permission Grants (Delivery, Sales, Damage)'
      ]
    },
    {
      id: 'settings',
      path: '/admin/settings',
      title: 'Store & System Config',
      category: 'Administration',
      tag: 'Planned',
      isLive: false,
      icon: Settings,
      accentColor: 'from-slate-700 to-slate-900',
      tagColor: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      description: 'Catalog Masters, Thermal Printer Settings, Integrations',
      features: [
        'Product & Bottle Catalog Pricing Configurations',
        'ESC/POS Bluetooth & USB Thermal Printer Settings',
        'Store GPS Hub Geofence Radius Setup'
      ]
    }
  ];

  const handleCardClick = (mod) => {
    if (onNavigate) {
      onNavigate(mod.path);
    }
  };

  return (
    <div className="space-y-6 pb-14 animate-in fade-in duration-300 w-full max-w-full overflow-x-hidden">
      {/* ======================================================== */}
      {/* 1. CLEAN EXECUTIVE GREETING & REAL-TIME CLOCK */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#0d1633] to-slate-950 border border-slate-800/90 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Top Greeting */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {greeting}, Executive Admin
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
              JAL-JIVAN Master Executive Hub. Access operations consoles and enterprise modules.
            </p>
          </div>

          {/* Real-time Clock (Time + Date in IST) */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 shadow-inner min-w-[220px] flex flex-col justify-center shrink-0">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 tracking-wider">
              <span className="flex items-center gap-1.5 uppercase">
                <Clock className="w-3.5 h-3.5 animate-spin-slow text-emerald-400" />
                Live Digital Clock
              </span>
              <span className="text-[10px] text-slate-500 font-mono">IST</span>
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-black text-white mt-1 tracking-tight">
              {formattedTime}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. DAILY AUTO-ROTATING MOTIVATIONAL BUSINESS QUOTE */}
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
                  <span>Rotates Daily at Midnight</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. CLEAN 8-MODULE GRID LAYOUT */}
      {/* ======================================================== */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <span>Enterprise Modules</span>
            </h2>
            <p className="text-xs text-slate-400">
              Select an operations module to launch its dedicated console.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              <strong className="text-slate-200">3 Active</strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
              <span>5 Planned</span>
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
                    ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-emerald-500/40 hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/20 hover:-translate-y-1.5'
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
                    {mod.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <Check
                          className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                            mod.isLive ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        />
                        <span className="leading-tight text-slate-300">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Card Footer */}
                <div className="pt-3.5 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:text-emerald-300">
                    <span>{mod.isLive ? 'Launch Module Console' : 'View Module Specs'}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
