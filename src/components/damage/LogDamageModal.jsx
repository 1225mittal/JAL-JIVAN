import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Camera,
  Upload,
  Sparkles,
  Loader2,
  Package,
  Calendar,
  Layers,
  IndianRupee,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Truck,
  Hash,
  Scale
} from 'lucide-react';
import { extractPackageDetails } from '../../lib/damageOcr';
import { createDamageExpiryItem, uploadDamagePhoto } from '../../lib/supabase';
import { compressImage } from '../../lib/imageCompressor';

const DAMAGE_TYPES = [
  { id: 'Damage', labelEn: 'Physical Damage (Broken/Cracked)', labelHi: 'टूटा-फूटा / डैमेज' },
  { id: 'Expired', labelEn: 'Expired / Date Over', labelHi: 'एक्सपायर्ड / डेट ख़त्म' },
  { id: 'Leaking', labelEn: 'Leaking / Dispenser Tap Fault', labelHi: 'लीकेज / बह रहा है' },
  { id: 'Pest/Rat', labelEn: 'Pest / Rat Bite', labelHi: 'चूहे द्वारा काटा गया' },
  { id: 'Cap/Seal', labelEn: 'Seal / Cap Broken', labelHi: 'सील / ढक्कन खुला' }
];

export default function LogDamageModal({
  isOpen,
  onClose,
  distributors = [],
  onItemLogged
}) {
  const [frontFile, setFrontFile] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);

  const [backFile, setBackFile] = useState(null);
  const [backPreview, setBackPreview] = useState(null);

  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form Fields
  const [productName, setProductName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [distributorId, setDistributorId] = useState('');
  const [distributorName, setDistributorName] = useState('');
  const [mrp, setMrp] = useState('');
  const [netWeightVolume, setNetWeightVolume] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantityPcs, setQuantityPcs] = useState(1);
  const [rackNumber, setRackNumber] = useState('');
  const [damageType, setDamageType] = useState('Damage');

  const frontInputRef = useRef(null);
  const backInputRef = useRef(null);

  // Reset all form inputs, previews, and file inputs to initial state
  const resetForm = useCallback(() => {
    setFrontFile(null);
    setFrontPreview(null);
    setBackFile(null);
    setBackPreview(null);
    setScanning(false);
    setScanMessage('');
    setSubmitting(false);
    setError('');

    setProductName('');
    setCompanyName('');
    setDistributorId('');
    setDistributorName('');
    setMrp('');
    setNetWeightVolume('');
    setBatchNo('');
    setMfgDate('');
    setExpiryDate('');
    setQuantityPcs(1);
    setRackNumber('');
    setDamageType('Damage');

    if (frontInputRef.current) {
      frontInputRef.current.value = '';
    }
    if (backInputRef.current) {
      backInputRef.current.value = '';
    }
  }, []);

  // Whenever isOpen prop becomes false, trigger a full form reset
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  if (!isOpen) return null;

  const handleFrontSelect = async (e) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    try {
      const compressed = await compressImage(rawFile, {
        maxDimension: 1280,
        quality: 0.75,
        outputType: 'image/jpeg'
      });
      setFrontFile(compressed.file);
      setFrontPreview(compressed.base64);
    } catch (err) {
      console.warn('Front image compression failed, using original:', err);
      setFrontFile(rawFile);
      const reader = new FileReader();
      reader.onload = () => setFrontPreview(reader.result);
      reader.readAsDataURL(rawFile);
    }
  };

  const handleBackSelect = async (e) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    try {
      const compressed = await compressImage(rawFile, {
        maxDimension: 1280,
        quality: 0.75,
        outputType: 'image/jpeg'
      });
      setBackFile(compressed.file);
      setBackPreview(compressed.base64);
    } catch (err) {
      console.warn('Back image compression failed, using original:', err);
      setBackFile(rawFile);
      const reader = new FileReader();
      reader.onload = () => setBackPreview(reader.result);
      reader.readAsDataURL(rawFile);
    }
  };

  // AI Groq Vision Scan
  const handleAiScan = async () => {
    if (!frontFile && !backFile && !frontPreview && !backPreview) {
      setError('Please take or upload at least one photo (Front or Back) before scanning with AI.');
      return;
    }

    try {
      setScanning(true);
      setError('');
      setScanMessage('Scanning package with Groq Vision AI... / AI से विवरण पढ़ा जा रहा है...');

      const extracted = await extractPackageDetails({
        frontFile,
        backFile,
        frontBase64: frontPreview,
        backBase64: backPreview
      });

      if (extracted) {
        if (extracted.product_name) setProductName(extracted.product_name);
        if (extracted.company_name) setCompanyName(extracted.company_name);
        if (extracted.mrp) setMrp(String(extracted.mrp));
        if (extracted.net_weight_volume) setNetWeightVolume(extracted.net_weight_volume);
        if (extracted.batch_no) setBatchNo(extracted.batch_no);
        if (extracted.mfg_date) setMfgDate(extracted.mfg_date);
        if (extracted.expiry_date) setExpiryDate(extracted.expiry_date);
        if (extracted.damage_type) setDamageType(extracted.damage_type);

        // Auto-match distributor if company matches
        if (extracted.company_name && distributors.length > 0) {
          const matched = distributors.find(
            (d) =>
              d.company_name?.toLowerCase().includes(extracted.company_name.toLowerCase()) ||
              extracted.company_name.toLowerCase().includes(d.company_name?.toLowerCase())
          );
          if (matched) {
            setDistributorId(matched.id);
            setDistributorName(matched.distributor_name);
          }
        }

        setScanMessage('✨ AI successfully auto-filled package details!');
        setTimeout(() => setScanMessage(''), 4000);
      }
    } catch (err) {
      setError(err.message || 'AI scanning failed. Please enter the details manually.');
    } finally {
      setScanning(false);
    }
  };

  const handleDistributorSelect = (e) => {
    const selectedId = e.target.value;
    setDistributorId(selectedId);
    const found = distributors.find((d) => d.id === selectedId);
    if (found) {
      setDistributorName(found.distributor_name);
      if (!companyName && found.company_name) {
        setCompanyName(found.company_name);
      }
    } else {
      setDistributorName('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!productName.trim()) {
      setError('Product Name is required / उत्पाद का नाम भरें');
      return;
    }
    if (!rackNumber.trim()) {
      setError('Rack Number is required (e.g. Rack A1, Shelf B2, Floor) / रैक नंबर भरें');
      return;
    }

    try {
      setSubmitting(true);

      // Upload photos if present
      let frontPhotoUrl = frontPreview || '';
      let backPhotoUrl = backPreview || '';

      if (frontFile) {
        try {
          const uploadedUrl = await uploadDamagePhoto(frontFile);
          if (uploadedUrl) frontPhotoUrl = uploadedUrl;
        } catch (e) {
          console.warn('Front photo upload warning:', e);
        }
      }

      if (backFile) {
        try {
          const uploadedUrl = await uploadDamagePhoto(backFile);
          if (uploadedUrl) backPhotoUrl = uploadedUrl;
        } catch (e) {
          console.warn('Back photo upload warning:', e);
        }
      }

      const itemPayload = {
        product_name: productName.trim(),
        company_name: companyName.trim() || 'General FMCG',
        distributor_id: distributorId || null,
        distributor_name: distributorName.trim() || 'Direct Supplier',
        mrp: parseFloat(mrp) || 0,
        net_weight_volume: netWeightVolume.trim(),
        batch_no: batchNo.trim(),
        mfg_date: mfgDate.trim(),
        expiry_date: expiryDate.trim(),
        quantity_pcs: parseInt(quantityPcs, 10) || 1,
        rack_number: rackNumber.trim(),
        damage_type: damageType,
        front_photo_url: frontPhotoUrl,
        back_photo_url: backPhotoUrl,
        current_status: 'in_godown'
      };

      const created = await createDamageExpiryItem(itemPayload);
      if (onItemLogged) {
        onItemLogged(created);
      }
      resetForm();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save damage item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                Log Damaged / Expired Item
              </h2>
              <p className="text-xs text-slate-400">
                गोदाम डैमेज और एक्सपायरी माल दर्ज करें
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
          {error && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {scanMessage && (
            <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-emerald-400 animate-spin" />
              <span>{scanMessage}</span>
            </div>
          )}

          {/* DUAL PHOTO CAPTURE & AI SCAN SECTION */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-white text-xs uppercase tracking-wider">
                  📸 Dual Package Photos / दोनों तरफ की फ़ोटो
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Front for brand & name, Back for MRP, Batch No & Expiry
                </p>
              </div>

              {/* AI Auto-Fill Action */}
              <button
                type="button"
                onClick={handleAiScan}
                disabled={scanning || (!frontFile && !backFile && !frontPreview && !backPreview)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scanning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>AI Scanning...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Auto-Fill with AI</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Photo 1: Front */}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={frontInputRef}
                  onChange={handleFrontSelect}
                  className="hidden"
                />
                <div
                  onClick={() => frontInputRef.current?.click()}
                  className={`h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-all ${
                    frontPreview
                      ? 'border-emerald-500/50 bg-slate-900/80'
                      : 'border-slate-700 hover:border-slate-500 bg-slate-900/40'
                  }`}
                >
                  {frontPreview ? (
                    <div className="relative w-full h-full">
                      <img
                        src={frontPreview}
                        alt="Front"
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <span className="absolute bottom-1 right-1 bg-black/75 px-1.5 py-0.5 rounded text-[10px] text-white font-semibold">
                        Front Label
                      </span>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-6 h-6 text-slate-500 mb-1" />
                      <span className="text-[11px] font-bold text-slate-300">Front Photo</span>
                      <span className="text-[10px] text-slate-500">सामने की फ़ोटो (नाम/ब्रांड)</span>
                    </>
                  )}
                </div>
              </div>

              {/* Photo 2: Back */}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={backInputRef}
                  onChange={handleBackSelect}
                  className="hidden"
                />
                <div
                  onClick={() => backInputRef.current?.click()}
                  className={`h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-all ${
                    backPreview
                      ? 'border-emerald-500/50 bg-slate-900/80'
                      : 'border-slate-700 hover:border-slate-500 bg-slate-900/40'
                  }`}
                >
                  {backPreview ? (
                    <div className="relative w-full h-full">
                      <img
                        src={backPreview}
                        alt="Back"
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <span className="absolute bottom-1 right-1 bg-black/75 px-1.5 py-0.5 rounded text-[10px] text-white font-semibold">
                        Back / MRP
                      </span>
                    </div>
                  ) : (
                    <>
                      <Camera className="w-6 h-6 text-slate-500 mb-1" />
                      <span className="text-[11px] font-bold text-slate-300">Back Photo</span>
                      <span className="text-[10px] text-slate-500">पीछे की फ़ोटो (MRP/बैच)</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* BASIC PRODUCT INFO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Product Name / उत्पाद का नाम <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Parle-G Gold, Bisleri 20L Can"
                required
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Company / Brand / कंपनी का नाम
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Parle, Britannia, Bisleri, Tata"
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* DISTRIBUTOR & RACK NUMBER */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Distributor / डिस्ट्रीब्यूटर
              </label>
              {distributors.length > 0 ? (
                <select
                  value={distributorId}
                  onChange={handleDistributorSelect}
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 text-xs sm:text-sm"
                >
                  <option value="">Select Registered Distributor / चुनें</option>
                  {distributors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.distributor_name} ({d.company_name})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={distributorName}
                  onChange={(e) => setDistributorName(e.target.value)}
                  placeholder="e.g. Shree Balaji Agencies"
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs sm:text-sm"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Godown Rack Number / रैक नंबर <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={rackNumber}
                  onChange={(e) => setRackNumber(e.target.value)}
                  placeholder="e.g. Rack A1, Shelf B2, Floor"
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs sm:text-sm"
                />
                <Layers className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* PRICING, WEIGHT & QUANTITY */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                MRP (₹) / मूल्य
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  placeholder="50"
                  className="w-full pl-8 pr-2.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs sm:text-sm"
                />
                <IndianRupee className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Weight/Vol / वज़न
              </label>
              <input
                type="text"
                value={netWeightVolume}
                onChange={(e) => setNetWeightVolume(e.target.value)}
                placeholder="20L / 100g"
                className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Quantity / संख्या
              </label>
              <input
                type="number"
                min="1"
                value={quantityPcs}
                onChange={(e) => setQuantityPcs(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* BATCH, MFG & EXPIRY DATE */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Batch No / बैच नंबर
              </label>
              <input
                type="text"
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value)}
                placeholder="e.g. B24A"
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mfg Date / निर्माण तिथि
              </label>
              <input
                type="text"
                value={mfgDate}
                onChange={(e) => setMfgDate(e.target.value)}
                placeholder="e.g. 02/2024"
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Expiry Date / समाप्ति तिथि
              </label>
              <input
                type="text"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                placeholder="e.g. 08/2024"
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* DAMAGE TYPE RADIO / PILLS */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Damage Category / नुक़सान का प्रकार
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DAMAGE_TYPES.map((dt) => (
                <button
                  type="button"
                  key={dt.id}
                  onClick={() => setDamageType(dt.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    damageType === dt.id
                      ? 'bg-rose-500/20 border-rose-500 text-white shadow-md shadow-rose-500/20'
                      : 'bg-slate-800/50 border-slate-700/80 text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
                >
                  <p className="font-bold text-xs">{dt.labelEn}</p>
                  <p className="text-[10px] text-slate-400">{dt.labelHi}</p>
                </button>
              ))}
            </div>
          </div>

          {/* SUBMIT BUTTONS */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancel / रद्द करें
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving to Godown...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Damaged Item / सुरक्षित करें</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
