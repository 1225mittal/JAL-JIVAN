import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  X,
  Trash2,
  Zap,
  ZoomIn,
  Link2,
  Plus,
  Clock,
  RefreshCw,
  AlertCircle,
  FileText,
  CheckCircle2,
  Maximize2,
  VideoOff,
  Sparkles
} from 'lucide-react';

export default function MobileScannerModal({
  isOpen,
  onClose,
  queue = [],
  onAddToQueue,
  onRemoveFromQueue,
  onToggleAttachToPrevious,
  onProcessBill,
  processingBillId = null
}) {
  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) | 'user'
  const [zoomedImage, setZoomedImage] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize camera when modal is open and on camera mode
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    stopCamera();
    setCameraError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }
      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraActive(true);
    } catch (err) {
      console.warn('Camera initiation failed:', err);
      setCameraError(err.message || 'Unable to access camera. Please allow camera permissions or upload images directly.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture photo from video feed
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');

      const newItem = {
        id: `bill_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        dataUrl,
        base64,
        mimeType: 'image/jpeg',
        name: `Camera Snap #${queue.length + 1}`,
        uploadedAt: new Date().toISOString(),
        attachedToPrevious: false
      };

      onAddToQueue(newItem);
    } catch (err) {
      console.error('Error capturing photo:', err);
    } finally {
      setTimeout(() => setIsCapturing(false), 200);
    }
  };

  // Handle file uploads (multiple images supported)
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target.result;
        const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
        const newItem = {
          id: `bill_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
          dataUrl,
          base64,
          mimeType: file.type || 'image/jpeg',
          name: file.name || `Uploaded Bill #${queue.length + index + 1}`,
          uploadedAt: new Date().toISOString(),
          attachedToPrevious: false
        };
        onAddToQueue(newItem);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-base sm:text-lg flex items-center gap-2">
                <span>Mobile Bill Scanner & Photo Queue</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {queue.length} in Queue
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Snap physical receipts one by one. Process each bill individually through Groq Vision OCR.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Split View on Desktop (Live Viewfinder on Left, Queue Cards on Right) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 sm:p-6">
          {/* Left Column: Live Camera Viewfinder & Controls (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-3.5">
            <div className="relative rounded-2xl bg-black border border-slate-800 overflow-hidden aspect-[4/3] flex items-center justify-center shadow-inner">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Targeting frame outline */}
                  <div className="absolute inset-4 sm:inset-6 border-2 border-dashed border-amber-400/60 rounded-xl pointer-events-none flex items-center justify-center">
                    <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold bg-black/60 px-2.5 py-1 rounded-full border border-amber-400/30 backdrop-blur-sm">
                      Align Tax Invoice Here
                    </span>
                  </div>
                  {/* Flashing capture indicator */}
                  {isCapturing && (
                    <div className="absolute inset-0 bg-white/70 animate-ping pointer-events-none" />
                  )}
                </>
              ) : (
                <div className="p-6 text-center space-y-3 text-slate-400">
                  <VideoOff className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-xs max-w-xs">{cameraError || 'Camera inactive or stream paused.'}</p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Camera</span>
                  </button>
                </div>
              )}
            </div>

            {/* Hidden canvas for snapshotting */}
            <canvas ref={canvasRef} className="hidden" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Capture & Flip Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!cameraActive}
                className="flex-1 py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-[0.98] cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>📸 Snap Bill Photo</span>
              </button>

              <button
                type="button"
                onClick={switchCamera}
                title="Switch Camera (Front/Back)"
                className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload Photo Files"
                className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition"
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              Snap multiple pages or receipts rapidly. Each photo gets queued as an independent bill below.
            </p>
          </div>

          {/* Right Column: Uploaded Bills Queue (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Uploaded Bills Queue ({queue.length})</span>
              </h4>
              <span className="text-[11px] text-slate-400">
                Process individually or link multi-page bills
              </span>
            </div>

            {queue.length === 0 ? (
              <div className="flex-1 min-h-[220px] rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/40 flex flex-col items-center justify-center p-6 text-center space-y-2.5">
                <FileText className="w-10 h-10 text-slate-700" />
                <p className="text-xs font-semibold text-slate-300">No photos in the queue yet</p>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  Click "📸 Snap Bill Photo" above or upload images from your device gallery.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {queue.map((item, index) => {
                  const isProcessing = processingBillId === item.id;
                  const formattedTime = new Date(item.uploadedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        item.attachedToPrevious
                          ? 'bg-slate-950/90 border-cyan-500/40 ml-4'
                          : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        {/* Thumbnail with Zoom overlay */}
                        <div
                          onClick={() => setZoomedImage(item.dataUrl)}
                          className="relative w-16 h-20 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden shrink-0 group cursor-pointer"
                        >
                          <img
                            src={item.dataUrl}
                            alt="Bill Thumbnail"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                            <ZoomIn className="w-4 h-4" />
                          </div>
                        </div>

                        {/* Card Info & Actions */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white truncate">
                                  {item.name || `Bill #${index + 1}`}
                                </span>
                                {item.attachedToPrevious && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                                    <Link2 className="w-2.5 h-2.5" />
                                    <span>Attached Page</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3 text-slate-500" />
                                <span>Uploaded {formattedTime}</span>
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => onRemoveFromQueue(item.id)}
                              title="Delete Image"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Action Buttons Row */}
                          <div className="flex items-center gap-2 pt-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => onProcessBill(item)}
                              disabled={isProcessing}
                              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition active:scale-[0.98] disabled:opacity-50"
                            >
                              {isProcessing ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Extracting with OCR...</span>
                                </>
                              ) : (
                                <>
                                  <Zap className="w-3.5 h-3.5 fill-slate-950" />
                                  <span>⚡ Process This Bill (OCR Entry)</span>
                                </>
                              )}
                            </button>

                            {/* Multi-page linking toggle */}
                            {index > 0 && (
                              <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700">
                                <input
                                  type="checkbox"
                                  checked={!!item.attachedToPrevious}
                                  onChange={() => onToggleAttachToPrevious(item.id)}
                                  className="w-3.5 h-3.5 text-cyan-500 rounded border-slate-700 focus:ring-0 cursor-pointer"
                                />
                                <span className="text-[11px]">Attach to Previous Bill Page</span>
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-7 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            {queue.length} photo{queue.length !== 1 ? 's' : ''} in queue
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Close Scanner
          </button>
        </div>
      </div>

      {/* Lightbox Zoom Preview Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 text-white hover:bg-black/90 transition z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomedImage}
              alt="Enlarged Bill Preview"
              className="w-full h-auto max-h-[85vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
