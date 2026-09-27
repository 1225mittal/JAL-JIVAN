import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  Plus,
  Trash2,
  Save,
  Search,
  Building2,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Printer,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  IndianRupee,
  Layers,
  ArrowLeft
} from 'lucide-react';
import {
  fetchDebitNotes,
  saveDebitNote,
  fetchPurchaseVendors
} from '../../lib/supabase';

export default function DebitNoteManager({ showToast = () => {} }) {
  const [activeSubTab, setActiveSubTab] = useState('create'); // 'create' | 'history'
  const [debitNotes, setDebitNotes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNoteId, setExpandedNoteId] = useState(null);

  // Form State
  const [vendorDetails, setVendorDetails] = useState({
    vendor_id: '',
    vendor_name: '',
    vendor_gst: '',
    vendor_phone: ''
  });

  const [noteHeader, setNoteHeader] = useState({
    debit_note_number: `DN-${Date.now().toString().slice(-6)}`,
    note_date: new Date().toISOString().split('T')[0],
    original_invoice_no: '',
    return_reason: 'Expiry' // 'Expiry' | 'Transit Damage' | 'Quality Rejection' | 'Pricing Discrepancy' | 'Short Supply'
  });

  const [returnItems, setReturnItems] = useState([
    {
      id: 'ret_1',
      item_name: '',
      barcode: '',
      hsn_code: '',
      quantity: 1,
      rate: 0,
      taxable_amount: 0,
      gst_pct: 18,
      cgst_amount: 0,
      sgst_amount: 0,
      total_amount: 0,
      reason_detail: ''
    }
  ]);

  const [notesRemarks, setNotesRemarks] = useState('');

  // Load Vendors & Existing Debit Notes
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [notesData, vendorsData] = await Promise.all([
        fetchDebitNotes().catch(() => []),
        fetchPurchaseVendors().catch(() => [])
      ]);
      setDebitNotes(notesData || []);
      setVendors(vendorsData || []);
    } catch (err) {
      console.warn('Failed to load debit notes data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Handle Vendor Selection
  const handleVendorSelect = (vendorId) => {
    const v = vendors.find((vend) => vend.id === vendorId);
    if (v) {
      setVendorDetails({
        vendor_id: v.id,
        vendor_name: v.vendor_name || '',
        vendor_gst: v.gstin || '',
        vendor_phone: v.phone || ''
      });
    } else {
      setVendorDetails({
        vendor_id: '',
        vendor_name: '',
        vendor_gst: '',
        vendor_phone: ''
      });
    }
  };

  // Recalculate row amounts
  const calculateRow = (qty, rate, gstPct) => {
    const q = Number(qty) || 0;
    const r = Number(rate) || 0;
    const g = Number(gstPct) || 0;
    const taxable = +(q * r).toFixed(2);
    const halfGst = g / 2;
    const cgst = +((taxable * halfGst) / 100).toFixed(2);
    const sgst = +((taxable * halfGst) / 100).toFixed(2);
    const total = +(taxable + cgst + sgst).toFixed(2);
    return { taxable, cgst, sgst, total };
  };

  const handleItemChange = (index, field, value) => {
    setReturnItems((prev) => {
      const updated = [...prev];
      const row = { ...updated[index], [field]: value };

      if (field === 'quantity' || field === 'rate' || field === 'gst_pct') {
        const { taxable, cgst, sgst, total } = calculateRow(
          field === 'quantity' ? value : row.quantity,
          field === 'rate' ? value : row.rate,
          field === 'gst_pct' ? value : row.gst_pct
        );
        row.taxable_amount = taxable;
        row.cgst_amount = cgst;
        row.sgst_amount = sgst;
        row.total_amount = total;
      }

      updated[index] = row;
      return updated;
    });
  };

  const handleAddItem = () => {
    setReturnItems((prev) => [
      ...prev,
      {
        id: `ret_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        item_name: '',
        barcode: '',
        hsn_code: '',
        quantity: 1,
        rate: 0,
        taxable_amount: 0,
        gst_pct: 18,
        cgst_amount: 0,
        sgst_amount: 0,
        total_amount: 0,
        reason_detail: ''
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (returnItems.length <= 1) {
      showToast('At least one item is required in a Debit Note', 'warning');
      return;
    }
    setReturnItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Grand Totals
  const { totalTaxable, totalTax, grandTotal } = useMemo(() => {
    let taxable = 0;
    let tax = 0;
    let total = 0;

    returnItems.forEach((it) => {
      taxable += Number(it.taxable_amount) || 0;
      tax += (Number(it.cgst_amount) || 0) + (Number(it.sgst_amount) || 0);
      total += Number(it.total_amount) || 0;
    });

    return {
      totalTaxable: +taxable.toFixed(2),
      totalTax: +tax.toFixed(2),
      grandTotal: +total.toFixed(2)
    };
  }, [returnItems]);

  // Submit Debit Note
  const handleSubmitDebitNote = async (e) => {
    e?.preventDefault();

    if (!vendorDetails.vendor_name?.trim()) {
      showToast('Please select or specify a distributor/vendor', 'error');
      return;
    }

    const hasInvalidItem = returnItems.some((it) => !it.item_name?.trim());
    if (hasInvalidItem) {
      showToast('Please specify item names for all return items', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        debit_note_number: noteHeader.debit_note_number,
        note_date: noteHeader.note_date,
        original_invoice_no: noteHeader.original_invoice_no,
        return_reason: noteHeader.return_reason,
        vendor_id: vendorDetails.vendor_id || null,
        vendor_name: vendorDetails.vendor_name,
        vendor_gst: vendorDetails.vendor_gst,
        vendor_phone: vendorDetails.vendor_phone,
        items: returnItems,
        total_taxable: totalTaxable,
        total_tax: totalTax,
        grand_total: grandTotal,
        remarks: notesRemarks,
        status: 'issued'
      };

      const saved = await saveDebitNote(payload);
      showToast(`Debit Note #${saved.debit_note_number || noteHeader.debit_note_number} issued successfully!`, 'success');

      // Reset form
      setNoteHeader({
        debit_note_number: `DN-${Date.now().toString().slice(-6)}`,
        note_date: new Date().toISOString().split('T')[0],
        original_invoice_no: '',
        return_reason: 'Expiry'
      });
      setReturnItems([
        {
          id: 'ret_1',
          item_name: '',
          barcode: '',
          hsn_code: '',
          quantity: 1,
          rate: 0,
          taxable_amount: 0,
          gst_pct: 18,
          cgst_amount: 0,
          sgst_amount: 0,
          total_amount: 0,
          reason_detail: ''
        }
      ]);
      setNotesRemarks('');

      await loadInitialData();
      setActiveSubTab('history');
    } catch (err) {
      console.error('Failed to issue debit note:', err);
      showToast(err.message || 'Failed to issue debit note', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered Debit Notes
  const filteredDebitNotes = useMemo(() => {
    const list = Array.isArray(debitNotes) ? debitNotes : [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (dn) =>
        (dn?.debit_note_number && dn.debit_note_number.toLowerCase().includes(q)) ||
        (dn?.vendor_name && dn.vendor_name.toLowerCase().includes(q)) ||
        (dn?.original_invoice_no && dn.original_invoice_no.toLowerCase().includes(q)) ||
        (dn?.return_reason && dn.return_reason.toLowerCase().includes(q))
    );
  }, [debitNotes, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Header and SubTab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-400" />
            <span>Sale Return & Debit Note Manager</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Issue formal debit notes to suppliers for damaged, expired, or returned inventory items.
          </p>
        </div>

        {/* SubTab Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('create')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              activeSubTab === 'create'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            + Issue New Debit Note
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('history')}
            className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📜 Debit Notes Ledger ({debitNotes.length})
          </button>
        </div>
      </div>

      {/* VIEW 1: CREATE DEBIT NOTE */}
      {activeSubTab === 'create' && (
        <form onSubmit={handleSubmitDebitNote} className="space-y-4">
          {/* Header Card: Vendor & Invoice Details */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-xl space-y-3">
            <div className="border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                1. Distributor & Return Reference
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* Vendor Selector */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Distributor / Supplier *</label>
                <select
                  value={vendorDetails.vendor_id}
                  onChange={(e) => handleVendorSelect(e.target.value)}
                  className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value="">-- Choose Vendor or Enter Manually --</option>
                  {(vendors || []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vendor_name} {v.gstin ? `(${v.gstin})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vendor Name (Manual fallback) */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Vendor / Agency Name *</label>
                <input
                  type="text"
                  required
                  value={vendorDetails.vendor_name}
                  onChange={(e) => setVendorDetails({ ...vendorDetails, vendor_name: e.target.value })}
                  placeholder="Distributor / Supplier Name"
                  className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white font-medium focus:outline-none"
                />
              </div>

              {/* Vendor GSTIN */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Vendor GSTIN</label>
                <input
                  type="text"
                  value={vendorDetails.vendor_gst}
                  onChange={(e) => setVendorDetails({ ...vendorDetails, vendor_gst: e.target.value.toUpperCase() })}
                  placeholder="15-digit GSTIN"
                  className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white font-mono uppercase focus:outline-none"
                />
              </div>

              {/* Debit Note Number */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Debit Note No. *</label>
                <input
                  type="text"
                  required
                  value={noteHeader.debit_note_number}
                  onChange={(e) => setNoteHeader({ ...noteHeader, debit_note_number: e.target.value })}
                  className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white font-mono font-bold focus:outline-none"
                />
              </div>

              {/* Return Date */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Date Issued</label>
                <input
                  type="date"
                  value={noteHeader.note_date}
                  onChange={(e) => setNoteHeader({ ...noteHeader, note_date: e.target.value })}
                  className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white font-mono focus:outline-none"
                />
              </div>

              {/* Original Bill / Invoice Ref */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Original Invoice Ref No.</label>
                <input
                  type="text"
                  value={noteHeader.original_invoice_no}
                  onChange={(e) => setNoteHeader({ ...noteHeader, original_invoice_no: e.target.value })}
                  placeholder="e.g. INV-2026-9810"
                  className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white font-mono focus:outline-none"
                />
              </div>

              {/* Return Reason Category */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Primary Return Reason</label>
                <select
                  value={noteHeader.return_reason}
                  onChange={(e) => setNoteHeader({ ...noteHeader, return_reason: e.target.value })}
                  className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white focus:outline-none cursor-pointer"
                >
                  <option value="Expiry">Product Expiry / Near Expiry</option>
                  <option value="Transit Damage">Transit / Delivery Breakage</option>
                  <option value="Quality Rejection">Quality / Seal Rejection</option>
                  <option value="Pricing Discrepancy">Rate / Tax Rate Discrepancy</option>
                  <option value="Short Supply">Short Supply / Missing Items</option>
                </select>
              </div>

              {/* Vendor Phone */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Distributor Phone / Contact</label>
                <input
                  type="text"
                  value={vendorDetails.vendor_phone}
                  onChange={(e) => setVendorDetails({ ...vendorDetails, vendor_phone: e.target.value })}
                  placeholder="+91 98XXXXXXXX"
                  className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Line Items Card */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  2. Damaged / Returned Items Breakdown
                </h3>
                <p className="text-[11px] text-slate-400">
                  Itemized quantities and claimable cost rates for debit claim.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Return Item</span>
              </button>
            </div>

            {/* Table */}
            <div className="w-full overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/60">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                    <th className="py-2.5 px-3 min-w-[200px]">Item Description</th>
                    <th className="py-2.5 px-2 min-w-[110px]">Barcode</th>
                    <th className="py-2.5 px-2 min-w-[80px]">HSN</th>
                    <th className="py-2.5 px-2 min-w-[70px] text-right">Return Qty</th>
                    <th className="py-2.5 px-2 min-w-[85px] text-right">Rate (₹)</th>
                    <th className="py-2.5 px-2 min-w-[90px] text-right">Taxable (₹)</th>
                    <th className="py-2.5 px-2 min-w-[75px] text-right">GST %</th>
                    <th className="py-2.5 px-2 min-w-[85px] text-right">CGST (₹)</th>
                    <th className="py-2.5 px-2 min-w-[85px] text-right">SGST (₹)</th>
                    <th className="py-2.5 px-2 min-w-[95px] text-right">Total Claim (₹)</th>
                    <th className="py-2.5 px-2 min-w-[45px] text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {(returnItems || []).map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-900/60">
                      {/* Name */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          required
                          value={item.item_name}
                          onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                          placeholder="Damaged / Expired Item Name"
                          className="w-full h-8 px-2.5 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg text-white font-medium text-xs focus:outline-none"
                        />
                      </td>

                      {/* Barcode */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={item.barcode}
                          onChange={(e) => handleItemChange(idx, 'barcode', e.target.value)}
                          placeholder="EAN / Code"
                          className="w-full h-8 px-2 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg text-white font-mono text-xs focus:outline-none"
                        />
                      </td>

                      {/* HSN */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={item.hsn_code}
                          onChange={(e) => handleItemChange(idx, 'hsn_code', e.target.value)}
                          placeholder="HSN"
                          className="w-full h-8 px-2 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg text-white font-mono text-xs focus:outline-none"
                        />
                      </td>

                      {/* Qty */}
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full h-8 px-2 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg text-white font-mono text-right text-xs focus:outline-none"
                        />
                      </td>

                      {/* Rate */}
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                          className="w-full h-8 px-2 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg text-white font-mono text-right text-xs focus:outline-none"
                        />
                      </td>

                      {/* Taxable */}
                      <td className="py-2 px-2 text-right font-mono text-slate-300">
                        ₹{Number(item.taxable_amount || 0).toFixed(2)}
                      </td>

                      {/* GST % */}
                      <td className="py-2 px-2 text-right">
                        <select
                          value={item.gst_pct}
                          onChange={(e) => handleItemChange(idx, 'gst_pct', e.target.value)}
                          className="w-full h-8 px-1.5 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg text-white text-xs focus:outline-none cursor-pointer"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>

                      {/* CGST */}
                      <td className="py-2 px-2 text-right font-mono text-slate-400">
                        ₹{Number(item.cgst_amount || 0).toFixed(2)}
                      </td>

                      {/* SGST */}
                      <td className="py-2 px-2 text-right font-mono text-slate-400">
                        ₹{Number(item.sgst_amount || 0).toFixed(2)}
                      </td>

                      {/* Total */}
                      <td className="py-2 px-2 text-right font-mono font-bold text-amber-400">
                        ₹{Number(item.total_amount || 0).toFixed(2)}
                      </td>

                      {/* Action */}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Remarks and Totals Bar */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pt-3 border-t border-slate-800">
              <div className="w-full lg:w-1/2">
                <input
                  type="text"
                  value={notesRemarks}
                  onChange={(e) => setNotesRemarks(e.target.value)}
                  placeholder="Notes / Distributor adjustment instructions..."
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-3 self-end flex-wrap text-xs">
                <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                  <span className="text-slate-400">Taxable: </span>
                  <span className="font-mono font-bold text-white">₹{totalTaxable.toFixed(2)}</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                  <span className="text-slate-400">Tax: </span>
                  <span className="font-mono font-bold text-amber-400">₹{totalTax.toFixed(2)}</span>
                </div>
                <div className="px-4 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300">
                  <span className="font-semibold text-amber-400">Total Debit Claim: </span>
                  <span className="font-mono font-black text-amber-300 text-sm">₹{grandTotal.toFixed(2)}</span>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-10 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Issuing Note...' : 'Issue & Commit Debit Note'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* VIEW 2: DEBIT NOTES LEDGER */}
      {activeSubTab === 'history' && (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Issued Debit Notes Ledger</h3>
              <p className="text-xs text-slate-400">Archived supplier returns and credit adjustments.</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search debit note, vendor..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="button"
                onClick={loadInitialData}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                title="Refresh Ledger"
              >
                <RefreshCw className={`w-4 h-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {filteredDebitNotes.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs space-y-2">
              <RotateCcw className="w-8 h-8 mx-auto text-slate-600" />
              <p>No debit notes issued yet.</p>
              <button
                type="button"
                onClick={() => setActiveSubTab('create')}
                className="text-amber-400 hover:underline font-bold"
              >
                + Issue your first debit note
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {(filteredDebitNotes || []).map((dn) => {
                const itemsList = Array.isArray(dn?.items) ? dn.items : [];
                const isExpanded = expandedNoteId === dn.id;

                return (
                  <div
                    key={dn.id}
                    className="rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition overflow-hidden"
                  >
                    <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300">
                            {dn.debit_note_number}
                          </span>
                          <h4 className="font-extrabold text-white text-sm">
                            {dn.vendor_name || 'Vendor'}
                          </h4>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{dn.note_date || 'Today'}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {dn.return_reason || 'Return'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          {dn.original_invoice_no && (
                            <span>Against Bill: <strong>{dn.original_invoice_no}</strong></span>
                          )}
                          <span>Items: <strong>{itemsList.length}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-center">
                        <div className="text-right">
                          <div className="text-[10px] uppercase text-slate-400">Debit Claim Amount</div>
                          <div className="font-mono font-black text-amber-400 text-base">
                            ₹{Number(dn.grand_total || 0).toFixed(2)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedNoteId(isExpanded ? null : dn.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
                        >
                          <span>Details</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Items Details */}
                    {isExpanded && (
                      <div className="border-t border-slate-800/80 bg-slate-900/60 p-4 space-y-3">
                        <div className="w-full overflow-x-auto rounded-xl border border-slate-800">
                          <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold">
                              <tr>
                                <th className="py-2 px-3">#</th>
                                <th className="py-2 px-3">Item Name</th>
                                <th className="py-2 px-3">Barcode</th>
                                <th className="py-2 px-3 text-right">Qty</th>
                                <th className="py-2 px-3 text-right">Rate</th>
                                <th className="py-2 px-3 text-right">GST %</th>
                                <th className="py-2 px-3 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-slate-300">
                              {itemsList.map((it, i) => (
                                <tr key={it.id || i} className="hover:bg-slate-800/30">
                                  <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                                  <td className="py-2 px-3 font-semibold text-white">{it.item_name}</td>
                                  <td className="py-2 px-3 font-mono text-[11px] text-amber-300">{it.barcode || '—'}</td>
                                  <td className="py-2 px-3 text-right font-bold text-amber-400">{it.quantity}</td>
                                  <td className="py-2 px-3 text-right font-mono">₹{Number(it.rate || 0).toFixed(2)}</td>
                                  <td className="py-2 px-3 text-right font-mono">{it.gst_pct || 0}%</td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-amber-300">₹{Number(it.total_amount || 0).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {dn.remarks && (
                          <div className="text-xs text-slate-400 italic">
                            Remarks: {dn.remarks}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
