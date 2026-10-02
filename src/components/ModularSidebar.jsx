import React, { useState } from 'react';
import {
  Receipt,
  FileSpreadsheet,
  Package,
  PackageX,
  Building2,
  Calculator,
  Settings,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
  Droplets
} from 'lucide-react';

export default function ModularSidebar({ currentModule, onNavigate, onLogout }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // The 7 Core Modules requested by user + Hub Overview
  const navItems = [
    {
      id: 'pos',
      label: 'POS Billing',
      path: '/pos',
      icon: Receipt,
      badge: 'Counter POS'
    },
    {
      id: 'purchase',
      label: 'Purchase Invoices',
      path: '/purchase',
      icon: FileSpreadsheet,
      badge: 'Inward'
    },
    {
      id: 'items',
      label: 'Inventory & Stock',
      path: '/inventory',
      icon: Package
    },
    {
      id: 'damage',
      label: 'Damage & Expiry',
      path: '/damage',
      icon: PackageX
    },
    {
      id: 'distributors',
      label: 'Distributors',
      path: '/distributors',
      icon: Building2
    },
    {
      id: 'reports',
      label: 'Reports & Ledgers',
      path: '/reports',
      icon: Calculator
    },
    {
      id: 'settings',
      label: 'Store Settings',
      path: '/settings',
      icon: Settings
    }
  ];

  const handleNavClick = (path) => {
    if (typeof onNavigate === 'function') {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
  };

  return (
    <aside
      className={`hidden md:flex flex-col bg-slate-950/95 border-r border-slate-800/80 transition-all duration-300 z-30 shrink-0 select-none ${
        isCollapsed ? 'w-16' : 'w-60 lg:w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between gap-2">
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-black text-white truncate">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <Droplets className="w-3.5 h-3.5" />
              </div>
              <span className="truncate tracking-wide">JAL-JIVAN POS</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-slate-400 font-mono">
                7 Core Modules Live
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-400 hover:text-white transition"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav Items List */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            currentModule === item.id ||
            (item.id === 'pos' && (currentModule === 'pos' || currentModule === 'sales')) ||
            (item.id === 'purchase' && currentModule === 'purchase') ||
            (item.id === 'items' && (currentModule === 'items' || currentModule === 'inventory')) ||
            (item.id === 'damage' && currentModule === 'damage') ||
            (item.id === 'distributors' && currentModule === 'distributors') ||
            (item.id === 'reports' && (currentModule === 'reports' || currentModule === 'finance')) ||
            (item.id === 'settings' && currentModule === 'settings');

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all text-left ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
              }`}
              title={item.label}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              {!isCollapsed && (
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <span className="truncate">{item.label}</span>
                  {item.badge && !isActive && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700/60">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="p-2 border-t border-slate-800/80 space-y-1">
        <button
          type="button"
          onClick={() => handleNavClick('/hub')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900 transition ${
            currentModule === 'hub' ? 'bg-slate-800 text-white font-bold' : ''
          }`}
          title="Executive Overview"
        >
          <LayoutDashboard className="w-4 h-4 shrink-0 text-indigo-400" />
          {!isCollapsed && <span className="truncate">Modules Overview</span>}
        </button>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="truncate">Sign Out</span>}
          </button>
        )}
      </div>
    </aside>
  );
}
