import React, { useState } from 'react';
import {
  Users,
  Lock,
  Phone,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Truck,
  PackageX,
  Receipt,
  FileSpreadsheet,
  Megaphone,
  Calculator,
  UserCheck,
  Settings,
  LogOut,
  ChevronRight,
  ArrowUpRight,
  Sparkles,
  X
} from 'lucide-react';
import { staffLogin } from '../lib/supabase';

export default function StaffPortal({
  staffSession,
  onStaffLoginSuccess,
  onStaffLogout,
  onSelectModule,
  onNavigateToAdminLogin
}) {
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [plannedModalModule, setPlannedModalModule] = useState(null);

  // Handle staff login submission
  const handleSubmit = async (e) => {
    e?.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const staff = await staffLogin(mobile, pin);
      if (!staff) {
        setErrorMsg('Invalid mobile number or 4-digit PIN. Please contact administration.');
        setLoading(false);
        return;
      }

      // Login successful!
      if (onStaffLoginSuccess) {
        onStaffLoginSuccess(staff);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Pre-configured module definitions for staff hub
  const moduleDefs = {
    delivery: {
      id: 'delivery',
      title: 'Delivery Management',
      category: 'Operations',
      isLive: true,
      icon: Truck,
      accentColor: 'from-emerald-500 to-teal-600',
      tagColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
      tag: 'Active / Live',
      description: 'Live Fleet Radar, Quick Grok/Groq Voice Orders, Dispatch Console'
    },
    damage: {
      id: 'damage',
      title: 'Damage Management',
      category: 'Quality & Audit',
      isLive: true,
      icon: PackageX,
      accentColor: 'from-rose-600 to-pink-600',
      tagColor: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
      tag: 'Active / Live',
      description: 'Loss Tracker, Expiry Returns, Bottle Write-Offs'
    },
    sales: {
      id: 'sales',
      title: 'Sales & Billing',
      category: 'Commercial',
      isLive: false,
      icon: Receipt,
      accentColor: 'from-blue-600 to-indigo-600',
      tagColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      tag: 'Planned / Pipeline',
      description: 'POS, Invoices, Thermal Receipts, Customer Returns'
    },
    purchase: {
      id: 'purchase',
      title: 'Purchase & Inward',
      category: 'Procurement',
      isLive: false,
      icon: FileSpreadsheet,
      accentColor: 'from-amber-600 to-orange-600',
      tagColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      tag: 'Planned / Pipeline',
      description: 'OCR Bill Extraction, Multi-Vendor Price Compare, Purchase Returns'
    },
    marketing: {
      id: 'marketing',
      title: 'Marketing & Broadcasts',
      category: 'Growth',
      isLive: false,
      icon: Megaphone,
      accentColor: 'from-violet-600 to-purple-600',
      tagColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      tag: 'Planned / Pipeline',
      description: 'WhatsApp API Broadcasting, Campaign Automations, Meta Ads'
    },
    finance: {
      id: 'finance',
      title: 'Bahi Khata & Finance',
      category: 'Accounts',
      isLive: false,
      icon: Calculator,
      accentColor: 'from-emerald-700 to-cyan-800',
      tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      tag: 'Planned / Pipeline',
      description: 'P&L Statements, GST Return Sheets, CA Data Export'
    },
    staff: {
      id: 'staff',
      title: 'Staff & Attendance',
      category: 'HR & Roster',
      isLive: false,
      icon: UserCheck,
      accentColor: 'from-cyan-600 to-blue-700',
      tagColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      tag: 'Planned / Pipeline',
      description: 'Attendance, Biometric Sync, Salary/Payroll, Role Permissions'
    },
    config: {
      id: 'config',
      title: 'Store & System Config',
      category: 'Settings',
      isLive: false,
      icon: Settings,
      accentColor: 'from-slate-700 to-slate-900',
      tagColor: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      tag: 'Planned / Pipeline',
      description: 'Catalog Masters, Thermal Printer Settings, Integrations'
    }
  };

  // If staff session is active and has multiple modules, display the restricted staff hub
  if (staffSession && Array.isArray(staffSession.allowed_modules) && staffSession.allowed_modules.length > 1) {
    const permittedModules = staffSession.allowed_modules
      .map((key) => moduleDefs[key] || {
        id: key,
        title: key.toUpperCase(),
        category: 'Custom',
        isLive: key === 'delivery' || key === 'damage',
        icon: Users,
        accentColor: 'from-slate-700 to-slate-800',
        tagColor: 'bg-slate-800 text-slate-300 border-slate-700',
        tag: 'Authorized',
        description: `Authorized module: ${key}`
      });

    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-300 w-full max-w-full overflow-x-hidden">
        {/* Streamlined Restricted Staff Hub Header */}
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 p-6 sm:p-7 shadow-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                Staff Authorized Console
              </span>
              <span className="text-xs text-slate-400">
                Logged in as <strong className="text-white">{staffSession.name}</strong>
              </span>
            </div>
            <h1 className="text-2xl font-black text-white">
              Restricted Staff Workspace
            </h1>
            <p className="text-xs text-slate-300">
              You have access to <strong>{permittedModules.length} assigned modules</strong>. Select a module below to proceed.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onStaffLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-white border border-slate-700 text-xs font-bold transition shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out Staff</span>
            </button>
          </div>
        </div>

        {/* Permitted Modules Grid */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            Your Permitted Modules:
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {permittedModules.map((mod) => {
              const Icon = mod.icon;
              return (
                <div
                  key={mod.id}
                  onClick={() => {
                    if (mod.isLive) {
                      onSelectModule(mod.id);
                    } else {
                      setPlannedModalModule(mod);
                    }
                  }}
                  className={`group relative cursor-pointer rounded-2xl p-5 shadow-xl transition-all duration-300 flex flex-col justify-between ${
                    mod.isLive
                      ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-emerald-500/40 hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/15 hover:-translate-y-1'
                      : 'bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800 hover:border-slate-700 hover:-translate-y-0.5'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${mod.accentColor} flex items-center justify-center text-white shadow-lg shrink-0`}
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

                    <div className="mb-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${mod.tagColor}`}>
                        {mod.tag}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed mb-4">
                      {mod.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-400">
                    <span>{mod.isLive ? 'Launch Module Console' : 'View Pipeline'}</span>
                    <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Planned Module Modal */}
        {plannedModalModule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-black text-white">{plannedModalModule.title}</h3>
                <button
                  type="button"
                  onClick={() => setPlannedModalModule(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-200 text-xs font-semibold flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Module pipeline initialized. Configurable in upcoming update.</span>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPlannedModalModule(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Common Staff Sign-In Form (/staff)
  return (
    <div className="flex items-center justify-center min-h-[75vh] px-4 py-8 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-slate-900/95 border border-slate-800 backdrop-blur-xl p-7 sm:p-8 rounded-3xl shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-gradient-to-tr from-cyan-600 to-blue-500 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Staff Portal</h2>
          <p className="text-xs text-slate-400">
            Common staff authentication via registered Mobile Number & 4-Digit Security PIN
          </p>
        </div>

        {/* Inline Error Message */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Mobile Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Phone className="w-4 h-4" />
              </div>
              <input
                id="staff-mobile-input"
                type="tel"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="Enter 10-digit mobile (e.g. 9876543210)"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              4-Digit Security PIN
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="staff-pin-input"
                type="password"
                maxLength={6}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-500 tracking-widest transition"
              />
            </div>
          </div>

          <button
            id="staff-login-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <span>Verifying Staff Credentials...</span>
            ) : (
              <>
                <span>Sign In as Staff</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Switch to Admin Login */}
        <div className="pt-4 border-t border-slate-800/80 text-center">
          <p className="text-xs text-slate-400">
            Store Owner / Super Administrator?{' '}
            <button
              type="button"
              onClick={onNavigateToAdminLogin}
              className="text-emerald-400 hover:text-emerald-300 font-bold underline transition ml-1"
            >
              Sign In to Admin Portal →
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
