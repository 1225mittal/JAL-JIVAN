import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const { type = 'info', message } = toast;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-sky-400 shrink-0" />
  };

  const borderColors = {
    success: 'border-emerald-500/40 bg-slate-900/95 text-emerald-100',
    error: 'border-rose-500/40 bg-slate-900/95 text-rose-100',
    info: 'border-sky-500/40 bg-slate-900/95 text-sky-100'
  };

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md animate-bounce-short">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border ${borderColors[type] || borderColors.info} backdrop-blur-md`}>
        {icons[type] || icons.info}
        <p className="text-sm font-medium flex-1 text-slate-100">{message}</p>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 transition-colors rounded-lg"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
