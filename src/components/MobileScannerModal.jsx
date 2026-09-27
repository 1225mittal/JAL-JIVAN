import React, { useState, useEffect, useMemo } from 'react';
import {
  QrCode,
  Smartphone,
  Sparkles,
  X,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Radio,
  Image as ImageIcon,
  Clock,
  Zap
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';

export default function MobileScannerModal({
  isOpen,
  onClose,
  queue = [],
  onAddToQueue,
  onBillSnapped
}) {
  const triggerAdd = onAddToQueue || onBillSnapped;
  // Generate a unique session ID whenever modal opens
  const [sessionId, setSessionId] = useState('');
  const [copied, setCopied] = useState(false);
  const [receivedCount, setReceivedCount] = useState(0);
  const [recentReceivedPhotos, setRecentReceivedPhotos] = useState([]);
  const [channelStatus, setChannelStatus] = useState('CONNECTING');

  useEffect(() => {
    if (isOpen) {
      const newSessionId = 'bill_' + Math.random().toString(36).substring(2, 9);
      setSessionId(newSessionId);
      setReceivedCount(0);
      setRecentReceivedPhotos([]);
      setCopied(false);
    }
  }, [isOpen]);

  // Construct mobile pairing URL
  const qrUrl = useMemo(() => {
    if (typeof window === 'undefined' || !sessionId) return '';
    return `${window.location.origin}/scan-inward?session=${sessionId}`;
  }, [sessionId]);

  // Realtime Supabase Broadcast Channel Listener
  useEffect(() => {
    if (!isOpen || !sessionId) return;

    // Connect to session broadcast channel
    const channel = supabase.channel(`inward_qr_${sessionId}`, {
      config: { broadcast: { self: true } }
    });

    channel
      .on('broadcast', { event: 'BILL_SNAPPED' }, ({ payload }) => {
        const rawBill = payload?.bill;
        const imgUrl = rawBill?.image_url || payload?.imageUrl;
        if (imgUrl) {
          const newBill = {
            id: rawBill?.id || ('bill_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
            name: `Mobile Snap #${(queue?.length || 0) + 1}`,
            image_url: imgUrl,
            dataUrl: imgUrl,
            uploadedAt: rawBill?.created_at || new Date().toISOString(),
            created_at: rawBill?.created_at || new Date().toISOString(),
            status: rawBill?.status || 'pending_ocr',
            attachedToPrevious: false
          };

          if (typeof triggerAdd === 'function') {
            triggerAdd(newBill);
          }

          setReceivedCount((prev) => prev + 1);
          setRecentReceivedPhotos((prev) => [
            {
              id: newBill.id,
              url: imgUrl,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            },
            ...prev
          ]);
        }
      })
      .subscribe((status) => {
        setChannelStatus(status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, sessionId, onAddToQueue, queue?.length]);

  const handleCopyLink = () => {
    if (!qrUrl) return;
    navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-md shadow-amber-500/10">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-base sm:text-lg flex items-center gap-2">
                <span>Scan via Phone QR Code</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Live Pairing
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Snap invoices with your phone and receive them here instantly
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Close Pairing Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 flex flex-col items-center text-center space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Real-time Status Indicator Banner */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span>Listening for photos from mobile...</span>
          </div>

          {/* QR Code Container */}
          <div className="p-4 bg-white rounded-2xl shadow-xl border-4 border-amber-500/30 group transition-transform hover:scale-[1.01]">
            {qrUrl ? (
              <QRCodeSVG
                value={qrUrl}
                size={210}
                level="H"
                includeMargin={false}
              />
            ) : (
              <div className="w-[210px] h-[210px] flex items-center justify-center text-slate-400">
                Generating QR...
              </div>
            )}
          </div>

          {/* Instructions Block */}
          <div className="space-y-1.5 max-w-sm">
            <p className="text-sm font-bold text-white">
              Scan this QR code with any mobile camera to snap and upload bills directly here.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              No app or login needed on the phone. Once scanned, the mobile camera opens automatically and uploads directly to this laptop screen.
            </p>
          </div>

          {/* Link Copy & Direct Open Tools */}
          <div className="w-full flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <span className="font-mono text-slate-400 truncate flex-1 text-left px-1">
              {qrUrl}
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold transition shrink-0 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
            <a
              href={qrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition"
              title="Open mobile view in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* Live Photos Received Notification */}
          {receivedCount > 0 && (
            <div className="w-full p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-left space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{receivedCount} bill{receivedCount !== 1 ? 's' : ''} received from phone!</span>
                </span>
                <span className="text-[10px] text-emerald-400/80">Added to queue below</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {recentReceivedPhotos.map((photo) => (
                  <div key={photo.id} className="relative w-12 h-14 rounded-lg overflow-hidden border border-emerald-500/40 shrink-0">
                    <img src={photo.url} alt="Received snap" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] text-center text-slate-300 font-mono">
                      {photo.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/70">
          <span className="text-xs text-slate-400 font-mono">
            Session: <span className="text-amber-400 font-bold">{sessionId}</span>
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export { MobileScannerModal };

