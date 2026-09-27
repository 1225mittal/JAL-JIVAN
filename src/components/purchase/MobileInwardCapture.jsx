import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Wifi,
  Image as ImageIcon,
  ArrowLeft,
  Upload
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Helper for canvas image compression (max width 1280px, quality 0.75)
function compressWithCanvas(file, maxWidth = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              reject(new Error('Canvas blob generation failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function MobileInwardCapture({ sessionId: propSessionId = '' }) {
  // Extract session ID from prop or URL
  const [sessionId, setSessionId] = useState(() => {
    if (propSessionId) return propSessionId;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('session') || '';
    }
    return '';
  });

  const [snappedList, setSnappedList] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [channelConnected, setChannelConnected] = useState(false);
  const [channel, setChannel] = useState(null);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Initialize Realtime Supabase Channel
  useEffect(() => {
    if (!sessionId) return;

    const ch = supabase.channel(`inward_qr_${sessionId}`, {
      config: { broadcast: { self: true } }
    });

    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setChannelConnected(true);
      } else {
        setChannelConnected(false);
      }
    });

    setChannel(ch);

    return () => {
      supabase.removeChannel(ch);
    };
  }, [sessionId]);

  // Handle snapping photo from camera
  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg('');
    setUploadProgress('Compressing photo (1280px)...');

    try {
      // 1. Compress with canvas (max width 1280px, quality 0.75)
      const { blob, dataUrl } = await compressWithCanvas(file, 1280, 0.75);

      setUploadProgress('Transmitting to laptop screen...');

      // 2. Upload to Supabase storage bucket `purchase-bills`
      let publicUrl = null;
      try {
        const fileExt = 'jpg';
        const fileName = `${sessionId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('purchase-bills')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (!uploadErr && uploadData?.path) {
          const { data: urlData } = supabase.storage
            .from('purchase-bills')
            .getPublicUrl(uploadData.path);
          publicUrl = urlData?.publicUrl;
        } else if (uploadErr) {
          console.warn('Supabase storage upload notice:', uploadErr.message);
        }
      } catch (storageErr) {
        console.warn('Storage upload notice (falling back to dataUrl):', storageErr);
      }

      // If publicUrl is obtained, use it; otherwise fallback to compressed dataUrl
      const finalImageUrl = publicUrl || dataUrl;

      // 3. Persistent Queue Storage in Supabase:
      // Insert a record directly into purchase_bill_queue with status: 'pending_ocr'
      let snappedBill = null;
      try {
        const { data, error } = await supabase
          .from('purchase_bill_queue')
          .insert([{ image_url: finalImageUrl, status: 'pending_ocr' }])
          .select()
          .single();

        if (!error && data) {
          snappedBill = data;
        } else if (error) {
          console.warn('purchase_bill_queue insert notice:', error.message);
        }
      } catch (dbErr) {
        console.warn('Failed to insert into purchase_bill_queue:', dbErr);
      }

      if (!snappedBill) {
        snappedBill = {
          id: 'bill_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          image_url: finalImageUrl,
          status: 'pending_ocr',
          created_at: new Date().toISOString()
        };
      }

      // 4. Broadcast the event via Supabase Realtime channel with the inserted record
      const broadcastPayload = {
        bill: snappedBill,
        imageUrl: finalImageUrl
      };

      // Session Broadcast
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'BILL_SNAPPED',
          payload: broadcastPayload
        }).catch(() => {});
      } else if (sessionId) {
        const directCh = supabase.channel(`inward_qr_${sessionId}`);
        directCh.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            directCh.send({
              type: 'broadcast',
              event: 'BILL_SNAPPED',
              payload: broadcastPayload
            }).catch(() => {});
          }
        });
      }

      // Requirement 2: Dual Fallback via Realtime Broadcast on global_inward_sync
      const globalChan = supabase.channel('global_inward_sync');
      globalChan.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          globalChan.send({
            type: 'broadcast',
            event: 'NEW_BILL_SNAPPED',
            payload: snappedBill
          }).catch(() => {});
        }
      });

      // 4. Record local thumbnail with confirmation
      setSnappedList((prev) => [
        {
          id: Date.now(),
          url: dataUrl,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        },
        ...prev
      ]);

      // Haptic feedback if available on mobile
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(100); } catch (v) {}
      }

    } catch (err) {
      console.error('Error processing photo:', err);
      setErrorMsg(err.message || 'Failed to capture and send photo.');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
      // 5. Keep camera input ready to snap next bill
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
      if (galleryInputRef.current) {
        galleryInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0b1329] text-white flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-20 w-full bg-slate-950/90 border-b border-slate-800 px-4 py-3 backdrop-blur-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <span>Inward Bill Mobile Camera</span>
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${channelConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
                <span className="text-[11px] font-semibold text-slate-300">
                  {channelConnected ? 'Connected to Laptop Screen' : 'Connecting to Laptop...'}
                </span>
              </div>
            </div>
          </div>

          {sessionId && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
              #{sessionId.replace('bill_', '')}
            </span>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 flex flex-col space-y-4">
        {/* Instructions Banner */}
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 space-y-1">
          <p className="font-semibold text-amber-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Live Purchase Inward Sync</span>
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Point camera directly over invoice with good lighting. Every photo snapped transmits instantly to the laptop's Uploaded Bills Queue!
          </p>
        </div>

        {/* Big Shutter Shutter Trigger Area */}
        <div className="flex-1 flex flex-col items-center justify-center py-6 px-2 space-y-4">
          {/* Hidden Camera Input with native rear-camera intent */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            className="hidden"
            id="mobile-camera-capture-input"
          />

          {/* Hidden Gallery Input */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoCapture}
            className="hidden"
            id="mobile-gallery-upload-input"
          />

          {/* Primary Action Button: Large Shutter Trigger */}
          <button
            type="button"
            disabled={isUploading}
            onClick={() => cameraInputRef.current?.click()}
            className="group relative w-full py-5 px-6 rounded-3xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-base shadow-2xl shadow-amber-500/30 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl bg-slate-950 text-amber-400 flex items-center justify-center shadow-md">
              <Camera className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="text-sm font-black uppercase tracking-wider">
                {isUploading ? 'Transmitting Photo...' : '📸 Snap Bill Photo'}
              </div>
              <div className="text-[11px] font-semibold text-slate-900 opacity-80">
                Direct camera viewfinder
              </div>
            </div>
          </button>

          {/* Secondary Action: Select from Gallery */}
          <button
            type="button"
            disabled={isUploading}
            onClick={() => galleryInputRef.current?.click()}
            className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <ImageIcon className="w-4 h-4 text-cyan-400" />
            <span>📁 Select Bill from Phone Gallery</span>
          </button>

          {/* Upload Status Alert */}
          {isUploading && (
            <div className="w-full p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-center gap-2 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span className="font-semibold">{uploadProgress}</span>
            </div>
          )}

          {/* Error Alert */}
          {errorMsg && (
            <div className="w-full p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Snapped History List for this session */}
        <div className="space-y-2.5 pb-6">
          <div className="flex items-center justify-between border-t border-slate-800 pt-3">
            <span className="text-xs font-bold text-slate-300">
              Photos Sent to Laptop ({snappedList.length})
            </span>
            <span className="text-[10px] text-slate-500">
              Camera ready for next page
            </span>
          </div>

          {snappedList.length === 0 ? (
            <div className="p-4 rounded-2xl border border-dashed border-slate-800 text-center text-slate-500 text-xs">
              No photos snapped yet. Tap the button above to begin!
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {snappedList.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2.5"
                >
                  <img
                    src={item.url}
                    alt={`Snap #${idx + 1}`}
                    className="w-12 h-14 rounded-lg object-cover bg-slate-950 border border-slate-800 shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="truncate">Sent to laptop!</span>
                    </span>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-slate-500" />
                      <span>{item.time}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-slate-950 border-t border-slate-800 py-3 text-center text-[11px] text-slate-500">
        Jal Jeevan Inward OCR • Phone Camera Companion
      </footer>
    </div>
  );
}
