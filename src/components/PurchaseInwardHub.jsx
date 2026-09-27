import React, { useState, useEffect, useRef } from 'react';
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
  Link2,
  Smartphone,
  Image as ImageIcon
} from 'lucide-react';
import BarcodeScannerModal from './BarcodeScannerModal';
import MobileScannerModal from './MobileScannerModal';
import VendorsDirectory from './purchase/VendorsDirectory';
import { renderPdfFirstPageToImage } from '../lib/pdfToImage';
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
  supabase,
  isSupabaseConfigured
} from '../lib/supabase';

export default function PurchaseInwardHub({
  onBackToHub,
  showToast = () => {}
}) {
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history' | 'vendors'
  const [invoicesHistory, setInvoicesHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);

  // Bill Queue & Upload State (Individual Bill Queue)
  const [billQueue, setBillQueue] = useState([]);
  const [activeProcessingBillId, setActiveProcessingBillId] = useState(null);
  const [currentQueueBillId, setCurrentQueueBillId] = useState(null);
  const [isMobileScannerOpen, setIsMobileScannerOpen] = useState(false);
  const [zoomedQueueImage, setZoomedQueueImage] = useState(null);
  const [ocrStatusMessage, setOcrStatusMessage] = useState('');

  // Active / Selected Bill Form State
  const [selectedFile, setSelectedFile] = useState(null);
  const [billPreviewUrl, setBillPreviewUrl] = useState(null);
  const [billBase64, setBillBase64] = useState(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Vendors State
  const [vendorsList, setVendorsList] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorLedgerFilter, setVendorLedgerFilter] = useState(null);

  // Barcode Scanner Modal State
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [activeScanningItemIndex, setActiveScanningItemIndex] = useState(null);

  // Editable Form State
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
      setInvoicesHistory(data || []);
    } catch (err) {
      console.error('Failed to load purchase history:', err);
      setHistoryError(err.message || 'Failed to fetch purchase invoices from database');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load vendors list
  const loadVendors = async () => {
    setVendorsLoading(true);
    try {
      const data = await fetchPurchaseVendors();
      setVendorsList(data || []);
    } catch (err) {
      console.warn('Failed to load vendors:', err);
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

      // Note 1: E5 (659.25 Hz)
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

      // Note 2: E6 (1318.51 Hz) sparkle
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
    if (billPreviewUrl === billQueue.find((b) => b.id === billId)?.dataUrl || billPreviewUrl === billQueue.find((b) => b.id === billId)?.image_url) {
      resetUploadState();
    }
    showToast('Bill removed from queue', 'info');
  };

  // Load persistent purchase bill queue on page load
  const loadBillQueue = async () => {
    try {
      const pendingBills = await fetchPurchaseBillQueue();
      if (Array.isArray(pendingBills) && pendingBills.length > 0) {
        setBillQueue((prev) => {
          const existingIds = new Set(prev.map((b) => b.id));
          const existingUrls = new Set(prev.map((b) => b.image_url || b.dataUrl));
          const formatted = pendingBills.map((b, idx) => ({
            id: b.id,
            name: `Mobile Snap #${pendingBills.length - idx}`,
            image_url: b.image_url,
            dataUrl: b.image_url,
            uploadedAt: b.created_at || new Date().toISOString(),
            created_at: b.created_at || new Date().toISOString(),
            status: b.status || 'pending_ocr',
            attachedToPrevious: false
          }));
          const newItems = formatted.filter(
            (b) => !existingIds.has(b.id) && !existingUrls.has(b.image_url)
          );
          return [...prev, ...newItems];
        });
      }
    } catch (err) {
      console.warn('Failed to load purchase bill queue:', err);
    }
  };

  useEffect(() => {
    loadHistory();
    loadVendors();
    loadBillQueue();

    // Supabase Realtime subscription on purchase_bill_queue
    if (isSupabaseConfigured && supabase) {
      const queueChannel = supabase
        .channel('realtime_purchase_bill_queue_hub')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'purchase_bill_queue' },
          (payload) => {
            if (payload.new && payload.new.status === 'pending_ocr') {
              handleIncomingBill(payload.new);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(queueChannel);
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

    e.target.value = '';
    showToast(`Added ${files.length} document${files.length > 1 ? 's' : ''} to Uploaded Bills Queue`, 'info');
  };

  // Process an individual bill card via Groq Vision OCR
  const handleProcessIndividualBill = async (billItem) => {
    setActiveProcessingBillId(billItem.id);
    setCurrentQueueBillId(billItem.id);
    setIsProcessingOcr(true);
    setOcrError('');
    setOcrStatusMessage('Extracting invoice line items and vendor details...');

    const imgUrl = billItem.image_url || billItem.dataUrl;
    setSelectedFile({
      name: billItem.name || 'Mobile Snapped Bill',
      size: billItem.size || (billItem.base64 ? Math.round(billItem.base64.length * 0.75) : 0),
      type: billItem.mimeType || 'image/jpeg'
    });
    setBillPreviewUrl(imgUrl);

    // Convert to base64 if not already available
    let base64ToSend = billItem.base64 || null;
    let mimeTypeToSend = billItem.mimeType || 'image/jpeg';

    if (!base64ToSend && imgUrl) {
      if (imgUrl.startsWith('data:')) {
        base64ToSend = imgUrl.replace(/^data:image\/[a-z]+;base64,/, '');
      } else if (imgUrl.startsWith('http')) {
        try {
          const res = await fetch(imgUrl);
          const blob = await res.blob();
          mimeTypeToSend = blob.type || 'image/jpeg';
          base64ToSend = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const d = e.target.result;
              resolve(typeof d === 'string' ? d.replace(/^data:image\/[a-z]+;base64,/, '') : null);
            };
            reader.readAsDataURL(blob);
          });
        } catch (fetchErr) {
          console.warn('Notice: Could not pre-convert image URL to base64, passing URL directly:', fetchErr.message);
        }
      }
    }

    if (base64ToSend) {
      setBillBase64(base64ToSend);
    }

    try {
      const response = await fetch('/api/purchase-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imgUrl,
          imageBase64: base64ToSend,
          mimeType: mimeTypeToSend
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server OCR Error (${response.status})`);
      }

      const parsed = await response.json();
      setRawOcrData(parsed);

      // Automated Vendor Profile Sync on OCR Extraction (Requirement 2)
      if (parsed.seller && parsed.seller.name) {
        const grandTotal = Number(parsed.totals?.grand_total) || 0;
        try {
          await syncPurchaseVendorFromOcr(
            {
              name: parsed.seller.name,
              gstin: parsed.seller.gst,
              phone: parsed.seller.contact,
              address: parsed.seller.address,
              bill_date: parsed.invoice?.invoice_date || new Date().toISOString().split('T')[0]
            },
            grandTotal
          );
          loadVendors();
        } catch (vErr) {
          console.warn('Vendor profile sync notice:', vErr);
        }
      }

      // Populate Editable Fields
      if (parsed.seller) {
        setSellerData({
          name: parsed.seller.name || '',
          gst: parsed.seller.gst || '',
          fssai: parsed.seller.fssai || '',
          contact: parsed.seller.contact || '',
          address: parsed.seller.address || '',
          salesman_name: parsed.seller.salesman_name || '',
          salesman_number: parsed.seller.salesman_number || ''
        });
      }

      if (parsed.invoice) {
        setInvoiceData({
          invoice_number: parsed.invoice.invoice_number || `INV-${Date.now().toString().slice(-6)}`,
          invoice_date: parsed.invoice.invoice_date || new Date().toISOString().split('T')[0]
        });
      }

      if (parsed.bank_details) {
        setBankDetails({
          bank_name: parsed.bank_details.bank_name || '',
          account_no: parsed.bank_details.account_no || '',
          ifsc: parsed.bank_details.ifsc || ''
        });
      }

      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        setItems(
          parsed.items.map((it, idx) => ({
            id: `temp_${Date.now()}_${idx}`,
            barcode: it.barcode || '',
            item_name: it.item_name || `Item ${idx + 1}`,
            hsn_code: it.hsn_code || '',
            quantity: Number(it.quantity) || 1,
            mrp: Number(it.mrp) || 0,
            purchase_price: Number(it.purchase_price) || Number(it.price_before_gst) || 0,
            price_before_gst: Number(it.price_before_gst) || Number(it.purchase_price) || 0,
            gst_rate: Number(it.gst_rate) || 18,
            cess: Number(it.cess) || 0,
            discount: Number(it.discount) || 0,
            price_after_gst: Number(it.price_after_gst) || 0
          }))
        );
      } else {
        setItems([
          {
            id: `temp_${Date.now()}`,
            barcode: '',
            item_name: 'New Product Item',
            hsn_code: '2201',
            quantity: 1,
            mrp: 100,
            purchase_price: 70,
            price_before_gst: 70,
            gst_rate: 18,
            cess: 0,
            discount: 0,
            price_after_gst: 82.60
          }
        ]);
      }

      // Mark this bill item as active in queue
      setBillQueue((prev) =>
        prev.map((b) => (b.id === billItem.id ? { ...b, extracted: true } : b))
      );

      showToast(`⚡ Bill "${billItem.name || 'Mobile Snap'}" extracted successfully via Groq Vision!`, 'success');

      // Scroll to review editor
      setTimeout(() => {
        const reviewEl = document.getElementById('inward-bill-review-section');
        if (reviewEl) reviewEl.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (err) {
      console.error('Groq Vision OCR failure:', err);
      setOcrError(err.message || 'Failed to extract text from bill. You can still input details manually.');
    } finally {
      setIsProcessingOcr(false);
      setActiveProcessingBillId(null);
      setOcrStatusMessage('');
    }
  };

  // Call Groq Vision OCR endpoint
  const processWithGroqVision = async (base64, mimeType) => {
    setIsProcessingOcr(true);
    setOcrError('');

    try {
      const response = await fetch('/api/purchase-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: mimeType || 'image/jpeg'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server OCR Error (${response.status})`);
      }

      const parsed = await response.json();
      setRawOcrData(parsed);

      // Populate Editable Fields
      if (parsed.seller) {
        setSellerData({
          name: parsed.seller.name || '',
          gst: parsed.seller.gst || '',
          fssai: parsed.seller.fssai || '',
          contact: parsed.seller.contact || '',
          address: parsed.seller.address || '',
          salesman_name: parsed.seller.salesman_name || '',
          salesman_number: parsed.seller.salesman_number || ''
        });
      }

      if (parsed.invoice) {
        setInvoiceData({
          invoice_number: parsed.invoice.invoice_number || `INV-${Date.now().toString().slice(-6)}`,
          invoice_date: parsed.invoice.invoice_date || new Date().toISOString().split('T')[0]
        });
      }

      if (parsed.bank_details) {
        setBankDetails({
          bank_name: parsed.bank_details.bank_name || '',
          account_no: parsed.bank_details.account_no || '',
          ifsc: parsed.bank_details.ifsc || ''
        });
      }

      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        setItems(
          parsed.items.map((it, idx) => ({
            id: `temp_${Date.now()}_${idx}`,
            barcode: it.barcode || '',
            item_name: it.item_name || `Item ${idx + 1}`,
            hsn_code: it.hsn_code || '',
            quantity: Number(it.quantity) || 1,
            mrp: Number(it.mrp) || 0,
            purchase_price: Number(it.purchase_price) || Number(it.price_before_gst) || 0,
            price_before_gst: Number(it.price_before_gst) || Number(it.purchase_price) || 0,
            gst_rate: Number(it.gst_rate) || 18,
            cess: Number(it.cess) || 0,
            discount: Number(it.discount) || 0,
            price_after_gst: Number(it.price_after_gst) || 0
          }))
        );
      } else {
        // Fallback default row
        setItems([
          {
            id: `temp_${Date.now()}`,
            barcode: '',
            item_name: 'New Product Item',
            hsn_code: '2201',
            quantity: 1,
            mrp: 100,
            purchase_price: 70,
            price_before_gst: 70,
            gst_rate: 18,
            cess: 0,
            discount: 0,
            price_after_gst: 82.60
          }
        ]);
      }

      showToast('Bill extracted successfully via Groq Vision!', 'success');
    } catch (err) {
      console.error('Groq Vision OCR failure:', err);
      setOcrError(err.message || 'Failed to extract text from bill. You can still input details manually.');
    } finally {
      setIsProcessingOcr(false);
    }
  };

  // Recalculate row totals
  const handleItemFieldChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: value };

      // Auto-recalculate final price if price_before_gst, gst_rate, or discount changes
      const priceBeforeGst = Number(target.price_before_gst) || 0;
      const gstRate = Number(target.gst_rate) || 0;
      const disc = Number(target.discount) || 0;
      const cess = Number(target.cess) || 0;

      const discountedPrice = Math.max(0, priceBeforeGst - disc);
      const taxAmount = (discountedPrice * gstRate) / 100;
      const finalCost = discountedPrice + taxAmount + cess;

      target.price_after_gst = Number(finalCost.toFixed(2));
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
        quantity: 1,
        mrp: 0,
        purchase_price: 0,
        price_before_gst: 0,
        gst_rate: 18,
        cess: 0,
        discount: 0,
        price_after_gst: 0
      }
    ]);
  };

  // Remove Item Row
  const handleRemoveItemRow = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Open Barcode Scanner for Row
  const handleOpenScanner = (index) => {
    setActiveScanningItemIndex(index);
    setIsBarcodeModalOpen(true);
  };

  // Barcode Assigned from Modal
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

  // Calculations for Totals Card
  const totalTaxable = items.reduce((sum, it) => {
    const qty = Number(it.quantity) || 1;
    const preTax = Number(it.price_before_gst) || 0;
    const disc = Number(it.discount) || 0;
    return sum + (preTax - disc) * qty;
  }, 0);

  const totalTax = items.reduce((sum, it) => {
    const qty = Number(it.quantity) || 1;
    const preTax = Math.max(0, (Number(it.price_before_gst) || 0) - (Number(it.discount) || 0));
    const gstRate = Number(it.gst_rate) || 0;
    return sum + (preTax * (gstRate / 100)) * qty;
  }, 0);

  const grandTotal = totalTaxable + totalTax;

  // Save Purchase Entry to Supabase & LocalStorage
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

      const invoicePayload = {
        invoice_number: invoiceData.invoice_number || `INV-${Date.now()}`,
        invoice_date: invoiceData.invoice_date || new Date().toISOString().split('T')[0],
        seller_name: sellerData.name.trim(),
        seller_gst: sellerData.gst.trim(),
        seller_fssai: sellerData.fssai.trim(),
        seller_contact: sellerData.contact.trim(),
        seller_address: sellerData.address.trim(),
        salesman_name: sellerData.salesman_name.trim(),
        salesman_number: sellerData.salesman_number.trim(),
        bank_name: bankDetails.bank_name.trim() || null,
        bank_account_no: bankAccountNo || null,
        bank_ifsc: bankIfsc || null,
        account_no: bankAccountNo || null,
        ifsc: bankIfsc || null,
        total_taxable_amount: Number(totalTaxable.toFixed(2)),
        total_tax_amount: Number(totalTax.toFixed(2)),
        grand_total: Number(grandTotal.toFixed(2)),
        bill_image_url: billPreviewUrl || '',
        status: 'verified'
      };

      if (rawOcrData && typeof rawOcrData === 'object' && Object.keys(rawOcrData).length > 0) {
        invoicePayload.raw_ocr_data = rawOcrData;
      }

      // Write to purchase_invoices first, obtain generated invoice id, and insert line items into purchase_items with purchase_invoice_id: id
      const saved = await savePurchaseInvoice(invoicePayload, items);

      // Auto-sync vendor profile upon saving purchase entry (Requirement 2)
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

      showToast('🎉 Purchase invoice & inward stock committed successfully!', 'success');

      // Once saved and committed, update the bill's status in purchase_bill_queue to 'processed'
      if (currentQueueBillId) {
        try {
          await updatePurchaseBillStatus(currentQueueBillId, 'processed');
          setBillQueue((prev) => prev.filter((b) => b.id !== currentQueueBillId));
        } catch (queueErr) {
          console.warn('Notice: Queue status update error:', queueErr);
        }
        setCurrentQueueBillId(null);
      }

      // Immediately trigger a re-fetch after saving so the new bill appears without a page reload
      await loadHistory();
      setActiveTab('history');
      resetUploadState();
    } catch (err) {
      console.error('Save purchase error:', err);
      const errorMessage = err?.message || 'Database or RLS permission error occurred';
      showToast(`Save Failed: ${errorMessage}`, 'error');
      alert(`⚠️ Database / RLS Failure:\n\n${errorMessage}\n\nPlease check Supabase RLS policies and table permissions for 'purchase_invoices' and 'purchase_items'.`);
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
    } catch (err) {
      console.error('Delete invoice error:', err);
      const errMsg = err?.message || 'Failed to delete invoice from database';
      showToast(`Delete Failed: ${errMsg}`, 'error');
      alert(`⚠️ Delete Failed:\n\n${errMsg}`);
    }
  };

  const filteredHistory = invoicesHistory.filter((inv) => {
    const q = searchQuery.toLowerCase();
    return (
      (inv.seller_name || '').toLowerCase().includes(q) ||
      (inv.invoice_number || '').toLowerCase().includes(q) ||
      (inv.seller_gst || '').toLowerCase().includes(q)
    );
  });

  const handleBack = () => {
    if (typeof onBackToHub === 'function') {
      onBackToHub();
    } else {
      window.location.href = '/admin';
    }
  };

  return (
    <div className="space-y-3 pb-12 animate-in fade-in duration-300 w-full max-w-[98vw] mx-auto px-2 md:px-4 py-2 overflow-x-hidden">
      {/* Top Header Card */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border border-slate-800 p-3 sm:p-4 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition text-xs font-semibold shrink-0 shadow-sm cursor-pointer"
              title="Return to Admin Hub"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>← Admin Hub</span>
            </button>
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-amber-400" />
              <span>Purchase & Inward Management</span>
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Groq Vision LPU OCR</span>
            </span>
          </div>

          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Scan tax invoices and vendor bills using high-speed Groq Vision OCR. Auto-populate HSN, rates, GST tax slabs, and assign EAN barcodes.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'new'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Bill Entry</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              loadHistory();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Inward Invoices Ledger ({invoicesHistory.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('vendors');
              loadVendors();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'vendors'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>🏢 Vendors Directory ({vendorsList.length})</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: NEW BILL ENTRY (UPLOAD + GROQ VISION + REVIEW) */}
      {/* ======================================================== */}
      {activeTab === 'new' && (
        <div className="space-y-3">
          {/* Upload Dropzone & Queue Hub Card */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3 sm:p-4 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-2.5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-amber-400" />
                  <span>Invoice Upload Drop-Zone & Photo Queue</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Snap physical receipts via camera or upload multiple bill files. Each bill is queued and processed individually.
                </p>
              </div>

              {selectedFile && (
                <button
                  type="button"
                  onClick={resetUploadState}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Active Bill</span>
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

            {/* Top Action Triggers: Phone QR Code Pairing Modal & Multi-File Upload */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Trigger 1: Open Phone QR Code Pairing Modal */}
              <button
                type="button"
                onClick={() => setIsMobileScannerOpen(true)}
                className="group relative flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed border-amber-500/50 hover:border-amber-400 bg-slate-950/70 hover:bg-slate-950 transition-all cursor-pointer text-left shadow-lg shadow-amber-500/5"
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
                    Scan QR with mobile camera to snap and upload bills directly here
                  </p>
                </div>
              </button>

              {/* Trigger 2: Upload Files (Multi-file enabled) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed border-cyan-500/50 hover:border-cyan-400 bg-slate-950/70 hover:bg-slate-950 transition-all cursor-pointer text-left shadow-lg shadow-cyan-500/5"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 group-hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 transition">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white text-xs sm:text-sm group-hover:text-cyan-400 transition flex items-center gap-1.5">
                    <span>📁 Upload Bill Photos / PDF (Multi-File)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Upload multiple images or PDFs. Each bill is queued as a separate entry
                  </p>
                </div>
              </button>
            </div>

            {/* ======================================================== */}
            {/* REQUIREMENT 1: UPLOADED BILLS QUEUE TRAY (INDIVIDUAL CARDS) */}
            {/* ======================================================== */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    Uploaded Bills Queue
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {billQueue.length} bill{billQueue.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Process each bill card separately through Groq Vision OCR
                </span>
              </div>

              {billQueue.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-800 bg-slate-950/40 p-4 sm:p-5 text-center space-y-1.5">
                  <FileText className="w-7 h-7 mx-auto text-slate-700" />
                  <p className="text-xs font-semibold text-slate-300">No bills currently in queue</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Snap physical bills using "📱 Open Mobile Bill Scanner" or upload images/PDFs above to add them to your queue.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {billQueue.map((item, index) => {
                    const isProcessing = activeProcessingBillId === item.id;
                    const itemUrl = item.image_url || item.dataUrl;
                    const isCurrentlyActive = billPreviewUrl === itemUrl;
                    const formattedTime = new Date(item.uploadedAt || item.created_at || Date.now()).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isCurrentlyActive
                            ? 'bg-slate-950 border-amber-500 shadow-md shadow-amber-500/10'
                            : item.attachedToPrevious
                            ? 'bg-slate-950/90 border-cyan-500/40'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Image Thumbnail with Zoom Preview Button */}
                          <div
                            onClick={() => setZoomedQueueImage(itemUrl)}
                            className="relative w-20 h-24 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden shrink-0 group cursor-pointer"
                            title="Click to Zoom Preview"
                          >
                            <img
                              src={itemUrl}
                              alt="Thumbnail"
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                              <ZoomIn className="w-5 h-5 text-amber-300" />
                            </div>
                            <span className="absolute bottom-1 right-1 bg-black/70 text-[9px] font-bold text-slate-300 px-1 rounded">
                              Zoom
                            </span>
                          </div>

                          {/* Card Information */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-white text-xs truncate max-w-[170px]">
                                    {item.name || `Bill #${index + 1}`}
                                  </span>
                                  {isCurrentlyActive && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500 text-slate-950">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  <span>{formattedTime}</span>
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveBillFromQueue(item.id)}
                                title="Remove Bill from Queue"
                                className="px-2 py-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition text-xs font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                <span className="text-[11px] text-rose-400">Remove</span>
                              </button>
                            </div>

                            {/* Status badge */}
                            <div className="flex items-center gap-1.5">
                              {item.extracted ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <Check className="w-2.5 h-2.5" />
                                  <span>Extracted & Loaded Below</span>
                                </span>
                              ) : isProcessing ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                  <span>Extracting OCR...</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300">
                                  <span>Queued (Ready to Process)</span>
                                </span>
                              )}
                            </div>

                            {/* Card Actions: Process Button & Multi-Page Link Option */}
                            <div className="flex items-center gap-2 pt-1 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleProcessIndividualBill(item)}
                                disabled={isProcessing}
                                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition active:scale-[0.98] cursor-pointer"
                              >
                                <Zap className="w-3.5 h-3.5 fill-slate-950" />
                                <span>{isProcessing ? 'Extracting...' : '⚡ Process This Bill (Groq OCR)'}</span>
                              </button>

                              {/* Multi-page linking checkbox */}
                              {index > 0 && (
                                <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none bg-slate-900 px-2 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={!!item.attachedToPrevious}
                                    onChange={() => {
                                      setBillQueue((prev) =>
                                        prev.map((b) =>
                                          b.id === item.id ? { ...b, attachedToPrevious: !b.attachedToPrevious } : b
                                        )
                                      );
                                    }}
                                    className="w-3.5 h-3.5 text-cyan-500 rounded border-slate-700 focus:ring-0 cursor-pointer"
                                  />
                                  <span className="text-[10px] text-cyan-300">Attach to Previous Bill Page</span>
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

            {/* Active Groq Vision OCR Scanning Spinner Banner */}
            {isProcessingOcr && (
              <div className="rounded-2xl border-2 border-amber-500/50 bg-gradient-to-r from-amber-500/15 via-slate-900/95 to-amber-500/15 p-5 shadow-2xl backdrop-blur-md animate-pulse">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20">
                      <RefreshCw className="w-7 h-7 animate-spin text-amber-400" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 animate-ping" />
                  </div>
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                        ⚡ Groq Vision OCR Active
                      </span>
                    </div>
                    <h4 className="text-sm sm:text-base font-extrabold text-white">
                      Extracting invoice line items and vendor details...
                    </h4>
                    <p className="text-xs text-slate-400">
                      Deep vision extracting supplier particulars, invoice dates, GST tax splits, and line item product details
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {ocrError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="font-medium">{ocrError}</span>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* EDITABLE REVIEW & VERIFICATION UI */}
          {/* ======================================================== */}
          <div id="inward-bill-review-section" className="space-y-3">
            {/* 1. Header Card: Seller Details & Bank Details */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3 sm:p-4 shadow-xl space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  <span>1. Vendor, Tax & Bank Credentials</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Verify or edit supplier particulars
                </span>
              </div>

              {/* Responsive Bill Header Grid: 6 cols (lg), 4 cols (md), 2 cols (mobile) */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-2.5 text-xs">
                {/* Seller Name */}
                <div className="col-span-2 md:col-span-2 lg:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1 text-xs truncate">
                    Seller / Agency Name *
                  </label>
                  <input
                    type="text"
                    value={sellerData.name}
                    onChange={(e) => setSellerData({ ...sellerData, name: e.target.value })}
                    placeholder="e.g. Bisleri Distributors Ltd"
                    className="w-full min-w-0 h-9 px-2.5 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-white font-medium text-xs sm:text-sm focus:outline-none transition"
                  />
                </div>

                {/* Seller GSTIN */}
                <div className="col-span-1">
                  <label className="block text-slate-300 font-semibold mb-1 text-xs truncate">
                    GSTIN (15 Digits)
                  </label>
                  <input
                    type="text"
                    value={sellerData.gst}
                    onChange={(e) => setSellerData({ ...sellerData, gst: e.target.value.toUpperCase() })}
                    placeholder="07AAAAA0000A1Z5"
                    className="w-full min-w-0 h-9 px-2.5 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-white font-mono uppercase text-xs sm:text-sm focus:outline-none transition"
                  />
                </div>

                {/* FSSAI License */}
                <div className="col-span-1">
                  <label className="block text-slate-300 font-semibold mb-1 text-xs truncate">
                    FSSAI Lic. No.
                  </label>
                  <input
                    type="text"
                    value={sellerData.fssai}
                    onChange={(e) => setSellerData({ ...sellerData, fssai: e.target.value })}
                    placeholder="14-digit FSSAI"
                    className="w-full min-w-0 h-9 px-2.5 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-white font-mono text-xs sm:text-sm focus:outline-none transition"
                  />
                </div>

                {/* Invoice Number */}
                <div className="col-span-1">
                  <label className="block text-slate-300 font-semibold mb-1 text-xs truncate">
                    Bill / Invoice No.
                  </label>
                  <input
                    type="text"
                    value={invoiceData.invoice_number}
                    onChange={(e) => setInvoiceData({ ...invoiceData, invoice_number: e.target.value })}
                    placeholder="INV-2026-001"
                    className="w-full min-w-0 h-9 px-2.5 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-white font-mono text-xs sm:text-sm focus:outline-none transition"
                  />
                </div>

                {/* Invoice Date */}
                <div className="col-span-1">
                  <label className="block text-slate-300 font-semibold mb-1 text-xs truncate">
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    value={invoiceData.invoice_date}
                    onChange={(e) => setInvoiceData({ ...invoiceData, invoice_date: e.target.value })}
                    className="w-full min-w-0 h-9 px-2.5 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-white font-mono text-xs sm:text-sm focus:outline-none transition"
                  />
                </div>

                {/* Vendor Contact / Phone */}
                <div className="col-span-1">
                  <label className="block text-slate-300 font-semibold mb-1 text-xs truncate">
                    Vendor Contact
                  </label>
                  <input
                    type="text"
                    value={sellerData.contact}
                    onChange={(e) => setSellerData({ ...sellerData, contact: e.target.value })}
                    placeholder="+91 98XXXXXXXX"
                    className="w-full min-w-0 h-9 px-2.5 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-white text-xs sm:text-sm focus:outline-none transition"
                  />
                </div>

                {/* Salesman Name */}
                <div className="col-span-1">
                  <label className="block text-slate-300 font-semibold mb-1 text-xs truncate">
                    Salesman Name
                  </label>
                  <input
                    type="text"
                    value={sellerData.salesman_name}
                    onChange={(e) => setSellerData({ ...sellerData, salesman_name: e.target.value })}
                    placeholder="Salesman name"
                    className="w-full min-w-0 h-9 px-2.5 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-white text-xs sm:text-sm focus:outline-none transition"
                  />
                </div>

                {/* Salesman Mobile */}
                <div className="col-span-1">
                  <label className="block text-slate-300 font-semibold mb-1 text-xs truncate">
                    Salesman Phone
                  </label>
                  <input
                    type="text"
                    value={sellerData.salesman_number}
                    onChange={(e) => setSellerData({ ...sellerData, salesman_number: e.target.value })}
                    placeholder="Salesman phone"
                    className="w-full min-w-0 h-9 px-2.5 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-white text-xs sm:text-sm focus:outline-none transition"
                  />
                </div>

                {/* Full Address */}
                <div className="col-span-2 md:col-span-2 lg:col-span-3">
                  <label className="block text-slate-300 font-semibold mb-1 text-xs truncate">
                    Depot / Godown Address
                  </label>
                  <input
                    type="text"
                    value={sellerData.address}
                    onChange={(e) => setSellerData({ ...sellerData, address: e.target.value })}
                    placeholder="Full street address & pin code"
                    className="w-full min-w-0 h-9 px-2.5 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-white text-xs sm:text-sm focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Bank Details Strip */}
              <div className="pt-2.5 border-t border-slate-800/80">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5 text-xs">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1 text-xs truncate">Bank Name</label>
                    <input
                      type="text"
                      value={bankDetails.bank_name}
                      onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })}
                      placeholder="e.g. HDFC / SBI / ICICI"
                      className="w-full min-w-0 h-9 px-2.5 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-white text-xs sm:text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1 text-xs truncate">Account Number</label>
                    <input
                      type="text"
                      value={bankDetails.account_no}
                      onChange={(e) => setBankDetails({ ...bankDetails, account_no: e.target.value })}
                      placeholder="Bank A/C number"
                      className="w-full min-w-0 h-9 px-2.5 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1 text-xs truncate">IFSC Code</label>
                    <input
                      type="text"
                      value={bankDetails.ifsc}
                      onChange={(e) => setBankDetails({ ...bankDetails, ifsc: e.target.value.toUpperCase() })}
                      placeholder="e.g. HDFC0001234"
                      className="w-full min-w-0 h-9 px-2.5 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-white font-mono uppercase text-xs sm:text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Line Items Table Card */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3 sm:p-4 shadow-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-400" />
                    <span>2. Inward Line Items ({items.length})</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Directly edit cell values. Use scanner buttons to capture barcodes via USB gun or back camera.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              {/* Full-Visibility Line Items Table Container */}
              <div className="w-full overflow-x-auto border border-slate-800 rounded-lg bg-slate-950/60 shadow-inner">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                      <th className="py-2.5 px-2.5 min-w-[110px]">Barcode</th>
                      <th className="py-2.5 px-2.5 min-w-[220px]">Item Name</th>
                      <th className="py-2.5 px-2 min-w-[80px]">HSN</th>
                      <th className="py-2.5 px-2 min-w-[65px] text-right">Qty</th>
                      <th className="py-2.5 px-2 min-w-[75px] text-right">MRP (₹)</th>
                      <th className="py-2.5 px-2 min-w-[85px] text-right">Pre-GST (₹)</th>
                      <th className="py-2.5 px-2 min-w-[80px] text-right">GST %</th>
                      <th className="py-2.5 px-2 min-w-[75px] text-right">Discount (₹)</th>
                      <th className="py-2.5 px-2 min-w-[90px] text-right">Final Cost (₹)</th>
                      <th className="py-2.5 px-2 min-w-[45px] text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {items.map((it, idx) => {
                      const hasBarcode = Boolean(it.barcode);
                      return (
                        <tr
                          key={it.id || idx}
                          className={`transition-colors ${
                            hasBarcode
                              ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                              : 'hover:bg-slate-900/60'
                          }`}
                        >
                          {/* Barcode Column: min-w-[110px] */}
                          <td className="py-1.5 px-2.5 min-w-[110px]">
                            <div className="flex items-center gap-1.5">
                              {hasBarcode ? (
                                <span className="font-mono text-[11px] font-bold text-emerald-300 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 max-w-[80px] truncate" title={it.barcode}>
                                  {it.barcode}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">
                                  No Barcode
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenScanner(idx)}
                                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                  hasBarcode
                                    ? 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
                                    : 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border-cyan-500/30'
                                }`}
                                title="Scan barcode with USB or Camera"
                              >
                                <Scan className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Item Name: min-w-[220px] flex-1 */}
                          <td className="py-1.5 px-2.5 min-w-[220px]">
                            <input
                              type="text"
                              value={it.item_name}
                              onChange={(e) => handleItemFieldChange(idx, 'item_name', e.target.value)}
                              placeholder="Product Name"
                              className="w-full min-w-0 h-8 px-2.5 py-1 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white font-medium text-xs focus:outline-none"
                            />
                          </td>

                          {/* HSN Code: min-w-[80px] */}
                          <td className="py-1.5 px-2 min-w-[80px]">
                            <input
                              type="text"
                              value={it.hsn_code}
                              onChange={(e) => handleItemFieldChange(idx, 'hsn_code', e.target.value)}
                              placeholder="HSN"
                              className="w-full min-w-0 h-8 px-2 py-1 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white font-mono text-xs focus:outline-none"
                            />
                          </td>

                          {/* Quantity: min-w-[65px] */}
                          <td className="py-1.5 px-2 min-w-[65px]">
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) => handleItemFieldChange(idx, 'quantity', e.target.value)}
                              className="w-full min-w-0 h-8 px-2 py-1 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white text-right font-mono text-xs focus:outline-none"
                            />
                          </td>

                          {/* MRP: min-w-[75px] */}
                          <td className="py-1.5 px-2 min-w-[75px]">
                            <input
                              type="number"
                              step="0.01"
                              value={it.mrp}
                              onChange={(e) => handleItemFieldChange(idx, 'mrp', e.target.value)}
                              className="w-full min-w-0 h-8 px-2 py-1 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white text-right font-mono text-xs focus:outline-none"
                            />
                          </td>

                          {/* Pre-GST: min-w-[85px] */}
                          <td className="py-1.5 px-2 min-w-[85px]">
                            <input
                              type="number"
                              step="0.01"
                              value={it.price_before_gst}
                              onChange={(e) => handleItemFieldChange(idx, 'price_before_gst', e.target.value)}
                              className="w-full min-w-0 h-8 px-2 py-1 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white text-right font-mono text-xs focus:outline-none"
                            />
                          </td>

                          {/* GST %: min-w-[80px] */}
                          <td className="py-1.5 px-2 min-w-[80px]">
                            <select
                              value={it.gst_rate}
                              onChange={(e) => handleItemFieldChange(idx, 'gst_rate', e.target.value)}
                              className="w-full min-w-0 h-8 px-1.5 py-1 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white text-xs focus:outline-none cursor-pointer"
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>

                          {/* Discount: min-w-[75px] */}
                          <td className="py-1.5 px-2 min-w-[75px]">
                            <input
                              type="number"
                              step="0.01"
                              value={it.discount}
                              onChange={(e) => handleItemFieldChange(idx, 'discount', e.target.value)}
                              className="w-full min-w-0 h-8 px-2 py-1 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white text-right font-mono text-xs focus:outline-none"
                            />
                          </td>

                          {/* Final Cost: min-w-[90px] */}
                          <td className="py-1.5 px-2 min-w-[90px] text-right font-mono font-bold text-emerald-400 text-xs">
                            ₹{(Number(it.price_after_gst) || 0).toFixed(2)}
                          </td>

                          {/* Action (delete): min-w-[45px] */}
                          <td className="py-1.5 px-2 min-w-[45px] text-center">
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
                        <td colSpan="10" className="py-8 text-center text-slate-500">
                          No line items entered yet. Click "Add Line Item" or upload a bill.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 3. Compact Footer & Summary Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2.5 border-t border-slate-800/80 bg-slate-950/60 p-2.5 sm:p-3 rounded-xl">
                {/* Left side: Inline compact summary badges */}
                <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap text-xs">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                    <span className="text-slate-400">Taxable Base:</span>
                    <span className="font-mono font-bold text-white">₹{totalTaxable.toFixed(2)}</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                    <span className="text-slate-400">GST Amount:</span>
                    <span className="font-mono font-bold text-amber-400">₹{totalTax.toFixed(2)}</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 shadow-sm">
                    <span className="font-semibold text-emerald-400">Grand Total:</span>
                    <span className="font-mono font-black text-emerald-300 text-sm">₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Right side: High-contrast Save & Commit Button */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isSaving || items.length === 0}
                    onClick={handleSavePurchaseEntry}
                    className="w-full sm:w-auto h-10 px-5 sm:px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm tracking-wide transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? (
                      <span>Saving Purchase Inward Entry...</span>
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
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: PURCHASE INVOICES HISTORY */}
      {/* ======================================================== */}
      {activeTab === 'history' && (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-3 sm:p-4 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      activeTab === 'history'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Inward Invoices Ledger
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('vendors');
                      loadVendors();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      activeTab === 'vendors'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🏢 Vendors Directory
                  </button>
                </div>
              </div>

              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                <span>Purchase Inward Invoices Ledger</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Archived bills and supplier inward shipments.
              </p>
            </div>

            {/* Search Filter & Refresh */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search vendor, bill, GST..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="button"
                onClick={loadHistory}
                disabled={historyLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition shrink-0 shadow-sm"
                title="Refresh Purchase Invoices Ledger"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${historyLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* Active Vendor Filter Alert */}
          {vendorLedgerFilter && (
            <div className="p-3 px-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Filtered by vendor: <strong>{vendorLedgerFilter.vendor_name}</strong>
                  {vendorLedgerFilter.gstin ? ` (${vendorLedgerFilter.gstin})` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVendorLedgerFilter(null);
                  setSearchQuery('');
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold transition text-[11px]"
              >
                Clear Filter
              </button>
            </div>
          )}

          {/* History Error Alert */}
          {historyError && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{historyError}</span>
              </div>
              <button
                type="button"
                onClick={loadHistory}
                className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 font-bold transition text-[11px]"
              >
                Retry
              </button>
            </div>
          )}

          {historyLoading ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
              <p>Loading purchase invoices ledger from database...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs space-y-2">
              <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-600" />
              <p>No purchase invoices recorded yet.</p>
              <button
                type="button"
                onClick={() => setActiveTab('new')}
                className="text-amber-400 hover:text-amber-300 font-bold underline"
              >
                Create your first purchase entry →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((inv) => {
                const lineItems = inv.purchase_items || inv.items || [];
                const isExpanded = expandedInvoiceId === inv.id;

                return (
                  <div
                    key={inv.id}
                    className="rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition overflow-hidden"
                  >
                    <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="space-y-1.5">
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
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                          {inv.seller_gst && (
                            <span>
                              GST: <strong className="text-slate-300">{inv.seller_gst}</strong>
                            </span>
                          )}
                          {inv.seller_contact && (
                            <span>
                              Ph: <strong className="text-slate-300">{inv.seller_contact}</strong>
                            </span>
                          )}
                          <span>
                            Items:{' '}
                            <strong className="text-emerald-400 font-semibold">
                              {lineItems.length} lines
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4 self-end md:self-center flex-wrap">
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">Grand Total</div>
                          <div className="font-mono font-black text-emerald-400 text-base">
                            ₹{Number(inv.grand_total || 0).toFixed(2)}
                          </div>
                        </div>

                        {/* Toggle Inspect Items */}
                        <button
                          type="button"
                          onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                            isExpanded
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                          }`}
                          title="Inspect Line Items"
                        >
                          <span>Items ({lineItems.length})</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteInvoice(inv.id)}
                          className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Delete Entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Line Items & Bill Preview Drawer */}
                    {isExpanded && (
                      <div className="border-t border-slate-800/80 bg-slate-900/60 p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5 text-amber-400" />
                            <span>Committed Inward Line Items ({lineItems.length})</span>
                          </h5>

                          {inv.bill_image_url && (
                            <a
                              href={inv.bill_image_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold underline"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>View Uploaded Bill</span>
                            </a>
                          )}
                        </div>

                        {lineItems.length === 0 ? (
                          <p className="text-xs text-slate-500 italic">No line items stored for this entry.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-slate-800">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px]">
                                <tr>
                                  <th className="py-2.5 px-3">#</th>
                                  <th className="py-2.5 px-3">Item Name</th>
                                  <th className="py-2.5 px-3">Barcode</th>
                                  <th className="py-2.5 px-3">HSN</th>
                                  <th className="py-2.5 px-3 text-right">Qty</th>
                                  <th className="py-2.5 px-3 text-right">Purchase Rate</th>
                                  <th className="py-2.5 px-3 text-right">MRP</th>
                                  <th className="py-2.5 px-3 text-right">GST %</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                                {lineItems.map((item, idx) => (
                                  <tr key={item.id || idx} className="hover:bg-slate-800/40">
                                    <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                                    <td className="py-2 px-3 font-semibold text-white">
                                      {item.item_name || 'Item'}
                                    </td>
                                    <td className="py-2 px-3 font-mono text-[11px] text-amber-300">
                                      {item.barcode ? (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                          {item.barcode}
                                        </span>
                                      ) : (
                                        <span className="text-slate-600">—</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 font-mono text-slate-400">
                                      {item.hsn_code || '—'}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-emerald-400">
                                      {item.quantity}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono text-slate-200">
                                      ₹{Number(item.purchase_price || 0).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono text-slate-400">
                                      ₹{Number(item.mrp || 0).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono text-slate-300">
                                      {item.gst_rate ? `${item.gst_rate}%` : '0%'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: VENDORS DIRECTORY VIEW */}
      {/* ======================================================== */}
      {activeTab === 'vendors' && (
        <div className="space-y-4">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800 self-start w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition"
            >
              Inward Invoices Ledger
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('vendors');
                loadVendors();
              }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 transition"
            >
              🏢 Vendors Directory
            </button>
          </div>

          <VendorsDirectory
            vendors={vendorsList}
            invoicesHistory={invoicesHistory}
            onSelectVendorInvoices={(vendor) => {
              setActiveTab('history');
              setSearchQuery(vendor.vendor_name || vendor.gstin || '');
              setVendorLedgerFilter(vendor);
            }}
            onRefresh={loadVendors}
            loading={vendorsLoading}
            onDeleteVendor={async (id) => {
              await deletePurchaseVendor(id);
              loadVendors();
            }}
          />
        </div>
      )}

      {/* Mobile QR Code Pairing Modal */}
      <MobileScannerModal
        isOpen={isMobileScannerOpen}
        onClose={() => setIsMobileScannerOpen(false)}
        queue={billQueue}
        onAddToQueue={(newItem) => {
          handleIncomingBill(newItem);
        }}
        onRemoveFromQueue={(id) => {
          handleRemoveBillFromQueue(id);
        }}
        onToggleAttachToPrevious={(id) => {
          setBillQueue((prev) =>
            prev.map((b) => (b.id === id ? { ...b, attachedToPrevious: !b.attachedToPrevious } : b))
          );
        }}
        onProcessBill={(item) => {
          setIsMobileScannerOpen(false);
          handleProcessIndividualBill(item);
        }}
        processingBillId={activeProcessingBillId}
      />

      {/* Lightbox Zoom Preview Modal */}
      {zoomedQueueImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
          onClick={() => setZoomedQueueImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomedQueueImage(null)}
              className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 text-white hover:bg-black/90 transition z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomedQueueImage}
              alt="Enlarged Bill Preview"
              className="w-full h-auto max-h-[85vh] object-contain"
            />
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        item={activeScanningItemIndex !== null ? items[activeScanningItemIndex] : null}
        onAssignBarcode={handleBarcodeAssigned}
      />
    </div>
  );
}
