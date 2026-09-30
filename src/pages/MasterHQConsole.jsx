import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Server,
  Building2,
  Store,
  Plus,
  Check,
  X,
  ExternalLink,
  Copy,
  Clock,
  Sparkles,
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
  LogOut,
  Layers,
  Receipt,
  FileSpreadsheet,
  BookOpen,
  Truck,
  Activity,
  Cpu,
  Database,
  Smartphone
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { HQ_AAL_KEY } from './SuperAdminAuth';

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

export default function MasterHQConsole({ onNavigate, showToast }) {
  const { userRole, logoutUser } = useAuth();

  const [isAal2Verified, setIsAal2Verified] = useState(false);
  const [checkingAal, setCheckingAal] = useState(true);

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

  // ========================================================
  // 1. AAL2 & SUPER_ADMIN ACCESS VERIFICATION
  // ========================================================
  useEffect(() => {
    async function verifyAssuranceLevel() {
      setCheckingAal(true);

      const localAal = localStorage.getItem(HQ_AAL_KEY);
      const localRole = localStorage.getItem('jal_jivan_user_role');
      const isAdminLoggedIn = localStorage.getItem('jal_jivan_admin_logged_in') === 'true';

      // Verify Supabase MFA AAL2 if Supabase configured
      let passedAal2 = false;
      if (isSupabaseConfigured && supabase?.auth?.mfa) {
        try {
          const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (!error && data?.currentLevel === 'aal2') {
            passedAal2 = true;
          }
        } catch (e) {}
      }

      // Check local storage AAL2 marker for demo / offline
      if (!passedAal2 && localAal === 'aal2' && isAdminLoggedIn && localRole === 'super_admin') {
        passedAal2 = true;
      }

      if (!passedAal2) {
        // Redirection to /hq-console/auth as mandated by Requirement 1
        if (onNavigate) {
          onNavigate('/hq-console/auth');
        } else {
          window.location.href = '/hq-console/auth';
        }
        return;
      }

      setIsAal2Verified(true);
      setCheckingAal(false);
    }

    verifyAssuranceLevel();
  }, [onNavigate]);

  // ========================================================
  // 2. FETCH REGISTERED TENANT STORES
  // ========================================================
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
    if (isAal2Verified) {
      fetchStores();
    }
  }, [isAal2Verified, fetchStores]);

  const updateLocalStores = useCallback((updatedList) => {
    setStores(updatedList);
    try {
      localStorage.setItem('jal_jivan_all_stores', JSON.stringify(updatedList));
    } catch (e) {}
  }, []);

  // ========================================================
  // 3. LIVE SWITCHES TO TOGGLE MODULES PER STORE
  // ========================================================
  const handleToggleModule = async (storeId, moduleKey, currentValue) => {
    const newValue = !currentValue;
    const storeToUpdate = stores.find((s) => s.id === storeId);
    if (!storeToUpdate) return;

    const updatedModules = {
      ...(storeToUpdate.enabled_modules || {}),
      [moduleKey]: newValue
    };

    const updatedStores = stores.map((s) =>
      s.id === storeId ? { ...s, enabled_modules: updatedModules } : s
    );
    updateLocalStores(updatedStores);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('stores')
          .update({ enabled_modules: updatedModules })
          .eq('id', storeId);
      } catch (e) {}
    }

    const moduleLabel =
      moduleKey === 'pos'
        ? 'POS'
        : moduleKey === 'inward_ocr'
        ? 'Inward OCR'
        : moduleKey === 'ledger'
        ? 'Ledgers'
        : 'Delivery';

    showToast?.(`${storeToUpdate.name}: ${moduleLabel} updated to ${newValue ? 'ON' : 'OFF'}`, 'success');
  };

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

    showToast?.(`Store ${storeToUpdate.name} status updated to ${newStatus.toUpperCase()}`, 'info');
  };

  // ========================================================
  // 4. CREATE NEW STORE SUBMISSION
  // ========================================================
  const handleCreateStore = async (e) => {
    e.preventDefault();
    setFormError('');

    const cleanName = newStoreForm.name.trim();
    const cleanSlug = newStoreForm.slug.trim().toLowerCase();
    const cleanOwnerEmail = newStoreForm.ownerEmail.trim().toLowerCase();
    const cleanOwnerPassword = newStoreForm.ownerPassword.trim();
    const cleanOwnerName = newStoreForm.ownerName.trim() || `${cleanName} Owner`;

    if (!cleanName || !cleanSlug || !cleanOwnerEmail || !cleanOwnerPassword) {
      setFormError('Please fill in all required fields.');
      return;
    }

    if (stores.some((s) => s.slug === cleanSlug)) {
      setFormError(`A store with slug "${cleanSlug}" already exists.`);
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

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('stores').insert([newStoreRecord]);
          await supabase.from('user_profiles').insert([
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
        } catch (e) {}
      }

      // Pre-seed local staff
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
            full_name: 'Cashier Staff',
            email: `cashier@${cleanSlug}.com`,
            role: 'billing_cashier',
            pin: '1122',
            is_active: true,
            created_at: new Date().toISOString()
          }
        ];
        localStorage.setItem(staffKey, JSON.stringify(initialStaff));
      } catch (e) {}

      const updatedStoresList = [newStoreRecord, ...stores];
      updateLocalStores(updatedStoresList);

      showToast?.(`Tenant store "${cleanName}" created successfully!`, 'success');
      setIsCreateModalOpen(false);
      setNewStoreForm({
        name: '',
        slug: '',
        ownerName: '',
        ownerEmail: '',
        ownerPassword: '',
        enabledModules: { pos: true, inward_ocr: true, ledger: true, delivery: true }
      });
    } catch (err) {
      setFormError(err.message || 'Failed to create store.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Master HQ Dedicated Logout
  const handleHqLogout = async () => {
    localStorage.removeItem(HQ_AAL_KEY);
    await logoutUser();
    if (onNavigate) {
      onNavigate('/hq-console/auth');
    } else {
      window.location.href = '/hq-console/auth';
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

  if (checkingAal) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#070b18] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-mono tracking-wider">
            VERIFYING CLOUD HQ ENCLAVE & 2FA LEVEL...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#070b18] text-slate-100 selection:bg-purple-500 selection:text-white flex flex-col font-sans">
      {/* ======================================================== */}
      {/* MASTER HQ DEDICATED HEADER (COMPLETELY ZERO STORE LOGOS) */}
      {/* ======================================================== */}
      <header className="w-full bg-slate-950/80 border-b border-purple-500/20 backdrop-blur-xl px-5 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 border border-purple-400/30 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-white tracking-wider">
                JAL-JIVAN CLOUD HQ
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono font-bold">
                ENCLAVE v2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Platform Infrastructure & Licensing</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Green Shield 2FA Verified Badge */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold shadow-sm shadow-emerald-500/10">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>2FA Verified (Apple Authenticator)</span>
          </div>

          {/* Master HQ Logout */}
          <button
            onClick={handleHqLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-red-500/10 hover:text-red-300 border border-slate-800 hover:border-red-500/30 text-slate-300 text-xs font-bold transition"
            title="Terminate Master Enclave Session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">HQ Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Enclave Status Bar */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/20 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
            <div>
              <span className="text-xs font-black text-white uppercase tracking-wider block">
                Infrastructure Master Directory
              </span>
              <span className="text-[11px] text-slate-400">
                Isolated multi-tenant supervisor. No tenant sales or purchase data accessed.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchStores}
              disabled={loading}
              className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-bold"
              title="Refresh Tenants"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              id="hq-create-store-btn"
              onClick={() => setIsCreateModalOpen(true)}
              className="py-2.5 px-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs transition shadow-lg shadow-purple-600/25 flex items-center gap-2 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Provision Tenant Store</span>
            </button>
          </div>
        </div>

        {/* Global Directory Search & KPI Chips */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter stores by name, slug..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono">
              Total Tenants: <strong className="text-white">{stores.length}</strong>
            </span>
            <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono">
              Active: <strong className="text-emerald-400">{stores.filter((s) => s.status === 'active').length}</strong>
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* GLOBAL TENANT STORES DIRECTORY WITH MODULE SWITCHES */}
        {/* ======================================================== */}
        <div className="overflow-hidden rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-4 px-5">Registered Tenant</th>
                  <th className="py-4 px-4">Slug Identifier</th>
                  <th className="py-4 px-4 text-center">Status</th>
                  <th className="py-4 px-4 text-center min-w-[280px]">
                    Module Feature Flags (Live Switches)
                  </th>
                  <th className="py-4 px-4">Provisioned</th>
                  <th className="py-4 px-5 text-right">Rider Portal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        <span>Querying global multi-tenant directory...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredStores.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="font-semibold">No registered tenant stores found</p>
                    </td>
                  </tr>
                ) : (
                  filteredStores.map((st) => {
                    const mods = st.enabled_modules || {};
                    return (
                      <tr key={st.id} className="hover:bg-slate-800/40 transition group">
                        {/* Name & ID */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-black text-white text-sm group-hover:text-purple-300 transition">
                                {st.name}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">id: {st.id}</div>
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
                            <button
                              onClick={() => handleToggleModule(st.id, 'pos', mods.pos)}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-bold transition ${
                                mods.pos
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                                  : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                              }`}
                              title="Point of Sale Module"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>POS</span>
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  mods.pos ? 'bg-emerald-400' : 'bg-slate-700'
                                }`}
                              />
                            </button>

                            <button
                              onClick={() => handleToggleModule(st.id, 'inward_ocr', mods.inward_ocr)}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-bold transition ${
                                mods.inward_ocr
                                  ? 'bg-teal-500/15 border-teal-500/40 text-teal-300 hover:bg-teal-500/25'
                                  : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                              }`}
                              title="Inward Groq OCR Module"
                            >
                              <FileSpreadsheet className="w-3 h-3" />
                              <span>OCR</span>
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  mods.inward_ocr ? 'bg-teal-400' : 'bg-slate-700'
                                }`}
                              />
                            </button>

                            <button
                              onClick={() => handleToggleModule(st.id, 'ledger', mods.ledger)}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-bold transition ${
                                mods.ledger
                                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-300 hover:bg-blue-500/25'
                                  : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                              }`}
                              title="Vendor Ledgers Module"
                            >
                              <BookOpen className="w-3 h-3" />
                              <span>Ledger</span>
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  mods.ledger ? 'bg-blue-400' : 'bg-slate-700'
                                }`}
                              />
                            </button>

                            <button
                              onClick={() => handleToggleModule(st.id, 'delivery', mods.delivery)}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-bold transition ${
                                mods.delivery
                                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/25'
                                  : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                              }`}
                              title="Delivery Dispatch Module"
                            >
                              <Truck className="w-3 h-3" />
                              <span>Delivery</span>
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  mods.delivery ? 'bg-indigo-400' : 'bg-slate-700'
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
                          <a
                            href={`/store/${st.slug}/delivery`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold transition"
                            title="Open Tenant Delivery Portal"
                          >
                            <span>Open Portal</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ======================================================== */}
      {/* 5. MODAL: + PROVISION TENANT STORE */}
      {/* ======================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-purple-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Provision Tenant Store</h3>
                  <p className="text-xs text-slate-400">Register new store and assign owner credentials</p>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Store Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newStoreForm.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const slug = name
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '');
                      setNewStoreForm((prev) => ({ ...prev, name, slug }));
                    }}
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

              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-xs font-black text-white uppercase tracking-wider block mb-2">
                  Store Owner Credentials
                </span>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Owner Full Name
                    </label>
                    <input
                      type="text"
                      value={newStoreForm.ownerName}
                      onChange={(e) =>
                        setNewStoreForm((prev) => ({ ...prev, ownerName: e.target.value }))
                      }
                      placeholder="e.g. Vikram Malhotra"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Owner Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={newStoreForm.ownerEmail}
                        onChange={(e) =>
                          setNewStoreForm((prev) => ({ ...prev, ownerEmail: e.target.value }))
                        }
                        placeholder="owner@apexstore.com"
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Owner Password *
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={newStoreForm.ownerPassword}
                          onChange={(e) =>
                            setNewStoreForm((prev) => ({ ...prev, ownerPassword: e.target.value }))
                          }
                          placeholder="Min 6 characters"
                          className="w-full pl-3.5 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 transition"
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

              {/* Module Feature Flags */}
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-xs font-black text-white uppercase tracking-wider block mb-2">
                  Module Feature Flags
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStoreForm.enabledModules.pos}
                      onChange={(e) =>
                        setNewStoreForm((prev) => ({
                          ...prev,
                          enabledModules: { ...prev.enabledModules, pos: e.target.checked }
                        }))
                      }
                      className="rounded text-purple-600 focus:ring-purple-500 bg-slate-900 border-slate-700"
                    />
                    <span className="text-white font-semibold">POS Billing</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStoreForm.enabledModules.inward_ocr}
                      onChange={(e) =>
                        setNewStoreForm((prev) => ({
                          ...prev,
                          enabledModules: { ...prev.enabledModules, inward_ocr: e.target.checked }
                        }))
                      }
                      className="rounded text-purple-600 focus:ring-purple-500 bg-slate-900 border-slate-700"
                    />
                    <span className="text-white font-semibold">Inward OCR</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStoreForm.enabledModules.ledger}
                      onChange={(e) =>
                        setNewStoreForm((prev) => ({
                          ...prev,
                          enabledModules: { ...prev.enabledModules, ledger: e.target.checked }
                        }))
                      }
                      className="rounded text-purple-600 focus:ring-purple-500 bg-slate-900 border-slate-700"
                    />
                    <span className="text-white font-semibold">Ledgers</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStoreForm.enabledModules.delivery}
                      onChange={(e) =>
                        setNewStoreForm((prev) => ({
                          ...prev,
                          enabledModules: { ...prev.enabledModules, delivery: e.target.checked }
                        }))
                      }
                      className="rounded text-purple-600 focus:ring-purple-500 bg-slate-900 border-slate-700"
                    />
                    <span className="text-white font-semibold">Delivery Dispatch</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black transition shadow-lg shadow-purple-600/30 flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Provision Tenant</span>
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
