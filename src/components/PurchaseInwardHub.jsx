import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileSpreadsheet,
  QrCode,
  Camera,
  Upload,
  ArrowLeft,
  Scan,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Sparkles,
  Building2,
  Receipt,
  IndianRupee,
  Barcode as BarcodeIcon,
  Eye,
  FileText,
  Calendar,
  Phone,
  User,
  ExternalLink,
  Search,
  ChevronRight,
  Clock,
  Package,
  Layers,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Zap,
  ZoomIn,
  ZoomOut,
  Link2,
  Smartphone,
  Image as ImageIcon,
  X,
  Sliders,
  AlertTriangle
} from 'lucide-react';
import BarcodeScannerModal from './BarcodeScannerModal';
import MobileScannerModal from './MobileScannerModal';
import VendorsDirectory from './purchase/VendorsDirectory';
import DebitNoteManager from './purchase/DebitNoteManager';
import ItemsInventoryHub from './items/ItemsInventoryHub';
import ErrorBoundary from './ErrorBoundary';
import { renderPdfFirstPageToImage } from '../lib/pdfToImage';
import dualOcrPipeline from '../lib/dualOcrPipeline';
import {
  fetchPurchaseInvoices,
  savePurchaseInvoice,
  deletePurchaseInvoice,
  fetchPurchaseVendors,
  syncPurchaseVendorFromOcr,
  deletePurchaseVendor,
  fetchPurchaseBillQueue,
  updatePurchaseBillStatus,
  deletePurchaseBillQueueItem,
  assignItemBarcode,
  supabase,
  isSupabaseConfigured
} from '../lib/supabase';

export const PURCHASE_UNITS = ['PCS', 'KG', 'GM', 'LTR', 'ML', 'BAG', 'BOX', 'PACK', 'TIN'];

export default function PurchaseInwardHub({
  onBackToHub,
  showToast = () => {}
}) {
  // Navigation: 'new' | 'history' | 'vendors' | 'debit_notes' | 'items'
  const [activeTab, setActiveTab] = useState('new');

  // Ledger / Invoices History State
  const [invoicesHistory, setInvoicesHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Side-by-Side Document & Ledger Drawer Modal State
  const [selectedLedgerInvoice, setSelectedLedgerInvoice] = useState(null);
  const [ledgerDocZoom, setLedgerDocZoom] = useState(1);
  const [assigningBarcodeRowId, setAssigningBarcodeRowId] = useState(null);
  const [newBarcodeInput, setNewBarcodeInput] = useState('');
  const [isAssigningBarcode, setIsAssigningBarcode] = useState(false);

  // Bill Queue & Upload State (Individual Bill Queue)
  const [billQueue, setBillQueue] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [activeProcessingBillId, setActiveProcessingBillId] = useState(null);
  const [currentQueueBillId, setCurrentQueueBillId] = useState(null);
  const [isMobileScannerOpen, setIsMobileScannerOpen] = useState(false);
  const [zoomedQueueImage, setZoomedQueueImage] = useState(null);
  const [ocrStatusMessage, setOcrStatusMessage] = useState('');
  const [recentlyArrivedIds, setRecentlyArrivedIds] = useState(() => new Set());

  const markRecentlyArrived = (id) => {
    if (!id) return;
    setRecentlyArrivedIds((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setRecentlyArrivedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2000);
  };

  // Active / Selected Bill Form State
  const [selectedFile, setSelectedFile] = useState(null);
  const [billPreviewUrl, setBillPreviewUrl] = useState(null);
  const [billBase64, setBillBase64] = useState(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Vendors State
  const [vendorsList, setVendorsList] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorLedgerFilter, setVendorLedgerFilter] = useState(null);

  // Barcode Scanner Modal State
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [activeScanningItemIndex, setActiveScanningItemIndex] = useState(null);

  // Editable Bill Header Form State
  const [sellerData, setSellerData] = useState({
    name: '',
    gst: '',
    fssai: '',
    contact: '',
    address: '',
    salesman_name: '',
    salesman_number: ''
  });

  const [invoiceData, setInvoiceData] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0]
  });

  const [bankDetails, setBankDetails] = useState({
    bank_name: '',
    account_no: '',
    ifsc: ''
  });

  // Line items state with detailed GST columns
  const [items, setItems] = useState([]);
  const [rawOcrData, setRawOcrData] = useState(null);

  // File input refs
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load purchase history
  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const data = await fetchPurchaseInvoices();
      setInvoicesHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load purchase history:', err);
      setHistoryError(err.message || 'Failed to fetch purchase invoices from database');
      setInvoicesHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load vendors list
  const loadVendors = async () => {
    setVendorsLoading(true);
    try {
      const data = await fetchPurchaseVendors();
      const list = Array.isArray(data) ? data : [];
      setVendorsList(list);
      setVendors(list);
    } catch (err) {
      console.warn('Failed to load vendors:', err);
      setVendorsList([]);
      setVendors([]);
    } finally {
      setVendorsLoading(false);
    }
  };

  const handleDeleteVendor = async (vendorOrId, deleteInvoices = false) => {
    const vendorId = typeof vendorOrId === 'object' ? vendorOrId?.id : vendorOrId;
    const vendorName = typeof vendorOrId === 'object' ? vendorOrId?.vendor_name : '';
    const vendorGstin = typeof vendorOrId === 'object' ? vendorOrId?.gstin : '';
    const label = vendorName || 'this vendor';

    try {
      setVendorsLoading(true);
      await deletePurchaseVendor(vendorId, vendorGstin, vendorName, deleteInvoices);
      showToast(
        deleteInvoices
          ? `Vendor "${label}" and associated bills deleted successfully`
          : `Vendor "${label}" removed from directory`,
        'info'
      );
      await Promise.all([loadVendors(), loadHistory()]);
      if (
        vendorLedgerFilter &&
        ((vendorName && vendorLedgerFilter.vendor_name === vendorName) ||
          (vendorId && vendorLedgerFilter.id === vendorId))
      ) {
        setVendorLedgerFilter(null);
      }
    } catch (err) {
      console.error('Delete vendor error:', err);
      showToast(err.message || 'Failed to delete vendor', 'error');
    } finally {
      setVendorsLoading(false);
    }
  };

  // Web Audio API chime for mobile snap notification
  const playNotificationChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.28, now + 0.03);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1318.51, now + 0.1);
      gain2.gain.setValueAtTime(0.001, now + 0.1);
      gain2.gain.linearRampToValueAtTime(0.18, now + 0.13);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.55);
    } catch (e) {
      // Audio autoplay restrictions handled gracefully
    }
  };

  const handleIncomingBill = (newItem) => {
    if (!newItem) return;
    const imgUrl = typeof newItem === 'string' ? newItem : (newItem.image_url || newItem.dataUrl);
    if (!imgUrl) return;

    const itemObj = typeof newItem === 'string' ? {
      id: 'bill_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: `Mobile Snap #${billQueue.length + 1}`,
      image_url: imgUrl,
      dataUrl: imgUrl,
      uploadedAt: new Date().toISOString(),
      created_at: new Date().toISOString(),
      status: 'pending_ocr',
      attachedToPrevious: false
    } : {
      id: newItem.id || ('bill_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
      name: newItem.name || `Mobile Snap #${billQueue.length + 1}`,
      image_url: imgUrl,
      dataUrl: imgUrl,
      uploadedAt: newItem.created_at || newItem.uploadedAt || new Date().toISOString(),
      created_at: newItem.created_at || new Date().toISOString(),
      status: newItem.status || 'pending_ocr',
      attachedToPrevious: false
    };

    setBillQueue((prev) => {
      const exists = prev.some(
        (b) => b.id === itemObj.id || (itemObj.image_url && (b.image_url === itemObj.image_url || b.dataUrl === itemObj.image_url))
      );
      if (exists) return prev;
      return [itemObj, ...prev];
    });

    markRecentlyArrived(itemObj.id);
    playNotificationChime();
    showToast(`📸 Photo received from mobile (${billQueue.length + 1} total)`, 'success');
  };

  const handleRemoveBillFromQueue = async (billId) => {
    try {
      await deletePurchaseBillQueueItem(billId);
    } catch (err) {
      console.warn('Failed to delete bill from queue in supabase:', err);
    }
    setBillQueue((prev) => prev.filter((b) => b.id !== billId));
    if (currentQueueBillId === billId) {
      setCurrentQueueBillId(null);
    }
  };

  // Toggle multi-page attachment flag
  const handleToggleAttachToPrevious = (billId) => {
    setBillQueue((prev) =>
      (prev || []).map((b) =>
        b.id === billId ? { ...b, attachedToPrevious: !b.attachedToPrevious } : b
      )
    );
  };

  // Load pending queue from Supabase on mount
  useEffect(() => {
    const fetchPendingQueue = async () => {
      try {
        const queuedBills = await fetchPurchaseBillQueue();
        if (queuedBills && queuedBills.length > 0) {
          setBillQueue(
            queuedBills.map((b, idx) => ({
              ...b,
              name: b.name || `Mobile Snap #${idx + 1}`,
              dataUrl: b.image_url,
              uploadedAt: b.created_at || new Date().toISOString(),
              attachedToPrevious: false
            }))
          );
        }
      } catch (err) {
        console.warn('Failed to load pending queue from Supabase:', err);
      }
    };

    fetchPendingQueue();
    loadHistory();
    loadVendors();

    // Supabase Realtime Subscription on purchase_bill_queue
    const isConfigured = typeof isSupabaseConfigured === 'function' ? isSupabaseConfigured() : Boolean(isSupabaseConfigured);
    if (isConfigured && supabase) {
      const queueChannel = supabase
        .channel('realtime_bill_queue')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'purchase_bill_queue' },
          (payload) => {
            if (!payload?.new) return;
            const newRow = payload.new;
            const formatted = {
              ...newRow,
              name: newRow.name || `Mobile Snap #${Date.now().toString().slice(-4)}`,
              image_url: newRow.image_url,
              dataUrl: newRow.image_url,
              uploadedAt: newRow.created_at || new Date().toISOString(),
              created_at: newRow.created_at || new Date().toISOString(),
              status: newRow.status || 'pending_ocr',
              attachedToPrevious: false
            };

            setBillQueue((prev) => {
              if (prev.some((b) => b.id === formatted.id || (formatted.image_url && (b.image_url === formatted.image_url || b.dataUrl === formatted.image_url)))) {
                return prev;
              }
              return [formatted, ...prev];
            });

            markRecentlyArrived(formatted.id);
            playNotificationChime();
            showToast('📸 New bill snapped from mobile added to queue!', 'success');
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'purchase_bill_queue' },
          (payload) => {
            if (!payload?.new) return;
            const updated = payload.new;
            setBillQueue((prev) =>
              updated.status === 'pending_ocr'
                ? (prev || []).map((b) =>
                    b.id === updated.id
                      ? {
                          ...b,
                          ...updated,
                          image_url: updated.image_url,
                          dataUrl: updated.image_url
                        }
                      : b
                  )
                : (prev || []).filter((b) => b.id !== updated.id)
            );
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'purchase_bill_queue' },
          (payload) => {
            if (payload?.old?.id) {
              setBillQueue((prev) => prev.filter((b) => b.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      // Dual Fallback via Realtime Broadcast on global_inward_sync
      const globalSyncChannel = supabase
        .channel('global_inward_sync')
        .on('broadcast', { event: 'NEW_BILL_SNAPPED' }, ({ payload }) => {
          if (!payload) return;
          const imgUrl = payload.image_url || payload.imageUrl || payload.dataUrl;
          if (!imgUrl) return;

          const newBill = {
            ...payload,
            id: payload.id || ('bill_' + Date.now()),
            name: payload.name || `Mobile Snap #${Date.now().toString().slice(-4)}`,
            image_url: imgUrl,
            dataUrl: imgUrl,
            uploadedAt: payload.created_at || new Date().toISOString(),
            created_at: payload.created_at || new Date().toISOString(),
            status: payload.status || 'pending_ocr',
            attachedToPrevious: false
          };

          setBillQueue((prev) => {
            if (prev.some((b) => b.id === newBill.id || (imgUrl && (b.image_url === imgUrl || b.dataUrl === imgUrl)))) {
              return prev;
            }
            return [newBill, ...prev];
          });

          markRecentlyArrived(newBill.id);
          playNotificationChime();
          showToast('📸 New bill snapped from mobile added to queue!', 'success');
        })
        .subscribe();

      return () => {
        supabase.removeChannel(queueChannel);
        supabase.removeChannel(globalSyncChannel);
      };
    }
  }, []);

  // Handle Multi-File / Image / PDF Upload
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setOcrError('');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const { dataUrl, base64 } = await renderPdfFirstPageToImage(file, 2.0);
          const newItem = {
            id: `bill_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
            dataUrl,
            base64,
            mimeType: 'image/jpeg',
            name: file.name,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            attachedToPrevious: false,
            status: 'queued'
          };
          setBillQueue((prev) => [...prev, newItem]);
        } else {
          await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (evt) => {
              const dataUrl = evt.target.result;
              const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
              const newItem = {
                id: `bill_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
                dataUrl,
                base64,
                mimeType: file.type || 'image/jpeg',
                name: file.name,
                size: file.size,
                uploadedAt: new Date().toISOString(),
                attachedToPrevious: false,
                status: 'queued'
              };
              setBillQueue((prev) => [...prev, newItem]);
              resolve();
            };
            reader.readAsDataURL(file);
          });
        }
      } catch (err) {
        console.error('File conversion error:', err);
        setOcrError(`Failed to process document "${file.name}": ${err.message || 'Corrupted file'}`);
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Convert image URL to base64 if needed
  const getBase64FromUrl = async (url) => {
    if (!url) return null;
    if (url.startsWith('data:')) {
      return url.replace(/^data:image\/[a-z]+;base64,/, '');
    }
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        resolve(result.replace(/^data:image\/[a-z]+;base64,/, ''));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Process a SINGLE bill through Groq Vision OCR
  const processSingleBillOcr = async (billItem) => {
    if (!billItem) return;

    setActiveProcessingBillId(billItem.id);
    setCurrentQueueBillId(billItem.id);
    setIsProcessingOcr(true);
    setOcrError('');
    setOcrStatusMessage(`Running Ensemble OCR (Gemini + Groq) on "${billItem.name || 'Selected Bill'}"...`);

    const imgPreview = billItem.dataUrl || billItem.image_url;
    setBillPreviewUrl(imgPreview);

    try {
      let base64 = billItem.base64;
      if (!base64 && (billItem.image_url || billItem.dataUrl)) {
        setOcrStatusMessage('Fetching full-resolution bill image for Ensemble OCR...');
        base64 = await getBase64FromUrl(billItem.image_url || billItem.dataUrl);
      }

      if (!base64) {
        throw new Error('Could not access image data for Ensemble Vision OCR.');
      }

      setBillBase64(base64);
      setOcrStatusMessage('Analyzing layout, items, barcodes & GST breakdown via Ensemble Engine (Gemini + Groq Consensus)...');

      const parsed = await dualOcrPipeline.processBill(base64, {
        mimeType: billItem.mimeType || 'image/jpeg'
      });
      setRawOcrData(parsed);

      // Populate Editable Header Fields (Priority to standard schema with fallback to nested)
      const vendorName = parsed.vendor_name || parsed.seller?.name || '';
      const vendorGstin = parsed.vendor_gstin || parsed.seller?.gst || '';
      const vendorAddress = parsed.vendor_address || parsed.seller?.address || '';
      const vendorPhone = parsed.vendor_phone || parsed.seller?.contact || '';
      const fssai = parsed.vendor_fssai || parsed.fssai || parsed.seller?.fssai || '';
      const salesmanName = parsed.salesman_name || parsed.seller?.salesman_name || '';
      const salesmanNumber = parsed.salesman_number || parsed.seller?.salesman_number || '';

      if (vendorName || vendorGstin || parsed.seller) {
        setSellerData({
          name: vendorName,
          gst: vendorGstin,
          fssai: fssai,
          contact: vendorPhone,
          address: vendorAddress,
          salesman_name: salesmanName,
          salesman_number: salesmanNumber
        });
      }

      const invoiceNum = parsed.invoice_no || parsed.invoice?.invoice_number || '';
      const invoiceDate = parsed.invoice_date || parsed.invoice?.invoice_date || '';

      if (invoiceNum || invoiceDate || parsed.invoice) {
        setInvoiceData({
          invoice_number: invoiceNum || `INV-${Date.now().toString().slice(-6)}`,
          invoice_date: invoiceDate || new Date().toISOString().split('T')[0]
        });
      }

      if (parsed.bank_details) {
        setBankDetails({
          bank_name: parsed.bank_details.bank_name || '',
          account_no: parsed.bank_details.account_no || '',
          ifsc: parsed.bank_details.ifsc || ''
        });
      }

      // Populate Line Items with detailed GST fields & auto-calculation
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        setItems(
          parsed.items.map((it, idx) => {
            const sn = Number(it.sn) || (idx + 1);
            const qty = Number(it.qty ?? it.quantity) || 1;
            const rate = Number(it.rate ?? it.purchase_price ?? it.price_before_gst) || 0;
            const disc = Number(it.discount_amount ?? it.discount) || 0;
            const taxable = Number(it.taxable_amount) || +Math.max(0, (qty * rate) - disc).toFixed(2);
            const gstPct = Number(it.gst_pct ?? it.gst_rate) || 18;
            const cgstPct = Number(it.cgst_pct) || (gstPct / 2);
            const sgstPct = Number(it.sgst_pct) || (gstPct / 2);
            const cgstAmt = Number(it.cgst_amount) || +((taxable * (cgstPct / 100))).toFixed(2);
            const sgstAmt = Number(it.sgst_amount) || +((taxable * (sgstPct / 100))).toFixed(2);
            const cessAmt = Number(it.cess_amount ?? it.cess) || 0;
            const totalAmt = Number(it.total_amount ?? it.price_after_gst) || +(taxable + cgstAmt + sgstAmt + cessAmt).toFixed(2);
            const hsnCode = (it.hsn ?? it.hsn_code ?? '').toString().trim();
            const rawBarcode = (it.barcode || '').toString().trim();
            // Discard barcode if it matches HSN or is less than 12 digits
            const cleanBarcode = (rawBarcode && rawBarcode !== hsnCode && rawBarcode.length >= 12) ? rawBarcode : '';

            return {
              id: `temp_${Date.now()}_${idx}`,
              sn,
              barcode: cleanBarcode,
              item_name: it.item_name || `Item ${sn}`,
              hsn_code: hsnCode,
              hsn: hsnCode,
              unit: (it.unit || 'PCS').toString().toUpperCase().trim(),
              quantity: qty,
              qty,
              mrp: Number(it.mrp) || +(rate * 1.25).toFixed(2),
              rate: rate,
              purchase_price: rate,
              price_before_gst: rate,
              taxable_amount: taxable,
              gst_pct: gstPct,
              gst_rate: gstPct,
              cgst_pct: cgstPct,
              cgst_amount: cgstAmt,
              sgst_pct: sgstPct,
              sgst_amount: sgstAmt,
              cess_pct: Number(it.cess_pct) || 0,
              cess_amount: cessAmt,
              cess: cessAmt,
              discount: disc,
              discount_amount: disc,
              total_amount: totalAmt,
              price_after_gst: totalAmt
            };
          })
        );
      } else {
        setItems([
          {
            id: `temp_${Date.now()}`,
            barcode: '',
            item_name: 'New Product Item',
            hsn_code: '2201',
            unit: 'PCS',
            quantity: 1,
            mrp: 100,
            rate: 70,
            price_before_gst: 70,
            taxable_amount: 70,
            gst_pct: 18,
            gst_rate: 18,
            cgst_pct: 9,
            cgst_amount: 6.30,
            sgst_pct: 9,
            sgst_amount: 6.30,
            cess_pct: 0,
            cess_amount: 0,
            cess: 0,
            discount: 0,
            total_amount: 82.60,
            price_after_gst: 82.60
          }
        ]);
      }

      setBillQueue((prev) =>
        (prev || []).map((b) => (b.id === billItem.id ? { ...b, extracted: true } : b))
      );

      showToast(`⚡ Bill "${billItem.name || 'Mobile Snap'}" verified & extracted successfully via Ensemble Consensus!`, 'success');

      setTimeout(() => {
        const reviewEl = document.getElementById('inward-bill-review-section');
        if (reviewEl) reviewEl.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (err) {
      console.error('Ensemble OCR failure:', err);
      setOcrError(err.message || 'Failed to extract text from bill. You can still input details manually.');
    } finally {
      setIsProcessingOcr(false);
      setActiveProcessingBillId(null);
      setOcrStatusMessage('');
    }
  };

  // Recalculate row totals with detailed GST logic
  const handleItemFieldChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: value };

      const qty = Number(target.quantity) || 1;
      const rate = Number(target.rate ?? target.price_before_gst) || 0;
      const disc = Number(target.discount) || 0;
      const gstPct = Number(target.gst_pct ?? target.gst_rate) || 0;
      const cessAmt = Number(target.cess_amount ?? target.cess) || 0;

      // If user adjusts taxable_amount directly
      let taxable = Number(target.taxable_amount) || 0;
      if (field === 'rate' || field === 'quantity' || field === 'discount') {
        taxable = Math.max(0, +(qty * rate - disc).toFixed(2));
        target.taxable_amount = taxable;
        target.price_before_gst = rate;
      }

      const cgstPct = gstPct / 2;
      const sgstPct = gstPct / 2;
      const cgstAmt = +((taxable * (cgstPct / 100))).toFixed(2);
      const sgstAmt = +((taxable * (sgstPct / 100))).toFixed(2);
      const totalAmt = +(taxable + cgstAmt + sgstAmt + cessAmt).toFixed(2);

      target.cgst_pct = cgstPct;
      target.cgst_amount = cgstAmt;
      target.sgst_pct = sgstPct;
      target.sgst_amount = sgstAmt;
      target.total_amount = totalAmt;
      target.price_after_gst = totalAmt;
      target.gst_rate = gstPct;

      next[index] = target;
      return next;
    });
  };

  // Add Item Row
  const handleAddItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `row_${Date.now()}`,
        barcode: '',
        item_name: '',
        hsn_code: '',
        unit: 'PCS',
        quantity: 1,
        mrp: 0,
        rate: 0,
        price_before_gst: 0,
        taxable_amount: 0,
        gst_pct: 18,
        gst_rate: 18,
        cgst_pct: 9,
        cgst_amount: 0,
        sgst_pct: 9,
        sgst_amount: 0,
        cess_pct: 0,
        cess_amount: 0,
        cess: 0,
        discount: 0,
        total_amount: 0,
        price_after_gst: 0
      }
    ]);
  };

  const handleRemoveItemRow = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Open Barcode Scanner for Row
  const handleOpenScanner = (index) => {
    setActiveScanningItemIndex(index);
    setIsBarcodeModalOpen(true);
  };

  // Barcode Assigned from Camera / USB Scanner
  const handleBarcodeAssigned = (code) => {
    if (activeScanningItemIndex !== null && items[activeScanningItemIndex]) {
      setItems((prev) => {
        const next = [...prev];
        next[activeScanningItemIndex] = {
          ...next[activeScanningItemIndex],
          barcode: code,
          _justScanned: true
        };
        return next;
      });
      showToast(`Barcode ${code} assigned to ${items[activeScanningItemIndex].item_name || 'item'}`, 'success');
    }
  };

  // Calculations for Totals Card & Indian GST Invoice Round-Off Matching
  const { totalTaxable, totalCgst, totalSgst, totalCess, totalTax, subtotal, roundOff, grandTotal } = useMemo(() => {
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let cess = 0;
    let rowSubtotal = 0;

    (items || []).forEach((it) => {
      if (!it) return;
      taxable += Number(it.taxable_amount) || 0;
      cgst += Number(it.cgst_amount) || 0;
      sgst += Number(it.sgst_amount) || 0;
      cess += Number(it.cess_amount || it.cess) || 0;
      rowSubtotal += Number(it.total_amount ?? it.price_after_gst) || 0;
    });

    const tax = cgst + sgst + cess;
    const cleanSubtotal = +rowSubtotal.toFixed(2);
    const roundedNetTotal = Math.round(cleanSubtotal);
    const roundOffAmt = +(roundedNetTotal - cleanSubtotal).toFixed(2);

    return {
      totalTaxable: +taxable.toFixed(2),
      totalCgst: +cgst.toFixed(2),
      totalSgst: +sgst.toFixed(2),
      totalCess: +cess.toFixed(2),
      totalTax: +tax.toFixed(2),
      subtotal: cleanSubtotal,
      roundOff: roundOffAmt,
      grandTotal: roundedNetTotal
    };
  }, [items]);

  // Save Purchase Entry to Supabase (Permanent Archival & Stock Sync)
  const handleSavePurchaseEntry = async () => {
    if (!sellerData.name.trim()) {
      showToast('Please enter the Seller / Vendor Name', 'error');
      alert('⚠️ Validation Notice:\nPlease enter the Seller / Vendor Name before saving.');
      return;
    }
    if (items.length === 0) {
      showToast('At least one line item is required', 'error');
      alert('⚠️ Validation Notice:\nAt least one line item is required in the bill.');
      return;
    }

    setIsSaving(true);
    try {
      const bankAccountNo = (bankDetails.account_no || bankDetails.bank_account_no || '').trim();
      const bankIfsc = (bankDetails.ifsc || bankDetails.bank_ifsc || '').trim();

      // Collect all permanent bill image URLs
      const billImageUrls = [
        billPreviewUrl,
        ...((billQueue || []).filter((b) => b && (b.id === currentQueueBillId || b.attachedToPrevious)).map((b) => b.image_url || b.dataUrl))
      ].filter(Boolean);

      const uniqueBillUrls = Array.from(new Set(billImageUrls));

      const invoicePayload = {
        invoice_number: invoiceData.invoice_number || `INV-${Date.now()}`,
        invoice_date: invoiceData.invoice_date || new Date().toISOString().split('T')[0],
        seller_name: (sellerData.name || '').trim(),
        seller_gst: (sellerData.gst || '').trim(),
        seller_fssai: (sellerData.fssai || '').trim(),
        seller_contact: (sellerData.contact || '').trim(),
        seller_address: (sellerData.address || '').trim(),
        salesman_name: (sellerData.salesman_name || '').trim(),
        salesman_number: (sellerData.salesman_number || '').trim(),
        bank_name: (bankDetails.bank_name || '').trim() || null,
        bank_account_no: bankAccountNo || null,
        bank_ifsc: bankIfsc || null,
        account_no: bankAccountNo || null,
        ifsc: bankIfsc || null,
        subtotal: subtotal,
        round_off_amount: roundOff,
        round_off: roundOff,
        total_taxable_amount: totalTaxable,
        total_tax_amount: totalTax,
        grand_total: grandTotal,
        bill_image_url: uniqueBillUrls[0] || billPreviewUrl || '',
        bill_image_urls: uniqueBillUrls,
        vendor_details: sellerData,
        tax_summary: {
          total_taxable: totalTaxable,
          total_cgst: totalCgst,
          total_sgst: totalSgst,
          total_cess: totalCess,
          total_tax: totalTax,
          subtotal: subtotal,
          round_off: roundOff,
          grand_total: grandTotal
        },
        status: 'verified'
      };

      if (rawOcrData && typeof rawOcrData === 'object' && Object.keys(rawOcrData).length > 0) {
        invoicePayload.raw_ocr_data = rawOcrData;
        invoicePayload.extracted_json = rawOcrData;
      }

      // Format items with detailed GST fields & unit for purchase_items & inventory sync
      const formattedItems = (items || []).map((it) => {
        const qty = Number(it.quantity) || 1;
        const total = Number(it.total_amount ?? it.price_after_gst) || 0;
        const landedCost = qty > 0 ? Number((total / qty).toFixed(2)) : total;
        return {
          ...it,
          unit: (it.unit || 'PCS').toString().toUpperCase().trim(),
          quantity: qty,
          landed_cost_per_unit: landedCost,
          purchase_price: Number(it.rate ?? it.price_before_gst) || 0,
          rate: Number(it.rate ?? it.price_before_gst) || 0,
          taxable_amount: Number(it.taxable_amount) || 0,
          gst_pct: Number(it.gst_pct ?? it.gst_rate) || 0,
          cgst_pct: Number(it.cgst_pct) || 0,
          cgst_amount: Number(it.cgst_amount) || 0,
          sgst_pct: Number(it.sgst_pct) || 0,
          sgst_amount: Number(it.sgst_amount) || 0,
          cess_pct: Number(it.cess_pct) || 0,
          cess_amount: Number(it.cess_amount ?? it.cess) || 0,
          total_amount: total
        };
      });

      // 1. Commit to purchase_invoices and purchase_items + auto-sync to inventory_items
      const saved = await savePurchaseInvoice(invoicePayload, formattedItems);

      // 2. Mark queue row status = 'processed' (never permanently delete)
      if (currentQueueBillId) {
        try {
          await updatePurchaseBillStatus(currentQueueBillId, 'processed');
          setBillQueue((prev) => prev.filter((b) => b.id !== currentQueueBillId));
        } catch (queueErr) {
          console.warn('Notice: Queue status update error:', queueErr);
        }
        setCurrentQueueBillId(null);
      }

      // 3. Auto-sync vendor profile
      if (sellerData.name) {
        try {
          await syncPurchaseVendorFromOcr(
            {
              name: sellerData.name,
              gstin: sellerData.gst,
              phone: sellerData.contact,
              address: sellerData.address,
              bill_date: invoiceData.invoice_date
            },
            grandTotal
          );
          loadVendors();
        } catch (vErr) {
          console.warn('Vendor profile sync notice on save:', vErr);
        }
      }

      showToast('🎉 Purchase invoice committed & inventory stock synced!', 'success');

      await loadHistory();
      setActiveTab('history');
      resetUploadState();
    } catch (err) {
      console.error('Save purchase error:', err);
      const errorMessage = err?.message || 'Database error occurred';
      showToast(`Save Failed: ${errorMessage}`, 'error');
      alert(`⚠️ Database Failure:\n\n${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const resetUploadState = () => {
    setSelectedFile(null);
    setBillPreviewUrl(null);
    setBillBase64(null);
    setOcrError('');
    setActiveProcessingBillId(null);
    setSellerData({
      name: '',
      gst: '',
      fssai: '',
      contact: '',
      address: '',
      salesman_name: '',
      salesman_number: ''
    });
    setInvoiceData({
      invoice_number: '',
      invoice_date: new Date().toISOString().split('T')[0]
    });
    setBankDetails({ bank_name: '', account_no: '', ifsc: '' });
    setItems([]);
    setRawOcrData(null);
  };

  const handleDeleteInvoice = async (id) => {
    if (!window.confirm('Are you sure you want to delete this purchase entry? This will also remove associated line items.')) return;
    try {
      await deletePurchaseInvoice(id);
      showToast('Purchase invoice deleted successfully', 'info');
      await loadHistory();
      if (selectedLedgerInvoice?.id === id) {
        setSelectedLedgerInvoice(null);
      }
    } catch (err) {
      console.error('Delete invoice error:', err);
      const errMsg = err?.message || 'Failed to delete invoice from database';
      showToast(`Delete Failed: ${errMsg}`, 'error');
    }
  };

  // Inline Barcode Assignment in Purchase Ledger
  const handleAssignBarcodeToLedgerItem = async (item) => {
    if (!newBarcodeInput.trim()) {
      showToast('Please enter a barcode', 'error');
      return;
    }

    setIsAssigningBarcode(true);
    try {
      await assignItemBarcode(item.id, newBarcodeInput.trim(), item.item_name);
      showToast(`Barcode ${newBarcodeInput.trim()} assigned to "${item.item_name}"!`, 'success');

      // Update in selected invoice
      setSelectedLedgerInvoice((prev) => {
        if (!prev) return prev;
        const updatedItems = (prev.purchase_items || prev.items || []).map((it) =>
          it.id === item.id ? { ...it, barcode: newBarcodeInput.trim() } : it
        );
        return { ...prev, purchase_items: updatedItems, items: updatedItems };
      });

      // Update in ledger history state
      setInvoicesHistory((prev) =>
        (prev || []).map((inv) => {
          if (inv.id === selectedLedgerInvoice?.id) {
            const updatedItems = (inv.purchase_items || inv.items || []).map((it) =>
              it.id === item.id ? { ...it, barcode: newBarcodeInput.trim() } : it
            );
            return { ...inv, purchase_items: updatedItems, items: updatedItems };
          }
          return inv;
        })
      );

      setAssigningBarcodeRowId(null);
      setNewBarcodeInput('');
    } catch (err) {
      console.error('Failed to assign barcode:', err);
      showToast(err.message || 'Failed to assign barcode', 'error');
    } finally {
      setIsAssigningBarcode(false);
    }
  };

  const filteredHistory = useMemo(() => {
    const list = Array.isArray(invoicesHistory) ? invoicesHistory : [];
    const q = (searchQuery || '').toLowerCase().trim();
    if (!q && !vendorLedgerFilter) return list;

    return list.filter((inv) => {
      if (!inv) return false;
      const matchVendorFilter = vendorLedgerFilter
        ? (inv.seller_name || '').toLowerCase() === (vendorLedgerFilter.vendor_name || '').toLowerCase()
        : true;

      const matchQuery = !q
        ? true
        : (inv.seller_name || '').toLowerCase().includes(q) ||
          (inv.invoice_number || '').toLowerCase().includes(q) ||
          (inv.seller_gst || '').toLowerCase().includes(q);

      return matchVendorFilter && matchQuery;
    });
  }, [invoicesHistory, searchQuery, vendorLedgerFilter]);

  return (
    <ErrorBoundary title="Purchase Inward Management">
      <div className="min-h-screen bg-[#070b14] text-white">
      {/* ======================================================== */}
      {/* REQUIREMENT 7: MODERN 2-COLUMN ENTERPRISE LAYOUT */}
      {/* ======================================================== */}
      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* ======================================================== */}
        {/* LEFT COLUMN: NARROW NAVIGATION SIDEBAR (250px - 280px) */}
        {/* ======================================================== */}
        <aside className="w-full lg:w-64 xl:w-72 bg-slate-950/90 border-b lg:border-b-0 lg:border-r border-slate-800 p-4 shrink-0 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Clean Single Return to Hub Button */}
            {onBackToHub && (
              <button
                type="button"
                onClick={onBackToHub}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition text-xs font-semibold cursor-pointer shadow-sm"
              >
                <ArrowLeft className="w-4 h-4 text-amber-400" />
                <span>← Back to Admin Hub</span>
              </button>
            )}

            {/* Brand Header */}
            <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 border border-amber-500/20">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-sm font-black text-white tracking-wide">Purchase Hub</h1>
                  <span className="text-[10px] font-semibold text-amber-400/90">Enterprise Inward & Sync</span>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="space-y-1 text-xs font-bold">
              {/* Tab 1: Add New Purchase */}
              <button
                type="button"
                onClick={() => setActiveTab('new')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition text-left cursor-pointer ${
                  activeTab === 'new'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Plus className="w-4 h-4" />
                  <span>📥 Add New Purchase</span>
                </div>
                {billQueue.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === 'new' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {billQueue.length}
                  </span>
                )}
              </button>

              {/* Tab 2: Invoices Ledger */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('history');
                  loadHistory();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition text-left cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>📜 Invoices Ledger</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'history' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {invoicesHistory.length}
                </span>
              </button>

              {/* Tab 3: Item & Stock Master */}
              <button
                type="button"
                onClick={() => setActiveTab('items')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition text-left cursor-pointer ${
                  activeTab === 'items'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4" />
                  <span>📦 Item & Stock Master</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-400">Live</span>
              </button>

              {/* Tab 4: Vendors Directory */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('vendors');
                  loadVendors();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition text-left cursor-pointer ${
                  activeTab === 'vendors'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4" />
                  <span>🏢 Vendors Directory</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'vendors' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {vendorsList.length}
                </span>
              </button>

              {/* Tab 5: Sale Return / Debit Note */}
              <button
                type="button"
                onClick={() => setActiveTab('debit_notes')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition text-left cursor-pointer ${
                  activeTab === 'debit_notes'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="w-4 h-4" />
                  <span>🔄 Sale Return / Debit Note</span>
                </div>
              </button>
            </nav>
          </div>

          {/* Left Sidebar Footer */}
          <div className="pt-4 border-t border-slate-900 text-[11px] text-slate-500 space-y-1 hidden lg:block">
            <div className="flex items-center justify-between font-semibold text-slate-400">
              <span>Jal Jeevan Enterprise</span>
              <span className="font-mono text-emerald-400">v2.5</span>
            </div>
            <p className="text-[10px] text-slate-600">
              Permanent archival, Groq Vision OCR & automatic stock syncing.
            </p>
          </div>
        </aside>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: FLUID WORKSPACE AREA */}
        {/* ======================================================== */}
        <main className="flex-1 min-w-0 p-3 sm:p-5 lg:p-6 overflow-y-auto">
          {/* ======================================================== */}
          {/* WORKSPACE TAB 1: ADD NEW PURCHASE (ACTIVE QUEUE & OCR) */}
          {/* ======================================================== */}
          {activeTab === 'new' && (
            <ErrorBoundary title="New Purchase Entry">
              <div className="space-y-4 max-w-[1400px]">
                {/* Dropzone & Mobile Pairing Header Banner */}
                <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-2.5">
                  <div>
                    <h2 className="text-base font-black text-white flex items-center gap-2">
                      <Upload className="w-5 h-5 text-amber-400" />
                      <span>Invoice Upload Drop-Zone & Mobile Camera Sync</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Snap bills with mobile camera via live QR pairing or upload invoice files.
                    </p>
                  </div>

                  {selectedFile && (
                    <button
                      type="button"
                      onClick={resetUploadState}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Clear Active Form</span>
                    </button>
                  )}
                </div>

                {/* Hidden Inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, application/pdf"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Action Triggers: Phone QR Code Pairing Modal & File Upload */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsMobileScannerOpen(true)}
                    className="group flex items-center gap-3 p-3.5 rounded-2xl border-2 border-dashed border-amber-500/50 hover:border-amber-400 bg-slate-950/70 hover:bg-slate-950 transition cursor-pointer text-left shadow-lg shadow-amber-500/5"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 transition">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-xs sm:text-sm group-hover:text-amber-400 transition flex items-center gap-1.5">
                        <span>📱 Scan via Phone QR Code</span>
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded-full border border-amber-500/30">
                          Live Sync
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Scan QR with mobile camera for crisp high-contrast document snaps
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="group flex items-center gap-3 p-3.5 rounded-2xl border-2 border-dashed border-cyan-500/50 hover:border-cyan-400 bg-slate-950/70 hover:bg-slate-950 transition cursor-pointer text-left shadow-lg shadow-cyan-500/5"
                  >
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 group-hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 transition">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-xs sm:text-sm group-hover:text-cyan-400 transition flex items-center gap-1.5">
                        <span>📁 Upload Bill Photos / PDF (Multi-File)</span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Upload invoice images or PDFs. Each bill is queued separately
                      </p>
                    </div>
                  </button>
                </div>

                {/* Uploaded Bills Queue (Individual Cards) */}
                <div className="space-y-2.5 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <h3 className="text-xs sm:text-sm font-bold text-white">
                        Uploaded Bills Queue
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {billQueue.length} bill{billQueue.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      Process each bill card separately through Ensemble OCR (Gemini + Groq)
                    </span>
                  </div>

                  {(!billQueue || billQueue.length === 0) ? (
                    <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center text-slate-500 text-xs">
                      No bills in the inward queue. Snap a photo using your phone or click Upload above.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {(billQueue || []).map((bill, index) => {
                        const isProcessingThis = activeProcessingBillId === bill.id;
                        const isRecentlyArrived = recentlyArrivedIds.has(bill.id);
                        const imgSrc = bill.image_url || bill.dataUrl;

                        return (
                          <div
                            key={bill.id}
                            className={`p-3 rounded-2xl border transition relative flex flex-col justify-between ${
                              isRecentlyArrived
                                ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                                : currentQueueBillId === bill.id
                                ? 'bg-amber-950/20 border-amber-500/50'
                                : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="space-y-2">
                              {/* Thumbnail with Zoom Preview */}
                              <div className="relative group/thumb aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                                {imgSrc ? (
                                  <img
                                    src={imgSrc}
                                    alt={bill.name || `Bill #${index + 1}`}
                                    className="w-full h-full object-cover group-hover/thumb:scale-105 transition duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                                    <FileText className="w-8 h-8" />
                                  </div>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setZoomedQueueImage(imgSrc)}
                                  className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover/thumb:opacity-100 transition flex items-center justify-center text-white gap-1.5 text-xs font-semibold"
                                >
                                  <ZoomIn className="w-4 h-4" />
                                  <span>View Photo</span>
                                </button>
                              </div>

                              {/* Card Meta */}
                              <div>
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold text-white truncate max-w-[130px]">
                                    {bill.name || `Bill #${index + 1}`}
                                  </span>
                                  <span className="text-slate-500 font-mono text-[10px]">
                                    {bill.uploadedAt ? new Date(bill.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {bill.extracted ? (
                                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                      <Check className="w-3 h-3" /> Form Pre-filled
                                    </span>
                                  ) : (
                                    <span>Ready for OCR extraction</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Card Actions */}
                            <div className="pt-2.5 mt-2.5 border-t border-slate-800/80 space-y-1.5">
                              <button
                                type="button"
                                disabled={isProcessingOcr}
                                onClick={() => processSingleBillOcr(bill)}
                                className={`w-full py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                  isProcessingThis
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                                    : 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-md shadow-amber-500/15'
                                }`}
                              >
                                {isProcessingThis ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Extracting...</span>
                                  </>
                                ) : (
                                  <>
                                    <Zap className="w-3.5 h-3.5" />
                                    <span>⚡ Process This Bill</span>
                                  </>
                                )}
                              </button>

                              <div className="flex items-center justify-between text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => handleToggleAttachToPrevious(bill.id)}
                                  className={`text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                                    bill.attachedToPrevious
                                      ? 'text-cyan-400'
                                      : 'text-slate-500 hover:text-slate-300'
                                  }`}
                                  title="Link as additional page of the previous bill"
                                >
                                  <Link2 className="w-3 h-3" />
                                  <span>{bill.attachedToPrevious ? 'Linked Page' : 'Attach as Page'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveBillFromQueue(bill.id)}
                                  className="text-slate-500 hover:text-rose-400 transition cursor-pointer flex items-center gap-1"
                                  title="Discard photo"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Discard</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Verified by Ensemble Engine Badge */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 font-medium text-[11px] shadow-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Verified by Ensemble Engine (Gemini + Groq Consensus)</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Dual Vision AI • Math Variance Zero • Disambiguation
                    </span>
                  </div>
                </div>
              </div>

              {/* Status or Error Notifications */}
              {isProcessingOcr && ocrStatusMessage && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                  <span className="font-semibold">{ocrStatusMessage}</span>
                </div>
              )}

              {ocrError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{ocrError}</span>
                </div>
              )}

              {/* ======================================================== */}
              {/* REQUIREMENT 3 & 4: INWARD BILL REVIEW & DETAILED GST EDITOR */}
              {/* ======================================================== */}
              <div id="inward-bill-review-section" className="space-y-4">
                {/* 1. Header Information Grid */}
                <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-xl space-y-3">
                  <div className="border-b border-slate-800 pb-2">
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      1. Supplier & Invoice Header Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs">
                    {/* Seller Name */}
                    <div className="col-span-2 md:col-span-2 lg:col-span-2">
                      <label className="block text-slate-300 font-semibold mb-1 truncate">
                        Seller / Agency Name *
                      </label>
                      <input
                        type="text"
                        value={sellerData.name}
                        onChange={(e) => setSellerData({ ...sellerData, name: e.target.value })}
                        placeholder="e.g. Bisleri Distributors Ltd"
                        className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg text-white font-medium focus:outline-none"
                      />
                    </div>

                    {/* GSTIN */}
                    <div className="col-span-1">
                      <label className="block text-slate-300 font-semibold mb-1 truncate">
                        GSTIN (15 Digits)
                      </label>
                      <input
                        type="text"
                        value={sellerData.gst}
                        onChange={(e) => setSellerData({ ...sellerData, gst: e.target.value.toUpperCase() })}
                        placeholder="07AAAAA0000A1Z5"
                        className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg text-white font-mono uppercase focus:outline-none"
                      />
                    </div>

                    {/* FSSAI */}
                    <div className="col-span-1">
                      <label className="block text-slate-300 font-semibold mb-1 truncate">
                        FSSAI Lic. No.
                      </label>
                      <input
                        type="text"
                        value={sellerData.fssai}
                        onChange={(e) => setSellerData({ ...sellerData, fssai: e.target.value })}
                        placeholder="14-digit FSSAI"
                        className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg text-white font-mono focus:outline-none"
                      />
                    </div>

                    {/* Invoice Number */}
                    <div className="col-span-1">
                      <label className="block text-slate-300 font-semibold mb-1 truncate">
                        Bill / Invoice No.
                      </label>
                      <input
                        type="text"
                        value={invoiceData.invoice_number}
                        onChange={(e) => setInvoiceData({ ...invoiceData, invoice_number: e.target.value })}
                        placeholder="INV-2026-001"
                        className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg text-white font-mono focus:outline-none"
                      />
                    </div>

                    {/* Invoice Date */}
                    <div className="col-span-1">
                      <label className="block text-slate-300 font-semibold mb-1 truncate">
                        Invoice Date
                      </label>
                      <input
                        type="date"
                        value={invoiceData.invoice_date}
                        onChange={(e) => setInvoiceData({ ...invoiceData, invoice_date: e.target.value })}
                        className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg text-white font-mono focus:outline-none"
                      />
                    </div>

                    {/* Contact */}
                    <div className="col-span-1">
                      <label className="block text-slate-300 font-semibold mb-1 truncate">
                        Vendor Contact
                      </label>
                      <input
                        type="text"
                        value={sellerData.contact}
                        onChange={(e) => setSellerData({ ...sellerData, contact: e.target.value })}
                        placeholder="+91 98XXXXXXXX"
                        className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg text-white focus:outline-none"
                      />
                    </div>

                    {/* Salesman Name */}
                    <div className="col-span-1">
                      <label className="block text-slate-300 font-semibold mb-1 truncate">
                        Salesman Name
                      </label>
                      <input
                        type="text"
                        value={sellerData.salesman_name}
                        onChange={(e) => setSellerData({ ...sellerData, salesman_name: e.target.value })}
                        placeholder="Salesman name"
                        className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg text-white focus:outline-none"
                      />
                    </div>

                    {/* Salesman Phone */}
                    <div className="col-span-1">
                      <label className="block text-slate-300 font-semibold mb-1 truncate">
                        Salesman Phone
                      </label>
                      <input
                        type="text"
                        value={sellerData.salesman_number}
                        onChange={(e) => setSellerData({ ...sellerData, salesman_number: e.target.value })}
                        placeholder="Salesman phone"
                        className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg text-white focus:outline-none"
                      />
                    </div>

                    {/* Godown Address */}
                    <div className="col-span-2 md:col-span-3 lg:col-span-3">
                      <label className="block text-slate-300 font-semibold mb-1 truncate">
                        Depot / Godown Address
                      </label>
                      <input
                        type="text"
                        value={sellerData.address}
                        onChange={(e) => setSellerData({ ...sellerData, address: e.target.value })}
                        placeholder="Full street address & pin code"
                        className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Detailed Inward Line Items Table with GST Columns */}
                <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-2.5">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Package className="w-4 h-4 text-emerald-400" />
                        <span>2. Itemized Inward Stock Lines & GST Breakup ({items.length})</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Universal Barcode assignment, HSN codes, Taxable amounts, CGST, SGST and CESS auto-calculations.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Line Item</span>
                    </button>
                  </div>

                  {/* Comprehensive Line Items Table */}
                  <div className="w-full overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/60 shadow-inner">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-900 border-b border-slate-800 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                          <th className="py-2.5 px-2.5 min-w-[150px]">Barcode / EAN</th>
                          <th className="py-2.5 px-2.5 min-w-[200px]">Item Name</th>
                          <th className="py-2.5 px-2 min-w-[75px]">HSN</th>
                          <th className="py-2.5 px-2 min-w-[65px] text-right">Qty</th>
                          <th className="py-2.5 px-2 min-w-[75px]">Unit</th>
                          <th className="py-2.5 px-2 min-w-[75px] text-right">MRP (₹)</th>
                          <th className="py-2.5 px-2 min-w-[80px] text-right">Rate (₹)</th>
                          <th className="py-2.5 px-2 min-w-[90px] text-right">Taxable (₹)</th>
                          <th className="py-2.5 px-2 min-w-[75px] text-right">GST %</th>
                          <th className="py-2.5 px-2 min-w-[80px] text-right">CGST (₹)</th>
                          <th className="py-2.5 px-2 min-w-[80px] text-right">SGST (₹)</th>
                          <th className="py-2.5 px-2 min-w-[75px] text-right">CESS (₹)</th>
                          <th className="py-2.5 px-2 min-w-[110px] text-right">Cost/Unit (Tax Incl.)</th>
                          <th className="py-2.5 px-2 min-w-[95px] text-right">Total (₹)</th>
                          <th className="py-2.5 px-2 min-w-[45px] text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {(items || []).map((it, idx) => {
                          const hasBarcode = Boolean(it.barcode);

                          return (
                            <tr
                              key={it.id || idx}
                              className={`transition-colors ${
                                hasBarcode
                                  ? 'bg-emerald-950/15 hover:bg-emerald-950/25'
                                  : 'hover:bg-slate-900/60'
                              }`}
                            >
                              {/* Universal Barcode Field + Scanner Button */}
                              <td className="py-2 px-2.5 min-w-[150px]">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={it.barcode || ''}
                                    onChange={(e) => handleItemFieldChange(idx, 'barcode', e.target.value)}
                                    placeholder="Scan or type barcode"
                                    className={`w-full min-w-0 h-8 px-2 rounded-lg font-mono text-xs focus:outline-none ${
                                      hasBarcode
                                        ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-300'
                                        : 'bg-slate-900 border border-slate-800 text-white focus:border-amber-500'
                                    }`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleOpenScanner(idx)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer shrink-0"
                                    title="Scan barcode with Camera or Gun"
                                  >
                                    <Scan className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>

                              {/* Item Name */}
                              <td className="py-2 px-2.5 min-w-[200px]">
                                <input
                                  type="text"
                                  value={it.item_name}
                                  onChange={(e) => handleItemFieldChange(idx, 'item_name', e.target.value)}
                                  placeholder="Product Description"
                                  className="w-full h-8 px-2.5 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white font-medium text-xs focus:outline-none"
                                />
                              </td>

                              {/* HSN */}
                              <td className="py-2 px-2 min-w-[75px]">
                                <input
                                  type="text"
                                  value={it.hsn_code}
                                  onChange={(e) => handleItemFieldChange(idx, 'hsn_code', e.target.value)}
                                  placeholder="HSN"
                                  className="w-full h-8 px-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white font-mono text-xs focus:outline-none"
                                />
                              </td>

                              {/* Qty */}
                              <td className="py-2 px-2 min-w-[65px]">
                                <input
                                  type="number"
                                  min="1"
                                  value={it.quantity}
                                  onChange={(e) => handleItemFieldChange(idx, 'quantity', e.target.value)}
                                  className="w-full h-8 px-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white text-right font-mono text-xs focus:outline-none"
                                />
                              </td>

                              {/* Unit */}
                              <td className="py-2 px-2 min-w-[75px]">
                                <select
                                  value={it.unit || 'PCS'}
                                  onChange={(e) => handleItemFieldChange(idx, 'unit', e.target.value)}
                                  className="w-full h-8 px-1.5 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white font-semibold text-xs focus:outline-none cursor-pointer"
                                >
                                  {PURCHASE_UNITS.map((u) => (
                                    <option key={u} value={u}>
                                      {u}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* MRP */}
                              <td className="py-2 px-2 min-w-[75px]">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.mrp}
                                  onChange={(e) => handleItemFieldChange(idx, 'mrp', e.target.value)}
                                  className="w-full h-8 px-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white text-right font-mono text-xs focus:outline-none"
                                />
                              </td>

                              {/* Rate */}
                              <td className="py-2 px-2 min-w-[80px]">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.rate ?? it.price_before_gst}
                                  onChange={(e) => handleItemFieldChange(idx, 'rate', e.target.value)}
                                  className="w-full h-8 px-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white text-right font-mono text-xs focus:outline-none"
                                />
                              </td>

                              {/* Taxable Amount */}
                              <td className="py-2 px-2 min-w-[90px]">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.taxable_amount}
                                  onChange={(e) => handleItemFieldChange(idx, 'taxable_amount', e.target.value)}
                                  className="w-full h-8 px-2 bg-slate-900/80 border border-slate-800 focus:border-emerald-500 rounded-lg text-slate-200 text-right font-mono text-xs focus:outline-none"
                                />
                              </td>

                              {/* GST % */}
                              <td className="py-2 px-2 min-w-[75px]">
                                <select
                                  value={it.gst_pct ?? it.gst_rate ?? 18}
                                  onChange={(e) => handleItemFieldChange(idx, 'gst_pct', e.target.value)}
                                  className="w-full h-8 px-1.5 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white text-xs focus:outline-none cursor-pointer"
                                >
                                  <option value="0">0%</option>
                                  <option value="5">5%</option>
                                  <option value="12">12%</option>
                                  <option value="18">18%</option>
                                  <option value="28">28%</option>
                                </select>
                              </td>

                              {/* CGST */}
                              <td className="py-2 px-2 min-w-[80px] text-right font-mono text-slate-400">
                                ₹{Number(it.cgst_amount || 0).toFixed(2)}
                              </td>

                              {/* SGST */}
                              <td className="py-2 px-2 min-w-[80px] text-right font-mono text-slate-400">
                                ₹{Number(it.sgst_amount || 0).toFixed(2)}
                              </td>

                              {/* CESS */}
                              <td className="py-2 px-2 min-w-[75px]">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.cess_amount || it.cess || 0}
                                  onChange={(e) => handleItemFieldChange(idx, 'cess_amount', e.target.value)}
                                  className="w-full h-8 px-2 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white text-right font-mono text-xs focus:outline-none"
                                />
                              </td>

                              {/* Effective Landed Cost / Unit (After Tax) */}
                              <td className="py-2 px-2 min-w-[110px] text-right font-mono">
                                {(() => {
                                  const rowQty = Number(it.quantity) || 1;
                                  const rowTotal = Number(it.total_amount ?? it.price_after_gst ?? 0);
                                  const effectiveCost = rowQty > 0 ? (rowTotal / rowQty) : rowTotal;
                                  return (
                                    <span
                                      className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] shadow-sm"
                                      title="Effective Landed Cost per unit including all taxes & cess"
                                    >
                                      ₹{effectiveCost.toFixed(2)}
                                    </span>
                                  );
                                })()}
                              </td>

                              {/* Total */}
                              <td className="py-2 px-2 min-w-[95px] text-right font-mono font-bold text-emerald-400">
                                ₹{Number(it.total_amount ?? it.price_after_gst ?? 0).toFixed(2)}
                              </td>

                              {/* Action */}
                              <td className="py-2 px-2 min-w-[45px] text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemRow(idx)}
                                  className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition cursor-pointer"
                                  title="Delete Row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                        {items.length === 0 && (
                          <tr>
                            <td colSpan="15" className="py-8 text-center text-slate-500">
                              No line items entered yet. Click "Add Line Item" or click "⚡ Process This Bill" from the queue above.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Bar & Commit Button */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-800 bg-slate-950/60 p-3 rounded-xl">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                        <span className="text-slate-400">Taxable: </span>
                        <span className="font-mono font-bold text-white">₹{totalTaxable.toFixed(2)}</span>
                      </div>
                      <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                        <span className="text-slate-400">CGST: </span>
                        <span className="font-mono font-bold text-amber-400">₹{totalCgst.toFixed(2)}</span>
                      </div>
                      <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                        <span className="text-slate-400">SGST: </span>
                        <span className="font-mono font-bold text-amber-400">₹{totalSgst.toFixed(2)}</span>
                      </div>
                      {totalCess > 0 && (
                        <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                          <span className="text-slate-400">CESS: </span>
                          <span className="font-mono font-bold text-cyan-400">₹{totalCess.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                        <span className="text-slate-400">Round Off: </span>
                        <span className={`font-mono font-bold ${roundOff === 0 ? 'text-slate-400' : roundOff > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                        </span>
                      </div>
                      <div className="px-3.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                        <span className="font-semibold text-emerald-400">Grand Total: </span>
                        <span className="font-mono font-black text-emerald-300 text-sm">₹{grandTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isSaving || items.length === 0}
                      onClick={handleSavePurchaseEntry}
                      className="h-10 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm tracking-wide transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isSaving ? (
                        <span>Committing & Syncing Stock...</span>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save & Commit Purchase Entry</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </ErrorBoundary>
          )}

          {/* ======================================================== */}
          {/* WORKSPACE TAB 2: INVOICES LEDGER (HISTORY & SIDE-BY-SIDE ARCHIVE) */}
          {/* ======================================================== */}
          {activeTab === 'history' && (
            <ErrorBoundary title="Purchase Inward Invoices Ledger">
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-xl space-y-4 max-w-[1400px]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-black text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                    <span>Purchase Inward Invoices Ledger & Archival</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Permanent bill archive with side-by-side original bill preview and universal barcode assignment.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search vendor, bill#, GST..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={loadHistory}
                    disabled={historyLoading}
                    className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                    title="Refresh Ledger"
                  >
                    <RefreshCw className={`w-4 h-4 text-amber-400 ${historyLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Vendor Filter Alert */}
              {vendorLedgerFilter && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between gap-2">
                  <span>Filtered by: <strong>{vendorLedgerFilter.vendor_name}</strong></span>
                  <button
                    type="button"
                    onClick={() => setVendorLedgerFilter(null)}
                    className="text-amber-400 hover:underline font-bold"
                  >
                    Clear Filter
                  </button>
                </div>
              )}

              {/* History Invoices List */}
              {(!filteredHistory || filteredHistory.length === 0) ? (
                <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                  <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-600" />
                  <p>No purchase invoices recorded yet.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('new')}
                    className="text-amber-400 hover:underline font-bold"
                  >
                    + Create your first purchase entry
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {(filteredHistory || []).map((inv) => {
                    const lineItems = inv.purchase_items || inv.items || [];
                    const hasUnbarcoded = lineItems.some((it) => !it.barcode);
                    const billImage = inv.bill_image_urls?.[0] || inv.bill_image_url;

                    return (
                      <div
                        key={inv.id}
                        className="rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition overflow-hidden p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-white text-sm">
                              {inv.seller_name || 'Vendor'}
                            </h4>
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {inv.invoice_number || 'No Bill#'}
                            </span>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{inv.invoice_date || 'Today'}</span>
                            </span>
                            {hasUnbarcoded && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                ⚠️ Missing Barcodes
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                            {inv.seller_gst && (
                              <span>GST: <strong className="text-slate-300">{inv.seller_gst}</strong></span>
                            )}
                            {inv.seller_contact && (
                              <span>Ph: <strong className="text-slate-300">{inv.seller_contact}</strong></span>
                            )}
                            <span>Items: <strong className="text-emerald-400">{lineItems.length} lines</strong></span>
                            {billImage && (
                              <span className="text-cyan-400 flex items-center gap-1 font-semibold">
                                <FileText className="w-3 h-3" /> Bill Archived
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                          <div className="text-right">
                            <div className="text-[10px] uppercase text-slate-400">Grand Total</div>
                            <div className="font-mono font-black text-emerald-400 text-base">
                              ₹{Number(inv.grand_total || 0).toFixed(2)}
                            </div>
                          </div>

                          {/* Inspect Side-by-Side Drawer Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLedgerInvoice(inv);
                              setLedgerDocZoom(1);
                              setAssigningBarcodeRowId(null);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                            <span>View Bill & Ledger</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteInvoice(inv.id)}
                            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                            title="Delete Entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            </ErrorBoundary>
          )}

          {/* ======================================================== */}
          {/* WORKSPACE TAB 3: ITEMS & STOCK MASTER */}
          {/* ======================================================== */}
          {activeTab === 'items' && (
            <div className="max-w-[1400px]">
              <ErrorBoundary title="Item & Stock Master">
                {typeof ItemsInventoryHub === 'function' ? (
                  <ItemsInventoryHub
                    onBackToHub={() => setActiveTab('new')}
                    showToast={showToast}
                  />
                ) : (
                  <div className="p-8 text-center text-slate-400">Items & Stock Master module loading...</div>
                )}
              </ErrorBoundary>
            </div>
          )}

          {/* ======================================================== */}
          {/* WORKSPACE TAB 4: VENDORS DIRECTORY */}
          {/* ======================================================== */}
          {activeTab === 'vendors' && (
            <div className="max-w-[1400px]">
              <ErrorBoundary title="Vendors Directory">
                {typeof VendorsDirectory === 'function' ? (
                  <VendorsDirectory
                    vendors={vendorsList || vendors || []}
                    invoicesHistory={invoicesHistory || []}
                    onSelectVendorInvoices={(v) => {
                      setVendorLedgerFilter(v);
                      setActiveTab('history');
                    }}
                    onRefresh={loadVendors}
                    loading={vendorsLoading}
                    onDeleteVendor={handleDeleteVendor}
                  />
                ) : (
                  <div className="p-8 text-center text-slate-400">Vendors Directory loading...</div>
                )}
              </ErrorBoundary>
            </div>
          )}

          {/* ======================================================== */}
          {/* WORKSPACE TAB 5: SALE RETURN / DEBIT NOTE */}
          {/* ======================================================== */}
          {activeTab === 'debit_notes' && (
            <div className="max-w-[1400px]">
              <ErrorBoundary title="Sale Return & Debit Notes">
                {typeof DebitNoteManager === 'function' ? (
                  <DebitNoteManager showToast={showToast} />
                ) : (
                  <div className="p-8 text-center text-slate-400">Debit Note module loading...</div>
                )}
              </ErrorBoundary>
            </div>
          )}
        </main>
      </div>

      {/* ======================================================== */}
      {/* REQUIREMENT 1 & 4: SIDE-BY-SIDE BILL & LEDGER MODAL DRAWER */}
      {/* ======================================================== */}
      {selectedLedgerInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-[95vw] h-[92vh] rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-3 sm:p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                    <span>{selectedLedgerInvoice.seller_name || 'Vendor Invoice'}</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {selectedLedgerInvoice.invoice_number || 'INV'}
                    </span>
                  </h3>
                  <div className="text-[11px] text-slate-400 flex items-center gap-3">
                    <span>Date: <strong>{selectedLedgerInvoice.invoice_date || 'N/A'}</strong></span>
                    {selectedLedgerInvoice.seller_gst && (
                      <span>GST: <strong>{selectedLedgerInvoice.seller_gst}</strong></span>
                    )}
                    <span>Grand Total: <strong className="text-emerald-400 font-mono">₹{Number(selectedLedgerInvoice.grand_total || 0).toFixed(2)}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLedgerInvoice(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Split Body: Side-by-side */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
              {/* Left Pane: Original Bill Document Viewer */}
              <div className="w-full lg:w-1/2 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950 flex flex-col shrink-0 overflow-hidden">
                <div className="p-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Archived Bill Document</span>
                  </span>

                  {/* Zoom Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setLedgerDocZoom((z) => Math.max(0.5, z - 0.25))}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-[10px] text-slate-400 px-1">
                      {Math.round(ledgerDocZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setLedgerDocZoom((z) => Math.min(3, z + 0.25))}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    {(selectedLedgerInvoice.bill_image_urls?.[0] || selectedLedgerInvoice.bill_image_url) && (
                      <a
                        href={selectedLedgerInvoice.bill_image_urls?.[0] || selectedLedgerInvoice.bill_image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 ml-1.5"
                        title="Open Full Image"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Document Display Area */}
                <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
                  {(selectedLedgerInvoice.bill_image_urls?.[0] || selectedLedgerInvoice.bill_image_url) ? (
                    <img
                      src={selectedLedgerInvoice.bill_image_urls?.[0] || selectedLedgerInvoice.bill_image_url}
                      alt="Archived Bill"
                      style={{ transform: `scale(${ledgerDocZoom})`, transformOrigin: 'top center' }}
                      className="max-w-full rounded-lg shadow-lg border border-slate-800 transition-transform duration-200"
                    />
                  ) : (
                    <div className="text-center text-slate-500 text-xs space-y-2">
                      <ImageIcon className="w-12 h-12 mx-auto text-slate-700" />
                      <p>No original document scan was stored for this legacy invoice.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Pane: Itemized Ledger Lines & Detailed GST */}
              <div className="flex-1 flex flex-col bg-slate-900/60 overflow-hidden">
                <div className="p-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Itemized Ledger Lines & Barcodes</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Click "No Barcode" to assign universal SKU code
                  </span>
                </div>

                <div className="flex-1 overflow-auto p-3">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                        <th className="py-2 px-2.5">#</th>
                        <th className="py-2 px-2.5">Barcode / EAN</th>
                        <th className="py-2 px-2.5 min-w-[140px]">Item Description</th>
                        <th className="py-2 px-2">HSN</th>
                        <th className="py-2 px-2 text-right">Qty</th>
                        <th className="py-2 px-2 text-right">Rate</th>
                        <th className="py-2 px-2 text-right">GST %</th>
                        <th className="py-2 px-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-slate-200">
                      {(selectedLedgerInvoice.purchase_items || selectedLedgerInvoice.items || []).map((item, idx) => {
                        const hasBarcode = Boolean(item.barcode);
                        const isEditingBarcode = assigningBarcodeRowId === item.id;

                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-800/40">
                            <td className="py-2 px-2.5 text-slate-500">{idx + 1}</td>

                            {/* Barcode Column & Quick Assignment */}
                            <td className="py-2 px-2.5">
                              {hasBarcode ? (
                                <span className="font-mono text-[11px] font-bold text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25">
                                  {item.barcode}
                                </span>
                              ) : isEditingBarcode ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    autoFocus
                                    value={newBarcodeInput}
                                    onChange={(e) => setNewBarcodeInput(e.target.value)}
                                    placeholder="Enter or scan barcode"
                                    className="w-32 h-7 px-2 bg-slate-950 border border-amber-500 rounded text-xs font-mono text-white focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    disabled={isAssigningBarcode}
                                    onClick={() => handleAssignBarcodeToLedgerItem(item)}
                                    className="px-2 py-1 bg-amber-500 text-slate-950 font-bold rounded text-[10px] hover:bg-amber-400 transition"
                                  >
                                    Assign
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAssigningBarcodeRowId(null)}
                                    className="p-1 text-slate-400 hover:text-white"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssigningBarcodeRowId(item.id);
                                    setNewBarcodeInput('');
                                  }}
                                  className="px-2 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>⚠️ No Barcode - Click to Assign</span>
                                </button>
                              )}
                            </td>

                            <td className="py-2 px-2.5 font-bold text-white max-w-xs truncate" title={item.item_name}>
                              {item.item_name}
                            </td>

                            <td className="py-2 px-2 font-mono text-slate-400 text-[11px]">
                              {item.hsn_code || '—'}
                            </td>

                            <td className="py-2 px-2 text-right font-bold text-emerald-400">
                              {item.quantity} {item.unit ? <span className="text-[10px] text-slate-400 font-normal">{item.unit}</span> : ''}
                            </td>

                            <td className="py-2 px-2 text-right font-mono text-slate-300">
                              ₹{Number(item.purchase_price ?? item.rate ?? 0).toFixed(2)}
                            </td>

                            <td className="py-2 px-2 text-right font-mono text-slate-400">
                              {item.gst_pct ?? item.gst_rate ?? 0}%
                            </td>

                            <td className="py-2 px-2 text-right font-mono font-bold text-emerald-400">
                              ₹{Number(item.total_amount ?? item.price_after_gst ?? (Number(item.purchase_price || 0) * Number(item.quantity || 1))).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer Tax Summary */}
                <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs flex-wrap gap-2">
                  <span className="text-slate-400">
                    Total Taxable: <strong className="text-white">₹{Number(selectedLedgerInvoice.total_taxable_amount || 0).toFixed(2)}</strong>
                  </span>
                  <span className="text-slate-400">
                    Total Tax: <strong className="text-amber-400">₹{Number(selectedLedgerInvoice.total_tax_amount || 0).toFixed(2)}</strong>
                  </span>
                  {Boolean(selectedLedgerInvoice.round_off_amount ?? selectedLedgerInvoice.round_off) && (
                    <span className="text-slate-400">
                      Round Off: <strong className="font-mono text-slate-300">
                        {Number(selectedLedgerInvoice.round_off_amount ?? selectedLedgerInvoice.round_off) >= 0 ? '+' : ''}
                        ₹{Number(selectedLedgerInvoice.round_off_amount ?? selectedLedgerInvoice.round_off ?? 0).toFixed(2)}
                      </strong>
                    </span>
                  )}
                  <span className="text-emerald-400 font-bold">
                    Grand Total: <strong className="font-mono text-sm">₹{Number(selectedLedgerInvoice.grand_total || 0).toFixed(2)}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal for Bill Queue */}
      {zoomedQueueImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-w-4xl max-h-[90vh] rounded-3xl bg-slate-900 border border-slate-800 p-2 shadow-2xl flex flex-col items-center">
            <button
              type="button"
              onClick={() => setZoomedQueueImage(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-950/80 text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomedQueueImage}
              alt="Zoomed Bill"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain"
            />
          </div>
        </div>
      )}

      {/* Mobile QR Code Pairing Scanner Modal */}
      {isMobileScannerOpen && typeof MobileScannerModal === 'function' && (
        <MobileScannerModal
          isOpen={isMobileScannerOpen}
          onClose={() => setIsMobileScannerOpen(false)}
          onBillSnapped={handleIncomingBill}
        />
      )}

      {/* Barcode Camera Scanner Modal */}
      {isBarcodeModalOpen && typeof BarcodeScannerModal === 'function' && (
        <BarcodeScannerModal
          isOpen={isBarcodeModalOpen}
          onClose={() => setIsBarcodeModalOpen(false)}
          onScan={handleBarcodeAssigned}
        />
      )}
    </div>
  </ErrorBoundary>
  );
}
