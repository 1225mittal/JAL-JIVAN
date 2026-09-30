import React from 'react';
import { Droplets, LogOut, Users, ShieldCheck } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

export default function Navbar({
  isAdminRoute = false,
  isAdminView = false,
  adminSubView = 'hub',
  storeName = '',
  storeSlug = '',
  onNavigateToAdminHub,
  onOpenDbInfo,
  isAdminLoggedIn = false,
  onAdminLogout
}) {
  const isViewAdmin = Boolean(isAdminView || isAdminRoute);

  const handleLogoClick = () => {
    if (onNavigateToAdminHub) {
      onNavigateToAdminHub();
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full max-w-full border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md overflow-x-hidden">
      <div className={`w-full ${adminSubView === 'purchase' ? 'max-w-[98vw]' : 'max-w-full sm:max-w-6xl'} mx-auto px-3.5 py-2 flex items-center justify-between gap-3`}>
        {/* Left Section: Logo & Branding */}
        <div
          onClick={handleLogoClick}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer group select-none"
          title="Navigate to Store Hub"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold shrink-0 group-hover:scale-105 transition-transform">
            <Droplets className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm sm:text-base tracking-tight text-white group-hover:text-emerald-300 transition-colors shrink-0">
                JAL-JIVAN
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 truncate max-w-[200px]">
                {isAdminLoggedIn ? (storeName || (adminSubView === 'hub' ? 'Store Hub' : 'Store Portal')) : 'Retail OS'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Cloud status & auth controls */}
        <div className="flex items-center gap-2.5 shrink-0 justify-end">
          {/* Operational Cloud Sync Status Pill */}
          {onOpenDbInfo && (
            <button
              type="button"
              onClick={onOpenDbInfo}
              className={`flex items-center gap-1.5 text-[10px] sm:text-xs px-2.5 py-1 rounded-full font-medium transition-all shrink-0 ${
                isSupabaseConfigured
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
              }`}
              title="System Connectivity"
            >
              <span className="relative flex h-2 w-2 shrink-0">
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
                {isSupabaseConfigured ? 'System Online' : 'Local Mode'}
              </span>
            </button>
          )}

          {/* ADMIN / ENTERPRISE VIEW: Logout or Login Indicator */}
          {isAdminLoggedIn ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800 shrink-0">
              <button
                type="button"
                id="admin-navbar-logout-btn"
                onClick={onAdminLogout}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/30 hover:shadow-rose-600/50 active:scale-95 transition-all shrink-0"
                title="Logout from Admin Panel"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800 shrink-0">
              <button
                type="button"
                onClick={handleLogoClick}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition shadow-sm active:scale-95"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin Sign In</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
