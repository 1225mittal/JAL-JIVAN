import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  X,
  Plus,
  Trash2,
  Calendar,
  Phone,
  User,
  Tag,
  Clock,
  Sparkles,
  Mic,
  MicOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  HelpCircle
} from 'lucide-react';
import {
  DAYS_OF_WEEK,
  CLAIM_WINDOW_PRESETS,
  RETURN_ELIGIBILITY_OPTIONS,
  SETTLEMENT_MODES,
  stripCompanyName,
  stripSalesmanName,
  stripDistributorName,
  stripProductCategories,
  cleanSingleFieldDictation,
  parseDistributorVoice
} from '../lib/distributorVoiceParser';

export default function AddDistributorModal({
  isOpen,
  onClose,
  editingDistributor = null,
  onSave
}) {
  // Form State
  const [distributorName, setDistributorName] = useState('');
  const [claimWindowPreset, setClaimWindowPreset] = useState('1st - 10th');
  const [claimWindowStart, setClaimWindowStart] = useState(1);
  const [claimWindowEnd, setClaimWindowEnd] = useState(10);
  const [returnEligibility, setReturnEligibility] = useState([
    'Expired Stock',
    'Damage / Breakage / Leakage',
    'Consumer Complaint'
  ]);
  const [settlementMode, setSettlementMode] = useState('Credit Note (CN)');
  const [notes, setNotes] = useState('');

  // Multi-Division & Multi-Salesman structure
  const [divisions, setDivisions] = useState([
    {
      id: 'div-1',
      company_name: '',
      product_categories: '',
      salesman_name: '',
      salesman_phone: '',
      visit_day: 'Monday'
    }
  ]);

  // Form submission & feedback
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Speech-to-Text State
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState('hi-IN'); // 'hi-IN' or 'en-IN'
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [isParsingVoice, setIsParsingVoice] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');
  
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const transcriptAccumulatorRef = useRef('');

  const isSpeechSupported =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  // Initialize or reset form when modal opens or editingDistributor changes
  useEffect(() => {
    if (!isOpen) {
      stopRecognition();
      resetForm();
      return;
    }

    if (editingDistributor) {
      setDistributorName(editingDistributor.distributor_name || '');
      setClaimWindowPreset(editingDistributor.claim_window_preset || '1st - 10th');
      setClaimWindowStart(Number(editingDistributor.claim_window_start) || 1);
      setClaimWindowEnd(Number(editingDistributor.claim_window_end) || 10);
      setSettlementMode(editingDistributor.settlement_mode || 'Credit Note (CN)');
      setReturnEligibility(
        Array.isArray(editingDistributor.return_eligibility) && editingDistributor.return_eligibility.length > 0
          ? editingDistributor.return_eligibility
          : ['Expired Stock', 'Damage / Breakage / Leakage', 'Consumer Complaint']
      );
      setNotes(editingDistributor.notes || '');

      // Load divisions
      if (Array.isArray(editingDistributor.divisions) && editingDistributor.divisions.length > 0) {
        setDivisions(
          editingDistributor.divisions.map((d, idx) => ({
            id: d.id || `div-${idx + 1}`,
            company_name: d.company_name || '',
            product_categories: d.product_categories || '',
            salesman_name: d.salesman_name || '',
            salesman_phone: d.salesman_phone || '',
            visit_day: d.visit_day || 'Monday'
          }))
        );
      } else {
        // Fallback for single division legacy record
        setDivisions([
          {
            id: 'div-1',
            company_name: editingDistributor.company_name || '',
            product_categories: '',
            salesman_name: editingDistributor.salesman_name || '',
            salesman_phone: editingDistributor.salesman_phone || '',
            visit_day: editingDistributor.visit_day || 'Monday'
          }
        ]);
      }
    } else {
      resetForm();
    }
  }, [isOpen, editingDistributor]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      stopRecognition();
    };
  }, []);

  const resetForm = () => {
    setDistributorName('');
    setClaimWindowPreset('1st - 10th');
    setClaimWindowStart(1);
    setClaimWindowEnd(10);
    setReturnEligibility([
      'Expired Stock',
      'Damage / Breakage / Leakage',
      'Consumer Complaint'
    ]);
    setSettlementMode('Credit Note (CN)');
    setNotes('');
    setDivisions([
      {
        id: 'div-1',
        company_name: '',
        product_categories: '',
        salesman_name: '',
        salesman_phone: '',
        visit_day: 'Monday'
      }
    ]);
    setFormError('');
    setVoiceNotice('');
    setSpeechTranscript('');
    transcriptAccumulatorRef.current = '';
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const stopRecognition = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  // Division management
  const addDivision = () => {
    setDivisions((prev) => [
      ...prev,
      {
        id: 'div-' + Date.now() + '-' + (prev.length + 1),
        company_name: '',
        product_categories: '',
        salesman_name: '',
        salesman_phone: '',
        visit_day: 'Monday'
      }
    ]);
  };

  const removeDivision = (id) => {
    if (divisions.length <= 1) return;
    setDivisions((prev) => prev.filter((d) => d.id !== id));
  };

  const updateDivision = (id, field, value) => {
    setDivisions((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
  };

  // Claim window preset selector handler
  const handlePresetSelect = (preset) => {
    setClaimWindowPreset(preset.label);
    if (preset.label !== 'Custom Range') {
      setClaimWindowStart(preset.start);
      setClaimWindowEnd(preset.end);
    }
  };

  // Return eligibility checkbox toggle
  const toggleEligibility = (opt) => {
    setReturnEligibility((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );
  };

  // Voice Dictation with 3.5s silence debounce & manual Done button
  const startVoiceDictation = () => {
    if (!isSpeechSupported) {
      setFormError(
        'Voice dictation is supported in Google Chrome, Microsoft Edge, and Android Chrome.'
      );
      return;
    }

    stopRecognition();
    setFormError('');
    setVoiceNotice('Listening... Speak naturally (e.g. "Distributor Laxmi Agency, company Britannia personal care, salesman Ramesh phone 9812345678, claim window 1st to 10th")');
    setSpeechTranscript('');
    transcriptAccumulatorRef.current = '';

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLang;
    recognition.maxAlternatives = 1;

    // Reset silence timer helper
    const resetSilenceTimer = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = setTimeout(() => {
        handleManualDoneVoice();
      }, 3500); // 3.5-second debounce on silence
    };

    recognition.onstart = () => {
      setIsListening(true);
      resetSilenceTimer();
    };

    recognition.onresult = (event) => {
      resetSilenceTimer();
      let currentInterim = '';
      let currentFinal = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        if (item.isFinal) {
          currentFinal += item[0].transcript + ' ';
        } else {
          currentInterim += item[0].transcript;
        }
      }

      if (currentFinal) {
        transcriptAccumulatorRef.current += ' ' + currentFinal;
      }

      const display = (transcriptAccumulatorRef.current + ' ' + currentInterim).trim();
      setSpeechTranscript(display);
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition notice:', event.error);
      if (event.error !== 'no-speech') {
        setVoiceNotice(`Mic status: ${event.error}. You can retry or type directly.`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  // Manual Done / Process or silence-triggered finish
  const handleManualDoneVoice = async () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);

    const fullTranscript = (transcriptAccumulatorRef.current || speechTranscript).trim();
    if (!fullTranscript) {
      setVoiceNotice('No speech detected. Please tap mic and speak again.');
      return;
    }

    setIsParsingVoice(true);
    setVoiceNotice('Processing speech & extracting FMCG entities...');

    try {
      const parsed = await parseDistributorVoice(fullTranscript);

      // Clean entities with regex prefix strippers
      if (parsed.distributor_name) {
        setDistributorName(stripDistributorName(parsed.distributor_name));
      }

      if (parsed.claim_window_preset) {
        setClaimWindowPreset(parsed.claim_window_preset);
        setClaimWindowStart(parsed.claim_window_start || 1);
        setClaimWindowEnd(parsed.claim_window_end || 10);
      }

      if (parsed.settlement_mode) {
        setSettlementMode(parsed.settlement_mode);
      }

      if (Array.isArray(parsed.return_eligibility) && parsed.return_eligibility.length > 0) {
        setReturnEligibility(parsed.return_eligibility);
      }

      if (parsed.notes) {
        setNotes((prev) => (prev ? `${prev}\n${parsed.notes}` : parsed.notes));
      }

      // Populate primary division
      setDivisions((prev) => {
        const first = prev[0] || {
          id: 'div-1',
          company_name: '',
          product_categories: '',
          salesman_name: '',
          salesman_phone: '',
          visit_day: 'Monday'
        };

        const updatedFirst = {
          ...first,
          company_name: stripCompanyName(parsed.company_name) || first.company_name,
          product_categories: stripProductCategories(parsed.product_categories) || first.product_categories,
          salesman_name: stripSalesmanName(parsed.salesman_name) || first.salesman_name,
          salesman_phone: parsed.salesman_phone || first.salesman_phone,
          visit_day: parsed.visit_day || first.visit_day
        };

        return [updatedFirst, ...prev.slice(1)];
      });

      setVoiceNotice('✓ Voice details parsed and populated successfully!');
      setTimeout(() => setVoiceNotice(''), 4000);
    } catch (err) {
      console.warn('Voice parsing error:', err);
      setVoiceNotice('Could not extract all fields automatically, please verify form inputs.');
    } finally {
      setIsParsingVoice(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!distributorName.trim()) {
      setFormError('Please enter distributor / agency name / डिस्ट्रीब्यूटर का नाम आवश्यक है।');
      return;
    }

    // Validate divisions
    const validDivisions = divisions.map((d) => ({
      ...d,
      company_name: stripCompanyName(d.company_name),
      product_categories: stripProductCategories(d.product_categories),
      salesman_name: stripSalesmanName(d.salesman_name),
      salesman_phone: (d.salesman_phone || '').replace(/\D/g, '').slice(-10),
      claim_window_preset: claimWindowPreset,
      claim_window_start: Number(claimWindowStart) || 1,
      claim_window_end: Number(claimWindowEnd) || 10
    }));

    const primaryCompany = validDivisions[0]?.company_name || '';
    if (!primaryCompany) {
      setFormError('Please enter at least one FMCG company / brand in Division #1.');
      return;
    }

    // Validate custom range days
    let startDay = Number(claimWindowStart) || 1;
    let endDay = Number(claimWindowEnd) || 10;
    if (claimWindowPreset === 'Custom Range') {
      if (startDay < 1 || startDay > 31 || endDay < 1 || endDay > 31) {
        setFormError('Custom claim window days must be between 1 and 31.');
        return;
      }
      if (startDay > endDay) {
        // Auto-fix if swapped
        const tmp = startDay;
        startDay = endDay;
        endDay = tmp;
      }
    }

    const payload = {
      ...(editingDistributor ? { id: editingDistributor.id } : {}),
      distributor_name: stripDistributorName(distributorName),
      divisions: validDivisions,
      claim_window_preset: claimWindowPreset,
      claim_window_start: startDay,
      claim_window_end: endDay,
      return_eligibility: returnEligibility,
      settlement_mode: settlementMode,
      notes: notes.trim(),
      // Backward compatibility primary fields
      company_name: validDivisions.map((d) => d.company_name).filter(Boolean).join(', '),
      salesman_name: validDivisions[0]?.salesman_name || '',
      salesman_phone: validDivisions[0]?.salesman_phone || '',
      visit_day: validDivisions[0]?.visit_day || 'Monday',
      return_window_rule:
        claimWindowPreset === 'Anytime / Weekly Visit'
          ? 'Anytime / Weekly Visit'
          : `${startDay}th–${endDay}th of Month (${claimWindowPreset})`
    };

    try {
      setSubmitting(true);
      await onSave(payload);
      onClose();
    } catch (err) {
      console.error('Error saving distributor:', err);
      setFormError(err.message || 'Failed to save distributor. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto max-w-[100vw]">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-scale-up my-auto max-w-full">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                {editingDistributor ? 'Edit Distributor & Divisions' : 'Register FMCG Distributor'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Multi-brand divisions, monthly claim cycle & salesman roster
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 shrink-0 transition"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Voice Assistant Master Bar (Continuous recognition + 3.5s silence debounce + Done button) */}
        <div className="p-3 sm:p-4 mx-3 sm:mx-6 mt-3 sm:mt-4 rounded-2xl bg-gradient-to-br from-cyan-950/60 via-slate-900/90 to-indigo-950/60 border border-cyan-500/30 shadow-lg space-y-3 max-w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/40 ring-4 ring-rose-500/20'
                    : 'bg-cyan-500/20 text-cyan-300'
                }`}
              >
                <Mic className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-white tracking-wide shrink-0">
                    Voice Dictation Assistant
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                    Bilingual Auto-Fill
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                  Speak naturally (Hindi / English / Hinglish)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Language Switch */}
              <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setSpeechLang('hi-IN')}
                  className={`px-2 py-1 rounded-md transition ${
                    speechLang === 'hi-IN'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  हिन्दी
                </button>
                <button
                  type="button"
                  onClick={() => setSpeechLang('en-IN')}
                  className={`px-2 py-1 rounded-md transition ${
                    speechLang === 'en-IN'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  English
                </button>
              </div>

              {/* Start / Listening / Done buttons */}
              {isListening ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleManualDoneVoice}
                    className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-600/30 transition animate-pulse"
                    title="Finish and process voice input immediately"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Done / Process</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopRecognition}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                    title="Cancel dictation"
                  >
                    <MicOff className="w-3.5 h-3.5 text-rose-400" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startVoiceDictation}
                  disabled={isParsingVoice}
                  className="py-1.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/20 transition disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>🎤 Speak Details</span>
                </button>
              )}
            </div>
          </div>

          {/* Transcript / Status banner */}
          {(isListening || isParsingVoice || speechTranscript || voiceNotice) && (
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-cyan-500/20 text-xs space-y-1.5 animate-fade-in">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-cyan-300 flex items-center gap-1">
                  {isParsingVoice ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                      <span>Parsing with AI...</span>
                    </>
                  ) : isListening ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span className="text-rose-400 font-bold">Listening (3.5s silence auto-done)</span>
                    </>
                  ) : (
                    <span>Dictation Transcript:</span>
                  )}
                </span>
                {isListening && (
                  <span className="text-[10px] text-slate-400">
                    Tap &ldquo;Done / Process&rdquo; anytime
                  </span>
                )}
              </div>
              {speechTranscript && (
                <p className="text-white italic bg-slate-900/90 p-2 rounded-lg border border-slate-800 font-mono text-[11px] leading-relaxed break-words">
                  &ldquo;{speechTranscript}&rdquo;
                </p>
              )}
              {voiceNotice && (
                <p className="text-[11px] text-emerald-400 font-semibold">{voiceNotice}</p>
              )}
            </div>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Distributor Firm Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Distributor / Agency Firm Name *</span>
              </span>
              <span className="text-[10px] font-normal text-slate-400">
                e.g. Laxmi Agency, Shree Balaji Traders
              </span>
            </label>
            <input
              type="text"
              required
              value={distributorName}
              onChange={(e) => setDistributorName(e.target.value)}
              placeholder="e.g. Laxmi Agency / लक्ष्मी एजेंसी"
              style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition font-medium"
            />
          </div>

          {/* 2. Multi-Division & Multi-Salesman repeating block */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs sm:text-sm font-bold text-white">
                  Brand Divisions & Salesmen ({divisions.length})
                </h4>
              </div>
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                Supports multiple salesmen per distributor (e.g. HUL personal care vs foods)
              </span>
            </div>

            <div className="space-y-3">
              {divisions.map((div, index) => (
                <div
                  key={div.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-black flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span>
                        {index === 0 ? 'Primary Division / Brand' : `Division #${index + 1}`}
                      </span>
                    </span>

                    {divisions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDivision(div.id)}
                        className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-rose-500/10 transition"
                        title="Remove division"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Company / Brand */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-cyan-400" />
                        <span>Company / Brand *</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={div.company_name}
                        onChange={(e) => updateDivision(div.id, 'company_name', e.target.value)}
                        placeholder="e.g. Britannia, Tata Consumer, HUL"
                        style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition font-medium"
                      />
                    </div>

                    {/* Product Categories */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Product Categories
                      </label>
                      <input
                        type="text"
                        value={div.product_categories}
                        onChange={(e) => updateDivision(div.id, 'product_categories', e.target.value)}
                        placeholder="e.g. Biscuits & Rusk, Tea & Salt, Personal Care"
                        style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition font-medium"
                      />
                    </div>

                    {/* Salesman Name */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                        <User className="w-3 h-3 text-cyan-400" />
                        <span>Assigned Salesman Name</span>
                      </label>
                      <input
                        type="text"
                        value={div.salesman_name}
                        onChange={(e) => updateDivision(div.id, 'salesman_name', e.target.value)}
                        placeholder="e.g. Ramesh Kumar / सेल्समैन का नाम"
                        style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition font-medium"
                      />
                    </div>

                    {/* Salesman Phone */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-cyan-400" />
                        <span>Salesman Phone (10 digits)</span>
                      </label>
                      <input
                        type="tel"
                        value={div.salesman_phone}
                        onChange={(e) => updateDivision(div.id, 'salesman_phone', e.target.value)}
                        placeholder="e.g. 9812345678"
                        maxLength={10}
                        style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition font-medium"
                      />
                    </div>

                    {/* Visit Day */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-cyan-400" />
                        <span>Salesman Weekly Visit Day</span>
                      </label>
                      <select
                        value={div.visit_day}
                        onChange={(e) => updateDivision(div.id, 'visit_day', e.target.value)}
                        style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition font-medium cursor-pointer"
                      >
                        {DAYS_OF_WEEK.map((d) => (
                          <option
                            key={d}
                            value={d}
                            style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                            className="bg-slate-900 text-white py-1"
                          >
                            {d} (हर {d})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addDivision}
              className="w-full py-2.5 px-3 rounded-xl border border-dashed border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition bg-cyan-950/20 hover:bg-cyan-950/40"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Another Division / Salesman (अन्य कंपनी या सेल्समैन जोड़ें)</span>
            </button>
          </div>

          {/* 3. Monthly Claim Window Selector (Day-of-Month) */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Monthly Claim Window (रिटर्न/क्लेम विंडो) *</span>
              </label>
              <span className="text-[10px] text-amber-400 font-semibold">
                Day of every month
              </span>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CLAIM_WINDOW_PRESETS.map((p) => {
                const isSelected = claimWindowPreset === p.label;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handlePresetSelect(p)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition border text-left flex flex-col justify-between ${
                      isSelected
                        ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-600/30'
                        : 'bg-slate-800 text-white border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    <span className="text-white font-bold">{p.label}</span>
                    <span
                      className={`text-[9px] font-normal truncate mt-0.5 ${
                        isSelected ? 'text-cyan-100' : 'text-slate-300'
                      }`}
                    >
                      {p.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom Range Inputs */}
            {claimWindowPreset === 'Custom Range' && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 gap-3 animate-fade-in">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    From Day (1–31)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={claimWindowStart}
                    onChange={(e) => setClaimWindowStart(Math.max(1, Math.min(31, Number(e.target.value))))}
                    style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    To Day (1–31)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={claimWindowEnd}
                    onChange={(e) => setClaimWindowEnd(Math.max(1, Math.min(31, Number(e.target.value))))}
                    style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 font-medium"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. Return Eligibility Checkboxes */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="text-xs font-bold text-slate-200">
              Return Eligibility Policies (स्वीकार्य नुक़सान / वापसी)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {RETURN_ELIGIBILITY_OPTIONS.map((opt) => {
                const checked = returnEligibility.includes(opt);
                return (
                  <label
                    key={opt}
                    onClick={() => toggleEligibility(opt)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer select-none transition ${
                      checked
                        ? 'bg-slate-800 border-cyan-400 text-cyan-200 shadow-sm'
                        : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span className="font-semibold text-[11px] text-white">{opt}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 5. Settlement Mode Options */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="text-xs font-bold text-slate-200">
              Preferred Settlement Mode (भुगतान / समायोजन का तरीका)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SETTLEMENT_MODES.map((mode) => {
                const isSelected = settlementMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSettlementMode(mode)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                        : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. Notes / Policy Instructions */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <label className="text-xs font-bold text-slate-200">
              Notes & Handover Instructions (अन्य निर्देश)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Salesman requires physical slip copy with distributor stamp; returns accepted only in original carton"
              style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
              className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 resize-none transition font-medium"
            />
          </div>

          {/* Modal Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{editingDistributor ? 'Update Distributor' : 'Save Distributor'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
