import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  Upload,
  CheckCircle2,
  Banknote,
  QrCode,
  FileText,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Trash2,
  Video,
  AlertCircle
} from 'lucide-react';
import { uploadDeliveryFile } from '../lib/supabase';

export default function ProofOfDeliveryModal({ isOpen, onClose, order, onCompleteDelivery }) {
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const isOrderPrepaid = Boolean(
    order?.is_prepaid ||
    order?.isPrepaid ||
    order?.payment_status === 'Prepaid' ||
    order?.payment_method === 'Prepaid' ||
    (typeof order?.notes === 'string' && order.notes.includes('[PREPAID'))
  );

  const [paymentMethod, setPaymentMethod] = useState(() => (isOrderPrepaid ? 'Prepaid' : 'Cash'));
  const [actualAmountReceived, setActualAmountReceived] = useState(() => (isOrderPrepaid ? '0' : String(order?.amount || '')));
  const [deliveryComment, setDeliveryComment] = useState('');
  const [upiScreenshotFile, setUpiScreenshotFile] = useState(null);
  const [upiPreview, setUpiPreview] = useState(null);

  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (order) {
      const prepaid = Boolean(
        order?.is_prepaid ||
        order?.isPrepaid ||
        order?.payment_status === 'Prepaid' ||
        order?.payment_method === 'Prepaid' ||
        (typeof order?.notes === 'string' && order.notes.includes('[PREPAID'))
      );
      setPaymentMethod(prepaid ? 'Prepaid' : 'Cash');
      setActualAmountReceived(prepaid ? '0' : String(order.amount || ''));
      setDeliveryComment('');
    }
  }, [order]);

  // In-app live camera state
  const [liveCameraTarget, setLiveCameraTarget] = useState(null); // 'photo' | 'upi' | null
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Stop video tracks helper
  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setLiveCameraTarget(null);
    setCameraError(null);
    setCameraLoading(false);
  };

  // Start live in-app camera viewfinder
  const startLiveCamera = async (target, facing = 'environment') => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setLiveCameraTarget(target);
      setFacingMode(facing);
      setCameraLoading(true);
      setCameraError(null);

      const constraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.warn('In-app camera stream error:', err);
      setCameraError('Unable to access in-app camera stream. Please use the "Take Photo (Camera)" button below.');
    } finally {
      setCameraLoading(false);
    }
  };

  // Flip camera between front and back
  const flipLiveCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    startLiveCamera(liveCameraTarget, nextFacing);
  };

  // Snap photo from live camera canvas
  const captureLiveSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const filename = `${liveCameraTarget === 'upi' ? 'upi-proof' : 'package-proof'}-${Date.now()}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      if (liveCameraTarget === 'upi') {
        setUpiScreenshotFile(file);
        setUpiPreview(dataUrl);
      } else {
        setPhotoFile(file);
        setPhotoPreview(dataUrl);
      }
      stopLiveCamera();
    }, 'image/jpeg', 0.85);
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  if (!isOpen || !order) return null;

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUpiScreenshotSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUpiScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = () => setUpiPreview(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!photoFile && !photoPreview) {
      setError('Please take or upload a package delivery photo as proof');
      return;
    }

    if (paymentMethod === 'UPI' && !upiScreenshotFile && !upiPreview) {
      setError('Please take or upload the UPI payment transaction screenshot/photo');
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
        paymentMethod: isOrderPrepaid ? 'Prepaid' : paymentMethod,
        paymentProofUrl,
        deliveryProofUrl,
        notes: notes.trim(),
        actualAmount: isOrderPrepaid ? 0 : (actualAmountReceived !== '' ? Number(actualAmountReceived) : order.amount),
        deliveryComment: deliveryComment.trim(),
        deliveryNotes: deliveryComment.trim()
      });

      stopLiveCamera();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to complete delivery');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col animate-slide-up sm:animate-scale-up">
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
            onClick={() => {
              stopLiveCamera();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live In-App Camera Viewfinder Overlay */}
        {liveCameraTarget && (
          <div className="relative bg-black flex flex-col items-center justify-between p-4 min-h-[360px] animate-fade-in">
            {/* Viewfinder Header */}
            <div className="w-full flex items-center justify-between text-xs text-white z-10 mb-2">
              <span className="font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                {liveCameraTarget === 'upi' ? 'Capture UPI Proof' : 'Capture Package Photo'}
              </span>
              <button
                type="button"
                onClick={stopLiveCamera}
                className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Viewport */}
            <div className="relative w-full aspect-[4/3] max-h-72 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
              {cameraLoading && (
                <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  <span>Starting camera stream...</span>
                </div>
              )}
              {cameraError && (
                <div className="p-4 text-center text-xs text-rose-300 flex flex-col items-center gap-2">
                  <AlertCircle className="w-6 h-6 text-rose-400" />
                  <span>{cameraError}</span>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraLoading || cameraError ? 'hidden' : 'block'}`}
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Viewfinder Guideline Box */}
              {!cameraLoading && !cameraError && (
                <div className="absolute inset-4 border-2 border-dashed border-emerald-400/60 rounded-xl pointer-events-none flex items-center justify-center">
                  <span className="text-[10px] text-emerald-300/80 bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm">
                    {liveCameraTarget === 'upi' ? 'Align UPI screen inside box' : 'Align package inside box'}
                  </span>
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div className="w-full flex items-center justify-around mt-4 pt-2">
              <button
                type="button"
                onClick={flipLiveCamera}
                className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                title="Switch Camera (Front/Back)"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={captureLiveSnapshot}
                disabled={cameraLoading || Boolean(cameraError)}
                className="w-16 h-16 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all border-4 border-white/20 disabled:opacity-40"
                title="Take Photo"
              >
                <div className="w-6 h-6 rounded-full bg-white" />
              </button>

              <button
                type="button"
                onClick={stopLiveCamera}
                className="px-3 py-2 text-xs rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Form Body */}
        {!liveCameraTarget && (
          <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto flex-1">
            {error && (
              <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
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
                <span>1. Package Delivery Photo <span className="text-rose-400">*</span></span>
                <span className="text-[10px] text-slate-400 font-normal">Delivery Proof</span>
              </label>

              {photoPreview ? (
                <div className="relative rounded-2xl overflow-hidden border border-emerald-500/40 bg-slate-950 group">
                  <img
                    src={photoPreview}
                    alt="Package proof preview"
                    className="w-full h-44 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-between p-3">
                    <span className="text-xs text-emerald-300 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Photo Attached
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer text-xs bg-slate-900/90 text-slate-200 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1 shadow">
                        <Camera className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Camera</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoSelect}
                          className="hidden"
                        />
                      </label>
                      <label className="cursor-pointer text-xs bg-slate-900/90 text-slate-200 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1 shadow">
                        <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>Gallery</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoSelect}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoPreview(null);
                        }}
                        className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {/* Direct Mobile Camera Button (capture="environment") */}
                  <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 rounded-2xl cursor-pointer bg-emerald-950/20 hover:bg-emerald-950/30 transition-all text-center group">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                      <Camera className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-emerald-300">Take Photo</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Mobile Camera</p>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>

                  {/* In-App Live Cam Viewfinder Button */}
                  <button
                    type="button"
                    onClick={() => startLiveCamera('photo', 'environment')}
                    className="flex flex-col items-center justify-center p-3.5 border border-dashed border-teal-600/40 hover:border-teal-400 rounded-2xl bg-teal-950/20 hover:bg-teal-950/30 transition-all text-center group"
                  >
                    <div className="w-10 h-10 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                      <Video className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-teal-300">Live Viewfinder</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">In-App Screen</p>
                  </button>

                  {/* Pick from Gallery Button */}
                  <label className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center p-3.5 border border-dashed border-slate-700 hover:border-slate-500 rounded-2xl cursor-pointer bg-slate-800/30 hover:bg-slate-800/60 transition-all text-center group">
                    <div className="w-10 h-10 rounded-full bg-slate-700/50 text-slate-300 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-200">From Gallery</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Select File</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* 2. Payment Method Selector */}
            {/* 2. Payment Method Selector */}
            {isOrderPrepaid ? (
              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-xs space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 uppercase text-[10px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Prepaid Order • Paid Online
                </span>
                <p className="text-white font-semibold">
                  Payment is already completed (₹0 to collect from customer).
                </p>
                <p className="text-slate-400 text-[11px]">
                  Capture the package delivery photo above and submit to finish.
                </p>
              </div>
            ) : (
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
            )}

            {/* If UPI is selected: Camera Only (No Gallery upload as requested) */}
            {paymentMethod === 'UPI' && !isOrderPrepaid && (
              <div className="p-4 rounded-2xl bg-teal-950/30 border border-teal-800/50 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                    <QrCode className="w-4 h-4" />
                    <span>UPI Payment Proof <span className="text-rose-400">*</span></span>
                  </label>
                  <span className="text-[10px] text-teal-300 font-semibold bg-teal-900/50 px-2 py-0.5 rounded border border-teal-700/50">
                    Live Camera Only
                  </span>
                </div>

                {upiPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-teal-500/40 bg-slate-950">
                    <img
                      src={upiPreview}
                      alt="UPI Payment Proof"
                      className="w-full h-36 object-contain bg-slate-950"
                    />
                    <div className="p-2.5 bg-slate-900/90 border-t border-slate-800 flex justify-between items-center text-xs">
                      <span className="text-teal-300 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" /> Photo Attached
                      </span>
                      <div className="flex items-center gap-2">
                        {/* Direct Camera Retake (Strictly Camera Only) */}
                        <label className="cursor-pointer text-xs bg-slate-800 text-teal-300 hover:text-white px-2.5 py-1 rounded-lg border border-teal-700/60 flex items-center gap-1 shadow-sm">
                          <Camera className="w-3 h-3 text-teal-400" />
                          <span>Retake Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleUpiScreenshotSelect}
                            className="hidden"
                          />
                        </label>
                        {/* Clear */}
                        <button
                          type="button"
                          onClick={() => {
                            setUpiScreenshotFile(null);
                            setUpiPreview(null);
                          }}
                          className="p-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30"
                          title="Remove UPI proof"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Primary Camera Button: Strictly opens native device camera */}
                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-teal-500/60 hover:border-teal-400 rounded-2xl cursor-pointer bg-teal-950/40 hover:bg-teal-900/40 transition-all text-center group shadow-sm">
                      <div className="w-11 h-11 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                        <Camera className="w-6 h-6 text-teal-400" />
                      </div>
                      <p className="text-xs font-bold text-teal-200">Take Live Photo of UPI Screen</p>
                      <p className="text-[10px] text-teal-400/80 mt-0.5">Mobile Camera (No Gallery)</p>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleUpiScreenshotSelect}
                        className="hidden"
                      />
                    </label>

                    {/* In-App Live Cam Viewfinder Button */}
                    <button
                      type="button"
                      onClick={() => startLiveCamera('upi', 'environment')}
                      className="flex flex-col items-center justify-center p-4 border border-dashed border-cyan-600/40 hover:border-cyan-400 rounded-2xl bg-cyan-950/20 hover:bg-cyan-950/30 transition-all text-center group"
                    >
                      <div className="w-11 h-11 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                        <Video className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-cyan-300">Live Viewfinder</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">In-App Screen View</p>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3. Delivery Comments & Discrepancies (Returns / Changed Amount) */}
            <div className="space-y-3 p-3.5 rounded-2xl bg-slate-800/40 border border-slate-700/70">
              <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
                <span>3. Delivery Comments & Amount Handover</span>
                <span className="text-[10px] text-slate-400 font-normal">Returns / Changes</span>
              </label>

              {/* Amount Received Input if not prepaid */}
              {!isOrderPrepaid && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Actual Amount Received (₹):</span>
                    <span className="text-slate-400">Expected: ₹{order.amount}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs">₹</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={actualAmountReceived}
                      onChange={(e) => setActualAmountReceived(e.target.value)}
                      placeholder={String(order.amount)}
                      className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* Discrepancy indicator */}
                  {actualAmountReceived !== '' && Number(actualAmountReceived) < Number(order.amount) && (
                    <p className="text-[11px] text-amber-300 mt-1 flex items-center gap-1 font-semibold">
                      <span>⚠️ Short by ₹{(Number(order.amount) - Number(actualAmountReceived)).toFixed(2)} (Please mention reason in comment below)</span>
                    </p>
                  )}
                  {actualAmountReceived !== '' && Number(actualAmountReceived) > Number(order.amount) && (
                    <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
                      <span>ℹ️ Extra ₹{(Number(actualAmountReceived) - Number(order.amount)).toFixed(2)} collected</span>
                    </p>
                  )}
                </div>
              )}

              {/* Quick Tags for Delivery Comment */}
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1.5">
                  Quick Select Reason / Tag:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '🔄 Item Returned / Cancelled',
                    '💵 Amount Discrepancy',
                    '🚪 Left at Doorstep',
                    '🤝 Handed to Security/Guard',
                    '📦 Damaged / Leaking Item',
                    '✅ Delivered in person'
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setDeliveryComment((prev) => {
                          const cleanTag = tag.replace(/^[^\w\s]+\s*/, '');
                          if (prev.includes(cleanTag)) return prev;
                          return prev ? `${prev}, ${cleanTag}` : cleanTag;
                        });
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-semibold border border-slate-700 transition active:scale-95"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Multi-line Comment Textarea */}
              <div>
                <textarea
                  rows={2}
                  value={deliveryComment}
                  onChange={(e) => setDeliveryComment(e.target.value)}
                  placeholder="e.g. 1 can returned due to broken seal, collected ₹80 instead of ₹160, handed to customer directly..."
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  stopLiveCamera();
                  onClose();
                }}
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
        )}
      </div>
    </div>
  );
}
