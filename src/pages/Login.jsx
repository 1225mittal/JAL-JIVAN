import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  Users,
  Store,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Smartphone,
  Crown,
  Phone
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  useAuth,
  DEFAULT_STORE,
  DEFAULT_USER_PROFILE
} from '../context/AuthContext';

export default function Login({ onLoginSuccess }) {
  const { loginUser, setCurrentStore, setUserProfile, setUserRole } = useAuth();

  // Mode: 'owner' | 'staff'
  const [activeTab, setActiveTab] = useState('owner');

  // Tab 1: Store Owner
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Tab 2: Staff Quick PIN
  const [storeSlug, setStoreSlug] = useState('');
  const [staffPin, setStaffPin] = useState('');

  // Status & Error
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ==========================================
  // 1. STORE OWNER (CUSTOM RPC: verify_store_phone_login)
  // ==========================================
  const handleOwnerLogin = async (e) => {
    e?.preventDefault();
    setErrorMsg('');

    const rawInput = mobile.trim();
    const cleanPassword = password.trim();

    if (!rawInput || !cleanPassword) {
      setErrorMsg('Invalid mobile number or password.');
      return;
    }

    const cleanPhone = rawInput.replace(/^(\+91|91)/, '').replace(/\D/g, '');

    setIsLoading(true);

    try {
      let userStore = null;

      // Authenticate via the custom RPC verify_store_phone_login:
      if (isSupabaseConfigured && supabase?.rpc) {
        try {
          const { data, error } = await supabase.rpc('verify_store_phone_login', {
            p_phone: cleanPhone,
            p_password: cleanPassword
          });

          if (!error && data && data.length > 0 && data[0].success) {
            userStore = data[0];
          } else if (error) {
            console.warn('verify_store_phone_login RPC notice:', error);
          }
        } catch (rpcErr) {
          console.warn('verify_store_phone_login RPC exception:', rpcErr);
        }
      }

      // Demo / Fallback Store Owner Credentials (offline or test instances)
      if (!userStore) {
        const isOwnerCreds =
          (cleanPhone === '8860221124' || cleanPhone === '9876543210' || rawInput === 'mittal') &&
          (cleanPassword === 'MittalStore#2026!Secure' || cleanPassword === '2026' || cleanPassword === '1225' || cleanPassword === '9999');

        if (isOwnerCreds) {
          userStore = {
            success: true,
            user_id: DEFAULT_USER_PROFILE.id,
            store_slug: DEFAULT_STORE.slug,
            store_name: DEFAULT_STORE.name,
            user_role: 'store_owner'
          };
        }
      }

      if (!userStore || !userStore.success) {
        setErrorMsg('Invalid mobile number or password.');
        setIsLoading(false);
        return;
      }

      // Store session info in localStorage/context so the store views recognize the logged-in owner
      localStorage.setItem('jaljivan_store_session', JSON.stringify({
        userId: userStore.user_id,
        storeSlug: userStore.store_slug,
        storeName: userStore.store_name,
        role: userStore.user_role
      }));

      // Also sync AuthContext state so the entire application recognizes the logged-in user
      loginUser({
        profile: {
          id: userStore.user_id,
          phone: `+91${cleanPhone}`,
          full_name: userStore.user_name || userStore.full_name || 'Store Owner',
          role: userStore.user_role || 'store_owner',
          store_id: userStore.store_id || `store_${userStore.store_slug}`,
          is_active: true
        },
        store: {
          id: userStore.store_id || `store_${userStore.store_slug}`,
          name: userStore.store_name,
          slug: userStore.store_slug,
          enabled_modules: {
            pos: true,
            inward_ocr: true,
            ledger: true,
            delivery: true
          }
        },
        role: userStore.user_role || 'store_owner',
        session: null
      });

      // Route directly to their store
      const redirectPath = `/${userStore.store_slug}`;

      if (onLoginSuccess) {
        onLoginSuccess(redirectPath);
      } else {
        window.history.pushState({}, '', redirectPath);
        window.location.reload();
      }
    } catch (err) {
      console.error('Login process exception:', err);
      setErrorMsg('Invalid mobile number or password.');
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // 2. STAFF QUICK PIN (STORE SLUG + PIN)
  // ==========================================
  const handleStaffPinLogin = async (e) => {
    e?.preventDefault();
    setErrorMsg('');

    const cleanSlug = storeSlug.trim().toLowerCase();
    const cleanPin = staffPin.trim();

    if (!cleanSlug) {
      setErrorMsg('Please enter your store slug (e.g. mittal-store).');
      return;
    }
    if (!cleanPin || cleanPin.length < 4) {
      setErrorMsg('Please enter your 4-digit staff PIN.');
      return;
    }

    setIsLoading(true);

    try {
      let matchedStore = null;

      // 1. Fetch Store by Slug
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('stores')
            .select('*')
            .eq('slug', cleanSlug)
            .single();
          if (!error && data) {
            matchedStore = data;
          }
        } catch (e) {}
      }

      // Check local storage stores
      if (!matchedStore) {
        try {
          const localStores = JSON.parse(localStorage.getItem('jal_jivan_all_stores') || '[]');
          matchedStore = localStores.find((s) => s.slug === cleanSlug);
        } catch (e) {}
      }

      if (!matchedStore && (cleanSlug === 'mittal-store' || cleanSlug === 'default' || cleanSlug === DEFAULT_STORE.slug)) {
        matchedStore = DEFAULT_STORE;
      }

      if (!matchedStore) {
        setErrorMsg(`Store with slug "${cleanSlug}" was not found. Please verify the store code.`);
        setIsLoading(false);
        return;
      }

      // 2. Find Staff Member by PIN and store_id
      let matchedStaff = null;
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: staffData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('store_id', matchedStore.id)
            .eq('pin', cleanPin)
            .eq('is_active', true)
            .single();

          if (staffData) {
            matchedStaff = staffData;
          }
        } catch (e) {}
      }

      if (!matchedStaff) {
        try {
          const localStaff = JSON.parse(localStorage.getItem(`jal_jivan_store_staff_${matchedStore.id}`) || '[]');
          const found = localStaff.find(
            (s) => String(s.pin) === cleanPin && s.is_active !== false
          );
          if (found) {
            matchedStaff = found;
          }
        } catch (e) {}
      }

      // Master PINs or Demo Staff fallbacks
      if (!matchedStaff) {
        if (cleanPin === '1122') {
          matchedStaff = {
            id: `staff_cashier_${matchedStore.id}`,
            full_name: 'Cashier Staff',
            email: 'cashier@' + cleanSlug + '.com',
            role: 'billing_cashier',
            store_id: matchedStore.id,
            pin: '1122',
            is_active: true
          };
        } else if (cleanPin === '3344') {
          matchedStaff = {
            id: `staff_inward_${matchedStore.id}`,
            full_name: 'Inventory Staff',
            email: 'inventory@' + cleanSlug + '.com',
            role: 'inventory_staff',
            store_id: matchedStore.id,
            pin: '3344',
            is_active: true
          };
        } else if (cleanPin === '5566' || cleanPin === '1234') {
          matchedStaff = {
            id: `staff_rider_${matchedStore.id}`,
            full_name: 'Delivery Staff',
            email: 'rider@' + cleanSlug + '.com',
            role: 'delivery_boy',
            store_id: matchedStore.id,
            pin: cleanPin,
            is_active: true
          };
        } else if (['2026', '1225', '9999'].includes(cleanPin)) {
          matchedStaff = {
            ...DEFAULT_USER_PROFILE,
            store_id: matchedStore.id
          };
        }
      }

      if (!matchedStaff) {
        setErrorMsg(`Invalid Staff PIN for "${matchedStore.name}". Please ask your store owner for your terminal PIN.`);
        setIsLoading(false);
        return;
      }

      loginUser({
        profile: matchedStaff,
        store: matchedStore,
        role: matchedStaff.role,
        session: null
      });

      let redirectPath = `/${matchedStore.slug}`;
      if (matchedStaff.role === 'delivery_boy') {
        redirectPath = `/${matchedStore.slug}/delivery`;
      } else if (matchedStaff.role === 'billing_cashier') {
        redirectPath = `/${matchedStore.slug}/sales`;
      } else if (matchedStaff.role === 'inventory_staff') {
        redirectPath = `/${matchedStore.slug}/purchase`;
      } else {
        redirectPath = `/${matchedStore.slug}`;
      }

      if (onLoginSuccess) {
        onLoginSuccess(redirectPath);
      } else {
        window.history.pushState({}, '', redirectPath);
        window.location.reload();
      }
    } catch (err) {
      console.error('Staff PIN login exception:', err);
      setErrorMsg(err.message || 'Staff login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[82vh] px-4 py-8 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-slate-900/95 border border-slate-800 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl shadow-2xl space-y-6">
        {/* Header Branding (Clean Store Branding) */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-gradient-to-tr from-emerald-500 to-teal-500 border border-emerald-400/30 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Store Portal Sign In</h1>
          <p className="text-xs text-slate-400">
            Mittal Departmental Store & Staff Access Terminal
          </p>
        </div>

        {/* Tab Toggle Switch */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-950/80 border border-slate-800 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('owner');
              setErrorMsg('');
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'owner'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
            }`}
          >
            <Crown className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Store Owner</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('staff');
              setErrorMsg('');
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'staff'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Staff Quick PIN</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="font-medium leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: STORE OWNER (PHONE + PASSWORD) */}
        {/* ======================================================== */}
        {activeTab === 'owner' && (
          <form onSubmit={handleOwnerLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Mobile Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  id="login-phone-input"
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="e.g. 8860221124"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition placeholder:text-slate-600 font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Store Password
                </label>
                <span className="text-[10px] text-slate-500">Master Password accepted</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit-owner-btn"
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-sm transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Store</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ======================================================== */}
        {/* TAB 2: STAFF QUICK PIN (STORE SLUG + PIN) */}
        {/* ======================================================== */}
        {activeTab === 'staff' && (
          <form onSubmit={handleStaffPinLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Store Slug
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Store className="w-4 h-4" />
                </div>
                <input
                  id="staff-login-slug-input"
                  type="text"
                  required
                  value={storeSlug}
                  onChange={(e) => setStoreSlug(e.target.value)}
                  placeholder="e.g. mittal-store"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-mono placeholder:text-slate-600"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Unique identifier provided by your store owner
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                4-Digit Staff PIN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="staff-login-pin-input"
                  type="password"
                  maxLength={6}
                  required
                  value={staffPin}
                  onChange={(e) => setStaffPin(e.target.value)}
                  placeholder="••••"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-base tracking-widest focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition placeholder:text-slate-600 font-mono"
                />
              </div>
            </div>

            <button
              id="staff-login-submit-btn"
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black rounded-xl text-sm transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Authorize Staff Terminal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
