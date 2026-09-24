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
  ExternalLink,
  MessageCircle,
  AlertCircle,
  Truck
} from 'lucide-react';
import {
  createDistributor,
  updateDistributor,
  deleteDistributor
} from '../../lib/supabase';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

const RETURN_RULES = [
  'Anytime / कभी भी',
  'Within 15 Days of Expiry',
  'Within 30 Days of Invoice',
  'Strict: Before Expiry Only',
  'Weekly Replacement'
];

export default function DistributorMaster({
  distributors = [],
  onDistributorsChange,
  onBackToInventory
}) {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDistributor, setEditingDistributor] = useState(null);

  // Form State
  const [distributorName, setDistributorName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [salesmanName, setSalesmanName] = useState('');
  const [salesmanPhone, setSalesmanPhone] = useState('');
  const [visitDay, setVisitDay] = useState('Monday');
  const [returnWindowRule, setReturnWindowRule] = useState('Anytime / कभी भी');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const filteredDistributors = distributors.filter((d) => {
    const q = search.toLowerCase();
    return (
      (d.distributor_name || '').toLowerCase().includes(q) ||
      (d.company_name || '').toLowerCase().includes(q) ||
      (d.salesman_name || '').toLowerCase().includes(q) ||
      (d.salesman_phone || '').includes(q)
    );
  });

  const openAddModal = () => {
    setEditingDistributor(null);
    setDistributorName('');
    setCompanyName('');
    setSalesmanName('');
    setSalesmanPhone('');
    setVisitDay('Monday');
    setReturnWindowRule('Anytime / कभी भी');
    setNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (dist) => {
    setEditingDistributor(dist);
    setDistributorName(dist.distributor_name || '');
    setCompanyName(dist.company_name || '');
    setSalesmanName(dist.salesman_name || '');
    setSalesmanPhone(dist.salesman_phone || '');
    setVisitDay(dist.visit_day || 'Monday');
    setReturnWindowRule(dist.return_window_rule || 'Anytime / कभी भी');
    setNotes(dist.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!distributorName.trim()) {
      setFormError('Distributor Name is required / डिस्ट्रीब्यूटर का नाम आवश्यक है');
      return;
    }
    if (!companyName.trim()) {
      setFormError('Company / Brand Name is required / कंपनी का नाम आवश्यक है');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        distributor_name: distributorName.trim(),
        company_name: companyName.trim(),
        salesman_name: salesmanName.trim(),
        salesman_phone: salesmanPhone.trim(),
        visit_day: visitDay,
        return_window_rule: returnWindowRule,
        notes: notes.trim()
      };

      if (editingDistributor) {
        const updated = await updateDistributor(editingDistributor.id, payload);
        if (onDistributorsChange) {
          onDistributorsChange(
            distributors.map((d) => (d.id === editingDistributor.id ? { ...d, ...updated } : d))
          );
        }
      } else {
        const created = await createDistributor(payload);
        if (onDistributorsChange) {
          onDistributorsChange([created, ...distributors]);
        }
      }

      setIsModalOpen(false);
    } catch (err) {
      setFormError(err.message || 'Failed to save distributor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove distributor "${name}"?`)) return;
    try {
      await deleteDistributor(id);
      if (onDistributorsChange) {
        onDistributorsChange(distributors.filter((d) => d.id !== id));
      }
    } catch (err) {
      alert(`Error deleting distributor: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header / Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-white tracking-tight">
              Distributors & Companies Directory
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {distributors.length} Registered
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            डिस्ट्रीब्यूटर और कंपनी मास्टर सूची - सेल्समैन फ़ोन, विज़िट के दिन और रिटर्न पॉलिसी
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onBackToInventory && (
            <button
              onClick={onBackToInventory}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              ← Back to Damaged Items
            </button>
          )}

          <button
            onClick={openAddModal}
            className="flex-1 sm:flex-none py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/25 flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Distributor</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by distributor firm, FMCG company (Parle, Bisleri, Tata), salesman..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
        />
      </div>

      {/* Directory Grid */}
      {filteredDistributors.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-3xl border border-slate-800 space-y-3">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-white font-bold text-sm">No distributors found</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Add your local FMCG distributors, agencies, and supplier salesmen to streamline damage returns.
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
          {filteredDistributors.map((dist) => (
            <div
              key={dist.id}
              className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-3 group"
            >
              <div className="space-y-2">
                {/* Distributor & Company Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-white group-hover:text-cyan-300 transition-colors">
                      {dist.distributor_name}
                    </h3>
                    <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 mt-0.5">
                      <Building2 className="w-3 h-3 shrink-0" />
                      <span>{dist.company_name}</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-cyan-300 shrink-0">
                    {dist.visit_day} Visit
                  </span>
                </div>

                {/* Salesman Details */}
                <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Salesman:</span>
                    <strong className="text-white">{dist.salesman_name || 'Not Specified'}</strong>
                  </div>

                  {dist.salesman_phone ? (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                      <span className="text-slate-400">Phone:</span>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${dist.salesman_phone}`}
                          className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{dist.salesman_phone}</span>
                        </a>
                        <a
                          href={`https://wa.me/91${dist.salesman_phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30"
                          title="Chat on WhatsApp"
                        >
                          <MessageCircle className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Return Rule */}
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Return Rule: <strong className="text-slate-200">{dist.return_window_rule || 'Anytime'}</strong></span>
                </div>

                {dist.notes && (
                  <p className="text-[11px] text-slate-400 italic line-clamp-2 bg-slate-950/40 p-2 rounded-lg border border-slate-850">
                    {dist.notes}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => openEditModal(dist)}
                  className="p-1.5 text-slate-400 hover:text-cyan-300 rounded-lg hover:bg-slate-800 transition"
                  title="Edit details"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(dist.id, dist.distributor_name)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                  title="Remove distributor"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Distributor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingDistributor ? 'Edit Distributor' : 'Register New Distributor'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    डिस्ट्रीब्यूटर व कंपनी विवरण जोड़ें
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs sm:text-sm">
              {formError && (
                <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Distributor / Agency Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={distributorName}
                  onChange={(e) => setDistributorName(e.target.value)}
                  placeholder="e.g. Shree Balaji Enterprises, Mittal Traders"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Company / FMCG Brand <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Parle, Bisleri, Tata Consumer, Britannia, ITC"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Salesman Name / नाम
                  </label>
                  <input
                    type="text"
                    value={salesmanName}
                    onChange={(e) => setSalesmanName(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Salesman Phone / फ़ोन
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={salesmanPhone}
                    onChange={(e) => setSalesmanPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Weekly Visit Day / आने का दिन
                  </label>
                  <select
                    value={visitDay}
                    onChange={(e) => setVisitDay(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 text-xs sm:text-sm"
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Return Window Rule / वापसी नियम
                  </label>
                  <select
                    value={returnWindowRule}
                    onChange={(e) => setReturnWindowRule(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 text-xs sm:text-sm"
                  >
                    {RETURN_RULES.map((rule) => (
                      <option key={rule} value={rule}>
                        {rule}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notes / विशेष निर्देश
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Salesman comes around 3 PM; gives credit note in next invoice."
                  className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingDistributor ? 'Update Distributor' : 'Save Distributor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
