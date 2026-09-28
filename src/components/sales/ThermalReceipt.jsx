import React, { useEffect } from 'react';
import { Printer, X, CheckCircle2, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function ThermalReceipt({
  isOpen,
  onClose,
  invoice,
  storeDetails = {
    name: 'JAL-JIVAN ENTERPRISE',
    tagline: 'FMCG Wholesale & Pure Drinking Water Delivery',
    address: 'Shop #12, Ground Floor, Sector 4, Jal-Jivan Complex, Greater Noida / Ghaziabad (U.P.)',
    phone: '+91 98765 43210',
    gstin: '09AABCU9603R1ZM',
    upiId: 'jaljivan@icici'
  },
  autoPrint = false
}) {
  useEffect(() => {
    if (isOpen && autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint]);

  if (!isOpen || !invoice) return null;

  const items = invoice.items || [];
  const grandTotal = Number(invoice.grand_total || 0);
  const subtotal = Number(invoice.subtotal || 0);
  const cgst = Number(invoice.cgst_amount || 0);
  const sgst = Number(invoice.sgst_amount || 0);
  const totalTax = Number(invoice.total_tax || (cgst + sgst));
  const roundOff = Number(invoice.round_off || 0);

  // Compute total MRP savings
  let totalMrp = 0;
  items.forEach((it) => {
    const q = Number(it.quantity || it.qty || 1);
    const m = Number(it.mrp) || Number(it.rate || 0);
    totalMrp += q * m;
  });
  const savings = Math.max(0, totalMrp - grandTotal);

  const reorderUpiUri = `upi://pay?pa=${encodeURIComponent(storeDetails.upiId)}&pn=${encodeURIComponent(storeDetails.name)}&am=${grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Reorder ${invoice.invoice_number}`)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      {/* On-Screen Modal Frame (Hidden during print) */}
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden print:hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>Bill Generated Successfully</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thermal Preview Canvas Container */}
        <div className="p-4 bg-slate-950/50 max-h-[70vh] overflow-y-auto flex justify-center">
          <div className="w-[80mm] bg-white text-black p-4 shadow-xl font-mono text-[11px] leading-tight select-none border border-slate-300 rounded-sm">
            {/* Store Header */}
            <div className="text-center space-y-0.5">
              <h2 className="text-sm font-black uppercase tracking-tight">{storeDetails.name}</h2>
              <p className="text-[9px] text-slate-700 italic">{storeDetails.tagline}</p>
              <p className="text-[9px] text-slate-700">{storeDetails.address}</p>
              <p className="text-[9px] font-bold">Ph: {storeDetails.phone}</p>
              <p className="text-[9px] font-bold">GSTIN: {storeDetails.gstin}</p>
            </div>

            <div className="my-2 border-t border-dashed border-black" />

            {/* Bill Meta */}
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>INVOICE: <strong>{invoice.invoice_number}</strong></span>
                <span>COUNTER: #01</span>
              </div>
              <div className="flex justify-between">
                <span>DATE: {invoice.invoice_date}</span>
                <span>TIME: {invoice.invoice_time || '10:00:00'}</span>
              </div>
              <div className="flex justify-between">
                <span>CUSTOMER: {invoice.customer_name || 'Walk-in'}</span>
                <span>{invoice.customer_phone || ''}</span>
              </div>
              <div className="flex justify-between">
                <span>PAYMENT: <strong>{invoice.payment_mode}</strong></span>
                <span>CASHIER: Admin</span>
              </div>
            </div>

            <div className="my-2 border-t border-dashed border-black" />

            {/* Itemized Table */}
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-black font-black text-[9px] uppercase">
                  <th className="py-1">ITEM</th>
                  <th className="py-1 text-center">QTY</th>
                  <th className="py-1 text-right">RATE</th>
                  <th className="py-1 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-slate-400">
                {items.map((it, idx) => {
                  const q = Number(it.quantity || it.qty || 1);
                  const r = Number(it.rate || it.selling_price || 0);
                  const tot = Number(it.total || it.total_amount || q * r);
                  return (
                    <tr key={idx} className="py-1">
                      <td className="py-1 pr-1 font-bold truncate max-w-[120px]">
                        {it.item_name}
                      </td>
                      <td className="py-1 text-center whitespace-nowrap">
                        {q} {it.unit || ''}
                      </td>
                      <td className="py-1 text-right whitespace-nowrap">
                        {r.toFixed(2)}
                      </td>
                      <td className="py-1 text-right font-bold whitespace-nowrap">
                        {tot.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="my-2 border-t border-dashed border-black" />

            {/* Totals Breakdown */}
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>TOTAL ITEMS / UNITS:</span>
                <span>{items.length} items ({items.reduce((s, it) => s + (Number(it.quantity || it.qty) || 1), 0)} pcs)</span>
              </div>
              <div className="flex justify-between">
                <span>TAXABLE BASE:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>CGST:</span>
                <span>₹{cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST:</span>
                <span>₹{sgst.toFixed(2)}</span>
              </div>
              {roundOff !== 0 && (
                <div className="flex justify-between">
                  <span>ROUND-OFF:</span>
                  <span>{roundOff > 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
                </div>
              )}
            </div>

            <div className="my-2 border-t-2 border-black" />

            {/* Net Grand Total */}
            <div className="flex justify-between items-center py-1">
              <span className="text-xs font-black uppercase">NET AMOUNT:</span>
              <span className="text-base font-black font-mono">₹{grandTotal.toFixed(2)}</span>
            </div>

            {/* Cash Tendered & Change Info */}
            {invoice.payment_mode === 'CASH' && Number(invoice.tendered_amount) > 0 && (
              <div className="text-[10px] space-y-0.5 pt-1 border-t border-dotted border-black">
                <div className="flex justify-between">
                  <span>CASH TENDERED:</span>
                  <span>₹{Number(invoice.tendered_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>CHANGE RETURNED:</span>
                  <span>₹{Number(invoice.change_returned || 0).toFixed(2)}</span>
                </div>
              </div>
            )}

            {invoice.payment_mode === 'SPLIT' && (
              <div className="text-[10px] space-y-0.5 pt-1 border-t border-dotted border-black">
                <div className="flex justify-between">
                  <span>CASH PAID:</span>
                  <span>₹{Number(invoice.split_cash || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>UPI PAID:</span>
                  <span>₹{Number(invoice.split_upi || 0).toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Savings Callout */}
            {savings > 0 && (
              <div className="my-2 p-1 text-center bg-slate-100 border border-slate-300 font-bold text-[10px]">
                🎉 YOU SAVED ₹{savings.toFixed(2)} ON THIS ORDER!
              </div>
            )}

            <div className="my-2 border-t border-dashed border-black" />

            {/* Reorder UPI QR & Footer */}
            <div className="flex flex-col items-center justify-center text-center space-y-1 mt-2">
              <div className="p-1 bg-white border border-black inline-block">
                <QRCodeSVG value={reorderUpiUri} size={65} />
              </div>
              <p className="text-[9px] font-bold">Scan to Pay & Re-order via UPI</p>
              <p className="text-[8px] text-slate-700">UPI ID: {storeDetails.upiId}</p>
              <p className="text-[9px] font-black uppercase mt-1">Thank you for choosing Jal-Jivan!</p>
              <p className="text-[8px] text-slate-600">Computer generated thermal tax invoice.</p>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print 3" Thermal (F8)</span>
          </button>
        </div>
      </div>

      {/* DEDICATED PRINT CONTAINER (Active strictly on window.print) */}
      <div id="thermal-receipt-print-area" className="hidden print:block w-[80mm] p-2 bg-white text-black font-mono text-[11px] leading-tight mx-auto">
        <div className="text-center space-y-0.5">
          <h2 className="text-sm font-black uppercase tracking-tight">{storeDetails.name}</h2>
          <p className="text-[9px] text-slate-700 italic">{storeDetails.tagline}</p>
          <p className="text-[9px] text-slate-700">{storeDetails.address}</p>
          <p className="text-[9px] font-bold">Ph: {storeDetails.phone}</p>
          <p className="text-[9px] font-bold">GSTIN: {storeDetails.gstin}</p>
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        <div className="space-y-0.5 text-[10px]">
          <div className="flex justify-between">
            <span>INVOICE: <strong>{invoice.invoice_number}</strong></span>
            <span>COUNTER: #01</span>
          </div>
          <div className="flex justify-between">
            <span>DATE: {invoice.invoice_date}</span>
            <span>TIME: {invoice.invoice_time || '10:00:00'}</span>
          </div>
          <div className="flex justify-between">
            <span>CUSTOMER: {invoice.customer_name || 'Walk-in'}</span>
            <span>{invoice.customer_phone || ''}</span>
          </div>
          <div className="flex justify-between">
            <span>PAYMENT: <strong>{invoice.payment_mode}</strong></span>
            <span>CASHIER: Admin</span>
          </div>
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-black font-black text-[9px] uppercase">
              <th className="py-1">ITEM</th>
              <th className="py-1 text-center">QTY</th>
              <th className="py-1 text-right">RATE</th>
              <th className="py-1 text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dotted divide-slate-400">
            {items.map((it, idx) => {
              const q = Number(it.quantity || it.qty || 1);
              const r = Number(it.rate || it.selling_price || 0);
              const tot = Number(it.total || it.total_amount || q * r);
              return (
                <tr key={idx} className="py-1">
                  <td className="py-1 pr-1 font-bold truncate max-w-[120px]">
                    {it.item_name}
                  </td>
                  <td className="py-1 text-center whitespace-nowrap">
                    {q} {it.unit || ''}
                  </td>
                  <td className="py-1 text-right whitespace-nowrap">
                    {r.toFixed(2)}
                  </td>
                  <td className="py-1 text-right font-bold whitespace-nowrap">
                    {tot.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="my-2 border-t border-dashed border-black" />

        <div className="space-y-0.5 text-[10px]">
          <div className="flex justify-between">
            <span>TOTAL ITEMS / UNITS:</span>
            <span>{items.length} items ({items.reduce((s, it) => s + (Number(it.quantity || it.qty) || 1), 0)} pcs)</span>
          </div>
          <div className="flex justify-between">
            <span>TAXABLE BASE:</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>CGST:</span>
            <span>₹{cgst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>SGST:</span>
            <span>₹{sgst.toFixed(2)}</span>
          </div>
          {roundOff !== 0 && (
            <div className="flex justify-between">
              <span>ROUND-OFF:</span>
              <span>{roundOff > 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
            </div>
          )}
        </div>

        <div className="my-2 border-t-2 border-black" />

        <div className="flex justify-between items-center py-1">
          <span className="text-xs font-black uppercase">NET AMOUNT:</span>
          <span className="text-base font-black font-mono">₹{grandTotal.toFixed(2)}</span>
        </div>

        {invoice.payment_mode === 'CASH' && Number(invoice.tendered_amount) > 0 && (
          <div className="text-[10px] space-y-0.5 pt-1 border-t border-dotted border-black">
            <div className="flex justify-between">
              <span>CASH TENDERED:</span>
              <span>₹{Number(invoice.tendered_amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>CHANGE RETURNED:</span>
              <span>₹{Number(invoice.change_returned || 0).toFixed(2)}</span>
            </div>
          </div>
        )}

        {savings > 0 && (
          <div className="my-2 p-1 text-center bg-slate-100 border border-slate-300 font-bold text-[10px]">
            🎉 YOU SAVED ₹{savings.toFixed(2)} ON THIS ORDER!
          </div>
        )}

        <div className="my-2 border-t border-dashed border-black" />

        <div className="flex flex-col items-center justify-center text-center space-y-1 mt-2">
          <div className="p-1 bg-white border border-black inline-block">
            <QRCodeSVG value={reorderUpiUri} size={65} />
          </div>
          <p className="text-[9px] font-bold">Scan to Pay & Re-order via UPI</p>
          <p className="text-[8px] text-slate-700">UPI ID: {storeDetails.upiId}</p>
          <p className="text-[9px] font-black uppercase mt-1">Thank you for choosing Jal-Jivan!</p>
          <p className="text-[8px] text-slate-600">Computer generated thermal tax invoice.</p>
        </div>
      </div>
    </div>
  );
}
