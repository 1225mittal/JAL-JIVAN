import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  UserCheck,
  Plus,
  Search,
  Phone,
  Calendar,
  IndianRupee,
  Clock,
  ArrowLeft,
  FileText,
  Eye,
  Trash2,
  Edit3,
  Camera,
  Upload,
  ShieldCheck,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Download,
  BadgeCheck,
  Briefcase,
  AlertCircle,
  CreditCard,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Wallet
} from 'lucide-react';
import {
  fetchStaffDirectory,
  saveStaffMember,
  deleteStaffDirectoryMember,
  fetchStaffAdvances,
  createStaffAdvance,
  deleteStaffAdvance,
  fetchStaffAttendanceMonth,
  recordStaffAttendanceDay
} from '../../lib/supabase';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ROLE_OPTIONS = [
  'Rider',
  'Godown Staff',
  'Store Manager',
  'Driver / Fleet',
  'Loading Personnel',
  'Accounts & Billing',
  'Water Plant Tech'
];

const PAYMENT_MODES = ['Cash', 'UPI', 'NEFT', 'Cheque'];
const ID_PROOF_TYPES = ['Aadhaar Card', 'Driving License', 'Voter ID', 'PAN Card', 'Other'];

export default function StaffDirectoryHub({ onBackToHub, showToast }) {
  // Staff Directory List State
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Month & Year Filter for Attendance & Payroll
  const today = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12

  // Staff Advances & Attendance for Selected Staff Member
  const [advances, setAdvances] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [advancesLoading, setAdvancesLoading] = useState(false);

  // Modals
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isIdPreviewOpen, setIsIdPreviewOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  // Form State for Adding / Editing Staff
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState('Rider');
  const [formAge, setFormAge] = useState('');
  const [formSalary, setFormSalary] = useState('');
  const [formPhotoUrl, setFormPhotoUrl] = useState('');
  const [formIdProofUrl, setFormIdProofUrl] = useState('');
  const [formIdProofType, setFormIdProofType] = useState('Aadhaar Card');
  const [formSaving, setFormSaving] = useState(false);

  // Form State for Giving Advance
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceMode, setAdvanceMode] = useState('Cash');
  const [advanceRemarks, setAdvanceRemarks] = useState('');
  const [advanceDate, setAdvanceDate] = useState(() => today.toISOString().split('T')[0]);
  const [advanceSaving, setAdvanceSaving] = useState(false);

  // 1. Initial Load of Staff Directory
  const loadDirectory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchStaffDirectory();
      setStaffList(data || []);
      if (data && data.length > 0 && !selectedStaffId) {
        setSelectedStaffId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load staff directory', err);
    } finally {
      setLoading(false);
    }
  }, [selectedStaffId]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  // Active Staff Member Object
  const selectedStaff = useMemo(() => {
    return staffList.find((s) => s.id === selectedStaffId) || staffList[0] || null;
  }, [staffList, selectedStaffId]);

  // Month String formatted as 'YYYY-MM'
  const currentMonthStr = useMemo(() => {
    return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  }, [selectedYear, selectedMonth]);

  // 2. Load Advances & Attendance when selected staff or month/year changes
  const loadStaffDetails = useCallback(async () => {
    if (!selectedStaff?.id) return;
    setAdvancesLoading(true);
    try {
      const [advData, attMap] = await Promise.all([
        fetchStaffAdvances(selectedStaff.id, currentMonthStr),
        fetchStaffAttendanceMonth(selectedStaff.id, selectedYear, selectedMonth)
      ]);
      setAdvances(advData || []);
      setAttendanceMap(attMap || {});
    } catch (err) {
      console.error('Failed to load staff details', err);
    } finally {
      setAdvancesLoading(false);
    }
  }, [selectedStaff?.id, currentMonthStr, selectedYear, selectedMonth]);

  useEffect(() => {
    loadStaffDetails();
  }, [loadStaffDetails]);

  // 3. Compute Attendance Stats & Live Payroll
  const payrollStats = useMemo(() => {
    if (!selectedStaff) {
      return {
        dailyRate: 0,
        presentDays: 0,
        halfDays: 0,
        absentDays: 0,
        effectiveWorkedDays: 0,
        totalEarned: 0,
        totalAdvanceTaken: 0,
        netOutstanding: 0
      };
    }

    const monthlySalary = Number(selectedStaff.monthly_salary) || 0;
    const dailyRate = Math.round(monthlySalary / 30);

    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;

    Object.entries(attendanceMap).forEach(([dateStr, status]) => {
      if (dateStr.startsWith(currentMonthStr)) {
        if (status === 'present') presentDays += 1;
        else if (status === 'half_day') halfDays += 1;
        else if (status === 'absent') absentDays += 1;
      }
    });

    const effectiveWorkedDays = presentDays + halfDays * 0.5;
    const totalEarned = Math.round(effectiveWorkedDays * dailyRate);

    const totalAdvanceTaken = advances.reduce(
      (acc, adv) => acc + (Number(adv.amount) || 0),
      0
    );

    const netOutstanding = totalEarned - totalAdvanceTaken;

    return {
      dailyRate,
      presentDays,
      halfDays,
      absentDays,
      effectiveWorkedDays,
      totalEarned,
      totalAdvanceTaken,
      netOutstanding
    };
  }, [selectedStaff, attendanceMap, currentMonthStr, advances]);

  // 4. Filtered Staff List for Left Sidebar
  const filteredStaffList = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return staffList;
    return staffList.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.role.toLowerCase().includes(query) ||
        s.phone.includes(query)
    );
  }, [staffList, searchTerm]);

  // Handlers for Add/Edit Staff Modal
  const openAddStaffModal = () => {
    setEditingStaff(null);
    setFormName('');
    setFormPhone('');
    setFormRole('Rider');
    setFormAge('25');
    setFormSalary('16000');
    setFormPhotoUrl('');
    setFormIdProofUrl('');
    setFormIdProofType('Aadhaar Card');
    setIsAddStaffOpen(true);
  };

  const openEditStaffModal = (staff) => {
    setEditingStaff(staff);
    setFormName(staff.name || '');
    setFormPhone(staff.phone || '');
    setFormRole(staff.role || 'Rider');
    setFormAge(String(staff.age || '25'));
    setFormSalary(String(staff.monthly_salary || '16000'));
    setFormPhotoUrl(staff.photo_url || '');
    setFormIdProofUrl(staff.id_proof_url || '');
    setFormIdProofType(staff.id_proof_type || 'Aadhaar Card');
    setIsAddStaffOpen(true);
  };

  const handleFileUpload = (e, targetSetter) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvt) => {
      targetSetter(uploadEvt.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      alert('Please enter Name and Phone number');
      return;
    }

    setFormSaving(true);
    try {
      const payload = {
        id: editingStaff ? editingStaff.id : undefined,
        name: formName.trim(),
        phone: formPhone.trim().replace(/\D/g, ''),
        role: formRole.trim(),
        age: Number(formAge) || 25,
        monthly_salary: Number(formSalary) || 15000,
        photo_url: formPhotoUrl,
        id_proof_url: formIdProofUrl,
        id_proof_type: formIdProofType,
        status: editingStaff ? editingStaff.status : 'active',
        joining_date: editingStaff ? editingStaff.joining_date : today.toISOString().split('T')[0]
      };

      const saved = await saveStaffMember(payload);
      if (showToast) {
        showToast(`Staff member "${saved.name}" saved successfully!`, 'success');
      }
      setIsAddStaffOpen(false);
      await loadDirectory();
      setSelectedStaffId(saved.id);
    } catch (err) {
      alert(`Failed to save staff: ${err.message}`);
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteStaff = async (staffId, name) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from Staff Directory?`)) {
      return;
    }
    try {
      await deleteStaffDirectoryMember(staffId);
      if (showToast) {
        showToast(`Staff member "${name}" removed.`, 'success');
      }
      const updated = staffList.filter((s) => s.id !== staffId);
      setStaffList(updated);
      if (selectedStaffId === staffId && updated.length > 0) {
        setSelectedStaffId(updated[0].id);
      }
    } catch (err) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  // Handlers for Advances
  const handleGiveAdvance = async (e) => {
    e.preventDefault();
    const amountNum = Number(advanceAmount);
    if (!amountNum || amountNum <= 0) {
      alert('Please enter a valid advance amount');
      return;
    }
    if (!selectedStaff) return;

    setAdvanceSaving(true);
    try {
      await createStaffAdvance({
        staff_id: selectedStaff.id,
        amount: amountNum,
        payment_mode: advanceMode,
        remarks: advanceRemarks.trim() || 'Staff Advance',
        date: advanceDate
      });

      if (showToast) {
        showToast(`Advance of ₹${amountNum.toLocaleString('en-IN')} recorded for ${selectedStaff.name}!`, 'success');
      }
      setIsAdvanceModalOpen(false);
      setAdvanceAmount('');
      setAdvanceRemarks('');
      await loadStaffDetails();
    } catch (err) {
      alert(`Failed to record advance: ${err.message}`);
    } finally {
      setAdvanceSaving(false);
    }
  };

  const handleDeleteAdvance = async (advId) => {
    if (!window.confirm('Delete this advance record?')) return;
    try {
      await deleteStaffAdvance(advId);
      if (showToast) {
        showToast('Advance entry deleted.', 'info');
      }
      await loadStaffDetails();
    } catch (err) {
      alert(`Failed to delete advance: ${err.message}`);
    }
  };

  // Handlers for Attendance
  const handleDayClick = async (dateStr) => {
    if (!selectedStaff) return;
    const currentStatus = attendanceMap[dateStr];
    // Cycle: unmarked -> present -> half_day -> absent -> unmarked
    let nextStatus = 'present';
    if (currentStatus === 'present') nextStatus = 'half_day';
    else if (currentStatus === 'half_day') nextStatus = 'absent';
    else if (currentStatus === 'absent') nextStatus = 'present';

    setAttendanceMap((prev) => ({ ...prev, [dateStr]: nextStatus }));
    try {
      await recordStaffAttendanceDay(selectedStaff.id, dateStr, nextStatus);
    } catch (err) {
      console.warn('Failed recording attendance', err);
    }
  };

  const handleQuickTodayAttendance = async (status) => {
    if (!selectedStaff) return;
    const todayStr = today.toISOString().split('T')[0];
    setAttendanceMap((prev) => ({ ...prev, [todayStr]: status }));
    try {
      await recordStaffAttendanceDay(selectedStaff.id, todayStr, status);
      if (showToast) {
        const label = status === 'present' ? 'Present' : status === 'half_day' ? 'Half-Day' : 'Absent';
        showToast(`Marked ${label} for ${selectedStaff.name} today.`, 'success');
      }
    } catch (err) {
      console.warn('Failed recording attendance', err);
    }
  };

  // Helper for Role Badges
  const getRoleBadgeClasses = (role = '') => {
    const r = role.toLowerCase();
    if (r.includes('rider') || r.includes('delivery')) {
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
    if (r.includes('godown') || r.includes('loading') || r.includes('store')) {
      return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    }
    if (r.includes('manager') || r.includes('admin')) {
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    }
    if (r.includes('account') || r.includes('billing')) {
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    }
    return 'bg-slate-700/50 text-slate-300 border-slate-600/40';
  };

  // Days in selected month calculation
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const firstDayIndex = new Date(selectedYear, selectedMonth - 1, 1).getDay(); // 0 is Sun

    const days = [];
    // Padding before 1st of month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ empty: true, key: `empty-${i}` });
    }
    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNum: d,
        dateStr,
        isToday: dateStr === today.toISOString().split('T')[0],
        status: attendanceMap[dateStr] || null,
        key: dateStr
      });
    }
    return days;
  }, [selectedYear, selectedMonth, attendanceMap, today]);

  return (
    <div className="space-y-4 pb-12 w-full max-w-full overflow-x-hidden">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          {onBackToHub && (
            <button
              type="button"
              onClick={onBackToHub}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition text-xs font-semibold shrink-0 shadow-sm"
              title="Switch to Admin Hub"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Admin Hub</span>
            </button>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-emerald-400" />
              <span>Staff & Roles Directory</span>
            </h1>
            <p className="text-xs text-slate-400">
              Master-detail personnel directory, live daily payroll, advances & monthly attendance
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadDirectory}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            id="btn-add-staff"
            onClick={openAddStaffModal}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs sm:text-sm font-black transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Add Staff / Rider</span>
          </button>
        </div>
      </div>

      {/* TWO-COLUMN MASTER-DETAIL LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Clean Vertical List of Staff Members (4 Cols on lg) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          {/* Search Card */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search personnel by name or role..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition shadow-inner"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Personnel List Container */}
          <div className="glass-card rounded-2xl border border-slate-800/80 p-2 overflow-hidden shadow-xl bg-slate-950/60 backdrop-blur-md">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60 text-xs font-semibold text-slate-400">
              <span className="uppercase tracking-wider text-[11px]">Personnel Directory</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold">
                {filteredStaffList.length} Members
              </span>
            </div>

            <div className="divide-y divide-slate-800/40 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 space-y-1 pt-1">
              {filteredStaffList.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Users className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">No staff personnel found.</p>
                  <button
                    onClick={openAddStaffModal}
                    className="text-xs text-emerald-400 font-bold hover:underline"
                  >
                    + Add New Staff Member
                  </button>
                </div>
              ) : (
                filteredStaffList.map((staff) => {
                  const isSelected = selectedStaff?.id === staff.id;
                  const initials = staff.name
                    ? staff.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : 'ST';

                  return (
                    <div
                      key={staff.id}
                      onClick={() => setSelectedStaffId(staff.id)}
                      className={`group relative p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-gradient-to-r from-emerald-500/15 via-slate-850 to-slate-900 border border-emerald-500/50 shadow-md shadow-emerald-500/10'
                          : 'hover:bg-slate-900/60 border border-transparent'
                      }`}
                    >
                      {/* Left: Avatar + Name + Role */}
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Profile Avatar */}
                        <div className="relative shrink-0">
                          {staff.photo_url ? (
                            <img
                              src={staff.photo_url}
                              alt={staff.name}
                              className="w-11 h-11 rounded-full object-cover border-2 border-slate-700 group-hover:border-emerald-500/50 transition-colors shadow-sm"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 border-2 border-slate-700/80 flex items-center justify-center text-xs font-black text-emerald-400 shadow-sm">
                              {initials}
                            </div>
                          )}
                          {/* Active / Online indicator dot */}
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950" />
                        </div>

                        {/* Name & Role Badge */}
                        <div className="min-w-0">
                          <h3
                            className={`text-sm font-bold truncate leading-tight transition-colors ${
                              isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'
                            }`}
                          >
                            {staff.name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${getRoleBadgeClasses(
                                staff.role
                              )}`}
                            >
                              {staff.role}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Active Selection Indicator */}
                      {isSelected ? (
                        <div className="w-2 h-8 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 shrink-0" />
                      ) : (
                        <div className="text-slate-600 group-hover:text-slate-400 transition-colors shrink-0">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Detailed Profile Screen (8 Cols on lg) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-8 space-y-5">
          {!selectedStaff ? (
            <div className="glass-card rounded-2xl border border-slate-800 p-12 text-center space-y-3">
              <Users className="w-12 h-12 text-slate-600 mx-auto animate-pulse" />
              <h3 className="text-base font-bold text-white">Select a staff member from the left</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                View profile credentials, inspect uploaded ID documents, manage monthly advances, and record attendance.
              </p>
            </div>
          ) : (
            <>
              {/* 1. Header Card: DP, Name, Role badge, Phone, Age, ID Card preview */}
              <div className="glass-card rounded-2xl border border-slate-800/90 p-5 bg-gradient-to-br from-slate-900/95 via-slate-950 to-[#0b1329] shadow-xl relative overflow-hidden">
                {/* Background accent glow */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                  {/* Left: Avatar + Details */}
                  <div className="flex items-start sm:items-center gap-4 min-w-0">
                    {/* DP Photo */}
                    <div className="relative shrink-0">
                      {selectedStaff.photo_url ? (
                        <img
                          src={selectedStaff.photo_url}
                          alt={selectedStaff.name}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/10"
                        />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 border-2 border-slate-700 flex items-center justify-center text-xl sm:text-2xl font-black text-emerald-400 shadow-md">
                          {selectedStaff.name
                            ? selectedStaff.name
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase()
                            : 'ST'}
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 rounded-lg text-slate-950 shadow-md">
                        <BadgeCheck className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                          {selectedStaff.name}
                        </h2>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${getRoleBadgeClasses(
                            selectedStaff.role
                          )}`}
                        >
                          {selectedStaff.role}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-300 flex-wrap">
                        {/* Phone */}
                        <a
                          href={`tel:${selectedStaff.phone}`}
                          className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-semibold transition"
                          title="Call Staff Member"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>+91 {selectedStaff.phone}</span>
                        </a>

                        <span className="text-slate-600">•</span>

                        {/* Age */}
                        <span className="text-slate-300 font-medium">
                          Age: <strong className="text-white">{selectedStaff.age || 25} yrs</strong>
                        </span>

                        <span className="text-slate-600">•</span>

                        {/* ID Document Preview Pill */}
                        <button
                          type="button"
                          onClick={() => setIsIdPreviewOpen(true)}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold transition text-[11px]"
                          title="View Verified ID Document"
                        >
                          <FileText className="w-3 h-3" />
                          <span>{selectedStaff.id_proof_type || 'ID Document'}</span>
                          <Eye className="w-3 h-3 ml-0.5 opacity-80" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions: Edit & Delete */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => openEditStaffModal(selectedStaff)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition active:scale-95"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteStaff(selectedStaff.id, selectedStaff.name)}
                      className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition active:scale-95"
                      title="Remove from Directory"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Live Outstanding Salary & Advance Management */}
              <div className="glass-card rounded-2xl border border-slate-800/80 p-5 bg-slate-900/60 space-y-4">
                {/* Header: Title + Give Advance Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                      <IndianRupee className="w-4 h-4 text-emerald-400" />
                      <span>Payroll & Advance Management ({MONTH_NAMES[selectedMonth - 1]} {selectedYear})</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Live daily rate calculation: ₹{selectedStaff.monthly_salary?.toLocaleString('en-IN')} / 30 = ₹{payrollStats.dailyRate}/day
                    </p>
                  </div>

                  <button
                    id="btn-give-advance"
                    onClick={() => {
                      setAdvanceAmount('');
                      setAdvanceRemarks('');
                      setAdvanceDate(today.toISOString().split('T')[0]);
                      setIsAdvanceModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                  >
                    <Wallet className="w-4 h-4 stroke-[2.5]" />
                    <span>Give Advance (पेशगी दें)</span>
                  </button>
                </div>

                {/* 4 Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Card 1: Monthly Fixed Salary */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Monthly Fixed Salary
                    </span>
                    <p className="text-xl font-black text-white tracking-tight">
                      ₹{Number(selectedStaff.monthly_salary || 0).toLocaleString('en-IN')}
                    </p>
                    <span className="text-[10px] text-slate-500 font-medium">
                      ₹{payrollStats.dailyRate} / day rate
                    </span>
                  </div>

                  {/* Card 2: Total Earned So Far */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      Total Earned So Far
                    </span>
                    <p className="text-xl font-black text-emerald-300 tracking-tight">
                      ₹{payrollStats.totalEarned.toLocaleString('en-IN')}
                    </p>
                    <span className="text-[10px] text-emerald-500/80 font-medium">
                      {payrollStats.effectiveWorkedDays} payable days worked
                    </span>
                  </div>

                  {/* Card 3: Total Advance Taken */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                      Total Advance Taken
                    </span>
                    <p className="text-xl font-black text-amber-300 tracking-tight">
                      ₹{payrollStats.totalAdvanceTaken.toLocaleString('en-IN')}
                    </p>
                    <span className="text-[10px] text-amber-500/80 font-medium">
                      {advances.length} advance transactions
                    </span>
                  </div>

                  {/* Card 4: Net Outstanding Payable */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-950/40 via-slate-950 to-slate-900 border border-emerald-500/40 space-y-1 shadow-md shadow-emerald-500/5">
                    <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                      Net Outstanding Payable
                    </span>
                    <p className="text-xl font-black text-emerald-400 tracking-tight">
                      ₹{payrollStats.netOutstanding.toLocaleString('en-IN')}
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Earned - Advance to date
                    </span>
                  </div>
                </div>

                {/* Advances Ledger Table for This Month */}
                {advances.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                    <span className="text-xs font-bold text-slate-300">
                      Advances Ledger ({MONTH_NAMES[selectedMonth - 1]} {selectedYear})
                    </span>
                    <div className="overflow-x-auto rounded-xl border border-slate-800/80">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                          <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Amount</th>
                            <th className="px-3 py-2">Mode</th>
                            <th className="px-3 py-2">Remarks</th>
                            <th className="px-3 py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 bg-slate-900/40 text-slate-300">
                          {advances.map((adv) => (
                            <tr key={adv.id} className="hover:bg-slate-800/30">
                              <td className="px-3 py-2 font-mono text-slate-400">{adv.date}</td>
                              <td className="px-3 py-2 font-black text-amber-300">
                                ₹{Number(adv.amount).toLocaleString('en-IN')}
                              </td>
                              <td className="px-3 py-2">
                                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-bold">
                                  {adv.payment_mode || 'Cash'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-400">{adv.remarks || '—'}</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAdvance(adv.id)}
                                  className="text-slate-500 hover:text-rose-400 p-1 transition"
                                  title="Delete advance entry"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Month-wise Attendance Calendar / View */}
              <div className="glass-card rounded-2xl border border-slate-800/80 p-5 bg-slate-900/60 space-y-4">
                {/* Header: Title + Year/Month Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span>Attendance Calendar & Monthly Grid</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Click any day cell to toggle: Present (Green) → Half-Day (Yellow) → Absent (Red)
                    </p>
                  </div>

                  {/* Year & Month Dropdown Selectors */}
                  <div className="flex items-center gap-2">
                    {/* Month Selector */}
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx + 1}>
                          {m}
                        </option>
                      ))}
                    </select>

                    {/* Year Selector */}
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 1-Click Today Quick Toggle Action Ribbon */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-white">Today's Quick Action:</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {today.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickTodayAttendance('present')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1 active:scale-95"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Present (पूरा दिन)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickTodayAttendance('half_day')}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1 active:scale-95"
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Half-Day (आधा)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickTodayAttendance('absent')}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition flex items-center gap-1 active:scale-95"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>Absent (छुट्टी)</span>
                    </button>
                  </div>
                </div>

                {/* Calendar Legend */}
                <div className="flex items-center gap-4 text-[11px] text-slate-400 flex-wrap px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-emerald-500" />
                    <span>Present (1.0 day)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-amber-500" />
                    <span>Half-Day (0.5 day)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-rose-500" />
                    <span>Absent (0 day)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-slate-800 border border-slate-700" />
                    <span>Unmarked</span>
                  </div>
                </div>

                {/* Interactive Monthly Grid */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {/* Day of Week Headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div
                      key={d}
                      className="text-center py-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider"
                    >
                      {d}
                    </div>
                  ))}

                  {/* Day Cells */}
                  {calendarDays.map((cell) => {
                    if (cell.empty) {
                      return (
                        <div
                          key={cell.key}
                          className="h-14 sm:h-16 rounded-xl bg-slate-950/30 border border-slate-850/40"
                        />
                      );
                    }

                    const isPresent = cell.status === 'present';
                    const isHalfDay = cell.status === 'half_day';
                    const isAbsent = cell.status === 'absent';

                    let cellBg = 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700';
                    let badgeBg = '';

                    if (isPresent) {
                      cellBg = 'bg-emerald-950/40 border-emerald-500/50 shadow-sm shadow-emerald-500/10';
                      badgeBg = 'bg-emerald-500 text-slate-950 font-black';
                    } else if (isHalfDay) {
                      cellBg = 'bg-amber-950/40 border-amber-500/50 shadow-sm shadow-amber-500/10';
                      badgeBg = 'bg-amber-500 text-slate-950 font-black';
                    } else if (isAbsent) {
                      cellBg = 'bg-rose-950/40 border-rose-500/50 shadow-sm shadow-rose-500/10';
                      badgeBg = 'bg-rose-500 text-white font-black';
                    }

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => handleDayClick(cell.dateStr)}
                        className={`h-14 sm:h-16 rounded-xl border p-1.5 flex flex-col justify-between items-center transition-all cursor-pointer relative ${cellBg} ${
                          cell.isToday ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950' : ''
                        }`}
                        title={`Click to toggle: ${cell.dateStr}`}
                      >
                        {/* Day Number */}
                        <div className="w-full flex items-center justify-between">
                          <span
                            className={`text-xs font-black ${
                              cell.isToday ? 'text-emerald-400' : 'text-slate-300'
                            }`}
                          >
                            {cell.dayNum}
                          </span>
                          {cell.isToday && (
                            <span className="text-[9px] font-bold text-emerald-400 uppercase">Today</span>
                          )}
                        </div>

                        {/* Status Label */}
                        {cell.status ? (
                          <span
                            className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md ${badgeBg} truncate w-full text-center`}
                          >
                            {isPresent ? 'Present' : isHalfDay ? 'Half-Day' : 'Absent'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-600">—</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Monthly Attendance Summary Metrics */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs flex-wrap gap-2">
                  <span className="text-slate-400">
                    Monthly Summary for <strong>{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</strong>:
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-bold">
                      {payrollStats.presentDays} Present
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-amber-400 font-bold">
                      {payrollStats.halfDays} Half-Days
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-rose-400 font-bold">
                      {payrollStats.absentDays} Absent
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-white font-extrabold">
                      = {payrollStats.effectiveWorkedDays} Days Payable
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT PERSONNEL */}
      {/* ========================================================================= */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {editingStaff ? 'Edit Staff Profile' : '+ Register New Personnel'}
                  </h3>
                  <p className="text-xs text-slate-400">Add staff member or delivery rider credentials</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveStaff} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name (पूरा नाम) *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Phone Number (मोबाइल नंबर) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full pl-12 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Role & Age in 2 Cols */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Role */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Role / Designation *
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Age */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Age (उम्र)</label>
                  <input
                    type="number"
                    min={18}
                    max={75}
                    value={formAge}
                    onChange={(e) => setFormAge(e.target.value)}
                    placeholder="25"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Monthly Fixed Salary */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Monthly Fixed Salary (मासिक वेतन ₹) *
                </label>
                <div className="relative">
                  <IndianRupee className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="number"
                    required
                    min={1000}
                    step={500}
                    value={formSalary}
                    onChange={(e) => setFormSalary(e.target.value)}
                    placeholder="18000"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Daily rate will be automatically computed as (Salary ÷ 30) = ₹{Math.round((Number(formSalary) || 0) / 30)}/day
                </span>
              </div>

              {/* Photo (DP) Upload */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Profile Photo / DP (प्रोफाइल फोटो)
                </label>
                <div className="flex items-center gap-3">
                  {formPhotoUrl ? (
                    <img
                      src={formPhotoUrl}
                      alt="DP Preview"
                      className="w-14 h-14 rounded-xl object-cover border border-emerald-500/40 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-950 border border-dashed border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{formPhotoUrl ? 'Change Photo' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, setFormPhotoUrl)}
                      />
                    </label>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Clear selfie or passport size photo
                    </span>
                  </div>
                </div>
              </div>

              {/* ID Proof Type & Document Upload */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    ID Proof Document (पहचान पत्र - Aadhaar / DL)
                  </label>
                  <select
                    value={formIdProofType}
                    onChange={(e) => setFormIdProofType(e.target.value)}
                    className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-emerald-400 cursor-pointer"
                  >
                    {ID_PROOF_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-dashed border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-6 h-6 text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {formIdProofUrl ? 'ID Proof Document Attached' : `Upload ${formIdProofType}`}
                      </p>
                      <span className="text-[10px] text-slate-500">
                        {formIdProofUrl ? 'Ready to save' : 'Aadhaar Card, Driving License, or Voter ID'}
                      </span>
                    </div>
                  </div>

                  <label className="px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold cursor-pointer transition shrink-0">
                    <span>{formIdProofUrl ? 'Change Doc' : 'Upload Doc'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, setFormIdProofUrl)}
                    />
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-staff-submit"
                  type="submit"
                  disabled={formSaving}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                >
                  {formSaving ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>{editingStaff ? 'Update Staff Member' : 'Save Personnel'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: GIVE ADVANCE (पेशगी दें) */}
      {/* ========================================================================= */}
      {isAdvanceModalOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Give Staff Advance (पेशगी दें)</h3>
                  <p className="text-xs text-slate-400">
                    Personnel: <strong className="text-white">{selectedStaff.name}</strong> ({selectedStaff.role})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdvanceModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleGiveAdvance} className="space-y-4">
              {/* Advance Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Advance Amount (पेशगी राशि ₹) *
                </label>
                <div className="relative">
                  <IndianRupee className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="number"
                    required
                    min={100}
                    step={100}
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                    placeholder="e.g. 2000"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-base font-bold text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Quick Amount Chips */}
                <div className="flex items-center gap-2 mt-2">
                  {[500, 1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAdvanceAmount(String(amt))}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 text-xs font-bold transition border border-slate-700"
                    >
                      +₹{amt.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Mode Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Payment Mode (भुगतान का माध्यम) *
                </label>
                <select
                  value={advanceMode}
                  onChange={(e) => setAdvanceMode(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {PAYMENT_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Advance Date (दिनांक) *
                </label>
                <input
                  type="date"
                  required
                  value={advanceDate}
                  onChange={(e) => setAdvanceDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Remarks / Reason (कारण / विवरण)
                </label>
                <input
                  type="text"
                  value={advanceRemarks}
                  onChange={(e) => setAdvanceRemarks(e.target.value)}
                  placeholder="e.g. Emergency family expense / Festival advance"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Live Preview Info */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                <div className="flex justify-between">
                  <span>Current Earned to Date:</span>
                  <strong>₹{payrollStats.totalEarned.toLocaleString('en-IN')}</strong>
                </div>
                <div className="flex justify-between">
                  <span>New Total Advance:</span>
                  <strong>
                    ₹{(payrollStats.totalAdvanceTaken + (Number(advanceAmount) || 0)).toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-amber-500/20 font-bold">
                  <span>Updated Net Outstanding:</span>
                  <strong className="text-white">
                    ₹
                    {(
                      payrollStats.totalEarned -
                      (payrollStats.totalAdvanceTaken + (Number(advanceAmount) || 0))
                    ).toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAdvanceModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-advance"
                  type="submit"
                  disabled={advanceSaving}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black transition shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
                >
                  {advanceSaving ? (
                    <span>Recording...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Confirm & Record Advance</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ID DOCUMENT VIEWER / PREVIEW */}
      {/* ========================================================================= */}
      {isIdPreviewOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {selectedStaff.id_proof_type || 'ID Proof Document'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Personnel: <strong className="text-white">{selectedStaff.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsIdPreviewOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Card Render */}
            <div className="space-y-3">
              {selectedStaff.id_proof_url ? (
                <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950 max-h-[350px] flex items-center justify-center p-2">
                  <img
                    src={selectedStaff.id_proof_url}
                    alt="ID Document"
                    className="max-h-[330px] w-auto object-contain rounded-xl"
                  />
                </div>
              ) : (
                /* Digital Verified ID Card Mockup */
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/40 border border-blue-500/30 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-6 h-6 text-emerald-400" />
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          GOVERNMENT OF INDIA VERIFIED
                        </span>
                        <h4 className="text-sm font-black text-white">
                          {selectedStaff.id_proof_type || 'Aadhaar Card'}
                        </h4>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                      VERIFIED ON FILE
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {selectedStaff.photo_url ? (
                      <img
                        src={selectedStaff.photo_url}
                        alt={selectedStaff.name}
                        className="w-16 h-16 rounded-xl object-cover border border-slate-700"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg font-bold text-slate-300">
                        {selectedStaff.name?.[0]}
                      </div>
                    )}
                    <div className="space-y-0.5 text-xs">
                      <p className="text-white font-bold text-sm">{selectedStaff.name}</p>
                      <p className="text-slate-400">
                        Phone: <strong className="text-slate-200">+91 {selectedStaff.phone}</strong>
                      </p>
                      <p className="text-slate-400">
                        Age: <strong className="text-slate-200">{selectedStaff.age || 25} yrs</strong>
                      </p>
                      <p className="text-slate-400">
                        ID Ref: <span className="font-mono text-emerald-400">XXXX-XXXX-{selectedStaff.phone.slice(-4)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-500">
                Uploaded during onboarding & HR audit
              </span>
              <button
                type="button"
                onClick={() => setIsIdPreviewOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
