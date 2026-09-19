import React from 'react';
import { ShieldCheck, Truck, Droplets, Database, LogOut, UserCheck } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

export default function Navbar({
  activeView,
  setActiveView,
  currentDriver,
  onDriverLogout,
  onOpenDbInfo,
  isAdminLoggedIn,
  onAdminLogout,
  onLogout
}) {
  const handleAdminLogout = onAdminLogout || onLogout;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 py-2.5 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="w-full sm:w-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold">
              <Droplets className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">JAL-JIVAN</span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Dispatch
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Delivery & Logistics System</p>
            </div>
          </div>

          {/* Database indicator and Mobile Logout */}
          <div className="flex items-center gap-1.5 sm:hidden">
            <button
              onClick={onOpenDbInfo}
              className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-medium transition-all ${
                isSupabaseConfigured
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
              }`}
              title="Click for Supabase setup status"
            >
              <Database className="w-3 h-3" />
              <span>{isSupabaseConfigured ? 'Supabase' : 'Demo Mode'}</span>
            </button>

            {activeView === 'admin' && isAdminLoggedIn && (
              <button
                id="admin-navbar-logout-btn-mobile"
                onClick={handleAdminLogout}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold shadow-md shadow-red-600/30 active:scale-95 transition-all"
                title="Logout from Admin Panel"
              >
                <LogOut className="w-3 h-3" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>

        {/* View Switcher Pill */}
        <div className="w-full sm:w-auto flex items-center justify-center">
          <div className="flex bg-slate-900/90 p-1 rounded-2xl border border-slate-800 shadow-inner w-full sm:w-auto">
            <button
              id="toggle-admin-view"
              onClick={() => setActiveView('admin')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeView === 'admin'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin Panel</span>
            </button>

            <button
              id="toggle-driver-view"
              onClick={() => setActiveView('driver')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                activeView === 'driver'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Driver Portal</span>
              {currentDriver && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              )}
            </button>
          </div>
        </div>

        {/* Driver Status / Supabase indicator desktop */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            onClick={onOpenDbInfo}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
              isSupabaseConfigured
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>{isSupabaseConfigured ? 'Supabase Live' : 'Demo Local Mode'}</span>
          </button>

          {activeView === 'driver' && currentDriver && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-emerald-400" />
                  {currentDriver.name}
                </p>
                <p className="text-[10px] text-slate-400">PIN: {currentDriver.pin}</p>
              </div>
              <button
                onClick={onDriverLogout}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Log Out Driver"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeView === 'admin' && isAdminLoggedIn && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <button
                id="admin-navbar-logout-btn"
                onClick={handleAdminLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-600/30 hover:shadow-red-600/50 active:scale-95 transition-all"
                title="Logout from Admin Panel"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
