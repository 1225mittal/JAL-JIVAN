import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Package,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  Layers,
  FileText,
  Truck,
  Trash2,
  Eye,
  Camera,
  ChevronRight,
  Printer,
  Sparkles,
  Check,
  X,
  ShieldCheck
} from 'lucide-react';
import LogDamageModal from './LogDamageModal';
import DistributorMaster from './DistributorMaster';
import DamageManagement from '../DamageManagement'; // Legacy water jar view for full compatibility
import {
  fetchDamageExpiryItems,
  updateDamageExpiryItem,
  deleteDamageExpiryItem,
  fetchDistributors,
  supabase
} from '../../lib/supabase';

export default function DamageReturnHub({ onBackToHub, drivers = [] }) {
  // Navigation View: 'inventory' | 'distributors' | 'legacy_jars'
  const [activeView, setActiveView] = useState('inventory');

  // Data State
  const [items, setItems] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [distributorFilter, setDistributorFilter] = useState('All');

  // Modals
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [slipModalDistributor, setSlipModalDistributor] = useState(null);

  // Load Data
  const loadData = async () => {
    try {
      setLoading(true);
      const [itemsData, distsData] = await Promise.all([
        fetchDamageExpiryItems(),
        fetchDistributors()
      ]);
      setItems(itemsData || []);
      setDistributors(distsData || []);
    } catch (err) {
      console.error('Error loading damage hub data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Supabase Realtime channel subscription
    let channel = null;
    if (supabase) {
      try {
        channel = supabase
          .channel('damage-expiry-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'damage_expiry_items' },
            () => {
              loadData();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'distributors' },
            () => {
              loadData();
            }
          )
          .subscribe();
      } catch (e) {
        console.warn('Realtime subscription notice for damages:', e);
      }
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        (item.product_name || '').toLowerCase().includes(q) ||
        (item.company_name || '').toLowerCase().includes(q) ||
        (item.distributor_name || '').toLowerCase().includes(q) ||
        (item.batch_no || '').toLowerCase().includes(q) ||
        (item.rack_number || '').toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'in_godown' && item.current_status === 'in_godown') ||
        (statusFilter === 'slip_made' && item.is_slip_made && !item.is_pickup_done) ||
        (statusFilter === 'picked_up' && item.is_pickup_done && !item.is_credit_received) ||
        (statusFilter === 'credit_received' && item.is_credit_received);

      const matchesType = typeFilter === 'All' || item.damage_type === typeFilter;

      const matchesDistributor =
        distributorFilter === 'All' || item.distributor_id === distributorFilter;

      return matchesSearch && matchesStatus && matchesType && matchesDistributor;
    });
  }, [items, search, statusFilter, typeFilter, distributorFilter]);

  // KPIs
  const stats = useMemo(() => {
    const inGodownItems = items.filter((i) => !i.is_pickup_done);
    const totalGodownUnits = inGodownItems.reduce((acc, i) => acc + (i.quantity_pcs || 1), 0);
    const totalGodownValue = inGodownItems.reduce(
      (acc, i) => acc + (Number(i.mrp) || 0) * (i.quantity_pcs || 1),
      0
    );

    const slipMadeCount = items.filter((i) => i.is_slip_made && !i.is_pickup_done).length;
    const pickedUpCount = items.filter((i) => i.is_pickup_done && !i.is_credit_received).length;

    const creditReceivedItems = items.filter((i) => i.is_credit_received);
    const totalRecoveredValue = creditReceivedItems.reduce(
      (acc, i) => acc + (Number(i.mrp) || 0) * (i.quantity_pcs || 1),
      0
    );

    return {
      totalGodownUnits,
      totalGodownValue,
      slipMadeCount,
      pickedUpCount,
      creditReceivedCount: creditReceivedItems.length,
      totalRecoveredValue
    };
  }, [items]);

  // Status transitions
  const handleTransitionStatus = async (item, nextAction) => {
    const nowIso = new Date().toISOString();
    let updates = {};

    if (nextAction === 'make_slip') {
      updates = {
        is_slip_made: true,
        slip_made_at: nowIso,
        current_status: 'slip_made'
      };
    } else if (nextAction === 'mark_pickup') {
      updates = {
        is_pickup_done: true,
        pickup_done_at: nowIso,
        current_status: 'picked_up'
      };
    } else if (nextAction === 'confirm_credit') {
      updates = {
        is_credit_received: true,
        credit_received_at: nowIso,
        current_status: 'credit_received'
      };
    }

    try {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, ...updates } : i))
      );
      await updateDamageExpiryItem(item.id, updates);
    } catch (err) {
      alert(`Status update failed: ${err.message}`);
      loadData();
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Delete damaged item "${item.product_name}"?`)) return;
    try {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      await deleteDamageExpiryItem(item.id);
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
      loadData();
    }
  };

  // Generate return slip items for a specific distributor
  const distributorSlipItems = useMemo(() => {
    if (!slipModalDistributor) return [];
    return items.filter(
      (i) => i.distributor_name === slipModalDistributor && !i.is_pickup_done
    );
  }, [items, slipModalDistributor]);

  return (
    <div className="space-y-6 animate-fade-in pb-12 w-full max-w-full overflow-x-hidden">
      {/* TOP HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 w-full max-w-full">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {onBackToHub && (
            <button
              onClick={onBackToHub}
              className="p-2 sm:p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
              title="Return to Admin Hub"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                Damage & Expiry Return Hub
              </h1>
              <span className="text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                गोदाम डैमेज और एक्सपायरी वापसी हब
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 truncate">
              Dual-Photo Groq Vision OCR • Godown Racks • FMCG Return Slips • Distributor Credits
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsLogModalOpen(true)}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-black shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition active:scale-95"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>+ Log Damaged Item</span>
          </button>

          <button
            onClick={loadData}
            title="Refresh inventory"
            className="w-full sm:w-auto py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center justify-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="sm:hidden">Refresh List</span>
          </button>
        </div>
      </div>

      {/* MODULE NAVIGATION TABS */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 overflow-x-auto no-scrollbar w-full max-w-full flex-nowrap">
        <button
          onClick={() => setActiveView('inventory')}
          className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 transition whitespace-nowrap shrink-0 ${
            activeView === 'inventory'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Package className="w-4 h-4 shrink-0" />
          <span>Damage & Expiry Inventory ({items.length})</span>
        </button>

        <button
          onClick={() => setActiveView('distributors')}
          className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 transition whitespace-nowrap shrink-0 ${
            activeView === 'distributors'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4 shrink-0" />
          <span>Distributors Directory ({distributors.length})</span>
        </button>

        <button
          onClick={() => setActiveView('legacy_jars')}
          className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 transition whitespace-nowrap shrink-0 ${
            activeView === 'legacy_jars'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span>Water Jar Transit Damages</span>
        </button>
      </div>

      {/* TAB 1: DAMAGE & EXPIRY INVENTORY */}
      {activeView === 'inventory' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: In Godown */}
            <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                In Godown / गोदाम स्टॉक
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-black text-rose-400">
                  {stats.totalGodownUnits} <span className="text-xs text-slate-400 font-normal">pcs</span>
                </span>
                <span className="text-xs font-bold text-slate-300">
                  ₹{stats.totalGodownValue.toLocaleString()}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">Unreturned damaged stock value</p>
            </div>

            {/* Card 2: Return Slip Made */}
            <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Slips Created / पर्ची बनी
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-black text-cyan-400">
                  {stats.slipMadeCount}
                </span>
                <span className="text-xs font-bold text-cyan-300">Ready</span>
              </div>
              <p className="text-[10px] text-slate-500">Awaiting salesman pickup</p>
            </div>

            {/* Card 3: Picked Up */}
            <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Picked Up / उठाया गया
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-black text-purple-400">
                  {stats.pickedUpCount}
                </span>
                <span className="text-xs font-bold text-purple-300">In Transit</span>
              </div>
              <p className="text-[10px] text-slate-500">Handed over to distributor</p>
            </div>

            {/* Card 4: Credit Note Received */}
            <div className="glass-card p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Credits Settled / क्रेडिट मिला
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-black text-emerald-400">
                  ₹{stats.totalRecoveredValue.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-emerald-300">
                  {stats.creditReceivedCount} items
                </span>
              </div>
              <p className="text-[10px] text-slate-500">Refund / credit note received</p>
            </div>
          </div>

          {/* SEARCH & FILTERS BAR */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-900 border border-slate-800 w-full max-w-full">
            {/* Search Input */}
            <div className="relative w-full lg:flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product, brand, distributor, batch, rack..."
                className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Filter Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 truncate"
              >
                <option value="All">All Statuses / सभी स्थिति</option>
                <option value="in_godown">In Godown (गोदाम में)</option>
                <option value="slip_made">Slip Made (पर्ची बनी)</option>
                <option value="picked_up">Picked Up (उठाया गया)</option>
                <option value="credit_received">Credit Settled (क्रेडिट मिला)</option>
              </select>

              {/* Damage Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 truncate"
              >
                <option value="All">All Types / सभी नुक़सान</option>
                <option value="Damage">Physical Damage</option>
                <option value="Expired">Expired Goods</option>
                <option value="Leaking">Leaking Packs</option>
                <option value="Pest/Rat">Pest/Rat Bite</option>
              </select>

              {/* Distributor Filter */}
              {distributors.length > 0 && (
                <select
                  value={distributorFilter}
                  onChange={(e) => setDistributorFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 truncate"
                >
                  <option value="All">All Distributors / सभी</option>
                  {distributors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.distributor_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* INVENTORY ITEMS LIST */}
          {filteredItems.length === 0 ? (
            <div className="glass-panel p-12 text-center rounded-3xl border border-slate-800 space-y-3">
              <Package className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-white font-bold text-sm">No damage/expiry items found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No items match your filter. Click &ldquo;+ Log Damaged Item&rdquo; to record product packages using Groq Vision OCR.
              </p>
              <button
                onClick={() => setIsLogModalOpen(true)}
                className="mt-2 py-2 px-4 rounded-xl bg-rose-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log New Damaged Item</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const totalItemLoss = (Number(item.mrp) || 0) * (item.quantity_pcs || 1);

                return (
                  <div
                    key={item.id}
                    className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-rose-500/40 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-3">
                      {/* Top Bar: Dual Photo Thumbs & Header */}
                      <div className="flex items-start gap-3">
                        {/* Dual Photos Thumbnail Stack */}
                        <div className="flex flex-col gap-1 shrink-0">
                          {item.front_photo_url ? (
                            <button
                              type="button"
                              onClick={() => setSelectedPhoto(item.front_photo_url)}
                              className="w-12 h-12 rounded-xl overflow-hidden border border-slate-700 hover:border-rose-400 transition"
                              title="Click to view front photo"
                            >
                              <img
                                src={item.front_photo_url}
                                alt="Front"
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 text-[10px]">
                              No Front
                            </div>
                          )}

                          {item.back_photo_url ? (
                            <button
                              type="button"
                              onClick={() => setSelectedPhoto(item.back_photo_url)}
                              className="w-12 h-12 rounded-xl overflow-hidden border border-slate-700 hover:border-rose-400 transition"
                              title="Click to view back photo"
                            >
                              <img
                                src={item.back_photo_url}
                                alt="Back"
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ) : null}
                        </div>

                        {/* Title, Brand, Category */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30">
                              {item.damage_type || 'Damage'}
                            </span>
                            {item.rack_number && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 border border-amber-500/30">
                                📍 {item.rack_number}
                              </span>
                            )}
                          </div>

                          <h3 className="text-sm font-extrabold text-white mt-1 leading-snug line-clamp-2">
                            {item.product_name}
                          </h3>

                          <div className="flex items-center gap-2 mt-1 text-xs">
                            <span className="text-emerald-400 font-semibold">{item.company_name}</span>
                            {item.net_weight_volume && (
                              <span className="text-slate-400 text-[11px]">({item.net_weight_volume})</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Distributor and Price Badge */}
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Distributor:</span>
                          <strong className="text-white truncate max-w-[160px]">
                            {item.distributor_name || 'Direct'}
                          </strong>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                          <span className="text-slate-400">
                            Qty: <strong className="text-white">{item.quantity_pcs || 1} pcs</strong> × ₹{item.mrp}
                          </span>
                          <span className="font-extrabold text-rose-400 text-sm">
                            ₹{totalItemLoss.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Batch & Dates */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 px-1">
                        <div>
                          <span>Batch: </span>
                          <strong className="text-slate-300">{item.batch_no || 'N/A'}</strong>
                        </div>
                        <div>
                          <span>Expiry: </span>
                          <strong className="text-amber-400">{item.expiry_date || 'N/A'}</strong>
                        </div>
                      </div>

                      {/* Status Stepper Badge */}
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Status:</span>
                        {item.is_credit_received ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Credit Settled</span>
                          </span>
                        ) : item.is_pickup_done ? (
                          <span className="inline-flex items-center gap-1 font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 text-[11px]">
                            <Truck className="w-3 h-3" />
                            <span>Picked Up</span>
                          </span>
                        ) : item.is_slip_made ? (
                          <span className="inline-flex items-center gap-1 font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20 text-[11px]">
                            <FileText className="w-3 h-3" />
                            <span>Slip Made</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 text-[11px]">
                            <Clock className="w-3 h-3" />
                            <span>In Godown</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions Workflow Bar */}
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
                      {/* Workflow advance button */}
                      {!item.is_slip_made ? (
                        <button
                          type="button"
                          onClick={() => handleTransitionStatus(item, 'make_slip')}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 font-bold transition flex items-center justify-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Make Slip 📝</span>
                        </button>
                      ) : !item.is_pickup_done ? (
                        <button
                          type="button"
                          onClick={() => handleTransitionStatus(item, 'mark_pickup')}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-bold transition flex items-center justify-center gap-1"
                        >
                          <Truck className="w-3 h-3" />
                          <span>Mark Picked Up 🚚</span>
                        </button>
                      ) : !item.is_credit_received ? (
                        <button
                          type="button"
                          onClick={() => handleTransitionStatus(item, 'confirm_credit')}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-bold transition flex items-center justify-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Confirm Credit Note ₹</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Settled</span>
                        </span>
                      )}

                      {/* Print Return Slip for Distributor */}
                      {item.distributor_name && (
                        <button
                          type="button"
                          onClick={() => setSlipModalDistributor(item.distributor_name)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                          title="Generate distributor return slip"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DISTRIBUTORS DIRECTORY */}
      {activeView === 'distributors' && (
        <DistributorMaster
          distributors={distributors}
          onDistributorsChange={setDistributors}
          onBackToInventory={() => setActiveView('inventory')}
        />
      )}

      {/* TAB 3: WATER JAR TRANSIT DAMAGES (LEGACY BACKWARD COMPATIBLE) */}
      {activeView === 'legacy_jars' && (
        <div className="space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between text-xs text-amber-300">
            <span>
              ℹ️ Historical water jar crack/leak records from dispatch deliveries.
            </span>
            <button
              onClick={() => setActiveView('inventory')}
              className="text-white underline font-semibold"
            >
              Switch back to FMCG Packages
            </button>
          </div>
          <DamageManagement drivers={drivers} />
        </div>
      )}

      {/* LOG DAMAGE MODAL WITH GROQ VISION */}
      <LogDamageModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        distributors={distributors}
        onItemLogged={(newItem) => {
          setItems((prev) => [newItem, ...prev]);
        }}
      />

      {/* PHOTO PREVIEW VIEWER MODAL */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in cursor-pointer"
        >
          <div className="relative max-w-xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 p-2">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={selectedPhoto}
              alt="Enlarged"
              className="w-full max-h-[80vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}

      {/* PRINTABLE DISTRIBUTOR RETURN SLIP MODAL */}
      {slipModalDistributor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-sm">
                  Distributor Return Slip ({slipModalDistributor})
                </h3>
              </div>
              <button
                onClick={() => setSlipModalDistributor(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-white text-slate-900 space-y-3 font-mono">
                <div className="text-center border-b pb-2">
                  <h2 className="font-extrabold text-base">JAL-JIVAN STORE / GODOWN</h2>
                  <p className="text-[10px] text-slate-600">Goods Return & Breakage Dispatch Memo</p>
                  <p className="text-[10px] text-slate-600">Date: {new Date().toLocaleDateString()}</p>
                </div>

                <div className="text-xs space-y-1">
                  <p><strong>Distributor / Agency:</strong> {slipModalDistributor}</p>
                  <p><strong>Items Count:</strong> {distributorSlipItems.length} items</p>
                </div>

                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-t text-left">
                      <th className="py-1">Item</th>
                      <th className="py-1">Batch</th>
                      <th className="py-1">Exp</th>
                      <th className="py-1">Rack</th>
                      <th className="py-1">Qty</th>
                      <th className="py-1 text-right">MRP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributorSlipItems.map((item, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="py-1">{item.product_name}</td>
                        <td className="py-1">{item.batch_no || '-'}</td>
                        <td className="py-1">{item.expiry_date || '-'}</td>
                        <td className="py-1">{item.rack_number || '-'}</td>
                        <td className="py-1 font-bold">{item.quantity_pcs || 1}</td>
                        <td className="py-1 text-right">₹{((Number(item.mrp) || 0) * (item.quantity_pcs || 1)).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="pt-3 border-t flex justify-between items-center text-xs font-bold">
                  <span>Total Return Value:</span>
                  <span>
                    ₹{distributorSlipItems.reduce((acc, i) => acc + (Number(i.mrp) || 0) * (i.quantity_pcs || 1), 0).toFixed(2)}
                  </span>
                </div>

                <div className="pt-6 grid grid-cols-2 text-[10px] text-center border-t border-dashed">
                  <div>Store In-Charge Signature</div>
                  <div>Salesman / Collector Signature</div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="py-2 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Return Slip / प्रिंट करें</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
