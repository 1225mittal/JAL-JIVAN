import React from 'react';
import { ShieldCheck, Droplets, Database, LogOut, UserCheck, Truck, LayoutGrid } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

export default function Navbar({
  isAdminRoute = false,
  isAdminView = false,
  adminSubView = 'hub',
  onSelectAdminSubView,
  onToggleAdminView,
  currentDriver = null,
  onDriverLogout,
  onOpenDbInfo,
  isAdminLoggedIn = false,
  onAdminLogout
}) {
  const isViewAdmin = Boolean(isAdminView || isAdminRoute);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold shrink-0">
            <Droplets className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">JAL-JIVAN</span>
              <span
                className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                  isViewAdmin
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {isViewAdmin
                  ? adminSubView === 'damage'
                    ? 'Damage & Returns'
                    : adminSubView === 'delivery'
                    ? 'Dispatch Console'
                    : 'Admin Command Hub'
                  : 'Driver Dispatch'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
              {isViewAdmin
                ? 'Fleet Logistics & Command Center'
                : 'Delivery & Logistics System'}
            </p>
          </div>
        </div>

        {/* Right Section: Database Info & Role Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Hub button if inside Admin sub-module */}
          {isViewAdmin && isAdminLoggedIn && adminSubView !== 'hub' && onSelectAdminSubView && (
            <button
              onClick={() => onSelectAdminSubView('hub')}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-semibold transition-all shadow-sm"
              title="Return to Admin Hub Home"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Main Hub</span>
            </button>
          )}

          {/* Toggle Driver / Admin View */}
          {onToggleAdminView && (
            <button
              onClick={onToggleAdminView}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-medium transition-all shadow-sm"
              title={isViewAdmin ? 'Switch to Driver View' : 'Switch to Admin Hub'}
            >
              {isViewAdmin ? (
                <>
                  <Truck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden md:inline">Driver Portal</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden md:inline">Admin Hub</span>
                </>
              )}
            </button>
          )}

          {/* Operational Status indicator (Mobile & Desktop) */}
          <button
            onClick={onOpenDbInfo}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
              isSupabaseConfigured
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
            }`}
            title="System Status: Operational"
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isSupabaseConfigured ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <span className="hidden sm:inline">
              {isSupabaseConfigured ? 'System Online' : 'Demo Local Mode'}
            </span>
            <span className="sm:hidden">
              {isSupabaseConfigured ? 'Online' : 'Demo'}
            </span>
          </button>

          {/* DRIVER VIEW (/): Driver Profile & Logout */}
          {!isViewAdmin && currentDriver && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-slate-200 flex items-center gap-1 justify-end">
                  <UserCheck className="w-3 h-3 text-emerald-400" />
                  <span>{currentDriver.name}</span>
                </p>
                <p className="text-[10px] text-slate-400">PIN: {currentDriver.pin}</p>
              </div>
              <button
                id="driver-navbar-logout-btn"
                onClick={onDriverLogout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-semibold transition-all shadow-sm"
                title="Log Out Driver"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}

          {/* ADMIN VIEW (/admin): Admin Logout Button */}
          {isViewAdmin && (
            isAdminLoggedIn ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <button
                  id="admin-navbar-logout-btn"
                  onClick={onAdminLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-600/30 hover:shadow-red-600/50 active:scale-95 transition-all"
                  title="Logout from Admin Panel"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-300 pl-2 border-l border-slate-800 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin Login Required</span>
              </div>
            )
          )}
        </div>
      </div>
    </header>
  );
}
