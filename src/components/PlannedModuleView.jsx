import React from 'react';
import {
  ArrowLeft,
  Receipt,
  Megaphone,
  Calculator,
  UserCheck,
  Settings,
  Sparkles,
  CheckCircle2,
  Layers,
  ArrowRight
} from 'lucide-react';

const MODULE_DATA = {
  sales: {
    id: 'sales',
    title: 'Sales & Billing',
    category: 'Commercial & POS',
    icon: Receipt,
    accentColor: 'from-blue-600 to-indigo-600',
    description: 'Counter POS, Invoices, Thermal Receipts, Customer Returns, E-Way Bill',
    features: [
      'Counter POS & Barcode Quick Scan Billing',
      'GST Compliant 3-Inch Thermal Invoices',
      'Customer Return Bottle Deposit Adjustments',
      'Automated Government E-Way Bill Generation'
    ],
    status: 'Phase 2 Pipeline'
  },
  marketing: {
    id: 'marketing',
    title: 'Marketing & Broadcasts',
    category: 'Growth & CRM',
    icon: Megaphone,
    accentColor: 'from-violet-600 to-purple-600',
    description: 'WhatsApp API Broadcasting, Campaign Automations, Meta Ads',
    features: [
      'Official Meta WhatsApp Business Cloud API Integration',
      'Neighborhood Festival & Refill Reminder Broadcasts',
      'Automated Customer Re-Engagement Triggers',
      'Hyperlocal Meta Ad Campaign ROI Tracking'
    ],
    status: 'Phase 2 Pipeline'
  },
  finance: {
    id: 'finance',
    title: 'Bahi Khata & Finance',
    category: 'Accounts & Tax',
    icon: Calculator,
    accentColor: 'from-emerald-700 to-cyan-800',
    description: 'P&L Statements, GST Return Sheets, CA Data Export, Balance Sheet',
    features: [
      'Automated Daily Profit & Loss Balance Sheet',
      'GSTR-1 & GSTR-3B Excel Sheet Export for CA',
      'Customer Jar Deposit Ledger (Bahi Khata)',
      'Vehicle Fuel, Tyre & Maintenance Expense Logging'
    ],
    status: 'Phase 2 Pipeline'
  },
  staff: {
    id: 'staff',
    title: 'Staff & Attendance',
    category: 'Human Resources',
    icon: UserCheck,
    accentColor: 'from-cyan-600 to-blue-700',
    description: 'Attendance, Biometric Sync, Salary/Payroll, Role Permissions',
    features: [
      'GPS Geofence Hub Attendance Punch Cards',
      'Monthly Driver Commission & Salary Payroll Calculation',
      'Staff Permission Grants (Delivery, Sales, Damage)',
      'Biometric Device USB/Network Sync Integration'
    ],
    status: 'Phase 2 Pipeline'
  },
  settings: {
    id: 'settings',
    title: 'Store & System Config',
    category: 'Administration',
    icon: Settings,
    accentColor: 'from-slate-700 to-slate-900',
    description: 'Catalog Masters, Thermal Printer Settings, Integrations',
    features: [
      'Product & Bottle Catalog Pricing Configurations',
      'ESC/POS Bluetooth & USB Thermal Printer Settings',
      'Store GPS Hub Geofence Radius Setup',
      'Supabase Database Backup & Secret Key Vault'
    ],
    status: 'Phase 2 Pipeline'
  }
};

export default function PlannedModuleView({ moduleId, onBackToHub }) {
  const mod = MODULE_DATA[moduleId] || MODULE_DATA.settings;
  const Icon = mod.icon;

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300 w-full max-w-full overflow-x-hidden">
      {/* Top Header Card */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 sm:p-7 shadow-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onBackToHub}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Hub</span>
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>{mod.status}</span>
            </span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <div
              className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${mod.accentColor} flex items-center justify-center text-white shadow-lg shrink-0`}
            >
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                {mod.category}
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white">
                {mod.title}
              </h1>
            </div>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={onBackToHub}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-600/20 active:scale-95"
          >
            <span>Return to Executive Hub</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs sm:text-sm font-semibold flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
            <span>Module pipeline initialized. Configurable in upcoming update.</span>
          </div>

          <p className="text-slate-300 text-sm leading-relaxed">
            {mod.description}
          </p>

          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Planned Enterprise Capabilities</span>
            </h3>

            <div className="space-y-2.5 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
              {mod.features.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Deployment Info
            </h4>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span>Architecture</span>
                <strong className="text-white">Enterprise Ready</strong>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span>Backend Store</span>
                <strong className="text-emerald-400">Supabase Cloud</strong>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span>Access Control</span>
                <strong className="text-indigo-400">Role-Based (RBAC)</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onBackToHub}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Master Hub</span>
          </button>
        </div>
      </div>
    </div>
  );
}
