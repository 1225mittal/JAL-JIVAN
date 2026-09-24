import React, { useState, useRef, useEffect } from 'react';
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
  Truck,
  Mic,
  MicOff,
  Square,
  Sparkles,
  Loader2,
  Volume2,
  CheckCircle2
} from 'lucide-react';
import {
  createDistributor,
  updateDistributor,
  deleteDistributor
} from '../../lib/supabase';
import {
  DAYS_OF_WEEK,
  RETURN_RULES,
  parseDistributorVoice,
  cleanSingleFieldDictation
} from '../../lib/distributorVoiceParser';

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

  // Speech-to-Text State
  const [isListening, setIsListening] = useState(false);
  const [listeningTarget, setListeningTarget] = useState(null); // 'all' or field name
  const [speechLang, setSpeechLang] = useState('hi-IN'); // 'hi-IN' (Hindi/Hinglish) or 'en-IN' (Indian English)
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [isParsingVoice, setIsParsingVoice] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');
  const recognitionRef = useRef(null);

  const isSpeechSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      stopRecognition();
    };
  }, []);

  const stopRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setListeningTarget(null);
  };

  const closeModal = () => {
    stopRecognition();
    setIsModalOpen(false);
    setVoiceNotice('');
    setSpeechTranscript('');
    setFormError('');
  };

  const openAddModal = () => {
    stopRecognition();
    setEditingDistributor(null);
    setDistributorName('');
    setCompanyName('');
    setSalesmanName('');
    setSalesmanPhone('');
    setVisitDay('Monday');
    setReturnWindowRule('Anytime / कभी भी');
    setNotes('');
    setFormError('');
    setVoiceNotice('');
    setSpeechTranscript('');
    setIsModalOpen(true);
  };

  const openEditModal = (dist) => {
    stopRecognition();
    setEditingDistributor(dist);
    setDistributorName(dist.distributor_name || '');
    setCompanyName(dist.company_name || '');
    setSalesmanName(dist.salesman_name || '');
    setSalesmanPhone(dist.salesman_phone || '');
    setVisitDay(dist.visit_day || 'Monday');
    setReturnWindowRule(dist.return_window_rule || 'Anytime / कभी भी');
    setNotes(dist.notes || '');
    setFormError('');
    setVoiceNotice('');
    setSpeechTranscript('');
    setIsModalOpen(true);
  };

  // Full form voice dictation: listens to multi-field natural sentence
  const toggleFullDictation = () => {
    if (!isSpeechSupported) {
      setFormError('Voice dictation is supported in Google Chrome, Microsoft Edge, and Android Chrome. / बोलकर विवरण भरने के लिए Chrome या Edge ब्राउज़र का प्रयोग करें।');
      return;
    }

    if (isListening && listeningTarget === 'all') {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    stopRecognition();
    setFormError('');
    setVoiceNotice('');
    setSpeechTranscript('');

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.lang = speechLang;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      let capturedTranscript = '';

      recognition.onstart = () => {
        setIsListening(true);
        setListeningTarget('all');
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += piece + ' ';
          } else {
            interim += piece;
          }
        }
        const current = (final + interim).trim();
        capturedTranscript = current;
        setSpeechTranscript(current);
      };

      recognition.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed') {
          setFormError('Microphone permission was denied. Please allow microphone access in browser settings / माइक्रोफ़ोन की अनुमति दें।');
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setFormError(`Voice recognition: ${event.error}`);
        }
        setIsListening(false);
        setListeningTarget(null);
      };

      recognition.onend = async () => {
        setIsListening(false);
        setListeningTarget(null);

        const textToParse = capturedTranscript.trim();
        if (!textToParse) return;

        try {
          setIsParsingVoice(true);
          setVoiceNotice('Parsing details from speech... / विवरण निकाले जा रहे हैं...');

          const parsed = await parseDistributorVoice(textToParse);

          if (parsed.distributor_name) setDistributorName(parsed.distributor_name);
          if (parsed.company_name) setCompanyName(parsed.company_name);
          if (parsed.salesman_name) setSalesmanName(parsed.salesman_name);
          if (parsed.salesman_phone) setSalesmanPhone(parsed.salesman_phone);
          if (parsed.visit_day) setVisitDay(parsed.visit_day);
          if (parsed.return_window_rule) setReturnWindowRule(parsed.return_window_rule);
          if (parsed.notes) setNotes(parsed.notes);

          setVoiceNotice('✨ Spoken details filled! Please review before saving. / विवरण भर दिए गए हैं।');
        } catch (err) {
          console.error('Failed to parse voice details:', err);
          setFormError('Failed to parse voice input. Please check fields manually.');
        } finally {
          setIsParsingVoice(false);
        }
      };

      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setFormError('Unable to start microphone dictation: ' + err.message);
      setIsListening(false);
      setListeningTarget(null);
    }
  };

  // Field-level voice dictation: dictating into a single input field
  const toggleFieldDictation = (fieldName) => {
    if (!isSpeechSupported) {
      setFormError('Voice dictation is supported in Google Chrome, Microsoft Edge, and Android Chrome.');
      return;
    }

    if (isListening && listeningTarget === fieldName) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    stopRecognition();
    setFormError('');
    setVoiceNotice('');

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.lang = speechLang;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
        setListeningTarget(fieldName);
      };

      recognition.onresult = (event) => {
        let current = '';
        for (let i = 0; i < event.results.length; i++) {
          current += event.results[i][0].transcript;
        }
        const cleaned = cleanSingleFieldDictation(fieldName, current);

        if (fieldName === 'distributorName') setDistributorName(cleaned);
        else if (fieldName === 'companyName') setCompanyName(cleaned);
        else if (fieldName === 'salesmanName') setSalesmanName(cleaned);
        else if (fieldName === 'salesmanPhone') setSalesmanPhone(cleaned);
        else if (fieldName === 'notes') setNotes(cleaned);
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setFormError('Microphone permission denied / माइक्रोफ़ोन की अनुमति दें।');
        }
        setIsListening(false);
        setListeningTarget(null);
      };

      recognition.onend = () => {
        setIsListening(false);
        setListeningTarget(null);
      };

      recognition.start();
    } catch (err) {
      console.error('Field dictation error:', err);
      setIsListening(false);
      setListeningTarget(null);
    }
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

      closeModal();
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

  const filteredDistributors = distributors.filter((d) => {
    const q = search.toLowerCase();
    return (
      (d.distributor_name || '').toLowerCase().includes(q) ||
      (d.company_name || '').toLowerCase().includes(q) ||
      (d.salesman_name || '').toLowerCase().includes(q) ||
      (d.salesman_phone || '').includes(q)
    );
  });

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-scale-up my-auto">
            {/* Modal Header */}
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
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Voice Dictation Master Bar */}
            <div className="p-4 mx-6 mt-4 rounded-2xl bg-gradient-to-br from-cyan-950/50 via-slate-900/90 to-indigo-950/50 border border-cyan-500/30 shadow-lg space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      isListening && listeningTarget === 'all'
                        ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/40 ring-4 ring-rose-500/20'
                        : 'bg-cyan-500/20 text-cyan-300'
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white tracking-wide">
                        AI Voice Assistant
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        Auto-Fill
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Bol kar bharein / Speak all details naturally
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Language Selector */}
                  <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-[10px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setSpeechLang('hi-IN')}
                      className={`px-2 py-1 rounded-md transition ${
                        speechLang === 'hi-IN'
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Hindi / Hinglish speech recognition"
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
                      title="Indian English speech recognition"
                    >
                      Eng
                    </button>
                  </div>

                  {/* Master Voice Dictation Toggle */}
                  <button
                    type="button"
                    onClick={toggleFullDictation}
                    disabled={!isSpeechSupported || isParsingVoice}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      isListening && listeningTarget === 'all'
                        ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-600/40 ring-2 ring-rose-400/60'
                        : isParsingVoice
                        ? 'bg-amber-600/90 text-white cursor-wait'
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30 active:scale-95'
                    }`}
                  >
                    {isListening && listeningTarget === 'all' ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop Listening</span>
                      </>
                    ) : isParsingVoice ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Parsing...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        <span>🎤 Bol kar bharein</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Active Listening Pulse & Audio Equalizer Animation */}
              {isListening && listeningTarget === 'all' && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-cyan-500/40 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 text-rose-400 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                      <span>
                        Listening ({speechLang === 'hi-IN' ? 'हिन्दी / Hinglish' : 'Indian English'})... Speak now
                      </span>
                    </div>

                    {/* Audio wave bars */}
                    <div className="flex items-center gap-1 h-4">
                      <span className="w-1 h-2.5 bg-cyan-400 rounded-full animate-pulse" />
                      <span className="w-1 h-4 bg-cyan-300 rounded-full animate-pulse delay-75" />
                      <span className="w-1 h-2 bg-cyan-500 rounded-full animate-pulse delay-150" />
                      <span className="w-1 h-4 bg-cyan-400 rounded-full animate-pulse delay-100" />
                      <span className="w-1 h-2 bg-cyan-300 rounded-full animate-pulse delay-200" />
                    </div>
                  </div>

                  <p className="text-xs text-cyan-200 font-mono italic bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 min-h-[2.5rem]">
                    {speechTranscript || 'Speak: "Distributor Laxmi Agency, company Britannia, salesman Ramesh phone 9812345678, visit day Tuesday..."'}
                  </p>
                </div>
              )}

              {/* Success Notification Banner */}
              {voiceNotice && !isListening && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{voiceNotice}</span>
                </div>
              )}

              {/* Speech Example Helper */}
              {!isListening && !isParsingVoice && !voiceNotice && (
                <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2 rounded-lg border border-slate-800/80">
                  <span className="text-cyan-400 font-semibold">💡 Example speech:</span>{' '}
                  <span className="italic text-slate-300">
                    "Distributor Laxmi Agency, company Britannia, salesman Ramesh phone number 9812345678, visit day Tuesday"
                  </span>
                </div>
              )}

              {/* Fallback for unsupported browsers */}
              {!isSpeechSupported && (
                <div className="text-[11px] text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/30">
                  ⚠️ Speech dictation works in Google Chrome, Microsoft Edge, and Android Chrome.
                </div>
              )}
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs sm:text-sm">
              {formError && (
                <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Distributor Name Input with Field-Level Mic */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Distributor / Agency Name <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleFieldDictation('distributorName')}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium transition ${
                      isListening && listeningTarget === 'distributorName'
                        ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/40'
                        : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
                    }`}
                    title="Dictate distributor name"
                  >
                    <Mic className="w-3 h-3" />
                    <span>{isListening && listeningTarget === 'distributorName' ? 'Listening...' : 'Speak'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={distributorName}
                  onChange={(e) => setDistributorName(e.target.value)}
                  placeholder="e.g. Shree Balaji Enterprises, Mittal Traders"
                  required
                  className={`w-full px-3.5 py-2.5 bg-slate-800/80 border rounded-xl text-white placeholder-slate-500 focus:outline-none text-xs sm:text-sm transition ${
                    isListening && listeningTarget === 'distributorName'
                      ? 'border-rose-500 ring-2 ring-rose-500/40'
                      : 'border-slate-700 focus:border-cyan-500'
                  }`}
                />
              </div>

              {/* Company / Brand Name Input with Field-Level Mic */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Company / FMCG Brand <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleFieldDictation('companyName')}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium transition ${
                      isListening && listeningTarget === 'companyName'
                        ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/40'
                        : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
                    }`}
                    title="Dictate company name"
                  >
                    <Mic className="w-3 h-3" />
                    <span>{isListening && listeningTarget === 'companyName' ? 'Listening...' : 'Speak'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Parle, Bisleri, Tata Consumer, Britannia, ITC"
                  required
                  className={`w-full px-3.5 py-2.5 bg-slate-800/80 border rounded-xl text-white placeholder-slate-500 focus:outline-none text-xs sm:text-sm transition ${
                    isListening && listeningTarget === 'companyName'
                      ? 'border-rose-500 ring-2 ring-rose-500/40'
                      : 'border-slate-700 focus:border-cyan-500'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Salesman Name Input with Field-Level Mic */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Salesman Name / नाम
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleFieldDictation('salesmanName')}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-medium transition ${
                        isListening && listeningTarget === 'salesmanName'
                          ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/40'
                          : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
                      }`}
                      title="Dictate salesman name"
                    >
                      <Mic className="w-3 h-3" />
                      <span>{isListening && listeningTarget === 'salesmanName' ? '...' : 'Speak'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={salesmanName}
                    onChange={(e) => setSalesmanName(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
                    className={`w-full px-3.5 py-2.5 bg-slate-800/80 border rounded-xl text-white placeholder-slate-500 focus:outline-none text-xs sm:text-sm transition ${
                      isListening && listeningTarget === 'salesmanName'
                        ? 'border-rose-500 ring-2 ring-rose-500/40'
                        : 'border-slate-700 focus:border-cyan-500'
                    }`}
                  />
                </div>

                {/* Salesman Phone Input with Field-Level Mic */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Salesman Phone / फ़ोन
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleFieldDictation('salesmanPhone')}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-medium transition ${
                        isListening && listeningTarget === 'salesmanPhone'
                          ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/40'
                          : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
                      }`}
                      title="Dictate salesman phone number"
                    >
                      <Mic className="w-3 h-3" />
                      <span>{isListening && listeningTarget === 'salesmanPhone' ? '...' : 'Speak'}</span>
                    </button>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    value={salesmanPhone}
                    onChange={(e) => setSalesmanPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className={`w-full px-3.5 py-2.5 bg-slate-800/80 border rounded-xl text-white placeholder-slate-500 focus:outline-none text-xs sm:text-sm transition ${
                      isListening && listeningTarget === 'salesmanPhone'
                        ? 'border-rose-500 ring-2 ring-rose-500/40'
                        : 'border-slate-700 focus:border-cyan-500'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Visit Day */}
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

                {/* Return Rule */}
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

              {/* Notes Input with Field-Level Mic */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Notes / विशेष निर्देश
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleFieldDictation('notes')}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium transition ${
                      isListening && listeningTarget === 'notes'
                        ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/40'
                        : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
                    }`}
                    title="Dictate notes"
                  >
                    <Mic className="w-3 h-3" />
                    <span>{isListening && listeningTarget === 'notes' ? 'Listening...' : 'Speak'}</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Salesman comes around 3 PM; gives credit note in next invoice."
                  className={`w-full px-3.5 py-2 bg-slate-800/80 border rounded-xl text-white placeholder-slate-500 focus:outline-none text-xs transition ${
                    isListening && listeningTarget === 'notes'
                      ? 'border-rose-500 ring-2 ring-rose-500/40'
                      : 'border-slate-700 focus:border-cyan-500'
                  }`}
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
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
