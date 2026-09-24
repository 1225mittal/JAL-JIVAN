import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  Phone,
  Calendar,
  Clock,
  Trash2,
  Edit2,
  FileText,
  Check,
  X,
  MessageCircle,
  AlertCircle,
  Truck,
  Sparkles,
  Layers,
  Tag,
  ShieldCheck,
  ArrowLeft,
  User,
  CheckCircle2
} from 'lucide-react';
import {
  createDistributor,
  updateDistributor,
  deleteDistributor
} from '../../lib/supabase';
import {
  isClaimWindowActive,
  formatClaimWindowBadge
} from '../../lib/distributorVoiceParser';
import AddDistributorModal from '../AddDistributorModal';

export default function DistributorMaster({
  distributors = [],
  onDistributorsChange,
  onBackToInventory
}) {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDistributor, setEditingDistributor] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const openAddModal = () => {
    setEditingDistributor(null);
    setIsModalOpen(true);
  };

  const openEditModal = (dist) => {
    setEditingDistributor(dist);
    setIsModalOpen(true);
  };

  const handleSaveDistributor = async (distributorData) => {
    try {
      if (editingDistributor) {
        const updated = await updateDistributor(editingDistributor.id, distributorData);
        if (onDistributorsChange) {
          onDistributorsChange((prev) =>
            prev.map((d) => (d.id === editingDistributor.id ? { ...d, ...updated } : d))
          );
        }
        showToast('Distributor updated successfully!');
      } else {
        const created = await createDistributor(distributorData);
        if (onDistributorsChange) {
          onDistributorsChange((prev) => [created, ...prev]);
        }
        showToast('Distributor registered successfully!');
      }
    } catch (err) {
      console.error('Error saving distributor:', err);
      throw err;
    }
  };

  const handleDelete = async (dist) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete distributor "${dist.distributor_name}"?`
    );
    if (!confirmDelete) return;

    try {
      setDeletingId(dist.id);
      await deleteDistributor(dist.id);
      if (onDistributorsChange) {
        onDistributorsChange((prev) => prev.filter((d) => d.id !== dist.id));
      }
      showToast('Distributor deleted.');
    } catch (err) {
      console.error('Failed to delete distributor:', err);
      alert('Could not delete distributor. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered Distributors
  const filteredDistributors = distributors.filter((d) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;

    const matchesMain =
      (d.distributor_name || '').toLowerCase().includes(q) ||
      (d.company_name || '').toLowerCase().includes(q) ||
      (d.salesman_name || '').toLowerCase().includes(q) ||
      (d.salesman_phone || '').toLowerCase().includes(q) ||
      (d.visit_day || '').toLowerCase().includes(q) ||
      (d.notes || '').toLowerCase().includes(q);

    if (matchesMain) return true;

    // Search in divisions
    if (Array.isArray(d.divisions)) {
      return d.divisions.some(
        (div) =>
          (div.company_name || '').toLowerCase().includes(q) ||
          (div.product_categories || '').toLowerCase().includes(q) ||
          (div.salesman_name || '').toLowerCase().includes(q) ||
          (div.salesman_phone || '').toLowerCase().includes(q) ||
          (div.visit_day || '').toLowerCase().includes(q)
      );
    }

    return false;
  });

  const todayDate = new Date().getDate();

  return (
    <div className="space-y-5 animate-fade-in w-full max-w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 py-2.5 px-4 rounded-2xl bg-cyan-600 text-white font-bold text-xs shadow-xl shadow-cyan-600/30 flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          {onBackToInventory && (
            <button
              onClick={onBackToInventory}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Back to Inventory"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-white">
                FMCG Distributors & Salesmen
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {distributors.length} Registered
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Multi-brand divisions, monthly claim cycles & salesman contact roster
            </p>
          </div>
        </div>

        <button
          onClick={openAddModal}
          className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-600/25 transition shrink-0"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>+ Add Distributor & Divisions</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative w-full max-w-full">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by distributor firm, company (Parle, Tata, HUL), salesman name, category..."
          style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
          className="w-full max-w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 transition font-medium"
        />
      </div>

      {/* Directory Grid */}
      {filteredDistributors.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-3xl border border-slate-800 space-y-3">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-white font-bold text-sm">No distributors found</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Add your local FMCG distributors, agencies, and supplier salesmen to streamline damage returns and claim windows.
          </p>
          <button
            onClick={openAddModal}
            className="mt-2 py-2 px-4 rounded-xl bg-cyan-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Distributor</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDistributors.map((dist) => {
            const windowStatus = isClaimWindowActive(dist, todayDate);
            const claimBadge = formatClaimWindowBadge(dist);

            // Divisions list
            const divisions = Array.isArray(dist.divisions) && dist.divisions.length > 0
              ? dist.divisions
              : [
                  {
                    id: 'div-1',
                    company_name: dist.company_name || 'General FMCG',
                    product_categories: '',
                    salesman_name: dist.salesman_name || '',
                    salesman_phone: dist.salesman_phone || '',
                    visit_day: dist.visit_day || 'Monday'
                  }
                ];

            const eligibility = Array.isArray(dist.return_eligibility) && dist.return_eligibility.length > 0
              ? dist.return_eligibility
              : ['Expired Stock', 'Damage / Breakage / Leakage'];

            return (
              <div
                key={dist.id}
                className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-3 group"
              >
                <div className="space-y-3">
                  {/* Card Header: Distributor Trade Name & Live Status */}
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-white group-hover:text-cyan-300 transition-colors truncate">
                          {dist.distributor_name}
                        </h3>
                        <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 mt-0.5 truncate">
                          <Building2 className="w-3 h-3 shrink-0" />
                          <span>{dist.company_name || 'Multi-Brand'}</span>
                        </div>
                      </div>

                      {/* Edit & Delete Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(dist)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                          title="Edit distributor"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(dist)}
                          disabled={deletingId === dist.id}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
                          title="Delete distributor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Return Window Badge */}
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700/80 text-amber-300 shadow-sm w-full">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">{claimBadge}</span>
                      </div>

                      {/* Live Status Indicator */}
                      <div
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5 border ${
                          windowStatus.isOpen
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            windowStatus.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                          }`}
                        />
                        <span className="truncate">{windowStatus.badgeText}</span>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Salesman / Brand Divisions List */}
                  <div className="space-y-2 pt-1 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3 text-cyan-400" />
                        <span>Salesmen & Divisions ({divisions.length}):</span>
                      </span>
                      {dist.settlement_mode && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                          {dist.settlement_mode}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {divisions.map((div, idx) => (
                        <div
                          key={div.id || idx}
                          className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 text-xs"
                        >
                          {/* Division Brand & Categories */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-white text-[11px] flex items-center gap-1 truncate">
                              <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[9px] font-black flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="truncate">{div.company_name}</span>
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700 shrink-0">
                              {div.visit_day} Visit
                            </span>
                          </div>

                          {div.product_categories && (
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 pl-5 truncate">
                              <Tag className="w-2.5 h-2.5 text-cyan-400/80 shrink-0" />
                              <span className="truncate">{div.product_categories}</span>
                            </div>
                          )}

                          {/* Salesman contact row */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 pl-5 text-[11px]">
                            <span className="text-slate-300 truncate">
                              {div.salesman_name ? (
                                <strong className="text-slate-200">{div.salesman_name}</strong>
                              ) : (
                                <span className="text-slate-500 italic">No salesman name</span>
                              )}
                            </span>

                            {div.salesman_phone ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <a
                                  href={`tel:${div.salesman_phone}`}
                                  className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20 transition"
                                  title="Call Salesman"
                                >
                                  <Phone className="w-2.5 h-2.5" />
                                  <span>{div.salesman_phone}</span>
                                </a>
                                <a
                                  href={`https://wa.me/91${div.salesman_phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition"
                                  title="WhatsApp Salesman"
                                >
                                  <MessageCircle className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Return Eligibility Tags */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-1">
                    {eligibility.map((el) => (
                      <span
                        key={el}
                        className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400"
                      >
                        ✓ {el}
                      </span>
                    ))}
                  </div>

                  {/* Notes */}
                  {dist.notes && (
                    <p className="text-[11px] text-slate-300 italic line-clamp-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      {dist.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Structured Add/Edit Distributor Modal */}
      <AddDistributorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingDistributor={editingDistributor}
        onSave={handleSaveDistributor}
      />
    </div>
  );
}
