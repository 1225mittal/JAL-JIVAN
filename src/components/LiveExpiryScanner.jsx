import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  X,
  Zap,
  ZapOff,
  RotateCcw,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Sparkles,
  Volume2,
  VolumeX,
  Scan,
  RefreshCw,
  ArrowRight,
  Package,
  Info,
  Bookmark
} from 'lucide-react';

export default function LiveExpiryScanner({
  isOpen,
  onClose,
  onLogDamaged
}) {
  const [streamActive, setStreamActive] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [scannerErrorMessage, setScannerErrorMessage] = useState(null);

  // Real-time active viewfinder detection (resets immediately to normal when item is removed)
  const [activeDetected, setActiveDetected] = useState(null);

  // Sticky product details (stays pinned until a new product packaging is shown and detected)
  const [pinnedProduct, setPinnedProduct] = useState(null);

  const [lastCapturedImage, setLastCapturedImage] = useState(null);
  const [auditHistory, setAuditHistory] = useState([]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const videoTrackRef = useRef(null);
  const audioCtxRef = useRef(null);
  const isAnalyzingRef = useRef(false);
  const lastAlertKeyRef = useRef(null);
  const loopTimeoutRef = useRef(null);

  // Initialize or resume the Web Audio API AudioContext on user interaction
  const ensureAudioContext = useCallback(async () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch (err) {
      console.warn('AudioContext initialization / resume error:', err);
      return null;
    }
  }, []);

  // Synthesize Web Audio alerts without any external audio dependencies
  const playAudioAlert = useCallback(async (type) => {
    if (!soundEnabled) return;
    try {
      const ctx = await ensureAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      if (type === 'expired') {
        // Double warning buzz: sawtooth wave 880Hz down to 440Hz, repeated twice
        [0, 0.2].forEach((offset) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(880, now + offset);
          osc.frequency.exponentialRampToValueAtTime(440, now + offset + 0.16);

          gain.gain.setValueAtTime(0.3, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.16);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + 0.17);
        });

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate([200, 100, 200]);
          } catch (_) {}
        }
      } else if (type === 'safe') {
        // Positive chime: sine wave 600Hz, 150ms
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch (e) {
      console.warn('Audio alert playback error:', e);
    }
  }, [soundEnabled, ensureAudioContext]);

  // Cleanly stop camera media tracks
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      streamRef.current = null;
      videoTrackRef.current = null;
    }
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    setStreamActive(false);
    setIsTorchOn(false);
    setActiveDetected(null);
  }, []);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setScannerErrorMessage(null);

    await ensureAudioContext();

    try {
      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      if (track) {
        videoTrackRef.current = track;
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        setTorchSupported(Boolean(capabilities.torch));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => {
          console.warn('Video play interrupted:', err);
        });
      }

      setStreamActive(true);
    } catch (err) {
      console.error('Camera initialization error:', err);
      let msg = 'Could not access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Please allow camera access in browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera found on this device.';
      } else {
        msg = `Camera error: ${err.message || 'Please check device permissions.'}`;
      }
      setCameraError(msg);
      setStreamActive(false);
    }
  }, [facingMode, stopCamera, ensureAudioContext]);

  // Toggle Torch/Flashlight
  const handleToggleTorch = async () => {
    if (!videoTrackRef.current || !torchSupported) return;
    try {
      const nextState = !isTorchOn;
      await videoTrackRef.current.applyConstraints({
        advanced: [{ torch: nextState }]
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn('Torch constraint error:', err);
    }
  };

  // Switch facing mode
  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture current video frame with optimal resolution and high compression for fast transfer
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0) return null;

    const canvas = canvasRef.current;
    // 520px max width is ideal for fast OCR without heavy base64 transmission overhead
    const maxWidth = 520;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.55);
  }, []);

  // Send frame to /api/groq-expiry for instant vision analysis
  const analyzeCurrentFrame = useCallback(async () => {
    if (isAnalyzingRef.current || isPaused) return;

    const base64Data = captureFrame();
    if (!base64Data) return;

    try {
      isAnalyzingRef.current = true;
      setIsAnalyzing(true);
      setScannerErrorMessage(null);

      const response = await fetch('/api/groq-expiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Data })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMsg = errorData.error || `Server error (${response.status})`;
        console.error('Groq Expiry API rejected:', errMsg);
        setScannerErrorMessage(errMsg);
        return;
      }

      const data = await response.json();

      if (data && data.detected) {
        // Active item in front of the camera: color the viewfinder border (Green / Red)
        setActiveDetected(data);
        setLastCapturedImage(base64Data);

        // STICKY DETAIL: Pin item details to stay on screen until a NEW product is detected
        setPinnedProduct({
          ...data,
          capturedImage: base64Data,
          timestamp: new Date().toLocaleTimeString()
        });

        setAuditHistory((prev) => [
          { ...data, timestamp: new Date().toLocaleTimeString() },
          ...prev.slice(0, 4)
        ]);

        // Debounce audio trigger so sound fires once per unique product result
        const alertKey = `${data.is_expired ? 'exp' : 'safe'}_${data.expiry_date || ''}_${data.product_name}`;
        if (lastAlertKeyRef.current !== alertKey) {
          lastAlertKeyRef.current = alertKey;
          await playAudioAlert(data.is_expired ? 'expired' : 'safe');
        }
      } else {
        // ITEM REMOVED FROM VIEW: Immediately revert viewfinder to normal (neutral/scanning state)
        setActiveDetected(null);
        // NOTE: pinnedProduct remains sticky so user can still review or log it!
      }
    } catch (err) {
      console.warn('Groq Expiry vision audit error:', err.message || err);
      setScannerErrorMessage(err.message || 'Vision analysis failed');
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, [captureFrame, isPaused, playAudioAlert]);

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setActiveDetected(null);
      setPinnedProduct(null);
      setLastCapturedImage(null);
      setScannerErrorMessage(null);
      lastAlertKeyRef.current = null;
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // High-Speed Adaptive Scan Loop: schedules next frame immediately after current analysis completes
  useEffect(() => {
    if (!isOpen || !streamActive || isPaused) {
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = null;
      }
      return;
    }

    let isCancelled = false;

    const runScanLoop = async () => {
      if (isCancelled || isPaused || !streamActive) return;
      await analyzeCurrentFrame();
      if (!isCancelled && !isPaused && streamActive) {
        // Fast 400ms interval between scans for instant reaction
        loopTimeoutRef.current = setTimeout(runScanLoop, 400);
      }
    };

    // Initial trigger after 600ms stream stabilization
    loopTimeoutRef.current = setTimeout(runScanLoop, 600);

    return () => {
      isCancelled = true;
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = null;
      }
    };
  }, [isOpen, streamActive, isPaused, analyzeCurrentFrame]);

  if (!isOpen) return null;

  // Active viewfinder colors reflect current real-time presence of an item
  const isCurrentlyExpired = Boolean(activeDetected?.detected && activeDetected?.is_expired);
  const isCurrentlySafe = Boolean(activeDetected?.detected && !activeDetected?.is_expired);

  // Sticky product details for card display
  const isPinnedExpired = Boolean(pinnedProduct?.is_expired);

  return (
    <div
      onClick={ensureAudioContext}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/95 backdrop-blur-md animate-fade-in select-none"
    >
      {/* Offscreen canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Scanner Container */}
      <div className="relative w-full max-w-4xl h-[94vh] sm:h-[88vh] bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
        {/* Top Header Controls Bar */}
        <div className="relative z-20 px-4 py-3 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white tracking-tight">
                  Real-Time FMCG Expiry Cam
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Groq Vision Fast LPU
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400">
                Auto-reads MFG, Expiry & Best Before • Reference: 2026-09-25
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1.5">
            {/* Sound Toggle */}
            <button
              onClick={async () => {
                await ensureAudioContext();
                setSoundEnabled(!soundEnabled);
              }}
              title={soundEnabled ? 'Mute Audio Alerts' : 'Unmute Audio Alerts'}
              className={`p-2 rounded-xl border transition ${
                soundEnabled
                  ? 'bg-slate-900 border-slate-700 text-cyan-400 hover:bg-slate-800'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Torch Toggle */}
            {torchSupported && (
              <button
                onClick={handleToggleTorch}
                title="Toggle Torch / Flashlight"
                className={`p-2 rounded-xl border transition ${
                  isTorchOn
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {isTorchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            {/* Switch Camera */}
            <button
              onClick={handleSwitchCamera}
              title="Flip Camera"
              className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              title="Close Scanner"
              className="p-2 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 hover:bg-rose-900 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Viewport Area */}
        <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
          {cameraError ? (
            <div className="p-6 text-center max-w-md space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 mx-auto flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-rose-300">{cameraError}</p>
              <button
                onClick={startCamera}
                className="py-2.5 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Camera Permission</span>
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}

          {/* TOP LIVE STATUS PILL ON CAMERA VIEW */}
          <div className="absolute top-4 left-4 right-4 z-30 pointer-events-none flex justify-center">
            {isCurrentlyExpired ? (
              <div className="px-4 py-2 rounded-2xl border shadow-xl backdrop-blur-md text-xs font-bold flex items-center gap-2 bg-red-950/90 border-red-500 text-red-200 shadow-red-500/30 animate-pulse">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>
                  {activeDetected.product_name || 'Product'} • EXPIRED (
                  {Math.abs(activeDetected.days_difference || 0)}d ago)
                </span>
              </div>
            ) : isCurrentlySafe ? (
              <div className="px-4 py-2 rounded-2xl border shadow-xl backdrop-blur-md text-xs font-bold flex items-center gap-2 bg-emerald-950/90 border-emerald-500 text-emerald-200 shadow-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {activeDetected.product_name || 'Product'} • FRESH (
                  {Math.abs(activeDetected.days_difference || 0)}d left)
                </span>
              </div>
            ) : isAnalyzing ? (
              <div className="px-4 py-2 rounded-full bg-slate-950/90 border border-cyan-500/50 shadow-lg shadow-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center gap-2 backdrop-blur-md">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>Scanning frame...</span>
              </div>
            ) : pinnedProduct ? (
              <div className="px-4 py-1.5 rounded-full bg-slate-950/85 border border-slate-700/80 text-slate-300 text-xs font-medium flex items-center gap-2 backdrop-blur-md">
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Pinned: <strong className="text-white">{pinnedProduct.product_name || 'Item'}</strong> • Aim next packaging to scan
                </span>
              </div>
            ) : scannerErrorMessage ? (
              <div className="px-4 py-2 rounded-full bg-amber-950/90 border border-amber-500/50 text-amber-300 text-xs font-medium flex items-center gap-2 backdrop-blur-md">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate max-w-xs sm:max-w-md">{scannerErrorMessage}</span>
              </div>
            ) : (
              <div className="px-4 py-2 rounded-full bg-slate-950/80 border border-slate-700/60 text-slate-300 text-xs font-medium flex items-center gap-2 backdrop-blur-md">
                <Scan className="w-3.5 h-3.5 text-cyan-400" />
                <span>Align packaging MFG / Expiry date inside viewfinder</span>
              </div>
            )}
          </div>

          {/* Real-time Viewfinder Reticle with Instant Return to Normal */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
            <div
              className={`relative w-full max-w-sm sm:max-w-md aspect-[4/3] rounded-3xl transition-all duration-200 flex flex-col justify-between p-4 ${
                isCurrentlyExpired
                  ? 'border-4 border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.9)] bg-red-950/20 animate-pulse'
                  : isCurrentlySafe
                  ? 'border-4 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.7)] bg-emerald-950/20'
                  : 'border-2 border-dashed border-cyan-400/60 shadow-[0_0_15px_rgba(34,211,238,0.2)] bg-cyan-950/5'
              }`}
            >
              {/* Corner Accents */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-current opacity-80" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-current opacity-80" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-current opacity-80" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-current opacity-80" />

              {/* Top Viewfinder Status Indicator */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full bg-black/60 text-slate-300 backdrop-blur-md border border-white/10 uppercase flex items-center gap-1.5">
                  <Scan className="w-3 h-3 text-cyan-400" />
                  Target Packaging Area
                </span>

                {activeDetected?.detected ? (
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      isCurrentlyExpired
                        ? 'bg-red-500 text-white shadow-md shadow-red-500/50'
                        : 'bg-emerald-500 text-black shadow-md shadow-emerald-500/40'
                    }`}
                  >
                    {isCurrentlyExpired ? 'EXPIRED' : 'FRESH / SAFE'}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-900/60 text-slate-400 border border-slate-700/50">
                    Scanning...
                  </span>
                )}
              </div>

              {/* Center Crosshair Guidance when empty */}
              {!activeDetected?.detected && !isAnalyzing && (
                <div className="text-center space-y-1">
                  <p className="text-xs font-bold text-white/90 drop-shadow-md">
                    Position Mfg / Expiry Date / Best Before
                  </p>
                  <p className="text-[10px] text-slate-300/80 drop-shadow">
                    Hold packaging steady inside the frame
                  </p>
                </div>
              )}

              {/* Bottom Target Tag */}
              <div className="flex items-center justify-between text-[9px] font-mono text-white/70">
                {activeDetected?.detected ? (
                  <span className="bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm truncate max-w-[200px]">
                    EXP: {activeDetected.expiry_date || 'N/A'} • MFG: {activeDetected.mfg_date || 'N/A'}
                  </span>
                ) : (
                  <span className="bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm text-cyan-300">
                    Continuous AI Stream
                  </span>
                )}

                {activeDetected?.reason && (
                  <span className="italic truncate max-w-[140px] text-slate-300/70">
                    {activeDetected.reason}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* STICKY FLOATING DETAIL CARD (Stays pinned until a new product is shown) */}
          {pinnedProduct && (
            <div className="absolute bottom-4 left-4 right-4 z-30 pointer-events-auto flex justify-center animate-slide-in">
              <div
                className={`w-full max-w-lg p-3 sm:p-4 rounded-2xl backdrop-blur-xl border shadow-2xl transition-all ${
                  isPinnedExpired
                    ? 'bg-red-950/95 border-red-500 text-white shadow-red-500/40'
                    : 'bg-emerald-950/95 border-emerald-500 text-white shadow-emerald-500/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isPinnedExpired ? 'bg-red-500 text-white' : 'bg-emerald-500 text-black'
                        }`}
                      >
                        {isPinnedExpired ? 'EXPIRED' : 'FRESH'}
                      </span>
                      <span className="text-xs sm:text-sm font-bold truncate">
                        {pinnedProduct.product_name && pinnedProduct.product_name !== 'unknown'
                          ? pinnedProduct.product_name
                          : 'Packaged Product'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-amber-300 border border-amber-400/30 flex items-center gap-1">
                        <Bookmark className="w-2.5 h-2.5" />
                        <span>Pinned</span>
                      </span>
                    </div>

                    <p className="text-xs">
                      {isPinnedExpired ? (
                        <span className="text-red-200 font-bold">
                          {Math.abs(pinnedProduct.days_difference || 0)} days past expiry (Exp: {pinnedProduct.expiry_date || 'Expired'})
                        </span>
                      ) : (
                        <span className="text-emerald-200 font-bold">
                          {Math.abs(pinnedProduct.days_difference || 0)} days remaining until {pinnedProduct.expiry_date || 'Expiry'}
                        </span>
                      )}
                    </p>

                    <div className="text-[10px] text-slate-300 flex items-center gap-3 font-mono">
                      <span>MFG: {pinnedProduct.mfg_date || 'N/A'}</span>
                      <span>EXP: {pinnedProduct.expiry_date || 'N/A'}</span>
                      <span className="opacity-75">{pinnedProduct.timestamp}</span>
                    </div>
                  </div>

                  {/* Actions on Sticky Card */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Log to Damaged Stock Button if expired */}
                    {isPinnedExpired && onLogDamaged && (
                      <button
                        onClick={() => {
                          onLogDamaged({
                            ...pinnedProduct,
                            damageType: 'Expired'
                          });
                          onClose();
                        }}
                        className="py-2 px-3 sm:px-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white text-xs font-black shadow-lg shadow-red-600/40 flex items-center gap-1.5 transition active:scale-95 whitespace-nowrap"
                        title="Log this scanned expired item to inventory"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>Log Damaged</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}

                    {/* Dismiss Button */}
                    <button
                      onClick={() => setPinnedProduct(null)}
                      className="p-1 rounded-lg bg-black/40 hover:bg-black/60 text-slate-400 hover:text-white transition"
                      title="Dismiss details"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="relative z-20 px-4 py-3 bg-slate-950/95 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Pause / Resume Button */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={async () => {
                await ensureAudioContext();
                setIsPaused(!isPaused);
              }}
              className={`flex-1 sm:flex-initial py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
                isPaused
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              <span>{isPaused ? 'Resume Auto-Scanning' : 'Pause Scanner'}</span>
            </button>

            {/* Manual Scan Now */}
            <button
              onClick={async () => {
                await ensureAudioContext();
                analyzeCurrentFrame();
              }}
              disabled={isAnalyzing}
              className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 shadow-md shadow-cyan-600/30"
            >
              <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Scanning Frame...' : 'Scan Now'}</span>
            </button>
          </div>

          {/* Quick Info / History Indicator */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>
              {pinnedProduct
                ? `Sticky Product: ${pinnedProduct.product_name || 'Item'} (${pinnedProduct.is_expired ? 'Expired' : 'Fresh'})`
                : 'Auditing frames in real time with Groq Vision'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
