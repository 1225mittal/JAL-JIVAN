import React, { useState } from 'react';
import {
  Camera,
  Layers,
  Building2,
  GitMerge,
  Headphones,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  RotateCcw,
  Sliders,
  ShieldCheck,
  Info,
  Calendar,
  Truck,
  FileText,
  IndianRupee,
  Mic,
  Video,
  Hash
} from 'lucide-react';
import { useAppSettings } from '../../context/AppSettingsContext';

export default function DamageWorkflowToggles({ onBack }) {
  const { config, updateToggle, resetToDefaults, syncStatus, loading } = useAppSettings();
  const [resetConfirm, setResetConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'intake' | 'rack' | 'rules' | 'pipeline' | 'hardware'

  const handleToggle = (section, key) => {
    const currentVal = config?.[section]?.[key] ?? true;
    updateToggle(section, key, !currentVal);
  };

  // Modern animated toggle switch
  const renderToggle = (section, key, titleEn, titleHi, descEn, icon = null) => {
    const isChecked = Boolean(config?.[section]?.[key]);
    const toggleId = `toggle-${section}-${key}`;

    return (
      <div
        key={key}
        onClick={() => handleToggle(section, key)}
        className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-start justify-between gap-3 ${
          isChecked
            ? 'bg-slate-900/90 border-slate-700/80 hover:border-emerald-500/50 shadow-sm'
            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 opacity-80'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 transition-colors ${
                isChecked
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800/80 text-slate-500 border-slate-700/60'
              }`}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-xs sm:text-sm tracking-tight">
                {titleEn}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/80">
                {titleHi}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-1 leading-relaxed">
              {descEn}
            </p>
          </div>
        </div>

        {/* Toggle Pill Switch */}
        <div className="pt-1 shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={isChecked}
            id={toggleId}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isChecked ? 'bg-emerald-500 shadow-md shadow-emerald-500/30' : 'bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                isChecked ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    );
  };

  // Calculate active toggle counts
  const totalToggles = 19;
  const activeCount = Object.values(config || {}).reduce((acc, section) => {
    return acc + Object.values(section || {}).filter(Boolean).length;
  }, 0);

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto pb-16 animate-fade-in">
      {/* Header & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20 shrink-0">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Damage Workflow Controls & Toggles
              </h1>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                कंट्रोल / सेटिंग्स
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Customize mandatory fields, Groq AI OCR, godown rack assignment, and settlement stages
            </p>
          </div>
        </div>

        {/* Status indicator & Reset button */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
              syncStatus === 'synced'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : syncStatus === 'saving'
                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === 'synced'
                  ? 'bg-emerald-400'
                  : syncStatus === 'saving'
                  ? 'bg-cyan-400 animate-ping'
                  : 'bg-amber-400'
              }`}
            />
            <span>
              {syncStatus === 'synced'
                ? 'Cloud Synced'
                : syncStatus === 'saving'
                ? 'Saving...'
                : 'Local Cached'}
            </span>
          </div>

          {resetConfirm ? (
            <div className="flex items-center gap-1.5 animate-fade-in">
              <button
                type="button"
                onClick={async () => {
                  await resetToDefaults();
                  setResetConfirm(false);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-sm"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setResetConfirm(false)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs transition"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setResetConfirm(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
              title="Reset all settings to Jal-Jivan default workflow"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Defaults</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Navigation Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'all', label: `All Rules (${activeCount}/${totalToggles})`, icon: Sliders },
          { id: 'intake', label: 'Step 1: Intake & OCR', icon: Camera },
          { id: 'rack', label: 'Step 2: Godown Racks', icon: Layers },
          { id: 'rules', label: 'Step 3: Company & Salesmen', icon: Building2 },
          { id: 'pipeline', label: 'Step 4: 3-Stage Pipeline', icon: GitMerge },
          { id: 'hardware', label: 'Hardware & Voice', icon: Headphones }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 border ${
                isActive
                  ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECTION 1: Product Intake & Dual-Photo OCR */}
      {(activeTab === 'all' || activeTab === 'intake') && (
        <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-white">
                  Step 1: Product Intake & Dual-Photo OCR
                </h2>
                <p className="text-[11px] text-slate-400">सामान दर्ज करने व AI विवरण स्कैन नियम</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-slate-400">7 Toggles</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {renderToggle(
              'intake',
              'require_front_photo',
              'Require Front Packaging Photo',
              'सामने की फोटो अनिवार्य',
              'Must take a photo of the front branding before saving the damaged item',
              <Camera className="w-4 h-4" />
            )}

            {renderToggle(
              'intake',
              'require_back_photo',
              'Require Back MRP/Expiry Photo',
              'पीछे की लेबल फोटो अनिवार्य',
              'Must take photo of the back label showing MRP, Batch, and Expiry before saving',
              <Camera className="w-4 h-4" />
            )}

            {renderToggle(
              'intake',
              'allow_groq_ocr_autofill',
              'Groq AI Vision Auto-fill',
              'Groq OCR से स्वतः भरें',
              'Show "AI Vision Scan" button to auto-extract product, dates & batch from photos',
              <Sparkles className="w-4 h-4" />
            )}

            {renderToggle(
              'intake',
              'require_mrp',
              'Mandatory MRP Field',
              'MRP भरना अनिवार्य',
              'Staff must enter a valid MRP in rupees to compute loss values accurately',
              <IndianRupee className="w-4 h-4" />
            )}

            {renderToggle(
              'intake',
              'require_expiry',
              'Mandatory Expiry Date',
              'एक्सपायरी तारीख अनिवार्य',
              'Staff must specify the expiry date (MM/YY or YYYY-MM-DD)',
              <Calendar className="w-4 h-4" />
            )}

            {renderToggle(
              'intake',
              'require_batch',
              'Mandatory Batch Number',
              'बैच नंबर अनिवार्य',
              'Requires batch code for manufacturer traceability and return claims',
              <Hash className="w-4 h-4" />
            )}

            {renderToggle(
              'intake',
              'require_net_weight',
              'Mandatory Net Qty (Weight/Vol)',
              'वज़न / माप अनिवार्य',
              'Requires net weight or volume specification (e.g. 500g, 1L, 20L)',
              <Info className="w-4 h-4" />
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: Godown Rack Management */}
      {(activeTab === 'all' || activeTab === 'rack') && (
        <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-white">
                  Step 2: Godown Rack Management
                </h2>
                <p className="text-[11px] text-slate-400">गोदाम रैक व शेल्फ सेटिंग्स</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-slate-400">3 Toggles</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {renderToggle(
              'rack',
              'enable_rack_allocation',
              'Use Rack Numbering System',
              'रैक सिस्टम चालू रखें',
              'Enables godown rack location tagging (e.g. Rack A1, Shelf B2, Ground Floor)',
              <Layers className="w-4 h-4" />
            )}

            {renderToggle(
              'rack',
              'require_rack_selection',
              'Force Rack Selection Before Save',
              'रैक चुनना अनिवार्य',
              'Prevents staff from saving damaged items without assigning a godown rack location',
              <CheckCircle2 className="w-4 h-4" />
            )}

            {renderToggle(
              'rack',
              'show_rack_in_salesman_list',
              'Display Rack on Salesman Slips',
              'पर्ची में रैक नंबर दिखाएं',
              'Prints/shows exact physical rack locations on distributor return slips for easy retrieval',
              <FileText className="w-4 h-4" />
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: Company & Salesman Rules */}
      {(activeTab === 'all' || activeTab === 'rules') && (
        <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-white">
                  Step 3: Company & Salesman Rules
                </h2>
                <p className="text-[11px] text-slate-400">कंपनी व सप्लायर नियम और विजिट शेड्यूल</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-slate-400">4 Toggles</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {renderToggle(
              'rules',
              'require_company_and_distributor',
              'Separate Company & Distributor',
              'कंपनी और डिस्ट्रीब्यूटर अलग रखें',
              'Maintains distinct brand company names (e.g. Parle) alongside local distributor firms',
              <Building2 className="w-4 h-4" />
            )}

            {renderToggle(
              'rules',
              'enable_visit_day_schedule',
              'Track Salesman Visit Days',
              'सेल्समैन विजिट दिन ट्रैक करें',
              'Enables tracking of weekly scheduled visit days (e.g. Haldiram rep visits on Tuesdays)',
              <Calendar className="w-4 h-4" />
            )}

            {renderToggle(
              'rules',
              'enable_return_window_rules',
              'Enforce Return Window Limits',
              'वापसी समय-सीमा लागू करें',
              'Warns if return request is outside agreed return window (e.g. 1st-7th of month or last week)',
              <Clock className="w-4 h-4" />
            )}

            {renderToggle(
              'rules',
              'filter_today_visits_by_default',
              'Highlight Today’s Visiting Reps',
              'आज के सेल्समैन पहले दिखाएं',
              'Automatically filters the distributor list to highlight representatives visiting today',
              <CheckCircle2 className="w-4 h-4" />
            )}
          </div>
        </div>
      )}

      {/* SECTION 4: 3-Stage Settlement Pipeline */}
      {(activeTab === 'all' || activeTab === 'pipeline') && (
        <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">
                <GitMerge className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-white">
                  Step 4: 3-Stage Settlement Pipeline
                </h2>
                <p className="text-[11px] text-slate-400">3-स्टेप वापसी प्रक्रिया (पर्ची → गाड़ी लोड → क्रेडिट नोट)</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-slate-400">4 Toggles</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {renderToggle(
              'pipeline',
              'enable_step1_return_slip',
              'Stage 1: Return Slip Made',
              'स्टेज 1: पर्ची बनाना',
              'First stage records that an official return slip was drafted. Turn off to jump straight to vehicle pickup',
              <FileText className="w-4 h-4" />
            )}

            {renderToggle(
              'pipeline',
              'require_slip_photo',
              'Require Photo of Signed Slip',
              'हस्ताक्षरित पर्ची फोटो अनिवार्य',
              'Must photograph the physical signed vendor slip before advancing past Stage 1',
              <Camera className="w-4 h-4" />
            )}

            {renderToggle(
              'pipeline',
              'enable_step2_driver_pickup',
              'Stage 2: Driver / Vehicle Pickup',
              'स्टेज 2: गाड़ी में लोड होना',
              'Second stage records that the distributor vehicle or recovery driver loaded the items',
              <Truck className="w-4 h-4" />
            )}

            {renderToggle(
              'pipeline',
              'enable_step3_credit_received',
              'Stage 3: Credit Settlement Tracking',
              'स्टेज 3: खाते/बिल में कटौती',
              'Final stage tracks that the credit note amount or replacement inventory was verified in billing',
              <IndianRupee className="w-4 h-4" />
            )}
          </div>
        </div>
      )}

      {/* SECTION 5: Hardware & Accessibility Options */}
      {(activeTab === 'all' || activeTab === 'hardware') && (
        <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-bold">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-white">
                  Hardware & Accessibility Options
                </h2>
                <p className="text-[11px] text-slate-400">हार्डवेयर, USB हेडकैम व वॉइस कंट्रोल्स</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-slate-400">2 Toggles</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {renderToggle(
              'hardware',
              'enable_external_usb_headcam',
              'USB / OTG Headcam Switcher',
              'USB हेडकैम सपोर्ट',
              'Allows switching video source to wearable external USB / OTG cameras for hands-free scanning',
              <Video className="w-4 h-4" />
            )}

            {renderToggle(
              'hardware',
              'enable_voice_commands',
              'Hands-Free Voice Triggers',
              'वॉइस ट्रिगर्स ("फोटो" / "स्कैन")',
              'Allows staff to shout "Scan" or "Photo" while holding heavy cartons for hands-free capture',
              <Mic className="w-4 h-4" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
