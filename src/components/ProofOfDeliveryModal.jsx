import React, { useState } from 'react';
import { X, Camera, Upload, CheckCircle2, Banknote, QrCode, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { uploadDeliveryFile } from '../lib/supabase';

export default function ProofOfDeliveryModal({ isOpen, onClose, order, onCompleteDelivery }) {
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [paymentMethod, setPaymentMethod] = useState('Cash'); // 'Cash' | 'UPI' | 'Credit'
  const [upiScreenshotFile, setUpiScreenshotFile] = useState(null);
  const [upiPreview, setUpiPreview] = useState(null);

  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !order) return null;

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleUpiScreenshotSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUpiScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = () => setUpiPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!photoFile && !photoPreview) {
      setError('Please take or upload a package delivery photo as proof');
      return;
    }

    if (paymentMethod === 'UPI' && !upiScreenshotFile && !upiPreview) {
      setError('Please upload the UPI payment transaction screenshot');
      return;
    }

    try {
      setLoading(true);

      // Upload package photo to 'delivery-proofs' bucket
      let deliveryProofUrl = photoPreview;
      if (photoFile) {
        deliveryProofUrl = await uploadDeliveryFile(photoFile, 'package-proofs');
      }

      // Upload UPI screenshot if applicable
      let paymentProofUrl = upiPreview;
      if (paymentMethod === 'UPI' && upiScreenshotFile) {
        paymentProofUrl = await uploadDeliveryFile(upiScreenshotFile, 'upi-proofs');
      }

      await onCompleteDelivery(order.id, {
        paymentMethod,
        paymentProofUrl,
        deliveryProofUrl,
        notes: notes.trim()
      });

      onClose();
    } catch (err) {
      setError(err.message || 'Failed to complete delivery');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-slide-up sm:animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Proof of Delivery</h3>
              <p className="text-xs text-slate-400">Order #{order.order_number} • ₹{order.amount}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl">
              {error}
            </div>
          )}

          {/* Delivery Location Summary */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-xs">
            <p className="text-slate-400 font-medium">Delivering To:</p>
            <p className="text-white font-semibold mt-0.5">{order.address}</p>
            {order.landmark && (
              <p className="text-emerald-400 mt-0.5">Landmark: {order.landmark}</p>
            )}
          </div>

          {/* 1. Package Photo Proof */}
          <div>
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>1. Package Photo Proof <span className="text-rose-400">*</span></span>
              <span className="text-[10px] text-slate-400 font-normal">Bucket: delivery-proofs</span>
            </label>

            {photoPreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-emerald-500/40 bg-slate-950 group">
                <img
                  src={photoPreview}
                  alt="Package proof preview"
                  className="w-full h-48 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-between p-3">
                  <span className="text-xs text-emerald-300 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Photo Attached
                  </span>
                  <label className="cursor-pointer text-xs bg-slate-900/90 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700">
                    Change
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-2xl cursor-pointer bg-slate-800/30 hover:bg-slate-800/60 transition-all p-4 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2">
                  <Camera className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-200">Tap to Capture Package Photo</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Use camera or select from gallery</p>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* 2. Payment Method Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
              2. Payment Collection Method <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {/* Cash */}
              <button
                type="button"
                onClick={() => setPaymentMethod('Cash')}
                className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl border transition-all ${
                  paymentMethod === 'Cash'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Banknote className="w-5 h-5 mb-1.5" />
                <span className="text-xs font-semibold">Cash</span>
                <span className="text-[10px] opacity-75">₹{order.amount}</span>
              </button>

              {/* UPI */}
              <button
                type="button"
                onClick={() => setPaymentMethod('UPI')}
                className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl border transition-all ${
                  paymentMethod === 'UPI'
                    ? 'bg-teal-600/20 border-teal-500 text-teal-300 shadow-md shadow-teal-500/10 ring-1 ring-teal-500'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <QrCode className="w-5 h-5 mb-1.5" />
                <span className="text-xs font-semibold">UPI Online</span>
                <span className="text-[10px] opacity-75">QR / App</span>
              </button>

              {/* Credit */}
              <button
                type="button"
                onClick={() => setPaymentMethod('Credit')}
                className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl border transition-all ${
                  paymentMethod === 'Credit'
                    ? 'bg-amber-600/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10 ring-1 ring-amber-500'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <FileText className="w-5 h-5 mb-1.5" />
                <span className="text-xs font-semibold">Credit</span>
                <span className="text-[10px] opacity-75">Khata/Postpaid</span>
              </button>
            </div>
          </div>

          {/* If UPI is selected: Screenshot upload requirement */}
          {paymentMethod === 'UPI' && (
            <div className="p-3.5 rounded-2xl bg-teal-950/30 border border-teal-800/50 space-y-2 animate-fade-in">
              <label className="block text-xs font-semibold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5" />
                Upload UPI Transaction Screenshot <span className="text-rose-400">*</span>
              </label>

              {upiPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-teal-500/40 bg-slate-950">
                  <img
                    src={upiPreview}
                    alt="UPI Screenshot"
                    className="w-full h-32 object-contain bg-slate-950"
                  />
                  <div className="p-2 bg-slate-900 flex justify-between items-center text-xs">
                    <span className="text-teal-300">Screenshot Attached</span>
                    <label className="cursor-pointer text-slate-300 hover:text-white underline text-[11px]">
                      Replace
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUpiScreenshotSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full py-3 px-4 border border-dashed border-teal-700 hover:border-teal-500 rounded-xl cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition-all text-xs text-teal-300 font-medium">
                  <Upload className="w-4 h-4" />
                  <span>Choose / Capture Payment Screenshot</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUpiScreenshotSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}

          {/* Delivery Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Delivery Remarks / Handover Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Handed to customer, placed at door, paid in cash"
              className="w-full px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-300 text-sm font-medium hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving POD...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark as Delivered</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
