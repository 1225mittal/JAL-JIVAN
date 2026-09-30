import React, { useState } from 'react';
import {
  Receipt,
  FileSpreadsheet,
  BookOpen,
  Truck,
  Package,
  PackageX,
  Users,
  Building2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Store,
  Layers,
  Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ModularSidebar({ currentModule, onNavigate, onLogout }) {
  const { currentStore, userRole, isOwner } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const enabledModules = currentStore?.enabled_modules || {
    pos: true,
    inward_ocr: true,
    ledger: true,
    delivery: true
  };

  const storeSlug = currentStore?.slug || 'mittal-store';

  // Nav Items configured per user requirements & store scoping:
  // Billing POS: enabled_modules.pos
  // Inward Hub & OCR: enabled_modules.inward_ocr
  // Vendor Ledgers: enabled_modules.ledger
  // Delivery Dispatch: enabled_modules.delivery
  const navItems = [
    {
      id: 'hub',
      label: 'Executive Hub',
      path: `/${storeSlug}`,
      icon: Building2,
      visible: true
    },
    {
      id: 'sales',
      label: 'Sales & POS Billing',
      path: `/${storeSlug}/sales`,
      icon: Receipt,
      visible: Boolean(enabledModules.pos),
      badge: 'Live POS'
    },
    {
      id: 'purchase',
      label: 'Purchase & Inward OCR',
      path: `/${storeSlug}/purchase`,
      icon: FileSpreadsheet,
      visible: Boolean(enabledModules.inward_ocr),
      badge: 'Groq OCR'
    },
    {
      id: 'ledger',
      label: 'Vendor Ledgers',
      path: `/${storeSlug}/purchase?tab=ledger`,
      icon: BookOpen,
      visible: Boolean(enabledModules.ledger)
    },
    {
      id: 'delivery',
      label: 'Delivery & Dispatch',
      path: `/${storeSlug}/delivery`,
      icon: Truck,
      visible: Boolean(enabledModules.delivery),
      badge: 'Fleet'
    },
    {
      id: 'items',
      label: 'Item & Stock Master',
      path: `/${storeSlug}/items`,
      icon: Package,
      visible: true
    },
    {
      id: 'damage',
      label: 'Damage & Returns',
      path: `/${storeSlug}/damage`,
      icon: PackageX,
      visible: true
    },
    {
      id: 'staff-settings',
      label: 'Staff Management',
      path: `/${storeSlug}/staff`,
      icon: Users,
      visible: Boolean(isOwner), // Accessible only to role store_owner
      badge: 'Owner'
    }
  ];

  const visibleItems = navItems.filter((it) => it.visible);

  return (
    <aside
      className={`hidden md:flex flex-col bg-slate-950/90 border-r border-slate-800/80 transition-all duration-300 z-30 shrink-0 select-none ${
        isCollapsed ? 'w-16' : 'w-60 lg:w-64'
      }`}
    >
      {/* Store Header & Tenant Info */}
      <div className="p-3 border-b border-slate-800/80 flex items-center justify-between gap-2">
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-black text-white truncate">
              <Store className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{currentStore?.name || 'Store'}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-slate-400 font-mono truncate">
                slug: {currentStore?.slug || 'default'}
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {userRole === 'store_owner' ? 'Owner' : userRole.replace('_', ' ')}
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
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            currentModule === item.id ||
            (item.id === 'purchase' && currentModule === 'purchase') ||
            (item.id === 'ledger' && window.location.search.includes('ledger')) ||
            (item.id === 'staff-settings' && (currentModule === 'staff-settings' || window.location.pathname.includes('/settings/staff')));

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.path)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800'
              } ${isCollapsed ? 'justify-center px-2' : ''}`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between text-left truncate">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-800 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Multi-Tenant Active</span>
            </span>
            <span className="font-mono text-[10px] text-slate-500">v2.4</span>
          </div>
        </div>
      )}
    </aside>
  );
}
