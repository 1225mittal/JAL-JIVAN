import React, { useState, useMemo } from 'react';
import {
  Building2,
  Search,
  Phone,
  MapPin,
  Calendar,
  FileText,
  IndianRupee,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Plus,
  Trash2,
  X,
  Eye,
  CheckCircle2,
  Sparkles,
  Receipt
} from 'lucide-react';

export default function VendorsDirectory({
  vendors = [],
  invoicesHistory = [],
  onSelectVendorInvoices,
  onRefresh,
  loading = false,
  onDeleteVendor
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendorForModal, setSelectedVendorForModal] = useState(null);

  // Filter vendors based on search input (name, GSTIN, phone)
  const filteredVendors = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return vendors;
    return vendors.filter((v) => {
      const name = (v.vendor_name || '').toLowerCase();
      const gst = (v.gstin || '').toLowerCase();
      const phone = (v.phone || '').toLowerCase();
      const address = (v.address || '').toLowerCase();
      return name.includes(q) || gst.includes(q) || phone.includes(q) || address.includes(q);
    });
  }, [vendors, searchQuery]);

  // Overall statistics
  const stats = useMemo(() => {
    const totalVendors = vendors.length;
    const totalBills = vendors.reduce((sum, v) => sum + (Number(v.total_bills_count) || 1), 0);
    const totalSpend = vendors.reduce((sum, v) => sum + (Number(v.total_purchased_amount) || 0), 0);
    return { totalVendors, totalBills, totalSpend };
  }, [vendors]);

  // Get historical invoices for a specific vendor
  const getVendorInvoices = (vendor) => {
    if (!vendor) return [];
    const vName = (vendor.vendor_name || '').toLowerCase();
    const vGst = (vendor.gstin || '').toLowerCase();
    return invoicesHistory.filter((inv) => {
      const invName = (inv.seller_name || '').toLowerCase();
      const invGst = (inv.seller_gst || '').toLowerCase();
      if (vGst && invGst && vGst === invGst) return true;
      return invName && vName && (invName.includes(vName) || vName.includes(invName));
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Metrics Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="glass-card p-4 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Vendors Registered</span>
            <Building2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{stats.totalVendors}</span>
            <span className="text-[11px] text-emerald-400 font-semibold">Active Profiles</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Invoices Logged</span>
            <Receipt className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{stats.totalBills}</span>
            <span className="text-[11px] text-cyan-400 font-semibold">Inward Bills</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Purchased Volume</span>
            <IndianRupee className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">₹{stats.totalSpend.toLocaleString('en-IN')}</span>
            <span className="text-[11px] text-slate-400">Procurement</span>
          </div>
        </div>
      </div>

      {/* Main Vendor Directory Card */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-7 shadow-xl space-y-4">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              <span>Vendors Directory & Archiving</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated vendor profiles synced from Groq Vision OCR bill extractions.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search vendor name, GSTIN, phone..."
                className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Refresh */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition shrink-0 shadow-sm"
              title="Refresh Vendors Directory"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Vendors List Table */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
            <p>Loading vendors directory...</p>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs space-y-2">
            <Building2 className="w-10 h-10 mx-auto text-slate-700" />
            <p className="font-semibold text-slate-400">
              {searchQuery ? 'No vendors matching your search' : 'No vendors registered yet'}
            </p>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Vendors are automatically created and synced whenever an invoice is extracted through Groq Vision OCR.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Vendor / Firm Name</th>
                  <th className="py-3 px-4">GSTIN</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4">Address / City</th>
                  <th className="py-3 px-4">Last Invoiced Date</th>
                  <th className="py-3 px-4 text-center">Invoices Logged</th>
                  <th className="py-3 px-4 text-right">Total Purchased</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredVendors.map((vendor) => {
                  const billCount = Number(vendor.total_bills_count) || 1;
                  const totalPurchased = Number(vendor.total_purchased_amount) || 0;
                  const lastDate = vendor.last_billed_date || 'N/A';

                  return (
                    <tr
                      key={vendor.id || vendor.gstin || vendor.vendor_name}
                      onClick={() => setSelectedVendorForModal(vendor)}
                      className="hover:bg-slate-900/60 transition cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-bold text-white group-hover:text-amber-400 transition">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="block truncate max-w-[200px]">{vendor.vendor_name}</span>
                            <span className="text-[10px] text-slate-500 font-normal">Click to view bills</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">
                        {vendor.gstin ? (
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-cyan-300 font-semibold">
                            {vendor.gstin}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Unregistered</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        {vendor.phone ? (
                          <a
                            href={`tel:${vendor.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-cyan-400 transition"
                          >
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{vendor.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 max-w-[200px] truncate" title={vendor.address}>
                        {vendor.address ? (
                          <div className="flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">{vendor.address}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{lastDate}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          {billCount} bill{billCount !== 1 ? 's' : ''}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-white whitespace-nowrap">
                        ₹{totalPurchased.toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof onSelectVendorInvoices === 'function') {
                              onSelectVendorInvoices(vendor);
                            } else {
                              setSelectedVendorForModal(vendor);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-slate-300 border border-slate-800 transition text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <span>View Bills</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vendor Details & Historical Inward Invoices Modal */}
      {selectedVendorForModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
          onClick={() => setSelectedVendorForModal(null)}
        >
          <div
            className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {selectedVendorForModal.vendor_name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    GSTIN: {selectedVendorForModal.gstin || 'Unregistered'} • {selectedVendorForModal.phone || 'No phone'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedVendorForModal(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Profile Details Pill Box */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Total Invoices</span>
                  <span className="font-bold text-amber-400 text-sm">
                    {selectedVendorForModal.total_bills_count || 1}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Total Spend</span>
                  <span className="font-bold text-white text-sm">
                    ₹{(Number(selectedVendorForModal.total_purchased_amount) || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Last Invoiced</span>
                  <span className="font-semibold text-slate-300">
                    {selectedVendorForModal.last_billed_date || 'N/A'}
                  </span>
                </div>
                {selectedVendorForModal.address && (
                  <div className="col-span-2 sm:col-span-3 pt-1 border-t border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">Registered Address</span>
                    <span className="text-slate-300">{selectedVendorForModal.address}</span>
                  </div>
                )}
              </div>

              {/* Historical Invoices List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Historical Inward Bills</span>
                  <button
                    type="button"
                    onClick={() => {
                      const v = selectedVendorForModal;
                      setSelectedVendorForModal(null);
                      if (onSelectVendorInvoices) onSelectVendorInvoices(v);
                    }}
                    className="text-amber-400 hover:text-amber-300 text-[11px] font-semibold"
                  >
                    Open in Invoices Ledger →
                  </button>
                </h4>

                {(() => {
                  const bills = getVendorInvoices(selectedVendorForModal);
                  if (bills.length === 0) {
                    return (
                      <div className="p-5 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                        No recorded invoices match this vendor in the current history ledger.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      {bills.map((b) => (
                        <div
                          key={b.id}
                          className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <span className="font-bold text-white block">
                              Bill #{b.invoice_number || 'N/A'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Date: {b.invoice_date || 'N/A'} • {b.purchase_items?.length || b.items?.length || 0} line items
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-emerald-400 block text-sm">
                              ₹{Number(b.grand_total || 0).toLocaleString('en-IN')}
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">
                              Verified
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedVendorForModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  const v = selectedVendorForModal;
                  setSelectedVendorForModal(null);
                  if (onSelectVendorInvoices) onSelectVendorInvoices(v);
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20"
              >
                Filter Invoices Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
