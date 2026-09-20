import React from 'react';
import { X, ExternalLink, FileText, Download, ZoomIn } from 'lucide-react';

export default function SlipViewerModal({
  isOpen,
  onClose,
  imageUrl,
  orderNumber
}) {
  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <span>Handwritten Order Slip</span>
                {orderNumber && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-bold border border-slate-700">
                    #{orderNumber}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">Photo captured during order placement</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
              title="Open original image in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Slip Image Viewport */}
        <div className="p-3 sm:p-4 overflow-auto flex-1 flex items-center justify-center bg-slate-950/90 select-none">
          <div className="relative group max-w-full max-h-[72vh] flex items-center justify-center">
            <img
              src={imageUrl}
              alt={orderNumber ? `Slip for #${orderNumber}` : 'Handwritten Slip'}
              className="max-h-[72vh] w-auto max-w-full rounded-xl object-contain border border-slate-800 shadow-2xl"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span className="hidden sm:inline">Pinch or open in a new tab to zoom</span>
          <div className="flex items-center gap-2 ml-auto">
            <a
              href={imageUrl}
              download={orderNumber ? `order_slip_${orderNumber}.jpg` : 'order_slip.jpg'}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download / Fullscreen</span>
            </a>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
