import React, { useState, useEffect, useRef } from 'react';
import {
  Scan,
  Camera,
  Keyboard,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Barcode as BarcodeIcon,
  RefreshCw,
  VideoOff
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  item,
  onAssignBarcode
}) {
  const [activeTab, setActiveTab] = useState('usb'); // 'usb' | 'camera'
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scanSuccessCode, setScanSuccessCode] = useState('');

  const usbInputRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const scannerContainerId = 'barcode-reader-viewport';

  useEffect(() => {
    if (isOpen) {
      setManualCode(item?.barcode || '');
      setScanSuccessCode('');
      setCameraError('');
      // Auto-focus USB scanner input field
      setTimeout(() => {
        if (usbInputRef.current) {
          usbInputRef.current.focus();
          usbInputRef.current.select();
        }
      }, 100);
    } else {
      stopCameraScanner();
    }
  }, [isOpen, item]);

  // Handle Tab Switch
  useEffect(() => {
    if (activeTab === 'camera' && isOpen) {
      startCameraScanner();
    } else {
      stopCameraScanner();
      if (activeTab === 'usb') {
        setTimeout(() => usbInputRef.current?.focus(), 100);
      }
    }
    return () => {
      stopCameraScanner();
    };
  }, [activeTab, isOpen]);

  // Start Camera Barcode Scanner using html5-qrcode
  const startCameraScanner = async () => {
    setCameraError('');
    setIsScanning(true);

    try {
      if (html5QrCodeRef.current) {
        await stopCameraScanner();
      }

      // Small delay to ensure DOM container is rendered
      await new Promise((r) => setTimeout(r, 150));
      const container = document.getElementById(scannerContainerId);
      if (!container) return;

      const html5QrCode = new Html5Qrcode(scannerContainerId);
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 160 },
        aspectRatio: 1.777778
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleBarcodeDetected(decodedText);
        },
        () => {
          // Ignore individual frame non-detections
        }
      );
    } catch (err) {
      console.warn('Camera barcode scanner error:', err);
      setCameraError(
        err?.message?.includes('Permission')
          ? 'Camera permission was denied. Please allow camera access in browser settings.'
          : 'Could not access back camera. You can still scan using USB or enter code manually.'
      );
      setIsScanning(false);
    }
  };

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        // ignore
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  };

  // Barcode Detected
  const handleBarcodeDetected = (code) => {
    if (!code) return;
    const cleanCode = String(code).trim();
    setScanSuccessCode(cleanCode);
    stopCameraScanner();

    // Trigger slight haptic feedback if available on mobile
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(80); } catch (e) {}
    }

    setTimeout(() => {
      if (onAssignBarcode) {
        onAssignBarcode(cleanCode);
      }
      onClose();
    }, 400);
  };

  // Handle USB scanner keystroke (USB barcode scanners send standard keyboard input ending with Enter)
  const handleUsbKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = manualCode.trim();
      if (code) {
        handleBarcodeDetected(code);
      }
    }
  };

  const handleManualSubmit = (e) => {
    e?.preventDefault();
    const code = manualCode.trim();
    if (code) {
      handleBarcodeDetected(code);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Assign Product Barcode</h3>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">
                {item?.item_name || 'Select Item'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: USB Handheld vs Phone Camera */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('usb')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'usb'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>USB / Bluetooth Scanner</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'camera'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera Scanner</span>
          </button>
        </div>

        {/* Success Alert */}
        {scanSuccessCode && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 font-bold animate-in zoom-in-95">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Barcode captured: {scanSuccessCode}</span>
          </div>
        )}

        {/* Tab 1: USB / Manual Input */}
        {activeTab === 'usb' && (
          <div className="space-y-4 pt-1">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/90 text-xs text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ready for Handheld Scanner</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Point your handheld USB/Bluetooth barcode gun at the item. It will automatically detect the code and press Enter.
              </p>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Barcode Number (EAN / UPC / Code-128)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <BarcodeIcon className="w-4 h-4" />
                  </div>
                  <input
                    ref={usbInputRef}
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={handleUsbKeyDown}
                    placeholder="Scan with USB gun or type code..."
                    className="w-full pl-9 pr-4 py-3 bg-slate-950 border border-cyan-500/40 focus:border-cyan-400 rounded-xl text-white font-mono text-sm tracking-wider focus:outline-none transition shadow-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!manualCode.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition shadow-md shadow-cyan-500/20"
                >
                  Assign to Row
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Camera Scanner */}
        {activeTab === 'camera' && (
          <div className="space-y-3 pt-1">
            {cameraError ? (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Camera Access Issue</span>
                </div>
                <p>{cameraError}</p>
                <button
                  type="button"
                  onClick={startCameraScanner}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-white font-semibold text-xs transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative w-full h-[220px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
                  <div id={scannerContainerId} className="w-full h-full" />
                  {/* Laser aiming line overlay */}
                  <div className="absolute inset-x-8 top-1/2 h-0.5 bg-rose-500/80 shadow-[0_0_8px_#f43f5e] pointer-events-none animate-pulse" />
                </div>
                <p className="text-[11px] text-center text-slate-400">
                  Center the product barcode inside the camera box.
                </p>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
