import React from 'react';
import { X, Database, CheckCircle2, Copy, AlertTriangle, ExternalLink, Terminal } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

export default function SupabaseInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const copySqlHint = () => {
    navigator.clipboard?.writeText(
      `-- See supabase_schema.sql in the project root\n-- Run it in the Supabase SQL editor to create drivers, orders, and delivery-proofs bucket.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isSupabaseConfigured ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
            }`}>
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Supabase Setup & Status</h3>
              <p className="text-[11px] text-slate-400">Database & Storage Configuration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Status Alert */}
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            isSupabaseConfigured
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          }`}>
            {isSupabaseConfigured ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold text-sm text-white">
                {isSupabaseConfigured ? 'Supabase Connected & Active' : 'Running in Interactive Demo Mode'}
              </p>
              <p className="mt-1 text-slate-300 leading-relaxed">
                {isSupabaseConfigured
                  ? 'Your web app is directly communicating with your Supabase backend and the "delivery-proofs" storage bucket.'
                  : 'Currently using local reactive storage with sample drivers and tasks so you can immediately test all dispatch, GPS, and POD features.'}
              </p>
            </div>
          </div>

          {/* Quick Setup Instructions */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">
              How to connect your live Supabase database:
            </h4>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]">1</span>
                <span>Open your Supabase project dashboard at <strong className="text-white">supabase.com</strong></span>
              </div>

              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]">2</span>
                <span>Copy <strong className="text-emerald-400">Project URL</strong> and <strong className="text-emerald-400">anon key</strong> into your <code className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-200">.env</code> file:</span>
              </div>

              <pre className="p-2.5 bg-slate-900 rounded-lg text-[11px] font-mono text-emerald-300 overflow-x-auto border border-slate-800">
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key
              </pre>

              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px]">3</span>
                <span>Run the prepared SQL schema from <strong className="text-white">supabase_schema.sql</strong> in Supabase SQL Editor.</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
