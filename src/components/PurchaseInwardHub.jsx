import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
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
  Check
} from 'lucide-react';
import BarcodeScannerModal from './BarcodeScannerModal';
import { renderPdfFirstPageToImage } from '../lib/pdfToImage';
import {
  fetchPurchaseInvoices,
  savePurchaseInvoice,
  deletePurchaseInvoice
} from '../lib/supabase';

export default function PurchaseInwardHub({
  onBackToHub,
  showToast = () => {}
}) {
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history'
  const [invoicesHistory, setInvoicesHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Bill Upload & Processing State
  const [selectedFile, setSelectedFile] = useState(null);
  const [billPreviewUrl, setBillPreviewUrl] = useState(null);
  const [billBase64, setBillBase64] = useState(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  // File input refs
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load purchase history
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await fetchPurchaseInvoices();
      setInvoicesHistory(data || []);
    } catch (err) {
      console.warn('Failed to load purchase history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Handle File / Camera Capture
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrError('');
    setSelectedFile(file);

    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // PDF Document: Render 1st page to canvas image via pdfjs-dist
        setIsProcessingOcr(true);
        const { dataUrl, base64 } = await renderPdfFirstPageToImage(file, 2.0);
        setBillPreviewUrl(dataUrl);
        setBillBase64(base64);
        await processWithGroqVision(base64, 'image/jpeg');
      } else {
        // Standard Image (PNG/JPG/JPEG/Camera capture)
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target.result;
          setBillPreviewUrl(dataUrl);
          const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
          setBillBase64(base64);
          await processWithGroqVision(base64, file.type || 'image/jpeg');
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error('File conversion error:', err);
      setOcrError(`Failed to process document: ${err.message || 'Corrupted file'}`);
      setIsProcessingOcr(false);
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
      return;
    }
    if (items.length === 0) {
      showToast('At least one line item is required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const invoicePayload = {
        invoice_number: invoiceData.invoice_number || `INV-${Date.now()}`,
        invoice_date: invoiceData.invoice_date || new Date().toISOString().split('T')[0],
        seller_name: sellerData.name,
        seller_gst: sellerData.gst,
        seller_fssai: sellerData.fssai,
        seller_contact: sellerData.contact,
        seller_address: sellerData.address,
        salesman_name: sellerData.salesman_name,
        salesman_number: sellerData.salesman_number,
        bank_name: bankDetails.bank_name,
        account_no: bankDetails.account_no,
        ifsc: bankDetails.ifsc,
        taxable_amount: Number(totalTaxable.toFixed(2)),
        total_tax: Number(totalTax.toFixed(2)),
        grand_total: Number(grandTotal.toFixed(2)),
        bill_image_url: billPreviewUrl || ''
      };

      const saved = await savePurchaseInvoice(invoicePayload, items);
      showToast('🎉 Purchase invoice & inward stock committed successfully!', 'success');

      // Refresh history & switch tab
      await loadHistory();
      setActiveTab('history');
      resetUploadState();
    } catch (err) {
      console.error('Save purchase error:', err);
      showToast(err.message || 'Failed to save purchase invoice', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const resetUploadState = () => {
    setSelectedFile(null);
    setBillPreviewUrl(null);
    setBillBase64(null);
    setOcrError('');
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
  };

  const handleDeleteInvoice = async (id) => {
    if (!window.confirm('Are you sure you want to delete this purchase entry?')) return;
    try {
      await deletePurchaseInvoice(id);
      showToast('Purchase invoice deleted', 'info');
      await loadHistory();
    } catch (err) {
      showToast('Failed to delete invoice', 'error');
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

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300 w-full max-w-full overflow-x-hidden">
      {/* Top Header Card */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border border-slate-800 p-6 sm:p-7 shadow-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onBackToHub}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Hub</span>
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Sparkles className="w-3 h-3 animate-spin-slow text-amber-400" />
              <span>Groq Vision LPU OCR</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <Scan className="w-3 h-3 text-emerald-400" />
              <span>Barcode / Camera Ready</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Purchase & Inward Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Scan tax invoices and vendor bills using high-speed Groq Vision OCR. Auto-populate HSN, rates, GST tax slabs, and assign EAN barcodes.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'new'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>New Bill Entry</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Purchase History ({invoicesHistory.length})</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: NEW BILL ENTRY (UPLOAD + GROQ VISION + REVIEW) */}
      {/* ======================================================== */}
      {activeTab === 'new' && (
        <div className="space-y-6">
          {/* Upload Dropzone Card */}
          <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-7 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-amber-400" />
                  <span>Invoice Upload Drop-Zone</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Capture physical bill via phone camera or upload PDF / Image tax invoice.
                </p>
              </div>

              {selectedFile && (
                <button
                  type="button"
                  onClick={resetUploadState}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear & Retake</span>
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
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Dropzone with 2 Options */}
            {!selectedFile ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Option 1: Take Photo with Camera */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="group relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-slate-700 hover:border-amber-500/80 bg-slate-950/60 hover:bg-slate-950/90 transition-all cursor-pointer text-center space-y-3"
                >
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 group-hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center transition shadow-lg shadow-amber-500/10">
                    <Camera className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm group-hover:text-amber-400 transition">
                      Take Photo with Camera
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Direct back-camera capture for mobile & tablet dispatch desks
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                    Fast Mobile Cam
                  </span>
                </button>

                {/* Option 2: Upload File (PDF / Images) */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-slate-700 hover:border-cyan-500/80 bg-slate-950/60 hover:bg-slate-950/90 transition-all cursor-pointer text-center space-y-3"
                >
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 group-hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center transition shadow-lg shadow-cyan-500/10">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm group-hover:text-cyan-400 transition">
                      Upload File (PDF / PNG / JPG)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Renders multi-page PDF documents via canvas & extracts first page
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
                    PDF & Image Docs
                  </span>
                </button>
              </div>
            ) : (
              /* Selected File & Preview Display */
              <div className="flex flex-col md:flex-row items-center gap-5 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                {billPreviewUrl && (
                  <div className="relative w-full md:w-48 h-40 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center">
                    <img
                      src={billPreviewUrl}
                      alt="Bill Preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-bold text-white text-sm truncate">
                      {selectedFile.name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Size: {(selectedFile.size / 1024).toFixed(1)} KB • Type: {selectedFile.type || 'Document'}
                  </p>

                  {isProcessingOcr ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 pt-2">
                      <Sparkles className="w-4 h-4 animate-spin-slow text-amber-400" />
                      <span>Groq Vision LPU OCR is extracting vendor, HSN, and price columns...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 pt-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Extraction completed. Review and edit fields below.</span>
                    </div>
                  )}
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
          <div className="space-y-6">
            {/* 1. Header Card: Seller Details & Bank Details */}
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-7 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-400" />
                  <span>1. Vendor, Tax & Bank Credentials</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Verify or edit supplier particulars
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {/* Seller Name */}
                <div>
                  <label className="block text-slate-300 font-bold uppercase tracking-wider mb-1">
                    Seller / Agency Name *
                  </label>
                  <input
                    type="text"
                    value={sellerData.name}
                    onChange={(e) => setSellerData({ ...sellerData, name: e.target.value })}
                    placeholder="e.g. Bisleri Distributors Ltd"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white font-semibold focus:outline-none transition"
                  />
                </div>

                {/* Seller GSTIN */}
                <div>
                  <label className="block text-slate-300 font-bold uppercase tracking-wider mb-1">
                    GSTIN (15 Digits)
                  </label>
                  <input
                    type="text"
                    value={sellerData.gst}
                    onChange={(e) => setSellerData({ ...sellerData, gst: e.target.value.toUpperCase() })}
                    placeholder="07AAAAA0000A1Z5"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white font-mono uppercase focus:outline-none transition"
                  />
                </div>

                {/* FSSAI License */}
                <div>
                  <label className="block text-slate-300 font-bold uppercase tracking-wider mb-1">
                    FSSAI Lic. No.
                  </label>
                  <input
                    type="text"
                    value={sellerData.fssai}
                    onChange={(e) => setSellerData({ ...sellerData, fssai: e.target.value })}
                    placeholder="14-digit FSSAI Number"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white font-mono focus:outline-none transition"
                  />
                </div>

                {/* Invoice Number */}
                <div>
                  <label className="block text-slate-300 font-bold uppercase tracking-wider mb-1">
                    Bill / Invoice Number
                  </label>
                  <input
                    type="text"
                    value={invoiceData.invoice_number}
                    onChange={(e) => setInvoiceData({ ...invoiceData, invoice_number: e.target.value })}
                    placeholder="INV-2026-001"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white font-mono focus:outline-none transition"
                  />
                </div>

                {/* Invoice Date */}
                <div>
                  <label className="block text-slate-300 font-bold uppercase tracking-wider mb-1">
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    value={invoiceData.invoice_date}
                    onChange={(e) => setInvoiceData({ ...invoiceData, invoice_date: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white font-mono focus:outline-none transition"
                  />
                </div>

                {/* Vendor Contact / Phone */}
                <div>
                  <label className="block text-slate-300 font-bold uppercase tracking-wider mb-1">
                    Vendor Phone / Contact
                  </label>
                  <input
                    type="text"
                    value={sellerData.contact}
                    onChange={(e) => setSellerData({ ...sellerData, contact: e.target.value })}
                    placeholder="+91 98XXXXXXXX"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white focus:outline-none transition"
                  />
                </div>

                {/* Salesman Name */}
                <div>
                  <label className="block text-slate-300 font-bold uppercase tracking-wider mb-1">
                    Salesman / Booking Agent
                  </label>
                  <input
                    type="text"
                    value={sellerData.salesman_name}
                    onChange={(e) => setSellerData({ ...sellerData, salesman_name: e.target.value })}
                    placeholder="Name of booking salesman"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white focus:outline-none transition"
                  />
                </div>

                {/* Salesman Mobile */}
                <div>
                  <label className="block text-slate-300 font-bold uppercase tracking-wider mb-1">
                    Salesman Mobile
                  </label>
                  <input
                    type="text"
                    value={sellerData.salesman_number}
                    onChange={(e) => setSellerData({ ...sellerData, salesman_number: e.target.value })}
                    placeholder="Salesman phone"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white focus:outline-none transition"
                  />
                </div>

                {/* Full Address */}
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block text-slate-300 font-bold uppercase tracking-wider mb-1">
                    Seller Depot / Godown Address
                  </label>
                  <input
                    type="text"
                    value={sellerData.address}
                    onChange={(e) => setSellerData({ ...sellerData, address: e.target.value })}
                    placeholder="Full street address & pin code"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Bank Details Strip */}
              <div className="pt-3 border-t border-slate-800/80">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={bankDetails.bank_name}
                      onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })}
                      placeholder="e.g. HDFC / SBI / ICICI"
                      className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-white text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Account Number</label>
                    <input
                      type="text"
                      value={bankDetails.account_no}
                      onChange={(e) => setBankDetails({ ...bankDetails, account_no: e.target.value })}
                      placeholder="Bank A/C number"
                      className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-white font-mono text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">IFSC Code</label>
                    <input
                      type="text"
                      value={bankDetails.ifsc}
                      onChange={(e) => setBankDetails({ ...bankDetails, ifsc: e.target.value.toUpperCase() })}
                      placeholder="e.g. HDFC0001234"
                      className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-white font-mono uppercase text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Line Items Table Card */}
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-7 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Package className="w-5 h-5 text-emerald-400" />
                    <span>2. Inward Line Items ({items.length})</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Directly edit cell values. Use scanner buttons to capture barcodes via USB gun or back camera.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              {/* Responsive Table Container */}
              <div className="overflow-x-auto w-full rounded-2xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                      <th className="py-3 px-3">Barcode</th>
                      <th className="py-3 px-3 min-w-[200px]">Item Name</th>
                      <th className="py-3 px-2 w-20">HSN</th>
                      <th className="py-3 px-2 w-16 text-right">Qty</th>
                      <th className="py-3 px-2 w-20 text-right">MRP (₹)</th>
                      <th className="py-3 px-2 w-24 text-right">Pre-GST (₹)</th>
                      <th className="py-3 px-2 w-16 text-right">GST %</th>
                      <th className="py-3 px-2 w-20 text-right">Disc (₹)</th>
                      <th className="py-3 px-2 w-24 text-right">Final Cost (₹)</th>
                      <th className="py-3 px-2 w-12 text-center">Action</th>
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
                          {/* Barcode Column */}
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              {hasBarcode ? (
                                <span className="font-mono text-[11px] font-bold text-emerald-300 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30">
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
                                className={`p-1.5 rounded-lg border transition ${
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

                          {/* Item Name */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={it.item_name}
                              onChange={(e) => handleItemFieldChange(idx, 'item_name', e.target.value)}
                              placeholder="Product Name"
                              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white font-semibold text-xs focus:outline-none"
                            />
                          </td>

                          {/* HSN Code */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={it.hsn_code}
                              onChange={(e) => handleItemFieldChange(idx, 'hsn_code', e.target.value)}
                              placeholder="HSN"
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white font-mono text-xs focus:outline-none"
                            />
                          </td>

                          {/* Quantity */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) => handleItemFieldChange(idx, 'quantity', e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white text-right font-mono text-xs focus:outline-none"
                            />
                          </td>

                          {/* MRP */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step="0.01"
                              value={it.mrp}
                              onChange={(e) => handleItemFieldChange(idx, 'mrp', e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white text-right font-mono text-xs focus:outline-none"
                            />
                          </td>

                          {/* Cost (Pre-GST) */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step="0.01"
                              value={it.price_before_gst}
                              onChange={(e) => handleItemFieldChange(idx, 'price_before_gst', e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white text-right font-mono text-xs focus:outline-none"
                            />
                          </td>

                          {/* GST % */}
                          <td className="py-2 px-2">
                            <select
                              value={it.gst_rate}
                              onChange={(e) => handleItemFieldChange(idx, 'gst_rate', e.target.value)}
                              className="w-full px-1.5 py-1.5 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white text-xs focus:outline-none"
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>

                          {/* Discount */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step="0.01"
                              value={it.discount}
                              onChange={(e) => handleItemFieldChange(idx, 'discount', e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg text-white text-right font-mono text-xs focus:outline-none"
                            />
                          </td>

                          {/* Final Cost */}
                          <td className="py-2 px-2 text-right font-mono font-bold text-emerald-400">
                            ₹{(Number(it.price_after_gst) || 0).toFixed(2)}
                          </td>

                          {/* Actions */}
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition"
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

              {/* 3. Totals & Commit Action Strip */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Taxable Base Value:</span>
                    <span className="font-mono text-slate-200">₹{totalTaxable.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>GST Tax Amount:</span>
                    <span className="font-mono text-slate-200">₹{totalTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
                    <span>Invoice Grand Total:</span>
                    <span className="font-mono text-emerald-400 text-base">₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex flex-col justify-center gap-2.5">
                  <button
                    type="button"
                    disabled={isSaving || items.length === 0}
                    onClick={handleSavePurchaseEntry}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm tracking-wide transition shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
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
                  <p className="text-[11px] text-slate-400 text-center">
                    Commits inward entry to Supabase `purchase_invoices` and updates warehouse inventory.
                  </p>
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
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-7 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                <span>Purchase Inward Invoices Ledger</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Archived bills and supplier inward shipments.
              </p>
            </div>

            {/* Search Filter */}
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
          </div>

          {historyLoading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Loading purchase invoices ledger...
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
              {filteredHistory.map((inv) => (
                <div
                  key={inv.id}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div className="space-y-1">
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
                      {inv.seller_gst && <span>GST: <strong className="text-slate-300">{inv.seller_gst}</strong></span>}
                      {inv.seller_contact && <span>Ph: <strong className="text-slate-300">{inv.seller_contact}</strong></span>}
                      <span>Items: <strong className="text-slate-200">{inv.items?.length || 0} lines</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end md:self-center">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">Grand Total</div>
                      <div className="font-mono font-black text-emerald-400 text-base">
                        ₹{Number(inv.grand_total || 0).toFixed(2)}
                      </div>
                    </div>

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
              ))}
            </div>
          )}
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
