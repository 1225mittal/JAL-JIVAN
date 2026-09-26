import React from 'react';
import { ShieldCheck, Droplets, Database, LogOut, UserCheck, Truck, LayoutGrid, Users } from 'lucide-react';
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
  onAdminLogout,
  isStaffView = false,
  staffSession = null,
  onStaffLogout,
  onNavigateToStaff,
  onNavigateToAdmin
}) {
  const isViewAdmin = Boolean(isAdminView || isAdminRoute);

  return (
    <header className="sticky top-0 z-40 w-full max-w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md overflow-x-hidden">
      <div className="w-full max-w-full sm:max-w-6xl mx-auto px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        {/* Left Section: Driver View shows ONLY status indicator ("🟢 Online"); Admin/Staff View shows Brand */}
        {!isViewAdmin && !isStaffView ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>🟢 Online</span>
            </span>
          </div>
        ) : isStaffView ? (
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-bold shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white shrink-0">Mittal Brothers</span>
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border shrink-0 bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
                  Staff Workspace
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium hidden sm:block truncate">
                Authorized Operations Access
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold shrink-0">
              <Droplets className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white shrink-0">Mittal Brothers</span>
                <span
                  className="text-[9px] sm:text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border shrink-0 bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                >
                  {adminSubView === 'purchase' ? (
                    <>
                      <span className="sm:hidden">Purchase</span>
                      <span className="hidden sm:inline">Purchase & Inward</span>
                    </>
                  ) : adminSubView === 'damage' ? (
                    <>
                      <span className="sm:hidden">Damage</span>
                      <span className="hidden sm:inline">Damage & Returns</span>
                    </>
                  ) : adminSubView === 'delivery' ? (
                    <>
                      <span className="sm:hidden">Dispatch</span>
                      <span className="hidden sm:inline">Dispatch Console</span>
                    </>
                  ) : (
                    <>
                      <span className="sm:hidden">Admin Hub</span>
                      <span className="hidden sm:inline">Master Admin Hub</span>
                    </>
                  )}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium hidden sm:block truncate">
                Fleet Logistics & Command Center
              </p>
            </div>
          </div>
        )}

        {/* Right Section: Role Controls & Logout */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">
          {/* Quick Hub button if inside Admin sub-module */}
          {isViewAdmin && isAdminLoggedIn && adminSubView !== 'hub' && onSelectAdminSubView && (
            <button
              type="button"
              onClick={() => onSelectAdminSubView('hub')}
              className="flex items-center gap-1 text-[11px] sm:text-xs px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-semibold transition-all shadow-sm shrink-0"
              title="Return to Master Admin Hub"
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline">Hub</span>
            </button>
          )}

          {/* Quick Hub button if staff is in a sub-module */}
          {isStaffView && staffSession && adminSubView !== 'hub' && onSelectAdminSubView && (
            <button
              type="button"
              onClick={() => onSelectAdminSubView('hub')}
              className="flex items-center gap-1 text-[11px] sm:text-xs px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 font-semibold transition-all shadow-sm shrink-0"
              title="Return to Staff Hub"
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline">Staff Hub</span>
            </button>
          )}

          {/* Operational Status indicator (for Admin View) */}
          {isViewAdmin && (
            <button
              type="button"
              onClick={onOpenDbInfo}
              className={`flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full font-medium transition-all shrink-0 ${
                isSupabaseConfigured
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
              }`}
              title="System Status: Operational"
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
                {isSupabaseConfigured ? 'System Online' : 'Demo Local Mode'}
              </span>
            </button>
          )}

          {/* DRIVER VIEW: Log Out Button */}
          {!isViewAdmin && !isStaffView && currentDriver && (
            <button
              type="button"
              id="driver-navbar-logout-btn"
              onClick={onDriverLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-semibold transition-all shadow-sm"
              title="Log Out Driver"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Log Out</span>
            </button>
          )}

          {/* STAFF VIEW (/staff): Staff Logout Button */}
          {isStaffView && staffSession && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800 shrink-0">
              <span className="hidden sm:inline text-xs text-slate-400 truncate max-w-[120px]">
                {staffSession.name}
              </span>
              <button
                type="button"
                id="staff-navbar-logout-btn"
                onClick={onStaffLogout}
                className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/30 transition-all active:scale-95 shrink-0"
                title="Logout from Staff Portal"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* ADMIN VIEW (/admin): Admin Logout Button */}
          {isViewAdmin && (
            isAdminLoggedIn ? (
              <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-slate-800 shrink-0">
                <button
                  type="button"
                  id="admin-navbar-logout-btn"
                  onClick={onAdminLogout}
                  className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-600/30 hover:shadow-red-600/50 active:scale-95 transition-all shrink-0"
                  title="Logout from Admin Panel"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-300 pl-2 border-l border-slate-800 font-medium shrink-0">
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
