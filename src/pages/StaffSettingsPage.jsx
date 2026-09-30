import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  UserPlus,
  ShieldAlert,
  Check,
  Copy,
  ExternalLink,
  QrCode,
  ShieldCheck,
  KeyRound,
  Mail,
  User,
  Power,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Store,
  Truck,
  Receipt,
  Package,
  Sparkles
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { supabase, isSupabaseConfigured, addDriver } from '../lib/supabase';

export default function StaffSettingsPage({ onBackToHub, showToast }) {
  const { currentStore, userRole, isOwner, userProfile } = useAuth();

  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    pin: '1234',
    role: 'billing_cashier'
  });

  const portalUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/store/${currentStore?.slug || 'default'}/delivery`;
  }, [currentStore?.slug]);

  // Load Staff for the current store
  const loadStaff = useCallback(async () => {
    setLoading(true);
    const storeId = currentStore?.id || 'store_mittal_dept';
    const localKey = `jal_jivan_store_staff_${storeId}`;

    let loaded = [];
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          loaded = data;
        }
      } catch (err) {
        console.warn('user_profiles fetch notice:', err.message);
      }
    }

    // Fallback to local storage if empty or Supabase is offline
    if (loaded.length === 0) {
      try {
        const saved = localStorage.getItem(localKey);
        if (saved) {
          loaded = JSON.parse(saved);
        } else {
          // Initial demo staff for this store
          loaded = [
            {
              id: `staff_demo_1_${storeId}`,
              store_id: storeId,
              full_name: 'Rohan Sharma',
              email: 'rohan.cashier@store.com',
              role: 'billing_cashier',
              pin: '1122',
              is_active: true,
              created_at: new Date(Date.now() - 86400000 * 5).toISOString()
            },
            {
              id: `staff_demo_2_${storeId}`,
              store_id: storeId,
              full_name: 'Amit Verma',
              email: 'amit.inward@store.com',
              role: 'inventory_staff',
              pin: '3344',
              is_active: true,
              created_at: new Date(Date.now() - 86400000 * 10).toISOString()
            },
            {
              id: `staff_demo_3_${storeId}`,
              store_id: storeId,
              full_name: 'Suresh Kumar',
              email: 'suresh.rider@store.com',
              role: 'delivery_boy',
              pin: '5566',
              is_active: true,
              created_at: new Date(Date.now() - 86400000 * 2).toISOString()
            }
          ];
          localStorage.setItem(localKey, JSON.stringify(loaded));
        }
      } catch (e) {}
    }

    setStaffList(loaded);
    setLoading(false);
  }, [currentStore?.id]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // Copy portal link
  const handleCopyPortalLink = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(portalUrl);
      setIsCopied(true);
      if (showToast) showToast('Delivery boy portal link copied to clipboard!', 'success');
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  // Toggle active/inactive
  const handleToggleActive = async (staffMember) => {
    const newStatus = !staffMember.is_active;
    const storeId = currentStore?.id || 'store_mittal_dept';
    const localKey = `jal_jivan_store_staff_${storeId}`;

    // Optimistic UI update
    setStaffList((prev) =>
      prev.map((s) => (s.id === staffMember.id ? { ...s, is_active: newStatus } : s))
    );

    if (isSupabaseConfigured && supabase && !staffMember.id.startsWith('staff_demo_')) {
      try {
        await supabase
          .from('user_profiles')
          .update({ is_active: newStatus, updated_at: new Date().toISOString() })
          .eq('id', staffMember.id);
      } catch (e) {
        console.warn('Update active status notice:', e.message);
      }
    }

    // Update local cache
    try {
      const updated = staffList.map((s) => (s.id === staffMember.id ? { ...s, is_active: newStatus } : s));
      localStorage.setItem(localKey, JSON.stringify(updated));
    } catch (e) {}

    if (showToast) {
      showToast(`${staffMember.full_name} is now ${newStatus ? 'ACTIVE' : 'INACTIVE'}`, 'info');
    }
  };

  // Submit Add Staff Member Form
  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      if (showToast) showToast('Please enter the full name', 'error');
      return;
    }
    if (!form.email.trim()) {
      if (showToast) showToast('Please enter email / username', 'error');
      return;
    }
    if (!form.password) {
      if (showToast) showToast('Please enter a password', 'error');
      return;
    }

    setIsSubmitting(true);
    const storeId = currentStore?.id || 'store_mittal_dept';
    const localKey = `jal_jivan_store_staff_${storeId}`;

    const newStaffItem = {
      id: `staff_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      store_id: storeId,
      full_name: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
      pin: form.pin.trim() || '1234',
      is_active: true,
      created_at: new Date().toISOString()
    };

    // If role is delivery_boy, also register in delivery_boys table for direct fleet integration
    if (form.role === 'delivery_boy') {
      try {
        await addDriver({
          name: form.fullName.trim(),
          phone: form.email.replace(/[^0-9]/g, '') || `98${Math.floor(10000000 + Math.random() * 90000000)}`,
          pin: form.pin.trim() || '1234',
          store_id: storeId
        });
      } catch (dErr) {
        console.warn('Driver fleet sync notice:', dErr.message);
      }
    }

    // Try Supabase insert
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .insert([newStaffItem])
          .select()
          .single();

        if (!error && data) {
          newStaffItem.id = data.id;
        }
      } catch (err) {
        console.warn('user_profiles insert notice:', err.message);
      }
    }

    const updated = [newStaffItem, ...staffList];
    setStaffList(updated);
    try {
      localStorage.setItem(localKey, JSON.stringify(updated));
    } catch (e) {}

    // Reset Form
    setForm({
      fullName: '',
      email: '',
      password: '',
      pin: '1234',
      role: 'billing_cashier'
    });
    setIsSubmitting(false);

    if (showToast) {
      showToast(`Staff member "${newStaffItem.full_name}" added successfully!`, 'success');
    }
  };

  // Role Badge Helper
  const renderRoleBadge = (role) => {
    switch (role) {
      case 'billing_cashier':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <Receipt className="w-3 h-3" />
            Billing Cashier
          </span>
        );
      case 'inventory_staff':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Package className="w-3 h-3" />
            Inventory Staff
          </span>
        );
      case 'delivery_boy':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            <Truck className="w-3 h-3" />
            Delivery Boy
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
            {role}
          </span>
        );
    }
  };

  // ACCESS CONTROL: Restricted to store_owner
  if (!isOwner && userRole !== 'store_owner') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="p-8 rounded-3xl bg-slate-900/90 border border-rose-500/30 max-w-md space-y-4 shadow-2xl">
          <ShieldAlert className="w-16 h-16 text-rose-500 mx-auto animate-bounce" />
          <h2 className="text-xl font-black text-white">Access Denied</h2>
          <p className="text-sm text-slate-400">
            The Staff & Access Management screen is restricted to the <strong className="text-rose-400">Store Owner</strong>.
          </p>
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-400">
            Current Role: <span className="text-amber-400 font-bold">{userRole}</span>
          </div>
          {onBackToHub && (
            <button
              onClick={onBackToHub}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition"
            >
              Back to Master Hub
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          {onBackToHub && (
            <button
              onClick={onBackToHub}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition"
              title="Back to Admin Hub"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-emerald-400" />
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Store Staff & Roles Management
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Assigned Store: <strong className="text-emerald-300">{currentStore?.name}</strong> ({currentStore?.slug})
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Role: <strong className="text-emerald-400">Store Owner</strong></span>
        </div>
      </div>

      {/* DEDICATED DELIVERY BOY PORTAL BANNER & QR CARD */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-500/30 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              <Truck className="w-3.5 h-3.5" />
              <span>Dedicated Delivery Boy Portal</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Instant Mobile Delivery Console for {currentStore?.name}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Share this dedicated URL with your fleet riders. They can scan the QR code on their smartphone or bookmark the link for zero-login-hassle PIN dispatch.
            </p>

            {/* Portal Link Pill & Copy Button */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <div className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300 select-all max-w-full overflow-x-auto truncate">
                {portalUrl}
              </div>
              <button
                type="button"
                onClick={handleCopyPortalLink}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-md shadow-cyan-600/20 transition active:scale-95 cursor-pointer"
              >
                {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Copied!' : 'Copy Link'}</span>
              </button>
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Portal</span>
              </a>
            </div>
          </div>

          {/* Interactive QR Code */}
          <div className="bg-white p-3 rounded-2xl shadow-lg border border-cyan-400/40 flex flex-col items-center justify-center shrink-0 mx-auto lg:mx-0">
            <QRCodeSVG value={portalUrl} size={110} level="M" />
            <span className="text-[10px] font-bold text-slate-800 mt-1.5 uppercase tracking-wider">
              Scan for Rider App
            </span>
          </div>
        </div>
      </div>

      {/* TWO-COLUMN GRID: ADD STAFF FORM (LEFT) & ACTIVE STAFF DIRECTORY (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: ADD NEW STAFF FORM (4 cols) */}
        <div className="lg:col-span-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg sticky top-20">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">Add New Staff Member</h2>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-3.5">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Email / Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email / Username <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. ramesh@store.com or phone"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Set staff login password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Quick 4-Digit PIN */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Quick 4-Digit PIN (for Counter / Rider Login)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="1234"
                    value={form.pin}
                    onChange={(e) => setForm({ ...form, pin: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Role Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Staff Role <span className="text-rose-400">*</span>
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="billing_cashier">Billing Cashier (POS & Sales)</option>
                  <option value="inventory_staff">Inventory Staff (Purchase & Inward)</option>
                  <option value="delivery_boy">Delivery Boy (Fleet & Rider App)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isSubmitting ? 'Registering...' : 'Register Staff Member'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE STAFF DIRECTORY (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Registered Staff ({staffList.length})</span>
            </h2>
            <span className="text-xs text-slate-500">
              Filtered strictly by store: <span className="font-mono text-slate-400">{currentStore?.id}</span>
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800">
              Loading staff records...
            </div>
          ) : staffList.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-2">
              <Users className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">No staff members registered for this store yet.</p>
              <p className="text-xs text-slate-500">Use the form on the left to add your first cashier, inventory staff, or delivery boy.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {staffList.map((member) => (
                <div
                  key={member.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    member.is_active
                      ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/60 border-slate-900 opacity-60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">
                        {member.full_name}
                      </span>
                      {renderRoleBadge(member.role)}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                        PIN: {member.pin || '1234'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-3">
                      <span>{member.email}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Added {member.created_at ? new Date(member.created_at).toLocaleDateString() : 'Recently'}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Active/Inactive Toggle */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(member)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        member.is_active
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                          : 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                      }`}
                      title="Toggle Active / Inactive status"
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{member.is_active ? 'Active' : 'Inactive'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
