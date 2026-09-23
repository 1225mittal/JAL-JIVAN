import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  PackageX,
  Plus,
  AlertTriangle,
  IndianRupee,
  Clock,
  CheckCircle2,
  Trash2,
  Camera,
  Upload,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Eye,
  X,
  FileText,
  User,
  ShieldAlert,
  Loader2,
  Sparkles,
  Layers,
  ChevronDown
} from 'lucide-react';
import {
  fetchProductDamages,
  createProductDamage,
  updateProductDamageStatus,
  deleteProductDamage,
  uploadDamagePhoto,
  supabase,
  isSupabaseConfigured
} from '../lib/supabase';

const COMMON_ITEMS = [
  { name: '20L RO Purified Water Jar', defaultValue: 150 },
  { name: '20L Premium Mineral Water Can', defaultValue: 180 },
  { name: '10L Water Dispenser Bottle', defaultValue: 140 },
  { name: 'Manual Water Dispenser Hand Pump', defaultValue: 120 },
  { name: 'Countertop Water Jar Tap & Stand', defaultValue: 280 },
  { name: '1L Packaged Water (Box of 12)', defaultValue: 180 },
  { name: '500ml Bottled Water (Box of 24)', defaultValue: 240 },
  { name: 'Other Custom Item', defaultValue: 100 }
];

const DAMAGE_CATEGORIES = [
  'Cracked Body',
  'Broken Neck',
  'Tap Leakage',
  'Dirty / Contaminated',
  'Transit Impact',
  'Cap Thread Stripped',
  'Other Defect'
];

export default function DamageManagement({
  onBackToHub,
  drivers = [],
  damages: initialPropDamages = [],
  onDamagesChange
}) {
  const [damages, setDamages] = useState(initialPropDamages);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Modal State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [itemName, setItemName] = useState('20L RO Purified Water Jar');
  const [customItemName, setCustomItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [damageCategory, setDamageCategory] = useState('Cracked Body');
  const [driverName, setDriverName] = useState('');
  const [customDriverName, setCustomDriverName] = useState('');
  const [reason, setReason] = useState('');
  const [estimatedValue, setEstimatedValue] = useState(150);
  const [status, setStatus] = useState('Pending');

  // Photo Upload State
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  // Enlarged Photo Viewer Modal
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);

  // Fetch damage reports from database
  const loadDamages = async () => {
    try {
      setLoading(true);
      const data = await fetchProductDamages();
      if (Array.isArray(data)) {
        setDamages(data);
        if (onDamagesChange) onDamagesChange(data);
      }
    } catch (err) {
      console.error('Failed to load damages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDamages();
  }, []);

  // Supabase Real-Time subscription on product_damages table
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let channel = null;
    try {
      channel = supabase
        .channel('public:product_damages_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'product_damages' },
          (payload) => {
            console.log('Realtime damage change detected:', payload.eventType);
            loadDamages();
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription on product_damages failed:', e);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Auto-fill estimated value on item select
  const handleItemSelect = (e) => {
    const selected = e.target.value;
    setItemName(selected);
    const matched = COMMON_ITEMS.find((i) => i.name === selected);
    if (matched) {
      setEstimatedValue(matched.defaultValue * quantity);
    }
  };

  const handleQuantityChange = (val) => {
    const qty = Math.max(1, parseInt(val) || 1);
    setQuantity(qty);
    const matched = COMMON_ITEMS.find((i) => i.name === itemName);
    if (matched) {
      setEstimatedValue(matched.defaultValue * qty);
    }
  };

  // Photo selection handler
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleClearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Reset form
  const resetForm = () => {
    setItemName('20L RO Purified Water Jar');
    setCustomItemName('');
    setQuantity(1);
    setDamageCategory('Cracked Body');
    setDriverName('');
    setCustomDriverName('');
    setReason('');
    setEstimatedValue(150);
    setStatus('Pending');
    handleClearPhoto();
    setFormError('');
  };

  // Submit new damage log
  const handleSubmitDamage = async (e) => {
    e.preventDefault();
    setFormError('');

    const finalItemName =
      itemName === 'Other Custom Item' ? customItemName.trim() : itemName.trim();
    if (!finalItemName) {
      setFormError('Please enter or select a valid item name.');
      return;
    }

    const finalDriverName =
      driverName === 'Custom' || !driverName
        ? customDriverName.trim() || 'Warehouse / Depot Unloading'
        : driverName.trim();

    try {
      setSubmitting(true);

      let finalPhotoUrl = null;
      if (photoFile) {
        setUploadingPhoto(true);
        finalPhotoUrl = await uploadDamagePhoto(photoFile);
        setUploadingPhoto(false);
      }

      const payload = {
        item_name: finalItemName,
        quantity: Number(quantity) || 1,
        damage_category: damageCategory,
        driver_name: finalDriverName,
        reason: reason.trim(),
        notes: reason.trim(),
        estimated_value: Number(estimatedValue) || 0,
        photo_url: finalPhotoUrl,
        status: status || 'Pending'
      };

      const created = await createProductDamage(payload);
      setDamages((prev) => [created, ...prev.filter((d) => d.id !== created.id)]);
      if (onDamagesChange) {
        onDamagesChange([created, ...damages.filter((d) => d.id !== created.id)]);
      }

      setIsLogModalOpen(false);
      resetForm();
    } catch (err) {
      setFormError(err.message || 'Failed to record damage report');
    } finally {
      setSubmitting(false);
      setUploadingPhoto(false);
    }
  };

  // Status toggle handler
  const handleStatusChange = async (id, newStatus) => {
    try {
      // Optimistic update
      setDamages((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: newStatus } : d))
      );
      await updateProductDamageStatus(id, newStatus);
      if (onDamagesChange) {
        onDamagesChange(
          damages.map((d) => (d.id === id ? { ...d, status: newStatus } : d))
        );
      }
    } catch (err) {
      console.error('Failed to update damage status:', err);
      loadDamages();
    }
  };

  // Delete damage report
  const handleDeleteDamage = async (id) => {
    if (!window.confirm('Are you sure you want to remove this damage report?')) return;
    try {
      setDamages((prev) => prev.filter((d) => d.id !== id));
      await deleteProductDamage(id);
      if (onDamagesChange) {
        onDamagesChange(damages.filter((d) => d.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete damage entry:', err);
      loadDamages();
    }
  };

  // Summary Metrics
  const totalDamagedUnits = useMemo(
    () => damages.reduce((sum, d) => sum + (Number(d.quantity) || 1), 0),
    [damages]
  );

  const totalEstimatedLoss = useMemo(
    () => damages.reduce((sum, d) => sum + (Number(d.estimated_value) || 0), 0),
    [damages]
  );

  const pendingCount = useMemo(
    () => damages.filter((d) => d.status === 'Pending').length,
    [damages]
  );

  const writtenOffCount = useMemo(
    () => damages.filter((d) => d.status === 'Written Off').length,
    [damages]
  );

  const replacedCount = useMemo(
    () => damages.filter((d) => d.status === 'Replaced').length,
    [damages]
  );

  // Filtered List
  const filteredDamages = useMemo(() => {
    return damages.filter((item) => {
      // Status filter
      if (statusFilter !== 'All' && item.status !== statusFilter) return false;

      // Category filter
      if (categoryFilter !== 'All' && item.damage_category !== categoryFilter) {
        return false;
      }

      // Keyword search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (item.item_name || '').toLowerCase().includes(q);
        const matchesDriver = (item.driver_name || '').toLowerCase().includes(q);
        const matchesReason = (item.reason || item.notes || '').toLowerCase().includes(q);
        const matchesCategory = (item.damage_category || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDriver && !matchesReason && !matchesCategory) {
          return false;
        }
      }

      return true;
    });
  }, [damages, statusFilter, categoryFilter, searchQuery]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Bar with Back to Main Hub & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHub}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-all active:scale-95 shadow-sm group shrink-0"
            title="Return to Admin Hub"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Hub</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                Asset & Quality Control
              </span>
              <span className="text-slate-500 text-xs hidden sm:inline">•</span>
              <span className="text-xs text-slate-400 hidden sm:inline">
                Real-Time Returns Sync
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <PackageX className="w-6 h-6 text-rose-500" />
              Damage & Returns Management
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={loadDamages}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95 shadow-sm"
            title="Refresh Damage Records"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              resetForm();
              setIsLogModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold shadow-lg shadow-rose-600/25 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Log Damaged Item</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Stat Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Damaged Units */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Total Damaged Units</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <PackageX className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-2 tracking-tight">
            {totalDamagedUnits}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Cans, dispensers & accessories</p>
        </div>

        {/* Estimated Financial Loss */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Estimated Loss (₹)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-2 tracking-tight">
            ₹{totalEstimatedLoss.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Valuation at wholesale replacement cost</p>
        </div>

        {/* Pending Replacements */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Pending Replacements</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400 mt-2 tracking-tight">
            {pendingCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting dispatch or vendor return</p>
        </div>

        {/* Resolved / Written Off */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Replaced / Written Off</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-2 tracking-tight">
            {replacedCount + writtenOffCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {replacedCount} replaced, {writtenOffCount} written off
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by item name, driver/handler, category, or incident reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto shrink-0 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <span className="text-slate-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="All" className="bg-slate-900 text-white">All Statuses</option>
              <option value="Pending" className="bg-slate-900 text-amber-400">Pending</option>
              <option value="Replaced" className="bg-slate-900 text-emerald-400">Replaced</option>
              <option value="Written Off" className="bg-slate-900 text-slate-300">Written Off</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <span className="text-slate-400 font-medium">Defect:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="All" className="bg-slate-900 text-white">All Categories</option>
              {DAMAGE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-slate-900 text-white">
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Damaged Reports List / Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-white text-sm">
              Logged Damage Reports ({filteredDamages.length})
            </h2>
            {statusFilter !== 'All' && (
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Filtered: {statusFilter}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400">
            Click status pills below to update workflow
          </span>
        </div>

        {filteredDamages.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700/80 mx-auto flex items-center justify-center text-slate-500">
              <CheckCircle2 className="w-7 h-7 text-emerald-400/80" />
            </div>
            <h3 className="font-bold text-white text-base">No Damage Reports Found</h3>
            <p className="text-xs max-w-sm mx-auto text-slate-400">
              {searchQuery || statusFilter !== 'All' || categoryFilter !== 'All'
                ? 'No items match the selected filter criteria. Try adjusting your filters.'
                : 'All stock and equipment are currently reported defect-free and intact.'}
            </p>
            <button
              onClick={() => {
                resetForm();
                setIsLogModalOpen(true);
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log First Damaged Item</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/70">
            {filteredDamages.map((item) => {
              const formattedDate = new Date(item.created_at || Date.now()).toLocaleDateString(
                'en-IN',
                {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }
              );

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 hover:bg-slate-800/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Thumbnail / Photo */}
                    <div className="shrink-0 relative group">
                      {item.photo_url ? (
                        <div
                          onClick={() => setPreviewPhotoUrl(item.photo_url)}
                          className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden bg-slate-950 border border-slate-700 cursor-pointer relative shadow"
                        >
                          <img
                            src={item.photo_url}
                            alt={item.item_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                            <Eye className="w-4 h-4" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-slate-500">
                          <PackageX className="w-6 h-6 text-slate-600" />
                          <span className="text-[9px] mt-1">No Photo</span>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-white text-sm sm:text-base">
                          {item.item_name}
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-200 border border-slate-700">
                          Qty: {item.quantity}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          {item.damage_category || 'Defect'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1 text-slate-300">
                          <User className="w-3.5 h-3.5 text-indigo-400" />
                          Handler / Driver: <strong>{item.driver_name || 'Warehouse'}</strong>
                        </span>
                        <span>•</span>
                        <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                          <IndianRupee className="w-3 h-3" />
                          Est. Value: ₹{item.estimated_value || 0}
                        </span>
                        <span>•</span>
                        <span className="text-slate-500 text-[11px]">{formattedDate}</span>
                      </div>

                      {item.reason && (
                        <p className="text-xs text-slate-300/90 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 max-w-2xl mt-1.5 leading-relaxed">
                          <strong className="text-slate-400">Incident Details: </strong>
                          {item.reason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Status Pill Toggle */}
                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleStatusChange(item.id, 'Pending')}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${
                          item.status === 'Pending'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                            : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                        title="Mark as Pending Action"
                      >
                        Pending
                      </button>

                      <button
                        onClick={() => handleStatusChange(item.id, 'Replaced')}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${
                          item.status === 'Replaced'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                            : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                        title="Mark as Replaced with New Can"
                      >
                        Replaced
                      </button>

                      <button
                        onClick={() => handleStatusChange(item.id, 'Written Off')}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${
                          item.status === 'Written Off'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm'
                            : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                        title="Mark as Scrapped / Written Off"
                      >
                        Written Off
                      </button>
                    </div>

                    <button
                      onClick={() => handleDeleteDamage(item.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete Report"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* LOG DAMAGED ITEM MODAL */}
      {/* ======================================================== */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-lg my-8 rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <PackageX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Log Damaged Item / Returns</h3>
                  <p className="text-xs text-slate-400">Record jar leaks, transit accidents, or scrap</p>
                </div>
              </div>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitDamage} className="space-y-4 text-xs">
              {/* Item Name */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Damaged Product / Asset Item *
                </label>
                <select
                  value={itemName}
                  onChange={handleItemSelect}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                >
                  {COMMON_ITEMS.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name} (Default: ₹{item.defaultValue})
                    </option>
                  ))}
                </select>
                {itemName === 'Other Custom Item' && (
                  <input
                    type="text"
                    placeholder="Enter custom item name..."
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                    className="w-full mt-2 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                    required
                  />
                )}
              </div>

              {/* Quantity & Estimated Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Estimated Loss (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Damage Category */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Damage Category / Defect *
                </label>
                <select
                  value={damageCategory}
                  onChange={(e) => setDamageCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                >
                  {DAMAGE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Driver / Handler Name */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Driver / Responsible Handler
                </label>
                <select
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="">Warehouse / Depot Unloading (Internal)</option>
                  {drivers.map((drv) => (
                    <option key={drv.id} value={drv.name}>
                      {drv.name} ({drv.phone})
                    </option>
                  ))}
                  <option value="Custom">Other / Custom Name</option>
                </select>
                {driverName === 'Custom' && (
                  <input
                    type="text"
                    placeholder="Enter handler or rider name..."
                    value={customDriverName}
                    onChange={(e) => setCustomDriverName(e.target.value)}
                    className="w-full mt-2 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                  />
                )}
              </div>

              {/* Incident Notes / Reason */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Incident Reason / Description
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Fell from delivery bike rack on pothole, water leaking from bottom seam..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Proof Photo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handlePhotoSelect}
                  className="hidden"
                  id="damage-photo-upload"
                />

                {photoPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 p-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded-lg border border-slate-800"
                      />
                      <div>
                        <div className="text-white font-medium text-xs">
                          {photoFile?.name || 'Photo captured'}
                        </div>
                        <div className="text-slate-400 text-[10px]">
                          {(photoFile?.size ? (photoFile.size / 1024).toFixed(1) + ' KB' : 'Image ready')}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearPhoto}
                      className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="damage-photo-upload"
                    className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-700 hover:border-rose-500/60 rounded-xl cursor-pointer bg-slate-950/60 hover:bg-slate-950 transition-all text-slate-400 hover:text-white"
                  >
                    <div className="flex items-center gap-2">
                      <Camera className="w-5 h-5 text-rose-400" />
                      <span className="font-semibold text-xs">Take Photo or Upload Image</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      JPG, PNG, or camera capture supported
                    </span>
                  </label>
                )}
              </div>

              {/* Initial Status */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Initial Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Pending', 'Replaced', 'Written Off'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatus(st)}
                      className={`py-2 rounded-lg font-semibold text-xs transition-all border ${
                        status === st
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold transition-all shadow-md shadow-rose-600/30"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Report...</span>
                    </>
                  ) : (
                    <span>Save Damage Report</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PHOTO PREVIEW MODAL */}
      {/* ======================================================== */}
      {previewPhotoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="relative max-w-3xl w-full rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Damage Inspection Photo
              </span>
              <button
                onClick={() => setPreviewPhotoUrl(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/60 max-h-[75vh] overflow-auto">
              <img
                src={previewPhotoUrl}
                alt="Enlarged Defect Inspection"
                className="max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
