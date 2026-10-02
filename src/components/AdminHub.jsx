import React, { useState, useEffect } from 'react';
import {
  Receipt,
  FileSpreadsheet,
  Package,
  PackageX,
  Building2,
  Calculator,
  Settings,
  Clock,
  Quote,
  Sparkles,
  Layers,
  ArrowRight,
  Calendar,
  CheckCircle2
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

  const hour = currentDateTime.getHours();
  const greeting =
    hour < 12
      ? 'Good Morning'
      : hour < 17
      ? 'Good Afternoon'
      : 'Good Evening';

  // 2. Daily Motivational Business Quote
  const todayQuote = getDailyBusinessQuote(currentDateTime);
  const startOfYear = new Date(currentDateTime.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((currentDateTime - startOfYear) / (24 * 60 * 60 * 1000)) + 1;

  // 3. The 7 Core Modules (Clean URLs, direct routing)
  const modulesList = [
    {
      id: 'pos',
      path: '/pos',
      title: 'POS Billing',
      category: 'Counter & Sales',
      icon: Receipt,
      accentColor: 'from-emerald-600 to-teal-600',
      description: 'Counter POS, Barcode Scanning (F1), Voice Billing, UPI QR, 3" Thermal Print (F8)',
      features: [
        'Dual-Pane 65/35 High-Efficiency Counter Desk',
        'Barcode (F1), Smart Search (F2) & Voice Billing (Space)',
        'Live Profit Radar, Dynamic UPI QR & 3" Thermal Print'
      ]
    },
    {
      id: 'purchase',
      path: '/purchase',
      title: 'Purchase Invoices',
      category: 'Procurement & OCR',
      icon: FileSpreadsheet,
      accentColor: 'from-amber-600 to-orange-600',
      description: 'Groq Vision OCR Bill Parsing, Vendor Inward Entry, GST Breakdown & Landed Cost',
      features: [
        'Groq Vision LPU OCR Extraction from Vendor Bills',
        'Multi-Page PDF & Smartphone Live Camera Uploads',
        'Automatic Inward Stock Increments & Landed Cost'
      ]
    },
    {
      id: 'items',
      path: '/inventory',
      title: 'Inventory & Stock',
      category: 'Stock Management',
      icon: Package,
      accentColor: 'from-indigo-600 to-violet-600',
      description: 'Universal Barcode Catalog, Live Stock Levels, Low Stock Alerts & Inward Sync',
      features: [
        'Universal Barcode / EAN SKU Mapping & Quick Fill',
        'Automatic Inward Stock Increments on Bill Commit',
        'Out-of-Stock & Low Stock Real-Time Alert Filters'
      ]
    },
    {
      id: 'damage',
      path: '/damage',
      title: 'Damage & Expiry',
      category: 'Returns & Audit',
      icon: PackageX,
      accentColor: 'from-rose-600 to-pink-600',
      description: 'Dual-Photo Expiry OCR, Godown Rack Allocation, 3-Stage Pipeline & Return Slips',
      features: [
        'Dual-Photo Groq Vision AI OCR & Expiry Camera',
        'Godown Rack Allocation & Weekly Salesman Schedules',
        '3-Stage Pipeline (Godown -> Return Slip -> Credit Note)'
      ]
    },
    {
      id: 'distributors',
      path: '/distributors',
      title: 'Distributors',
      category: 'Vendor Directory',
      icon: Building2,
      accentColor: 'from-blue-600 to-cyan-600',
      description: 'Distributor Directory, Salesman Contacts, Claim Windows & Return Policies',
      features: [
        'Master Distributor & FMCG Company Registry',
        'Salesman Contact & Dedicated Visit Day Scheduling',
        'Monthly Claim Window Presets (e.g. 1st - 10th)'
      ]
    },
    {
      id: 'reports',
      path: '/reports',
      title: 'Reports & Ledgers',
      category: 'Finance & Analytics',
      icon: Calculator,
      accentColor: 'from-emerald-700 to-cyan-800',
      description: 'Daily Sales Ledger, Bahi Khata, Debit Notes, Profit/Loss & Tax Summaries',
      features: [
        'Daily Profit & Loss Ledger and Revenue Analytics',
        'GSTR Sales & Tax Summary Exports',
        'Vendor Debit Notes & Customer Balance Radar'
      ]
    },
    {
      id: 'settings',
      path: '/settings',
      title: 'Store Settings',
      category: 'System Config',
      icon: Settings,
      accentColor: 'from-slate-700 to-slate-900',
      description: 'Store Profile, Thermal Printer Configuration, Barcode Options & Database Status',
      features: [
        'ESC/POS Thermal Printer Settings (USB / Bluetooth)',
        'Barcode Scanner & Audio Chimes Configuration',
        'Cloud Database Health & Local Storage Status'
      ]
    }
  ];

  const handleCardClick = (path, e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (typeof onNavigate === 'function') {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
  };

  return (
    <div className="space-y-6 pb-14 animate-in fade-in duration-300 w-full max-w-full overflow-x-hidden">
      {/* Header with Clock & Greeting */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#0d1633] to-slate-950 border border-slate-800/90 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-16 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Retail Operations Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {greeting}, Operator
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Welcome to JAL-JIVAN POS. Select any of the 7 core modules below to open its dedicated workspace.
            </p>
          </div>

          {/* Real-time Clock */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 shadow-inner min-w-[220px] flex flex-col justify-center shrink-0">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 tracking-wider">
              <span className="flex items-center gap-1.5 uppercase">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
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

        {/* Motivational Business Quote */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/70 via-slate-900/90 to-purple-950/50 border border-indigo-500/20 p-4 sm:p-5 shadow-lg">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                <Quote className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-md border border-indigo-500/30">
                    Daily Retail Wisdom
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
          </div>
        </div>
      </div>

      {/* 7 Core Modules Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <span>7 Core Operations Modules</span>
            </h2>
            <p className="text-xs text-slate-400">
              Direct access to all retail modules without barriers.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>All Modules Active</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {modulesList.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                onClick={(e) => handleCardClick(mod.path, e)}
                className="group relative cursor-pointer rounded-2xl p-5 shadow-xl transition-all duration-300 flex flex-col justify-between select-none bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 hover:border-emerald-500/60 hover:shadow-2xl hover:shadow-emerald-500/15 hover:-translate-y-1"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${mod.accentColor} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                      {mod.category}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                    {mod.description}
                  </p>

                  <ul className="mt-3.5 space-y-1.5 border-t border-slate-800/80 pt-3">
                    {mod.features.map((feat, idx) => (
                      <li key={idx} className="text-[11px] text-slate-300 flex items-start gap-1.5 leading-snug">
                        <span className="text-emerald-400 font-bold shrink-0">•</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:text-emerald-300">
                  <span>Open Module</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
