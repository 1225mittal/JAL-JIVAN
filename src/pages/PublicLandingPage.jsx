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
  Plus
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth, DEFAULT_STORE, DEFAULT_USER_PROFILE } from '../context/AuthContext';

export default function PublicLandingPage({ onLoginSuccess, onNavigate }) {
  const { loginUser } = useAuth();

  // Store Access Modal State (2 modes: 'signin' | 'signup')
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('signin'); // 'signin' | 'signup'

  // Tab 1: Store Owner Sign In State (Strictly Mobile Number & Password)
  const [signInMobile, setSignInMobile] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Tab 2: Register New Store (Signup) State (STRICTLY 4 COMPULSORY FIELDS)
  const [regStoreName, setRegStoreName] = useState('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

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

  // ==========================================
  // 1. STORE OWNER SIGN IN HANDLER (CUSTOM RPC: verify_store_phone_login)
  // ==========================================
  const handleOwnerSignIn = async (e) => {
    e.preventDefault();
    setLoginError('');

    const rawInput = signInMobile.trim();
    const cleanPassword = signInPassword.trim();

    if (!rawInput || !cleanPassword) {
      setLoginError('Invalid mobile number or password.');
      return;
    }

    const cleanPhone = rawInput.replace(/^(\+91|91)/, '').replace(/\D/g, '');

    setIsSubmitting(true);

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

      // Offline / Demo store fallback
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
        setLoginError('Invalid mobile number or password.');
        setIsSubmitting(false);
        return;
      }

      // Store session info in localStorage/context so the store views recognize the logged-in owner
      localStorage.setItem('jaljivan_store_session', JSON.stringify({
        userId: userStore.user_id,
        storeSlug: userStore.store_slug,
        storeName: userStore.store_name,
        role: userStore.user_role
      }));

      // Also sync AuthContext state so entire app context recognizes the store & profile
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
      setIsLoginModalOpen(false);

      if (onLoginSuccess) {
        onLoginSuccess(redirectPath);
      } else if (onNavigate) {
        onNavigate(redirectPath);
      } else {
        window.location.href = redirectPath;
      }
    } catch (err) {
      console.error('Login process exception:', err);
      setLoginError('Invalid mobile number or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // 2. REGISTER NEW STORE (STRICTLY 4 FIELDS + 7-DAY TRIAL, PHONE ONLY)
  // ==========================================
  const handleStoreRegister = async (e) => {
    e.preventDefault();
    setLoginError('');

    const cleanStoreName = regStoreName.trim();
    const cleanOwnerName = regOwnerName.trim();
    const cleanMobileDigits = regMobile.replace(/[\s-]/g, '').replace(/\D/g, '').slice(-10);
    const cleanPassword = regPassword.trim();

    // 1. Strict Validations for 4 Compulsory Fields
    if (!cleanStoreName) {
      setLoginError('Please enter your store name.');
      return;
    }
    if (!cleanOwnerName) {
      setLoginError('Please enter the store owner full name.');
      return;
    }
    if (!cleanMobileDigits || cleanMobileDigits.length < 10) {
      setLoginError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      setLoginError('Please set a secure password (minimum 6 characters).');
      return;
    }

    const formattedMobile = `+91${cleanMobileDigits}`;

    setIsSubmitting(true);

    try {
      // 2. Auto-generate store URL slug in the background
      const baseSlug = generateSlug(cleanStoreName) || 'store';
      const reservedSlugs = [
        'hq-console', 'super-admin', 'login', 'admin', 'rider', 'driver', 'scan-inward', 'store', 'api', 'assets'
      ];
      let generatedSlug = baseSlug;

      if (reservedSlugs.includes(generatedSlug) || generatedSlug.length < 2) {
        generatedSlug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;
      }

      if (isSupabaseConfigured && supabase) {
        try {
          const { data: existingStore } = await supabase
            .from('stores')
            .select('id, slug')
            .eq('slug', generatedSlug)
            .maybeSingle();

          if (existingStore) {
            generatedSlug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;
          }
        } catch (e) {}
      }

      // 3. Supabase Auth signup strictly using phone & password (NO EMAIL)
      let authUser = null;
      let authSession = null;

      if (isSupabaseConfigured && supabase?.auth) {
        try {
          const { data, error } = await supabase.auth.signUp({
            phone: `+91${cleanMobileDigits}`,
            password: cleanPassword
          });

          if (error) {
            console.warn('Supabase signUp notice:', error.message);
            // If already registered, attempt signIn strictly using phone
            if (error.message?.toLowerCase().includes('already registered')) {
              const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
                phone: formattedMobile,
                password: cleanPassword
              });
              if (signInData?.user) {
                authUser = signInData.user;
                authSession = signInData.session;
              } else if (signInErr) {
                setLoginError('Mobile number already registered. Please sign in to your store.');
                setIsSubmitting(false);
                return;
              }
            } else {
              setLoginError(error.message);
              setIsSubmitting(false);
              return;
            }
          } else {
            authUser = data?.user;
            authSession = data?.session;
          }
        } catch (err) {
          console.warn('Auth exception during signup:', err);
        }
      }

      // 4. Automated 7-Day All-Access Free Trial
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const newStoreId = `store_${generatedSlug}_${Date.now()}`;
      const newStoreRecord = {
        id: newStoreId,
        name: cleanStoreName,
        slug: generatedSlug,
        phone: formattedMobile,
        contact_phone: formattedMobile,
        status: 'active',
        trial_ends_at: trialEndsAt,
        enabled_modules: {
          pos: true,
          inward_ocr: true,
          ledger: true,
          delivery: true
        },
        created_at: new Date().toISOString()
      };

      // 5. Create user_profiles row (phone only, NO EMAIL)
      const newUserId = authUser?.id || `user_owner_${generatedSlug}_${Date.now()}`;
      const newUserProfile = {
        id: newUserId,
        full_name: cleanOwnerName,
        phone: formattedMobile,
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

      // 6. Pre-seed local storage directory & staff for immediate reactivity (phone only, NO EMAIL)
      try {
        const localStores = JSON.parse(localStorage.getItem('jal_jivan_all_stores') || '[]');
        const updatedList = [newStoreRecord, ...localStores.filter((s) => s.slug !== generatedSlug)];
        localStorage.setItem('jal_jivan_all_stores', JSON.stringify(updatedList));

        const staffKey = `jal_jivan_store_staff_${newStoreId}`;
        const initialStaff = [
          {
            id: `staff_owner_${newStoreId}`,
            store_id: newStoreId,
            full_name: cleanOwnerName,
            phone: formattedMobile,
            role: 'store_owner',
            pin: '2026',
            is_active: true,
            created_at: new Date().toISOString()
          }
        ];
        localStorage.setItem(staffKey, JSON.stringify(initialStaff));
      } catch (e) {}

      // 7. Instant Session Init & Redirect
      loginUser({
        profile: newUserProfile,
        store: newStoreRecord,
        role: 'store_owner',
        session: authSession
      });

      const redirectPath = `/${generatedSlug}`;
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
      setLoginError(err.message || 'Failed to deploy store. Please try again.');
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
                      ? '7-Day All-Access Free Trial • Instant Deployment'
                      : 'Sign in with your mobile number and password'}
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
                      Mobile Number
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        autoComplete="tel"
                        required
                        value={signInMobile}
                        onChange={(e) => setSignInMobile(e.target.value)}
                        placeholder="e.g. 8860221124"
                        className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-600"
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

              {/* TAB 2: REGISTER NEW STORE (STRICTLY 4 COMPULSORY FIELDS) */}
              {modalTab === 'signup' && (
                <form onSubmit={handleStoreRegister} className="space-y-4">
                  {/* 1. Store Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Store Name <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={regStoreName}
                        onChange={(e) => setRegStoreName(e.target.value)}
                        placeholder="e.g. Mittal Mart"
                        className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  {/* 2. Owner Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Owner Name <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={regOwnerName}
                        onChange={(e) => setRegOwnerName(e.target.value)}
                        placeholder="e.g. Rahul Mittal"
                        className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  {/* 3. Mobile Number */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Mobile Number <span className="text-emerald-400">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        value={regMobile}
                        onChange={(e) => setRegMobile(e.target.value)}
                        placeholder="e.g. 8860221124"
                        className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  {/* 4. Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Password <span className="text-emerald-400">*</span>
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
                        placeholder="•••••••• (min 6 characters)"
                        className="w-full pl-9 pr-9 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-600"
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

                  {/* 7-Day Free Trial Banner */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/25 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-emerald-300">
                        ✨ Includes 7-Day All-Access Free Trial
                      </p>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        All enterprise modules (POS, AI Inward, Ledgers, Fleet) are unlocked instantly.
                      </p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Deploy Store</span>
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
                        Sign In to Store
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
