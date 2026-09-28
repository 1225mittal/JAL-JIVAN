import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Copy, Check, ExternalLink, ShieldCheck, Smartphone } from 'lucide-react';

export default function DynamicUpiQr({
  grandTotal = 0,
  upiId = 'jaljivan@icici',
  payeeName = 'JAL JIVAN ENTERPRISE',
  invoiceNumber = '',
  onPaymentConfirmed = null,
  compact = false
}) {
  const [copied, setCopied] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const cleanTotal = Math.max(0, Number(grandTotal) || 0).toFixed(2);
  const cleanUpi = (upiId || 'jaljivan@icici').trim();
  const note = invoiceNumber ? `Bill ${invoiceNumber}` : 'Jal-Jivan Retail Bill';

  // Construct valid Indian NPCI UPI Payment URI
  const upiUri = `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(payeeName)}&am=${cleanTotal}&cu=INR&tn=${encodeURIComponent(note)}`;

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(cleanUpi);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`rounded-2xl border transition-all ${compact ? 'p-3 bg-slate-900/90 border-slate-800' : 'p-4 bg-gradient-to-b from-slate-900 to-slate-950 border-emerald-500/30 shadow-xl'}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
            <QrCode className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-300">
              Live Counter UPI QR
            </h4>
            <p className="text-[10px] text-slate-400">
              Instant scan via any UPI app
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          Active
        </span>
      </div>

      {/* QR Code Canvas with High Contrast White Backing */}
      <div className="flex flex-col items-center justify-center">
        <div className="p-3 bg-white rounded-2xl shadow-lg border border-slate-200 inline-block transition-transform hover:scale-[1.02]">
          <QRCodeSVG
            value={upiUri}
            size={compact ? 130 : 160}
            level="M"
            includeMargin={false}
          />
        </div>

        {/* Live Amount Banner */}
        <div className="mt-3 text-center">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            Amount to Pay
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
            ₹{cleanTotal}
          </div>
        </div>

        {/* VPA Copy Bar */}
        <div className="mt-2.5 w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300">
          <span className="truncate text-[11px] font-semibold text-slate-400">
            UPI ID: <strong className="text-white">{cleanUpi}</strong>
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-emerald-300 transition cursor-pointer shrink-0"
            title="Copy UPI VPA"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Supported UPI Apps Pills */}
        <div className="mt-3 flex items-center justify-center gap-1.5 flex-wrap">
          {['GPay', 'PhonePe', 'Paytm', 'BHIM', 'Cred'].map((app) => (
            <span
              key={app}
              className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-[10px] font-bold text-slate-300"
            >
              {app}
            </span>
          ))}
        </div>

        {/* Quick Payment Verification Button */}
        {onPaymentConfirmed && (
          <button
            type="button"
            onClick={() => {
              setIsVerifying(true);
              setTimeout(() => {
                setIsVerifying(false);
                onPaymentConfirmed();
              }, 400);
            }}
            disabled={isVerifying}
            className="mt-3 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-xs tracking-wide transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isVerifying ? 'Confirming...' : 'Mark UPI Payment Received'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
