import React, { useState } from 'react';
import {
  Store,
  Receipt,
  FileSpreadsheet,
  BookOpen,
  Truck,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Lock,
  Mail,
  X,
  ChevronRight,
  Activity,
  Layers,
  Zap,
  Cpu,
  Smartphone,
  Eye,
  EyeOff,
  AlertCircle,
  Building2,
  User,
  Phone,
  Globe,
  Plus
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth, DEFAULT_STORE, DEFAULT_USER_PROFILE } from '../context/AuthContext';

export default function PublicLandingPage({ onLoginSuccess, onNavigate }) {
  const { loginUser } = useAuth();

  // Store Access Modal State (3 modes: 'signin' | 'signup' | 'staff')
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('signin'); // 'signin' | 'signup' | 'staff'

  // Tab 1: Store Owner Sign In State (all default to empty string)
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Tab 2: Register New Store (Signup) State (all default to empty string)
  const [regStoreName, setRegStoreName] = useState('');
  const [regStoreSlug, setRegStoreSlug] = useState('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Interactive Capability Tab in Hero
  const [activeCapability, setActiveCapability] = useState('pos');

  // Auto-slug generator
  const generateSlug = (text) => {
    return (text || '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleStoreNameChange = (e) => {
    const val = e.target.value;
    setRegStoreName(val);
    if (!slugManuallyEdited) {
      setRegStoreSlug(generateSlug(val));
    }
  };

  const handleStoreSlugChange = (e) => {
    setSlugManuallyEdited(true);
    setRegStoreSlug(generateSlug(e.target.value));
  };

  // ==========================================
  // 1. STORE OWNER SIGN IN HANDLER
  // ==========================================
  const handleOwnerSignIn = async (e) => {
    e.preventDefault();
    setLoginError('');

    const cleanEmail = signInEmail.trim().toLowerCase();
    const cleanPassword = signInPassword.trim();

    if (!cleanEmail || !cleanPassword) {
      setLoginError('Please enter your email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      let resolvedProfile = null;
      let resolvedStore = null;
      let authSession = null;

      if (isSupabaseConfigured && supabase?.auth) {
        try {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPassword
          });

          if (!authError && authData?.user) {
            authSession = authData.session;
            const { data: profData } = await supabase
              .from('user_profiles')
              .select('*, stores(*)')
              .eq('id', authData.user.id)
              .single();

            if (profData) {
              resolvedProfile = profData;
              if (profData.stores) {
                resolvedStore = Array.isArray(profData.stores) ? profData.stores[0] : profData.stores;
              }
            }
          } else if (authError) {
            console.warn('Supabase signIn notice:', authError.message);
          }
        } catch (err) {
          console.warn('Auth notice:', err);
        }
      }

      // Check local stores cache
      if (!resolvedProfile) {
        try {
          const localStores = JSON.parse(localStorage.getItem('jal_jivan_all_stores') || '[]');
          for (const s of localStores) {
            const staffKey = `jal_jivan_store_staff_${s.id}`;
            const staffList = JSON.parse(localStorage.getItem(staffKey) || '[]');
            const foundOwner = staffList.find(
              (st) => st.email?.toLowerCase() === cleanEmail && st.role === 'store_owner'
            );
            if (foundOwner) {
              resolvedProfile = foundOwner;
              resolvedStore = s;
              break;
            }
          }
        } catch (e) {}
      }

      // Offline / Demo Store Owner fallback
      if (!resolvedProfile) {
        const isOwnerCreds =
          (cleanEmail === 'owner@mittalstore.com' || cleanEmail === 'mittal' || cleanEmail === 'admin') &&
          (cleanPassword === 'MittalStore#2026!Secure' || cleanPassword === '2026' || cleanPassword === '1225' || cleanPassword === '9999');

        if (isOwnerCreds) {
          resolvedProfile = DEFAULT_USER_PROFILE;
          resolvedStore = DEFAULT_STORE;
        }
      }

      if (!resolvedProfile) {
        setLoginError('Invalid credentials. Please verify your email and password.');
        setIsSubmitting(false);
        return;
      }

      if (!resolvedStore && resolvedProfile.store_id && isSupabaseConfigured && supabase) {
        try {
          const { data: storeData } = await supabase
            .from('stores')
            .select('*')
            .eq('id', resolvedProfile.store_id)
            .single();
          if (storeData) resolvedStore = storeData;
        } catch (e) {}
      }

      if (!resolvedStore) {
        resolvedStore = DEFAULT_STORE;
      }

      loginUser({
        profile: resolvedProfile,
        store: resolvedStore,
        role: 'store_owner',
        session: authSession
      });

      const storeSlug = resolvedStore?.slug || 'mittal-store';
      const redirectPath = `/${storeSlug}`;

      setIsLoginModalOpen(false);
      if (onLoginSuccess) {
        onLoginSuccess(redirectPath);
      } else if (onNavigate) {
        onNavigate(redirectPath);
      } else {
        window.location.href = redirectPath;
      }
    } catch (err) {
      setLoginError(err.message || 'Authentication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // 2. REGISTER NEW STORE (SIGNUP) HANDLER
  // ==========================================
  const handleStoreRegister = async (e) => {
    e.preventDefault();
    setLoginError('');

    const cleanStoreName = regStoreName.trim();
    const cleanSlug = generateSlug(regStoreSlug || regStoreName);
    const cleanOwnerName = regOwnerName.trim();
    const cleanPhone = regPhone.trim();
    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanPassword = regPassword.trim();

    if (!cleanStoreName) {
      setLoginError('Please enter your store name.');
      return;
    }
    if (!cleanSlug || cleanSlug.length < 2) {
      setLoginError('Please enter a valid store URL slug (e.g. apex-retail).');
      return;
    }
    if (!cleanOwnerName) {
      setLoginError('Please enter the store owner full name.');
      return;
    }
    if (!cleanPhone) {
      setLoginError('Please enter a contact phone number.');
      return;
    }
    if (!cleanEmail) {
      setLoginError('Please enter your work email address.');
      return;
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      setLoginError('Please enter a secure password (minimum 6 characters).');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Prevent collision with system paths
      const reservedSlugs = [
        'hq-console', 'super-admin', 'login', 'admin', 'rider', 'driver', 'scan-inward', 'store', 'api', 'assets'
      ];
      if (reservedSlugs.includes(cleanSlug)) {
        setLoginError(`The slug "${cleanSlug}" is reserved. Please choose another unique slug.`);
        setIsSubmitting(false);
        return;
      }

      // Check if slug already exists in Supabase
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: existingStore } = await supabase
            .from('stores')
            .select('id, slug')
            .eq('slug', cleanSlug)
            .maybeSingle();

          if (existingStore) {
            setLoginError(`Store slug "${cleanSlug}" is already taken. Please choose a different slug.`);
            setIsSubmitting(false);
            return;
          }
        } catch (e) {}
      }

      // 2. Sign up user with supabase.auth.signUp
      let authUser = null;
      let authSession = null;
      if (isSupabaseConfigured && supabase?.auth) {
        try {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: cleanEmail,
            password: cleanPassword,
            options: {
              data: {
                full_name: cleanOwnerName,
                phone: cleanPhone,
                role: 'store_owner'
              }
            }
          });

          if (signUpError) {
            console.warn('Supabase signUp error notice:', signUpError.message);
            if (!signUpError.message?.toLowerCase().includes('already registered')) {
              throw new Error(signUpError.message);
            }
          } else {
            authUser = signUpData?.user;
            authSession = signUpData?.session;
          }
        } catch (err) {
          if (!err.message?.toLowerCase().includes('already registered')) {
            throw err;
          }
        }
      }

      // 3. Create row in stores table with default modules
      const newStoreId = `store_${cleanSlug}_${Date.now()}`;
      const newStoreRecord = {
        id: newStoreId,
        name: cleanStoreName,
        slug: cleanSlug,
        phone: cleanPhone,
        status: 'active',
        enabled_modules: {
          pos: true,
          inward_ocr: true,
          ledger: true,
          delivery: true
        },
        created_at: new Date().toISOString()
      };

      // 4. Create corresponding row in user_profiles with role 'store_owner'
      const newUserId = authUser?.id || `user_owner_${cleanSlug}_${Date.now()}`;
      const newUserProfile = {
        id: newUserId,
        full_name: cleanOwnerName,
        email: cleanEmail,
        phone: cleanPhone,
        role: 'store_owner',
        store_id: newStoreId,
        is_active: true,
        created_at: new Date().toISOString()
      };

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('stores').insert([newStoreRecord]);
          await supabase.from('user_profiles').insert([newUserProfile]);
        } catch (dbErr) {
          console.warn('Database insert warning (fallback cached):', dbErr.message);
        }
      }

      // 5. Pre-seed local storage directory & staff
      try {
        const localStores = JSON.parse(localStorage.getItem('jal_jivan_all_stores') || '[]');
        const updatedList = [newStoreRecord, ...localStores.filter((s) => s.slug !== cleanSlug)];
        localStorage.setItem('jal_jivan_all_stores', JSON.stringify(updatedList));

        const staffKey = `jal_jivan_store_staff_${newStoreId}`;
        const initialStaff = [
          {
            id: `staff_owner_${newStoreId}`,
            store_id: newStoreId,
            full_name: cleanOwnerName,
            email: cleanEmail,
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

      // 6. Log in the newly registered store owner
      loginUser({
        profile: newUserProfile,
        store: newStoreRecord,
        role: 'store_owner',
        session: authSession
      });

      // 7. Redirect immediately to /${newStoreSlug}
      const redirectPath = `/${cleanSlug}`;
      setIsLoginModalOpen(false);
      if (onLoginSuccess) {
        onLoginSuccess(redirectPath);
      } else if (onNavigate) {
        onNavigate(redirectPath);
      } else {
        window.location.href = redirectPath;
      }
    } catch (err) {
      console.error('Registration exception:', err);
      setLoginError(err.message || 'Failed to register store. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#070b18] text-slate-100 selection:bg-emerald-500 selection:text-white flex flex-col font-sans overflow-x-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/4 right-10 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

      {/* ======================================================== */}
      {/* 1. PUBLIC PLATFORM HEADER */}
      {/* ======================================================== */}
      <header className="w-full bg-slate-950/70 border-b border-slate-800/80 backdrop-blur-xl sticky top-0 z-40 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-600 border border-emerald-400/40 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base sm:text-lg tracking-tight text-white">
                  JAL-JIVAN
                </span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono">
                  RETAIL OS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                High-Performance FMCG & Supermarket Platform
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#pos" className="hover:text-emerald-400 transition">Counter POS</a>
            <a href="#ocr" className="hover:text-teal-400 transition">AI Inward OCR</a>
            <a href="#ledger" className="hover:text-blue-400 transition">Vendor Ledgers</a>
            <a href="#fleet" className="hover:text-indigo-400 transition">Hyperlocal Fleet</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setModalTab('signup');
                setIsLoginModalOpen(true);
                setLoginError('');
              }}
              className="hidden sm:inline-flex py-2.5 px-4 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-white font-bold rounded-xl text-xs sm:text-sm transition items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Register Store</span>
            </button>

            <button
              onClick={() => {
                setModalTab('signin');
                setIsLoginModalOpen(true);
                setLoginError('');
              }}
              className="py-2.5 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 active:scale-95"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Store Login</span>
            </button>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. HERO SECTION */}
      {/* ======================================================== */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pt-12 pb-16 text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Multi-Tenant Operating System for Modern Retail</span>
        </div>

        <div className="space-y-4 max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15]">
            Automate Counter Billing,{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
              Groq Vision Inwarding
            </span>{' '}
            & Delivery Fleet
          </h1>
          <p className="text-sm sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            The all-in-one retail cloud engineered for departmental stores and high-velocity supermarkets.
            Instant barcode billing, paper bill digitization, real-time vendor bahi-khata, and a smartphone rider portal.
          </p>
        </div>

        {/* Hero CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <button
            onClick={() => {
              setModalTab('signup');
              setIsLoginModalOpen(true);
              setLoginError('');
            }}
            className="py-3.5 px-7 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-2xl text-sm transition shadow-xl shadow-emerald-500/25 flex items-center gap-2.5 active:scale-95"
          >
            <Plus className="w-4 h-4 text-slate-950" />
            <span>Register New Store</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setModalTab('signin');
              setIsLoginModalOpen(true);
              setLoginError('');
            }}
            className="py-3.5 px-6 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-white font-bold rounded-2xl text-sm transition flex items-center gap-2"
          >
            <Store className="w-4 h-4 text-emerald-400" />
            <span>Store Sign In</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* INTERACTIVE CAPABILITIES PREVIEW TABS */}
        {/* ======================================================== */}
        <div className="pt-8 max-w-4xl mx-auto text-left">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800">
              <button
                onClick={() => setActiveCapability('pos')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  activeCapability === 'pos'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Counter POS</span>
              </button>

              <button
                onClick={() => setActiveCapability('ocr')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  activeCapability === 'ocr'
                    ? 'bg-teal-500/20 border border-teal-500/40 text-teal-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>AI Inward OCR</span>
              </button>

              <button
                onClick={() => setActiveCapability('ledger')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  activeCapability === 'ledger'
                    ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Vendor Ledgers</span>
              </button>

              <button
                onClick={() => setActiveCapability('fleet')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  activeCapability === 'fleet'
                    ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Delivery Fleet</span>
              </button>
            </div>

            {/* Tab Preview Content */}
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              {activeCapability === 'pos' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-emerald-400" />
                      <span>Counter Billing & Thermal Printing</span>
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Sub-second Latency
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Designed for peak-hour rush. Scan barcodes or search FMCG inventory instantly. Handles split tenders (Cash, UPI QR, Customer Udhaar/Khata), auto-computes CGST + SGST tax slabs, and prints 80mm thermal receipts directly.
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-mono text-slate-300">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      ⚡ Barcode Scan: &lt;50ms
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      🧾 ESC/POS Thermal Print
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      💳 Split Payment Engine
                    </div>
                  </div>
                </div>
              )}

              {activeCapability === 'ocr' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                      <span>Groq Vision B2B Tax Invoice Digitizer</span>
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      Zero Manual Entry
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Take a smartphone photo of any distributor paper bill. The Groq Vision engine extracts vendor GSTIN, line items, purchase rate, MRP, and GST brackets. Automatically syncs item master stock and flags price hikes.
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-mono text-slate-300">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      📸 Smartphone Snap Sync
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      📦 Automatic Stock Inward
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      🛡️ HSN & Tax Validation
                    </div>
                  </div>
                </div>
              )}

              {activeCapability === 'ledger' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-400" />
                      <span>Distributor Bahi-Khata & Debit Notes</span>
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Real-Time Statements
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    End-to-end accounts payable ledger for every agency. Track bill payments, record cash/bank settlements, and automatically deduct return damages using formatted debit notes.
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-mono text-slate-300">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      📒 Agency Account Ledger
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      ✂️ Damage Debit Deductions
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      📊 Outstanding Aging Reports
                    </div>
                  </div>
                </div>
              )}

              {activeCapability === 'fleet' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <Truck className="w-4 h-4 text-indigo-400" />
                      <span>Hyperlocal Dispatch & Delivery Portal</span>
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      Dedicated Rider App
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Smartphone delivery boy portal accessible via store QR code or link (<code className="text-indigo-300">/:storeSlug/delivery</code>). Drivers accept orders, capture live proof of delivery photos, and trigger real-time GPS tracking.
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-mono text-slate-300">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      📱 Mobile PIN Sign-In
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      📸 Camera Proof of Delivery
                    </div>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                      🗺️ Live Order Coordinates
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 3. FOUR CORE MODULE PILLARS */}
      {/* ======================================================== */}
      <section id="modules" className="max-w-7xl mx-auto px-4 sm:px-8 py-16 space-y-12">
        <div className="text-center space-y-2">
          <span className="text-xs font-black tracking-widest uppercase text-emerald-400">
            Enterprise Architecture
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Modular Retail Infrastructure
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Enable only the operational modules each store needs. Control licensing and feature flags dynamically.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: POS */}
          <div id="pos" className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Counter POS</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Fast barcode scanning, GST thermal receipts, and unified khata accounts.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Module: enabled_modules.pos</span>
            </div>
          </div>

          {/* Card 2: OCR */}
          <div id="ocr" className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-teal-500/40 transition space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">AI Inward OCR</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Groq Vision invoice processing from smartphone camera snapshots.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-1.5 text-xs text-teal-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Module: enabled_modules.inward_ocr</span>
            </div>
          </div>

          {/* Card 3: Ledger */}
          <div id="ledger" className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/40 transition space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Vendor Ledgers</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Distributor statement reconciliation, debit notes, and payment scheduling.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-1.5 text-xs text-blue-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Module: enabled_modules.ledger</span>
            </div>
          </div>

          {/* Card 4: Fleet */}
          <div id="fleet" className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Delivery Fleet</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Mobile rider portal, task dispatching, and camera proof of delivery.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-1.5 text-xs text-indigo-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Module: enabled_modules.delivery</span>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 4. FOOTER */}
      {/* ======================================================== */}
      <footer className="w-full bg-slate-950 border-t border-slate-800/80 py-8 px-4 sm:px-8 mt-auto text-center text-xs text-slate-500 space-y-2">
        <p className="font-semibold text-slate-400">
          JAL-JIVAN Retail Operating System © {new Date().getFullYear()}
        </p>
        <p className="text-[11px]">
          Dedicated Multi-Tenant Architecture. Tenant stores run inside scoped paths (<code className="text-slate-400 font-mono">/:storeSlug</code>).
        </p>
      </footer>

      {/* ======================================================== */}
      {/* 5. STORE ACCESS MODAL (SIGN IN & REGISTER STORE ONLY) */}
      {/* ======================================================== */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  {modalTab === 'signup' ? (
                    <Building2 className="w-5 h-5" />
                  ) : (
                    <Store className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {modalTab === 'signup' ? 'Register New Store' : 'Store Sign In'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {modalTab === 'signup'
                      ? 'Deploy your dedicated retail operating system'
                      : 'Sign in to access your tenant store'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsLoginModalOpen(false);
                  setLoginError('');
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 2-Tab Switcher */}
            <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={() => {
                  setModalTab('signin');
                  setLoginError('');
                }}
                className={`py-2 rounded-lg transition text-center ${
                  modalTab === 'signin'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalTab('signup');
                  setLoginError('');
                }}
                className={`py-2 rounded-lg transition text-center ${
                  modalTab === 'signup'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Register Store
              </button>
            </div>

            {/* Error Message */}
            {loginError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Scrollable Content Container */}
            <div className="overflow-y-auto pr-1 space-y-4">
              {/* TAB 1: OWNER SIGN IN */}
              {modalTab === 'signin' && (
                <form onSubmit={handleOwnerSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Store Owner Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        autoComplete="username"
                        required
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        placeholder="name@store.com"
                        className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showSignInPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-9 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignInPassword(!showSignInPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showSignInPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Sign In to Store</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <p className="text-xs text-slate-400">
                      Need a new store instance?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setModalTab('signup');
                          setLoginError('');
                        }}
                        className="text-emerald-400 hover:underline font-bold"
                      >
                        Register New Store
                      </button>
                    </p>
                  </div>
                </form>
              )}

              {/* TAB 2: REGISTER NEW STORE (SIGNUP) */}
              {modalTab === 'signup' && (
                <form onSubmit={handleStoreRegister} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Store Name
                      </label>
                      <div className="relative">
                        <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={regStoreName}
                          onChange={handleStoreNameChange}
                          placeholder="e.g. Apex Retail"
                          className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Desired Store URL Slug
                      </label>
                      <div className="relative">
                        <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={regStoreSlug}
                          onChange={handleStoreSlugChange}
                          placeholder="apex-retail"
                          className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-mono text-xs focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-600"
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 font-mono">
                    Direct access URL:{' '}
                    <span className="text-emerald-400">
                      jaljivan.com/{regStoreSlug || 'your-slug'}
                    </span>
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Owner Full Name
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={regOwnerName}
                          onChange={(e) => setRegOwnerName(e.target.value)}
                          placeholder="e.g. Vikram Sharma"
                          className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Contact Phone
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="tel"
                          required
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Owner Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        autoComplete="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="name@store.com"
                        className="w-full pl-9 pr-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Set Secure Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-9 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Modules Included Badge */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-300">Default Activated Modules</span>
                      <span className="text-[10px] text-emerald-400 font-semibold uppercase">All 4 Enabled</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold text-slate-400">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">POS Billing</span>
                      <span className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/20">Inward AI OCR</span>
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20">Vendor Ledger</span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">Delivery Fleet</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Deploy Store & Launch Dashboard</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>

                  <div className="pt-1 text-center">
                    <p className="text-xs text-slate-400">
                      Already registered?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setModalTab('signin');
                          setLoginError('');
                        }}
                        className="text-emerald-400 hover:underline font-bold"
                      >
                        Sign In
                      </button>
                    </p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
