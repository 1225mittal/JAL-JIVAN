import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Building2,
  Store,
  Plus,
  Check,
  X,
  ExternalLink,
  Copy,
  Clock,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Search,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Layers,
  Receipt,
  FileSpreadsheet,
  BookOpen,
  Truck
} from 'lucide-react';
import { useAuth, DEFAULT_STORE } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Initial pre-seeded stores for demo & offline mode
const INITIAL_DEMO_STORES = [
  {
    id: 'store_mittal_dept',
    name: 'Mittal Departmental Store',
    slug: 'mittal-store',
    status: 'active',
    enabled_modules: {
      pos: true,
      inward_ocr: true,
      ledger: true,
      delivery: true
    },
    created_at: new Date(Date.now() - 86400000 * 30).toISOString()
  },
  {
    id: 'store_city_supermarket',
    name: 'City Supermarket & Mart',
    slug: 'city-supermarket',
    status: 'active',
    enabled_modules: {
      pos: true,
      inward_ocr: true,
      ledger: false,
      delivery: true
    },
    created_at: new Date(Date.now() - 86400000 * 15).toISOString()
  },
  {
    id: 'store_express_grocery',
    name: 'Express 24/7 Grocery Hub',
    slug: 'express-grocery',
    status: 'active',
    enabled_modules: {
      pos: true,
      inward_ocr: false,
      ledger: true,
      delivery: true
    },
    created_at: new Date(Date.now() - 86400000 * 7).toISOString()
  }
];

export default function SuperAdminDashboard({ showToast, onNavigate }) {
  const { userRole, isSuperAdmin, currentStore, setCurrentStore } = useAuth();

  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSlug, setCopiedSlug] = useState(null);

  // Modal State for "+ Create New Store"
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

  const [newStoreForm, setNewStoreForm] = useState({
    name: '',
    slug: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    enabledModules: {
      pos: true,
      inward_ocr: true,
      ledger: true,
      delivery: true
    }
  });

  // 1. Load All Registered Stores (RESTRICTED ONLY TO STORES TABLE - NO INVOICE DATA)
  const fetchStores = useCallback(async () => {
    setLoading(true);
    let loadedStores = [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('stores')
          .select('id, name, slug, status, enabled_modules, created_at')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          loadedStores = data.map((s) => ({
            ...s,
            status: s.status || 'active',
            enabled_modules: {
              pos: true,
              inward_ocr: true,
              ledger: true,
              delivery: true,
              ...(s.enabled_modules || {})
            }
          }));
        }
      } catch (err) {
        console.warn('Supabase stores fetch notice:', err.message);
      }
    }

    // Fallback to local storage or initial demo stores
    if (loadedStores.length === 0) {
      try {
        const cached = localStorage.getItem('jal_jivan_all_stores');
        if (cached) {
          loadedStores = JSON.parse(cached);
        } else {
          loadedStores = INITIAL_DEMO_STORES;
          localStorage.setItem('jal_jivan_all_stores', JSON.stringify(INITIAL_DEMO_STORES));
        }
      } catch (e) {
        loadedStores = INITIAL_DEMO_STORES;
      }
    }

    setStores(loadedStores);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  // Sync stores cache
  const updateLocalStores = useCallback((updatedList) => {
    setStores(updatedList);
    try {
      localStorage.setItem('jal_jivan_all_stores', JSON.stringify(updatedList));
    } catch (e) {}
  }, []);

  // 2. LIVE SWITCHES TO TOGGLE MODULES PER STORE (pos, inward_ocr, ledger, delivery)
  const handleToggleModule = async (storeId, moduleKey, currentValue) => {
    const newValue = !currentValue;
    const storeToUpdate = stores.find((s) => s.id === storeId);
    if (!storeToUpdate) return;

    const updatedModules = {
      ...(storeToUpdate.enabled_modules || {}),
      [moduleKey]: newValue
    };

    // Optimistic UI update
    const updatedStores = stores.map((s) =>
      s.id === storeId ? { ...s, enabled_modules: updatedModules } : s
    );
    updateLocalStores(updatedStores);

    // If currentStore matches, update globally in context
    if (currentStore?.id === storeId) {
      setCurrentStore((prev) => ({
        ...prev,
        enabled_modules: updatedModules
      }));
    }

    // Persist to Supabase stores table
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('stores')
          .update({ enabled_modules: updatedModules })
          .eq('id', storeId);

        if (error) {
          console.warn('Module toggle update notice:', error.message);
        }
      } catch (err) {
        console.warn('Module toggle exception:', err);
      }
    }

    const moduleLabel =
      moduleKey === 'pos'
        ? 'Billing POS'
        : moduleKey === 'inward_ocr'
        ? 'Inward OCR'
        : moduleKey === 'ledger'
        ? 'Vendor Ledgers'
        : 'Delivery Dispatch';

    showToast?.(`${storeToUpdate.name}: ${moduleLabel} is now ${newValue ? 'ENABLED' : 'DISABLED'}`, 'success');
  };

  // 3. Toggle Store Active / Inactive Status
  const handleToggleStatus = async (storeId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const storeToUpdate = stores.find((s) => s.id === storeId);
    if (!storeToUpdate) return;

    const updatedStores = stores.map((s) =>
      s.id === storeId ? { ...s, status: newStatus } : s
    );
    updateLocalStores(updatedStores);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('stores')
          .update({ status: newStatus })
          .eq('id', storeId);
      } catch (e) {}
    }

    showToast?.(`Store ${storeToUpdate.name} set to ${newStatus.toUpperCase()}`, 'info');
  };

  // Auto-slugify store name
  const handleNameChange = (e) => {
    const name = e.target.value;
    const generatedSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    setNewStoreForm((prev) => ({
      ...prev,
      name,
      slug: prev.slug === '' || prev.slug === generatedSlug.slice(0, -1) ? generatedSlug : prev.slug
    }));
  };

  // 4. CREATE NEW STORE SUBMISSION
  const handleCreateStore = async (e) => {
    e.preventDefault();
    setFormError('');

    const cleanName = newStoreForm.name.trim();
    const cleanSlug = newStoreForm.slug.trim().toLowerCase();
    const cleanOwnerEmail = newStoreForm.ownerEmail.trim().toLowerCase();
    const cleanOwnerPassword = newStoreForm.ownerPassword.trim();
    const cleanOwnerName = newStoreForm.ownerName.trim() || `${cleanName} Owner`;

    if (!cleanName) {
      setFormError('Please enter a Store Name.');
      return;
    }
    if (!cleanSlug) {
      setFormError('Please provide a unique Store Slug.');
      return;
    }
    if (!cleanOwnerEmail) {
      setFormError('Please provide the Store Owner email.');
      return;
    }
    if (!cleanOwnerPassword || cleanOwnerPassword.length < 6) {
      setFormError('Owner password must be at least 6 characters long.');
      return;
    }

    // Check slug uniqueness
    if (stores.some((s) => s.slug === cleanSlug)) {
      setFormError(`A store with slug "${cleanSlug}" already exists. Please choose a different slug.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const newStoreId = `store_${cleanSlug}_${Date.now()}`;
      const newStoreRecord = {
        id: newStoreId,
        name: cleanName,
        slug: cleanSlug,
        status: 'active',
        enabled_modules: newStoreForm.enabledModules,
        created_at: new Date().toISOString()
      };

      // 1. Insert store into Supabase stores table
      if (isSupabaseConfigured && supabase) {
        try {
          const { error: storeErr } = await supabase
            .from('stores')
            .insert([newStoreRecord]);

          if (storeErr) {
            console.warn('Supabase store insert notice:', storeErr.message);
          }

          // 2. Create Owner User Profile in user_profiles
          const { error: profileErr } = await supabase
            .from('user_profiles')
            .insert([
              {
                id: `user_owner_${cleanSlug}`,
                full_name: cleanOwnerName,
                email: cleanOwnerEmail,
                role: 'store_owner',
                store_id: newStoreId,
                is_active: true,
                created_at: new Date().toISOString()
              }
            ]);

          if (profileErr) {
            console.warn('Supabase owner profile insert notice:', profileErr.message);
          }

          // 3. Try creating Auth account for owner
          try {
            await supabase.auth.signUp({
              email: cleanOwnerEmail,
              password: cleanOwnerPassword,
              options: {
                data: {
                  full_name: cleanOwnerName,
                  role: 'store_owner',
                  store_id: newStoreId
                }
              }
            });
          } catch (signUpErr) {
            console.warn('Auth sign up notice (fallback local credentials stored):', signUpErr.message);
          }
        } catch (supabaseErr) {
          console.warn('Supabase multi-tenant insert exception:', supabaseErr);
        }
      }

      // Pre-seed local staff for this store
      try {
        const staffKey = `jal_jivan_store_staff_${newStoreId}`;
        const initialStaff = [
          {
            id: `staff_owner_${newStoreId}`,
            store_id: newStoreId,
            full_name: cleanOwnerName,
            email: cleanOwnerEmail,
            role: 'store_owner',
            pin: '2026',
            is_active: true,
            created_at: new Date().toISOString()
          },
          {
            id: `staff_cashier_${newStoreId}`,
            store_id: newStoreId,
            full_name: 'Cashier 1',
            email: `cashier@${cleanSlug}.com`,
            role: 'billing_cashier',
            pin: '1122',
            is_active: true,
            created_at: new Date().toISOString()
          },
          {
            id: `staff_rider_${newStoreId}`,
            store_id: newStoreId,
            full_name: 'Rider 1',
            email: `rider@${cleanSlug}.com`,
            role: 'delivery_boy',
            pin: '5566',
            is_active: true,
            created_at: new Date().toISOString()
          }
        ];
        localStorage.setItem(staffKey, JSON.stringify(initialStaff));
      } catch (e) {}

      // Update local store state
      const updatedStoresList = [newStoreRecord, ...stores];
      updateLocalStores(updatedStoresList);

      showToast?.(`Store "${cleanName}" created successfully! Owner login: ${cleanOwnerEmail}`, 'success');

      // Reset form and close modal
      setNewStoreForm({
        name: '',
        slug: '',
        ownerName: '',
        ownerEmail: '',
        ownerPassword: '',
        enabledModules: {
          pos: true,
          inward_ocr: true,
          ledger: true,
          delivery: true
        }
      });
      setIsCreateModalOpen(false);
    } catch (err) {
      console.error('Error creating store:', err);
      setFormError(err.message || 'Failed to create store.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyStoreLink = (slug) => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/store/${slug}/delivery`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    showToast?.(`Copied Rider Portal Link for ${slug}`, 'success');
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  // Filtered stores
  const filteredStores = useMemo(() => {
    if (!searchTerm.trim()) return stores;
    const term = searchTerm.toLowerCase();
    return stores.filter(
      (s) =>
        s.name?.toLowerCase().includes(term) ||
        s.slug?.toLowerCase().includes(term) ||
        s.status?.toLowerCase().includes(term)
    );
  }, [stores, searchTerm]);

  // ==========================================
  // ACCESS CONTROL: SUPER_ADMIN ONLY
  // ==========================================
  if (!isSuperAdmin && userRole !== 'super_admin') {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/90 border border-red-500/30 rounded-3xl p-8 text-center space-y-5 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl mx-auto flex items-center justify-center text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Super Admin Access Required</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              This console is strictly restricted to platform super administrators. Your current
              active role is <span className="font-mono text-amber-400 font-bold">[{userRole}]</span>.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => onNavigate?.('/admin')}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
            >
              Back to Store Admin
            </button>
            <button
              onClick={() => onNavigate?.('/admin/login')}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-purple-600/20"
            >
              Sign In as Super Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300 w-full max-w-full">
      {/* ======================================================== */}
      {/* 1. EXECUTIVE SUPER ADMIN HEADER & STATS */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-950 via-[#0d1633] to-slate-950 border border-purple-500/30 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>Multi-Tenant Platform Control</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Global Stores Directory & Module Flags
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Register new retail tenants, provision store owner credentials, and control live module
              toggles (<span className="text-emerald-400 font-semibold">POS</span>,{' '}
              <span className="text-teal-400 font-semibold">Inward OCR</span>,{' '}
              <span className="text-blue-400 font-semibold">Ledger</span>,{' '}
              <span className="text-indigo-400 font-semibold">Delivery</span>).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchStores}
              disabled={loading}
              className="p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-2xl text-slate-300 hover:text-white transition flex items-center gap-2 text-xs font-bold"
              title="Refresh Store List"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              id="superadmin-create-store-btn"
              onClick={() => setIsCreateModalOpen(true)}
              className="py-3 px-5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm transition shadow-lg shadow-emerald-500/20 flex items-center gap-2.5 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create New Store</span>
            </button>
          </div>
        </div>

        {/* Global Platform KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-purple-500/20">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Registered Stores
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{stores.length}</span>
              <span className="text-xs text-purple-400 font-semibold">Tenants</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              POS Terminals Active
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400">
                {stores.filter((s) => s.enabled_modules?.pos).length}
              </span>
              <span className="text-xs text-slate-500 font-mono">/ {stores.length}</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Groq Vision OCR Engines
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-teal-400">
                {stores.filter((s) => s.enabled_modules?.inward_ocr).length}
              </span>
              <span className="text-xs text-slate-500 font-mono">/ {stores.length}</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Delivery Portals
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-indigo-400">
                {stores.filter((s) => s.enabled_modules?.delivery).length}
              </span>
              <span className="text-xs text-slate-500 font-mono">/ {stores.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. SEARCH & CONTROLS */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search stores by name, slug..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
          />
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2 self-start sm:self-auto">
          <span>Data Isolation:</span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px]">
            Financial & Inward data isolated per tenant
          </span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. REGISTERED STORES TABLE WITH LIVE MODULE SWITCHES */}
      {/* ======================================================== */}
      <div className="overflow-hidden rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-4 px-5">Store Name & ID</th>
                <th className="py-4 px-4">Slug & URL</th>
                <th className="py-4 px-4 text-center">Status</th>
                <th className="py-4 px-4 text-center min-w-[280px]">
                  Live Module Switches (Click to Toggle)
                </th>
                <th className="py-4 px-4">Created At</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading multi-tenant stores registry...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredStores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Store className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold">No stores found matching your query</p>
                  </td>
                </tr>
              ) : (
                filteredStores.map((st) => {
                  const mods = st.enabled_modules || {};
                  return (
                    <tr
                      key={st.id}
                      className="hover:bg-slate-800/40 transition group"
                    >
                      {/* Name & ID */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                            <Store className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-black text-white text-sm group-hover:text-purple-300 transition">
                              {st.name}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              id: {st.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Slug */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-purple-300 bg-purple-950/40 border border-purple-500/30 px-2 py-1 rounded-lg text-xs">
                            {st.slug}
                          </span>
                          <button
                            onClick={() => copyStoreLink(st.slug)}
                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                            title="Copy Rider Portal URL"
                          >
                            {copiedSlug === st.slug ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(st.id, st.status)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition border ${
                            st.status === 'active'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              st.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'
                            }`}
                          />
                          <span className="capitalize">{st.status || 'active'}</span>
                        </button>
                      </td>

                      {/* LIVE MODULE SWITCHES */}
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          {/* POS Toggle */}
                          <button
                            onClick={() => handleToggleModule(st.id, 'pos', mods.pos)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-bold transition ${
                              mods.pos
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                                : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                            }`}
                            title="Toggle Point of Sale Billing"
                          >
                            <Receipt className="w-3 h-3" />
                            <span>POS</span>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                mods.pos ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-700'
                              }`}
                            />
                          </button>

                          {/* Inward OCR Toggle */}
                          <button
                            onClick={() => handleToggleModule(st.id, 'inward_ocr', mods.inward_ocr)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-bold transition ${
                              mods.inward_ocr
                                ? 'bg-teal-500/15 border-teal-500/40 text-teal-300 hover:bg-teal-500/25'
                                : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                            }`}
                            title="Toggle Groq Vision Inward OCR"
                          >
                            <FileSpreadsheet className="w-3 h-3" />
                            <span>OCR</span>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                mods.inward_ocr ? 'bg-teal-400 shadow-sm shadow-teal-400' : 'bg-slate-700'
                              }`}
                            />
                          </button>

                          {/* Ledger Toggle */}
                          <button
                            onClick={() => handleToggleModule(st.id, 'ledger', mods.ledger)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-bold transition ${
                              mods.ledger
                                ? 'bg-blue-500/15 border-blue-500/40 text-blue-300 hover:bg-blue-500/25'
                                : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                            }`}
                            title="Toggle Vendor Ledgers"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>Ledger</span>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                mods.ledger ? 'bg-blue-400 shadow-sm shadow-blue-400' : 'bg-slate-700'
                              }`}
                            />
                          </button>

                          {/* Delivery Toggle */}
                          <button
                            onClick={() => handleToggleModule(st.id, 'delivery', mods.delivery)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-bold transition ${
                              mods.delivery
                                ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/25'
                                : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                            }`}
                            title="Toggle Delivery Portal & Fleet Dispatch"
                          >
                            <Truck className="w-3 h-3" />
                            <span>Delivery</span>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                mods.delivery ? 'bg-indigo-400 shadow-sm shadow-indigo-400' : 'bg-slate-700'
                              }`}
                            />
                          </button>
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="py-4 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                        {st.created_at
                          ? new Date(st.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setCurrentStore(st);
                              showToast?.(`Active tenant switched to ${st.name}`, 'success');
                              onNavigate?.('/admin');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition"
                          >
                            Switch To
                          </button>
                          <a
                            href={`/store/${st.slug}/delivery`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition"
                            title="Open Store Delivery Portal"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. MODAL: + CREATE NEW STORE */}
      {/* ======================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-purple-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Create New Tenant Store</h3>
                  <p className="text-xs text-slate-400">Provision store and assign owner credentials</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStore} className="space-y-4">
              {/* Store Name & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Store Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newStoreForm.name}
                    onChange={handleNameChange}
                    placeholder="e.g. Apex Supermarket"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Store Slug *
                  </label>
                  <input
                    type="text"
                    required
                    value={newStoreForm.slug}
                    onChange={(e) =>
                      setNewStoreForm((prev) => ({
                        ...prev,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
                      }))
                    }
                    placeholder="e.g. apex-supermarket"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-purple-300 text-xs font-mono focus:outline-none focus:border-purple-500 transition"
                  />
                </div>
              </div>

              {/* Owner Details */}
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-xs font-black text-white uppercase tracking-wider block mb-2">
                  Store Owner Credentials
                </span>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Owner Full Name
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={newStoreForm.ownerName}
                        onChange={(e) =>
                          setNewStoreForm((prev) => ({ ...prev, ownerName: e.target.value }))
                        }
                        placeholder="e.g. Vikram Malhotra"
                        className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Owner Email *
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={newStoreForm.ownerEmail}
                          onChange={(e) =>
                            setNewStoreForm((prev) => ({ ...prev, ownerEmail: e.target.value }))
                          }
                          placeholder="owner@apexstore.com"
                          className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Owner Password *
                      </label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={newStoreForm.ownerPassword}
                          onChange={(e) =>
                            setNewStoreForm((prev) => ({ ...prev, ownerPassword: e.target.value }))
                          }
                          placeholder="Minimum 6 chars"
                          className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Initial Module Permissions */}
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-xs font-black text-white uppercase tracking-wider block mb-2">
                  Module Checkboxes (Feature Flags)
                </span>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                    <input
                      type="checkbox"
                      checked={newStoreForm.enabledModules.pos}
                      onChange={(e) =>
                        setNewStoreForm((prev) => ({
                          ...prev,
                          enabledModules: { ...prev.enabledModules, pos: e.target.checked }
                        }))
                      }
                      className="rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
                    />
                    <span className="text-white font-semibold">Billing POS</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                    <input
                      type="checkbox"
                      checked={newStoreForm.enabledModules.inward_ocr}
                      onChange={(e) =>
                        setNewStoreForm((prev) => ({
                          ...prev,
                          enabledModules: { ...prev.enabledModules, inward_ocr: e.target.checked }
                        }))
                      }
                      className="rounded text-teal-500 focus:ring-teal-500 bg-slate-900 border-slate-700"
                    />
                    <span className="text-white font-semibold">Inward OCR</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                    <input
                      type="checkbox"
                      checked={newStoreForm.enabledModules.ledger}
                      onChange={(e) =>
                        setNewStoreForm((prev) => ({
                          ...prev,
                          enabledModules: { ...prev.enabledModules, ledger: e.target.checked }
                        }))
                      }
                      className="rounded text-blue-500 focus:ring-blue-500 bg-slate-900 border-slate-700"
                    />
                    <span className="text-white font-semibold">Vendor Ledgers</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                    <input
                      type="checkbox"
                      checked={newStoreForm.enabledModules.delivery}
                      onChange={(e) =>
                        setNewStoreForm((prev) => ({
                          ...prev,
                          enabledModules: { ...prev.enabledModules, delivery: e.target.checked }
                        }))
                      }
                      className="rounded text-indigo-500 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                    />
                    <span className="text-white font-semibold">Delivery Dispatch</span>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  id="submit-create-store-form"
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Provision Store</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
