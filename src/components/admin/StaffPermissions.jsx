import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Phone,
  Pencil,
  Trash2,
  Check,
  X,
  Search,
  Filter,
  Sparkles,
  RefreshCw,
  Copy,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Eye,
  EyeOff,
  Truck,
  PackageX,
  FileSpreadsheet,
  Receipt,
  BarChart3,
  Settings,
  Layers,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import {
  fetchStaffMembers,
  upsertStaffMember,
  deleteStaffMember,
  initialStaffMembers,
  supabase,
  isSupabaseConfigured
} from '../../lib/supabase';

export const SYSTEM_MODULES = [
  {
    id: 'delivery',
    nameEn: 'Delivery & Dispatch',
    nameHi: 'डिलीवरी एवं डिस्पैच',
    icon: Truck,
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    activeBg: 'bg-emerald-600',
    dotColor: 'bg-emerald-400',
    description: 'Driver route dispatch, live fleet radar, and doorstep cash/delivery proof.'
  },
  {
    id: 'damage',
    nameEn: 'Damage & Returns Hub',
    nameHi: 'डैमेज एवं एक्सपायरी वापसी',
    icon: PackageX,
    badgeColor: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    activeBg: 'bg-rose-600',
    dotColor: 'bg-rose-400',
    description: 'Dual-photo OCR, Godown racks, and FMCG distributor return credit notes.'
  },
  {
    id: 'purchase',
    nameEn: 'Purchase & Inward',
    nameHi: 'खरीद एवं इनवर्ड एंट्री',
    icon: FileSpreadsheet,
    badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    activeBg: 'bg-amber-600',
    dotColor: 'bg-amber-400',
    description: 'Groq Vision bill scanner, vendor inwards, GST computation.'
  },
  {
    id: 'sales',
    nameEn: 'Sales & Billing',
    nameHi: 'बिक्री एवं बिलिंग काउंटर',
    icon: Receipt,
    badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    activeBg: 'bg-blue-600',
    dotColor: 'bg-blue-400',
    description: 'Counter POS, thermal bills, customer bottle deposit adjustments.'
  },
  {
    id: 'analytics',
    nameEn: 'Analytics & Settings',
    nameHi: 'एनालिटिक्स एवं सेटिंग्स',
    icon: BarChart3,
    badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    activeBg: 'bg-purple-600',
    dotColor: 'bg-purple-400',
    description: 'Store revenue metrics, driver turnaround time audits, geofence rules.'
  }
];

const PRESET_ROLES = [
  'Operations Lead',
  'Store Manager',
  'Quality Auditor',
  'Dispatch Associate',
  'Delivery Rider',
  'Inventory Clerk',
  'Counter Cashier',
  'Custom Role'
];

export default function StaffPermissions({ onBackToHub } = {}) {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'saving' | 'error'

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');

  // PIN Visibility toggles (staffId -> boolean)
  const [visiblePins, setVisiblePins] = useState({});

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formRole, setFormRole] = useState('Dispatch Associate');
  const [customRole, setCustomRole] = useState('');
  const [formAllowed, setFormAllowed] = useState(['delivery']);
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  // Feedback Notification
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Load Staff Members
  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchStaffMembers();
      setStaffList(data || initialStaffMembers);
      setSyncStatus('synced');
    } catch (err) {
      console.warn('Failed loading staff members:', err);
      setSyncStatus('error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();

    // Supabase Realtime channel subscription
    let channel = null;
    if (isSupabaseConfigured && supabase) {
      try {
        channel = supabase
          .channel('staff-permissions-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'staff' },
            () => {
              loadStaff();
            }
          )
          .subscribe();
      } catch (e) {
        console.warn('Realtime subscription notice for staff table:', e);
      }
    }

    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [loadStaff]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingStaff(null);
    setFormName('');
    setFormPhone('');
    setFormPin('');
    setFormRole('Dispatch Associate');
    setCustomRole('');
    setFormAllowed(['delivery']);
    setFormError('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (staff) => {
    setEditingStaff(staff);
    setFormName(staff.name || '');
    setFormPhone(staff.phone || staff.mobile || '');
    setFormPin(staff.pin || '');
    if (PRESET_ROLES.includes(staff.role)) {
      setFormRole(staff.role);
      setCustomRole('');
    } else {
      setFormRole('Custom Role');
      setCustomRole(staff.role || '');
    }
    setFormAllowed(Array.isArray(staff.allowed_modules) ? staff.allowed_modules : ['delivery']);
    setFormError('');
    setIsModalOpen(true);
  };

  // Toggle Module in Form
  const handleToggleModuleInForm = (moduleId) => {
    setFormAllowed((prev) => {
      if (prev.includes(moduleId)) {
        if (prev.length === 1) {
          setFormError('Staff must have at least one allowed module / कम से कम एक मॉड्यूल चुनना अनिवार्य है');
          return prev;
        }
        setFormError('');
        return prev.filter((m) => m !== moduleId);
      } else {
        setFormError('');
        return [...prev, moduleId];
      }
    });
  };

  // 1-Click Toggle Directly on Staff Card
  const handleQuickToggleModule = async (staff, moduleId) => {
    const currentAllowed = Array.isArray(staff.allowed_modules) ? staff.allowed_modules : ['delivery'];
    let nextAllowed;

    if (currentAllowed.includes(moduleId)) {
      if (currentAllowed.length === 1) {
        showToast('⚠️ Staff must have at least one permitted module!');
        return;
      }
      nextAllowed = currentAllowed.filter((m) => m !== moduleId);
    } else {
      nextAllowed = [...currentAllowed, moduleId];
    }

    const updated = {
      ...staff,
      allowed_modules: nextAllowed
    };

    setStaffList((prev) => prev.map((s) => (s.id === staff.id ? updated : s)));
    setSyncStatus('saving');

    try {
      await upsertStaffMember(updated);
      setSyncStatus('synced');
      showToast(`Updated permissions for ${staff.name}`);
    } catch (err) {
      console.error('Failed to update permission:', err);
      setSyncStatus('error');
      loadStaff();
    }
  };

  // Save Staff (Add or Edit)
  const handleSaveStaff = async (e) => {
    e.preventDefault();
    setFormError('');

    const cleanName = formName.trim();
    const cleanPhone = formPhone.replace(/\D/g, '');
    const cleanPin = formPin.trim();
    const finalRole = formRole === 'Custom Role' ? (customRole.trim() || 'Staff') : formRole;

    if (!cleanName) {
      setFormError('Staff Name is required / नाम भरना आवश्यक है');
      return;
    }
    if (cleanPhone.length < 10) {
      setFormError('Valid 10-digit mobile number is required / 10 अंकों का मोबाइल नंबर भरें');
      return;
    }
    if (cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
      setFormError('4-Digit Security PIN is required (numbers only) / 4 अंकों का पिन भरें');
      return;
    }
    if (formAllowed.length === 0) {
      setFormError('Select at least one permitted module / कम से कम 1 मॉड्यूल अनुमति दें');
      return;
    }

    // Check duplicate phone
    const duplicate = staffList.find(
      (s) =>
        s.id !== editingStaff?.id &&
        (s.phone || s.mobile || '').replace(/\D/g, '') === cleanPhone
    );
    if (duplicate) {
      setFormError(`Mobile number already assigned to ${duplicate.name}`);
      return;
    }

    setFormSaving(true);
    setSyncStatus('saving');

    const memberPayload = {
      id: editingStaff?.id || `staff-${Date.now()}`,
      name: cleanName,
      phone: cleanPhone,
      mobile: cleanPhone,
      pin: cleanPin,
      role: finalRole,
      allowed_modules: formAllowed
    };

    try {
      await upsertStaffMember(memberPayload);
      setStaffList((prev) => {
        const idx = prev.findIndex((s) => s.id === memberPayload.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = memberPayload;
          return next;
        }
        return [memberPayload, ...prev];
      });
      setIsModalOpen(false);
      setSyncStatus('synced');
      showToast(editingStaff ? `Updated ${cleanName}` : `Added ${cleanName} to staff roster`);
    } catch (err) {
      setFormError(err.message || 'Failed saving staff member');
      setSyncStatus('error');
    } finally {
      setFormSaving(false);
    }
  };

  // Delete Staff Member
  const handleDeleteStaff = async (staffId) => {
    setSyncStatus('saving');
    try {
      await deleteStaffMember(staffId);
      setStaffList((prev) => prev.filter((s) => s.id !== staffId));
      setDeleteConfirmId(null);
      setSyncStatus('synced');
      showToast('Staff member removed successfully');
    } catch (err) {
      console.error('Delete staff failed:', err);
      setSyncStatus('error');
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Toggle PIN visibility for specific card
  const togglePinVisibility = (staffId) => {
    setVisiblePins((prev) => ({
      ...prev,
      [staffId]: !prev[staffId]
    }));
  };

  // Copy PIN helper
  const handleCopyPin = (pin, staffName) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(pin);
      showToast(`Copied PIN (${pin}) for ${staffName}`);
    }
  };

  // Filtered List
  const filteredStaff = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return staffList.filter((s) => {
      const matchesQuery =
        !q ||
        (s.name || '').toLowerCase().includes(q) ||
        (s.phone || s.mobile || '').includes(q) ||
        (s.role || '').toLowerCase().includes(q);

      const matchesModule =
        moduleFilter === 'all' ||
        (Array.isArray(s.allowed_modules) && s.allowed_modules.includes(moduleFilter));

      return matchesQuery && matchesModule;
    });
  }, [staffList, searchQuery, moduleFilter]);

  return (
    <div className="w-full space-y-6 animate-fade-in pb-12">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-white px-4 py-2.5 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER & ACTION RIBBON */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Staff & Roles Management
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                स्टाफ एवं अनुमतियाँ
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : syncStatus === 'saving'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20 animate-pulse'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    syncStatus === 'synced'
                      ? 'bg-emerald-400'
                      : syncStatus === 'saving'
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                />
                <span>{syncStatus === 'synced' ? 'Cloud Synced' : syncStatus === 'saving' ? 'Saving...' : 'Offline'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Grant granular access to Delivery, Damage/Expiry, Purchase OCR & Billing. Staff login at <strong className="text-slate-300">/staff</strong> with 4-digit PIN.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          {onBackToHub && (
            <button
              type="button"
              onClick={onBackToHub}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              title="Return to Admin Hub"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>← Hub</span>
            </button>
          )}

          {/* Test Staff Login */}
          <a
            href="/staff"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            title="Open /staff login screen in a new tab"
          >
            <span>Test Staff Login</span>
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
          </a>

          {/* Add Staff Button */}
          <button
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 transition active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Staff Member</span>
          </button>

          {/* Refresh */}
          <button
            onClick={loadStaff}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition disabled:opacity-50"
            title="Refresh staff roster"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Staff / कुल कर्मचारी
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-cyan-400">
              {staffList.length}
            </span>
            <span className="text-xs text-slate-400">Active</span>
          </div>
          <p className="text-[10px] text-slate-500">Registered staff profiles</p>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Delivery Access / डिलीवरी
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-400">
              {staffList.filter((s) => (s.allowed_modules || []).includes('delivery')).length}
            </span>
            <span className="text-xs text-emerald-400 font-semibold">Drivers / Leads</span>
          </div>
          <p className="text-[10px] text-slate-500">Can view & dispatch deliveries</p>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Damage Hub Access / डैमेज
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-400">
              {staffList.filter((s) => (s.allowed_modules || []).includes('damage')).length}
            </span>
            <span className="text-xs text-rose-400 font-semibold">Auditors</span>
          </div>
          <p className="text-[10px] text-slate-500">Can log breakages & claim slips</p>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Purchase OCR Access / खरीद
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-400">
              {staffList.filter((s) => (s.allowed_modules || []).includes('purchase')).length}
            </span>
            <span className="text-xs text-amber-400 font-semibold">Inward Clerk</span>
          </div>
          <p className="text-[10px] text-slate-500">Can scan bills with Groq AI</p>
        </div>
      </div>

      {/* SEARCH AND MODULE FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff by name, mobile, or role..."
            className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <button
            onClick={() => setModuleFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              moduleFilter === 'all'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All Modules ({staffList.length})
          </button>
          {SYSTEM_MODULES.map((mod) => (
            <button
              key={mod.id}
              onClick={() => setModuleFilter(mod.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 ${
                moduleFilter === mod.id
                  ? 'bg-slate-700 text-white border border-slate-600 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <mod.icon className="w-3.5 h-3.5 shrink-0" />
              <span>{mod.nameEn.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* STAFF CARDS GRID */}
      {filteredStaff.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
          <Users className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-white font-bold text-base">No staff members found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery || moduleFilter !== 'all'
              ? 'Try adjusting your search query or module filters above.'
              : 'Click "+ Add Staff Member" to set up your team login PINs and permissions.'}
          </p>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
          >
            + Add Staff Member Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((staff) => {
            const isPinVisible = Boolean(visiblePins[staff.id]);
            const allowed = Array.isArray(staff.allowed_modules) ? staff.allowed_modules : ['delivery'];

            return (
              <div
                key={staff.id}
                className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 shadow-xl transition-all flex flex-col justify-between space-y-4 group"
              >
                {/* Card Top: Avatar, Name & Role */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-600/30 to-slate-800 border border-cyan-500/30 text-cyan-300 font-black text-base flex items-center justify-center shadow-inner shrink-0">
                        {staff.name ? staff.name.charAt(0).toUpperCase() : 'S'}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-white text-sm sm:text-base leading-snug">
                          {staff.name}
                        </h3>
                        <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 border border-slate-700">
                          {staff.role || 'Staff Member'}
                        </span>
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(staff)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        title="Edit profile & permissions"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(staff.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="Delete staff member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Contact Info & 4-Digit Security PIN */}
                  <div className="mt-3.5 p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                    {/* Mobile Phone */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>Mobile:</span>
                      </span>
                      <a
                        href={`tel:${staff.phone || staff.mobile}`}
                        className="font-mono font-bold text-slate-200 hover:text-cyan-400 transition"
                      >
                        {staff.phone || staff.mobile || '—'}
                      </a>
                    </div>

                    {/* 4-Digit PIN */}
                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800/60">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                        <span>Login PIN:</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-amber-300 tracking-widest text-sm bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                          {isPinVisible ? staff.pin || '••••' : '••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePinVisibility(staff.id)}
                          className="p-1 text-slate-400 hover:text-slate-200 rounded transition"
                          title={isPinVisible ? 'Hide PIN' : 'Reveal PIN'}
                        >
                          {isPinVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyPin(staff.pin, staff.name)}
                          className="p-1 text-slate-400 hover:text-cyan-400 rounded transition"
                          title="Copy PIN"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Permitted Modules Section with 1-Click Toggle Controls */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Module Permissions ({allowed.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-500">Click to toggle</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {SYSTEM_MODULES.map((mod) => {
                      const isGranted = allowed.includes(mod.id);
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => handleQuickToggleModule(staff, mod.id)}
                          className={`p-2 rounded-xl text-left border transition-all flex items-center justify-between gap-1.5 ${
                            isGranted
                              ? `${mod.badgeColor} shadow-sm`
                              : 'bg-slate-950/40 border-slate-800/60 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                          }`}
                          title={`${isGranted ? 'Revoke' : 'Grant'} access to ${mod.nameEn}`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <mod.icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[11px] font-bold truncate">
                              {mod.nameEn.split(' ')[0]}
                            </span>
                          </div>
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isGranted ? mod.dotColor : 'bg-slate-700'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT STAFF MEMBER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
                  {editingStaff ? <Pencil className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    {editingStaff ? `Edit Staff: ${editingStaff.name}` : 'Add New Staff Member'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    स्टाफ विवरण एवं अनुमतियाँ सेट करें
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveStaff} className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
              {formError && (
                <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Staff Name / नाम <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Ramesh Sharma"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Mobile Number / मोबाइल <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="9876543210"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs sm:text-sm font-mono"
                  />
                </div>
              </div>

              {/* Role & 4-Digit Security PIN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Role / पद <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 text-xs sm:text-sm"
                  >
                    {PRESET_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    4-Digit Login PIN / 4 अंकों का पिन <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={4}
                      value={formPin}
                      onChange={(e) => setFormPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="1234"
                      required
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-amber-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs sm:text-sm font-mono font-bold tracking-widest"
                    />
                    <KeyRound className="w-4 h-4 text-amber-400 absolute left-3 top-3 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Custom Role Input if selected */}
              {formRole === 'Custom Role' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Specify Custom Title / विशेष पद
                  </label>
                  <input
                    type="text"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    placeholder="e.g. Head of Warehouse Logistics"
                    className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs sm:text-sm"
                  />
                </div>
              )}

              {/* Granular Module Permissions */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-white uppercase tracking-wider">
                    Permitted Modules / अधिकृत मॉड्यूल
                  </label>
                  <span className="text-[11px] text-cyan-400 font-semibold">
                    {formAllowed.length} selected
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Select which workspaces this staff member can access upon login:
                </p>

                <div className="space-y-2 pt-1">
                  {SYSTEM_MODULES.map((mod) => {
                    const isChecked = formAllowed.includes(mod.id);
                    return (
                      <div
                        key={mod.id}
                        onClick={() => handleToggleModuleInForm(mod.id)}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                          isChecked
                            ? 'bg-slate-800/90 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                            : 'bg-slate-950/40 border-slate-800 text-slate-500 hover:border-slate-700'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition ${
                            isChecked
                              ? 'bg-cyan-600 border-cyan-500 text-white'
                              : 'border-slate-600 bg-slate-800'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <mod.icon className={`w-4 h-4 shrink-0 ${isChecked ? 'text-cyan-400' : 'text-slate-500'}`} />
                            <span className={`font-bold text-xs sm:text-sm ${isChecked ? 'text-white' : 'text-slate-400'}`}>
                              {mod.nameEn}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              ({mod.nameHi})
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                            {mod.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel / रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {formSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Staff...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save Staff Member / सुरक्षित करें</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">
                  Remove Staff Member?
                </h3>
                <p className="text-xs text-slate-400">
                  स्टाफ सदस्य को हटाएं
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
              Are you sure you want to remove this staff member? They will immediately lose login access to all assigned modules.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteStaff(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30"
              >
                Yes, Remove Staff
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
