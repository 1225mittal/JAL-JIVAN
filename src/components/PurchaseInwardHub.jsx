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
  RotateCw,
  Maximize2,
  Minimize2,
  ChevronLeft,
  EyeOff,
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
  AlertTriangle,
  Tag
} from 'lucide-react';
import BarcodeScannerModal from './BarcodeScannerModal';
import MobileScannerModal from './MobileScannerModal';
import VendorsDirectory from './purchase/VendorsDirectory';
import DebitNoteManager from './purchase/DebitNoteManager';
import ItemsInventoryHub from './items/ItemsInventoryHub';
import ErrorBoundary from './ErrorBoundary';
import { renderPdfFirstPageToImage } from '../lib/pdfToImage';
import dualOcrPipeline from '../lib/dualOcrPipeline';
import useRealtimeSubscription from '../hooks/useRealtimeSubscription';
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

/**
 * Pure Mathematical Calculation Engine for Purchase Inward Line Items
 * Computes:
 * 1. Gross Line Amount = qty * rate
 * 2. Line Discount = discount_type === '%' ? (Gross * disc / 100) : disc
 * 3. Line Taxable Base = Gross - Line Discount
 * 4. CGST = Line Taxable Base * (gst_pct / 2) / 100
 * 5. SGST = Line Taxable Base * (gst_pct / 2) / 100
 * 6. Line Total = Line Taxable Base + CGST + SGST + CESS
 * 7. Landing Cost (Net Unit Cost) = Line Total / qty
 * 8. Margin ₹ = MRP - Landing Cost
 * 9. Margin % = (Margin ₹ / MRP) * 100
 */
export function calculateLineItem(item, manualTaxable = false) {
  const qty = Math.max(1, Number(item.quantity ?? item.qty) || 1);
  const rate = Math.max(0, Number(item.rate ?? item.price_before_gst ?? item.purchase_price) || 0);
  const discType = item.discount_type === '₹' ? '₹' : '%';
  const discVal = Math.max(0, Number(item.discount_value ?? item.discount_pct ?? item.discount) || 0);

  // 1. Gross Line Amount = qty * rate
  const gross = +(qty * rate).toFixed(2);

  // 2. Line Discount = discount_type === '%' ? (Gross * disc / 100) : disc
  const discAmt = discType === '%'
    ? +((gross * (discVal / 100))).toFixed(2)
    : Math.min(gross, +discVal.toFixed(2));

  // 3. Line Taxable Base = Gross Line Amount - Line Discount
  const taxable = manualTaxable && item.taxable_amount !== undefined
    ? Math.max(0, Number(item.taxable_amount) || 0)
    : Math.max(0, +(gross - discAmt).toFixed(2));

  // 4 & 5. Enforce fallback summing: Total GST% = CGST% + SGST% (e.g. 2.5% + 2.5% = 5%)
  const cgst = Number(item.cgst_pct || item.cgst || 0);
  const sgst = Number(item.sgst_pct || item.sgst || 0);
  const igst = Number(item.igst_pct || item.igst || 0);
  let gstPct = Number(item.gst_percentage ?? item.gst_rate ?? item.gst_pct ?? 0);
  if (gstPct === 0 && (cgst > 0 || sgst > 0)) {
    gstPct = +(cgst + sgst).toFixed(2);
  } else if (gstPct === 0 && igst > 0) {
    gstPct = igst;
  }

  const cgstPct = cgst > 0 ? cgst : +(gstPct / 2).toFixed(2);
  const sgstPct = sgst > 0 ? sgst : +(gstPct / 2).toFixed(2);
  const cgstAmt = +((taxable * (cgstPct / 100))).toFixed(2);
  const sgstAmt = +((taxable * (sgstPct / 100))).toFixed(2);

  // 6. Line Total = Line Taxable Base + CGST + SGST + CESS
  const cessAmt = Math.max(0, Number(item.cess_amount ?? item.cess) || 0);
  const lineTotal = +(taxable + cgstAmt + sgstAmt + cessAmt).toFixed(2);

  // 7. Landing Cost (Net Unit Cost)
  const landedCost = qty > 0 ? +((lineTotal / qty)).toFixed(2) : lineTotal;

  // 8. Margin (₹ and %)
  const mrp = Number(item.mrp) || 0;
  const marginAmount = +(mrp - landedCost).toFixed(2);
  const marginPercentage = mrp > 0 ? +((marginAmount / mrp) * 100).toFixed(2) : 0;

  return {
    ...item,
    quantity: qty,
    qty,
    rate,
    price_before_gst: rate,
    purchase_price: rate,
    discount_type: discType,
    discount_value: discVal,
    discount: discAmt,
    discount_amount: discAmt,
    taxable_amount: taxable,
    taxable,
    gst_pct: gstPct,
    gst_rate: gstPct,
    gst_percentage: gstPct,
    cgst_pct: cgstPct,
    cgst_amount: cgstAmt,
    sgst_pct: sgstPct,
    sgst_amount: sgstAmt,
    igst_pct: igst,
    cess_pct: Number(item.cess_pct) || 0,
    cess_amount: cessAmt,
    cess: cessAmt,
    total_amount: lineTotal,
    price_after_gst: lineTotal,
    total: lineTotal,
    landing_cost: landedCost,
    landed_cost: landedCost,
    landed_cost_per_unit: landedCost,
    mrp,
    margin_amount: marginAmount,
    margin_percentage: marginPercentage,
    margin_pct: marginPercentage
  };
}

/**
 * Standardized Margin Badge Renderer
 * - Green badge if Margin > 15% (e.g. +₹18.50 (22.5%))
 * - Yellow badge if Margin between 5% and 15%
 * - Red alert pill if Landing Cost > MRP (Negative margin/Loss warning)
 */
export function renderMarginBadge(mrp, landingCost, marginAmount, marginPercentage) {
  const m = Number(mrp) || 0;
  const lc = Number(landingCost) || 0;
  const diff = marginAmount !== undefined && !isNaN(Number(marginAmount))
    ? Number(marginAmount)
    : +(m - lc).toFixed(2);
  const pct = marginPercentage !== undefined && !isNaN(Number(marginPercentage))
    ? Number(marginPercentage)
    : (m > 0 ? +((diff / m) * 100).toFixed(1) : 0);

  if (m <= 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono text-[10px]" title="Set MRP to calculate margin">
        Set MRP
      </span>
    );
  }

  // Red alert pill if Landing Cost > MRP (Negative margin/Loss warning)
  if (lc > m || diff < 0) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold font-mono text-[11px] shadow-sm animate-pulse"
        title={`Warning: Loss of ₹${Math.abs(diff).toFixed(2)} per unit! Landing cost exceeds MRP.`}
      >
        <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
        <span>Loss: -₹{Math.abs(diff).toFixed(2)} ({pct.toFixed(1)}%)</span>
      </span>
    );
  }

  // Green badge if Margin > 15%
  if (pct > 15) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 font-bold font-mono text-[11px] shadow-sm"
        title={`Healthy Profit Margin: ₹${diff.toFixed(2)} (${pct.toFixed(1)}%)`}
      >
        +₹{diff.toFixed(2)} ({pct.toFixed(1)}%)
      </span>
    );
  }

  // Yellow badge if Margin between 5% and 15%
  if (pct >= 5) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/35 text-amber-300 font-bold font-mono text-[11px] shadow-sm"
        title={`Moderate Margin: ₹${diff.toFixed(2)} (${pct.toFixed(1)}%)`}
      >
        +₹{diff.toFixed(2)} ({pct.toFixed(1)}%)
      </span>
    );
  }

  // Low Margin (0% to 5%)
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px] shadow-sm"
      title={`Low Margin: ₹${diff.toFixed(2)} (${pct.toFixed(1)}%)`}
    >
      +₹{diff.toFixed(2)} ({pct.toFixed(1)}%)
    </span>
  );
}

export default function PurchaseInwardHub({
  onBackToHub,
  showToast = () => {},
  initialTab = 'new'
}) {
  // Navigation: 'new' | 'history' | 'vendors' | 'debit_notes' | 'items'
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Ledger / Invoices History State
  const [invoicesHistory, setInvoicesHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Side-by-Side Document & Ledger Drawer Modal State
  const [selectedLedgerInvoice, setSelectedLedgerInvoice] = useState(null);

  // Live Realtime Subscriptions for purchase_invoices and purchase_items
  useRealtimeSubscription({
    table: ['purchase_invoices', 'purchase_items'],
    onInsert: (newRecord, { table }) => {
      if (table === 'purchase_invoices') {
        setInvoicesHistory((prev) => {
          if (prev.some((inv) => inv.id === newRecord.id)) return prev;
          return [newRecord, ...prev];
        });
        loadHistory();
      } else if (table === 'purchase_items') {
        const invId = newRecord.purchase_invoice_id || newRecord.invoice_id;
        setInvoicesHistory((prev) =>
          prev.map((inv) => {
            if (inv.id === invId) {
              const curItems = inv.purchase_items || inv.items || [];
              const exists = curItems.some((it) => it.id === newRecord.id);
              return {
                ...inv,
                purchase_items: exists
                  ? curItems.map((it) => (it.id === newRecord.id ? { ...it, ...newRecord } : it))
                  : [newRecord, ...curItems]
              };
            }
            return inv;
          })
        );
        setSelectedLedgerInvoice((prev) => {
          if (!prev || prev.id !== invId) return prev;
          const curItems = prev.purchase_items || prev.items || [];
          const exists = curItems.some((it) => it.id === newRecord.id);
          return {
            ...prev,
            purchase_items: exists
              ? curItems.map((it) => (it.id === newRecord.id ? { ...it, ...newRecord } : it))
              : [newRecord, ...curItems]
          };
        });
      }
    },
    onUpdate: (updatedRecord, { table }) => {
      if (table === 'purchase_invoices') {
        setInvoicesHistory((prev) =>
          prev.map((inv) => (inv.id === updatedRecord.id ? { ...inv, ...updatedRecord } : inv))
        );
        setSelectedLedgerInvoice((prev) =>
          prev?.id === updatedRecord.id ? { ...prev, ...updatedRecord } : prev
        );
      } else if (table === 'purchase_items') {
        const invId = updatedRecord.purchase_invoice_id || updatedRecord.invoice_id;
        setInvoicesHistory((prev) =>
          prev.map((inv) => {
            if (inv.id === invId) {
              const curItems = inv.purchase_items || inv.items || [];
              return {
                ...inv,
                purchase_items: curItems.map((it) => (it.id === updatedRecord.id ? { ...it, ...updatedRecord } : it))
              };
            }
            return inv;
          })
        );
        setSelectedLedgerInvoice((prev) => {
          if (!prev || prev.id !== invId) return prev;
          const curItems = prev.purchase_items || prev.items || [];
          return {
            ...prev,
            purchase_items: curItems.map((it) => (it.id === updatedRecord.id ? { ...it, ...updatedRecord } : it))
          };
        });
      }
    },
    onDelete: (deletedRecord, { table }) => {
      const delId = deletedRecord?.id;
      if (!delId) return;
      if (table === 'purchase_invoices') {
        setInvoicesHistory((prev) => prev.filter((inv) => inv.id !== delId));
        setSelectedLedgerInvoice((prev) => (prev?.id === delId ? null : prev));
      } else if (table === 'purchase_items') {
        setInvoicesHistory((prev) =>
          prev.map((inv) => {
            const curItems = inv.purchase_items || inv.items || [];
            return {
              ...inv,
              purchase_items: curItems.filter((it) => it.id !== delId)
            };
          })
        );
        setSelectedLedgerInvoice((prev) => {
          if (!prev) return prev;
          const curItems = prev.purchase_items || prev.items || [];
          return {
            ...prev,
            purchase_items: curItems.filter((it) => it.id !== delId)
          };
        });
      }
    }
  });
  const [ledgerDocZoom, setLedgerDocZoom] = useState(1);
  const [ledgerDocRotation, setLedgerDocRotation] = useState(0);
  const [isDocPanelCollapsed, setIsDocPanelCollapsed] = useState(false);
  const [isDocPanelExpanded, setIsDocPanelExpanded] = useState(false);
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

  // Invoice-Level Discount State & Verification Controls
  const [invoiceDiscountPct, setInvoiceDiscountPct] = useState('');
  const [invoiceDiscountAmount, setInvoiceDiscountAmount] = useState('');
  const [globalDiscountType, setGlobalDiscountType] = useState('pre_tax'); // 'pre_tax' | 'post_tax'
  const [vendorPrintedGrandTotal, setVendorPrintedGrandTotal] = useState(null);

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
    setOcrStatusMessage(`Running Gemini Vision OCR on "${billItem.name || 'Selected Bill'}"...`);

    const imgPreview = billItem.dataUrl || billItem.image_url;
    setBillPreviewUrl(imgPreview);

    try {
      let base64 = billItem.base64;
      if (!base64 && (billItem.image_url || billItem.dataUrl)) {
        setOcrStatusMessage('Fetching full-resolution bill image for Vision OCR...');
        base64 = await getBase64FromUrl(billItem.image_url || billItem.dataUrl);
      }

      if (!base64) {
        throw new Error('Could not access image data for Vision OCR.');
      }

      setBillBase64(base64);
      setOcrStatusMessage('Extracting invoice header & line items via Gemini Vision...');

      const parsed = await dualOcrPipeline.processBill(base64, {
        mimeType: billItem.mimeType || 'image/jpeg'
      });
      setRawOcrData(parsed);

      // Populate Editable Header Fields (Priority to standard schema with fallback to nested)
      const vendorName = parsed.vendor_name || parsed.seller?.name || '';
      const vendorGstin = parsed.vendor_gstin || parsed.gstin || parsed.seller?.gst || '';
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

      // Auto-populate Invoice-Level Discount from OCR
      const rawDiscountAmt = Number(parsed.discount_amount ?? parsed.discount ?? parsed.totals?.discount_total) || 0;
      const rawDiscountPct = Number(parsed.discount_pct ?? parsed.totals?.discount_pct) || 0;

      // Extract vendor printed grand total strictly for validation & discrepancy verification
      const rawVendorGrand = Number(
        parsed.vendor_grand_total ??
        parsed.grand_total ??
        parsed.invoice?.grand_total ??
        parsed.totals?.grand_total
      );
      setVendorPrintedGrandTotal(!isNaN(rawVendorGrand) && rawVendorGrand > 0 ? rawVendorGrand : null);

      const parsedItemsList = Array.isArray(parsed.items) ? parsed.items : [];
      let parsedGrossSum = 0;
      parsedItemsList.forEach((it) => {
        const q = Math.max(0, Number(it.qty ?? it.quantity) || 1);
        const r = Math.max(0, Number(it.rate ?? it.purchase_price ?? it.price_before_gst) || 0);
        parsedGrossSum += q * r;
      });

      if (rawDiscountAmt > 0) {
        setInvoiceDiscountAmount(String(rawDiscountAmt));
        const computedPct = rawDiscountPct > 0
          ? rawDiscountPct
          : (parsedGrossSum > 0 ? +((rawDiscountAmt / parsedGrossSum) * 100).toFixed(2) : 0);
        setInvoiceDiscountPct(computedPct > 0 ? String(computedPct) : '');
      } else if (rawDiscountPct > 0) {
        setInvoiceDiscountPct(String(rawDiscountPct));
        const computedAmt = parsedGrossSum > 0 ? +((parsedGrossSum * (rawDiscountPct / 100))).toFixed(2) : 0;
        setInvoiceDiscountAmount(computedAmt > 0 ? String(computedAmt) : '');
      } else {
        setInvoiceDiscountAmount('');
        setInvoiceDiscountPct('');
      }

      // Populate Line Items with detailed GST fields & pure arithmetic calculation
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        setItems(
          parsed.items.map((it, idx) => {
            const sn = Number(it.sn) || (idx + 1);
            const qty = Math.max(1, Number(it.qty ?? it.quantity) || 1);
            const rate = Math.max(0, Number(it.rate ?? it.purchase_price ?? it.price_before_gst) || 0);

            // Extract explicitly printed line discount (percentage or flat amount)
            const extractedDiscPct = Number(it.discount_pct || it.discount || 0);
            const extractedDiscAmount = Number(it.discount_amount || 0);

            let discType = '%';
            let discVal = 0;
            if (extractedDiscPct > 0) {
              discType = '%';
              discVal = extractedDiscPct;
            } else if (extractedDiscAmount > 0) {
              discType = '₹';
              discVal = extractedDiscAmount;
            }

            const hsnCode = (it.hsn ?? it.hsn_code ?? '').toString().trim();
            const rawBarcode = (it.barcode || '').toString().trim();
            // Discard barcode if it matches HSN or is less than 12 digits
            const cleanBarcode = (rawBarcode && rawBarcode !== hsnCode && rawBarcode.length >= 12) ? rawBarcode : '';

            // Split tax columns & GST extraction logic (Stop defaulting to 18%)
            const cgst = Number(it.cgst_pct || it.cgst || 0);
            const sgst = Number(it.sgst_pct || it.sgst || 0);
            const igst = Number(it.igst_pct || it.igst || 0);
            let totalGst = Number(it.gst_pct ?? it.gst_percentage ?? it.gst_rate ?? 0);
            if (totalGst === 0 && (cgst > 0 || sgst > 0)) {
              totalGst = +(cgst + sgst).toFixed(2);
            } else if (totalGst === 0 && igst > 0) {
              totalGst = igst;
            }

            const rawItem = {
              id: `temp_${Date.now()}_${idx}`,
              sn,
              barcode: cleanBarcode,
              item_name: (it.name || it.item_name || it.description || `Item ${sn}`).toString().trim(),
              hsn_code: hsnCode,
              hsn: hsnCode,
              unit: (it.unit || 'PCS').toString().toUpperCase().trim(),
              quantity: qty,
              mrp: Number(it.mrp) || +(rate * 1.25).toFixed(2),
              rate: rate,
              discount_pct: extractedDiscPct,
              discount_type: discType,
              discount_value: discVal,
              gst_pct: totalGst,
              gst_rate: totalGst,
              gst_percentage: totalGst,
              cgst_pct: cgst,
              sgst_pct: sgst,
              igst_pct: igst,
              cess_amount: Number(it.cess_amount ?? it.cess) || 0
            };

            // Pure arithmetic calculation engine - independent of printed line totals
            return calculateLineItem(rawItem);
          })
        );
      } else {
        setItems([
          calculateLineItem({
            id: `temp_${Date.now()}`,
            barcode: '',
            item_name: 'New Product Item',
            hsn_code: '2201',
            unit: 'PCS',
            quantity: 1,
            mrp: 100,
            rate: 70,
            discount_type: '%',
            discount_value: 0,
            gst_pct: 0,
            cess_amount: 0
          })
        ]);
      }

      setBillQueue((prev) =>
        (prev || []).map((b) => (b.id === billItem.id ? { ...b, extracted: true } : b))
      );

      showToast(`⚡ Bill "${billItem.name || 'Mobile Snap'}" extracted successfully via Gemini Vision!`, 'success');

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

  // Recalculate row totals with pure arithmetic engine
  const handleItemFieldChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: value };
      const isManualTaxable = field === 'taxable_amount';
      next[index] = calculateLineItem(target, isManualTaxable);
      return next;
    });
  };

  // Add Item Row
  const handleAddItemRow = () => {
    setItems((prev) => [
      ...prev,
      calculateLineItem({
        id: `row_${Date.now()}`,
        barcode: '',
        item_name: '',
        hsn_code: '',
        unit: 'PCS',
        quantity: 1,
        mrp: 0,
        rate: 0,
        discount_type: '%',
        discount_value: 0,
        gst_pct: 0,
        cess_amount: 0
      })
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

  // Linked Global Discount Input Handlers
  const handleDiscountPctChange = (val) => {
    setInvoiceDiscountPct(val);
    const pct = parseFloat(val);
    const base = globalDiscountType === 'pre_tax' ? preTaxBase : (preTaxBase + totalCgst + totalSgst + totalCess);
    if (!isNaN(pct) && base > 0) {
      const calculatedAmt = +((base * (pct / 100))).toFixed(2);
      setInvoiceDiscountAmount(calculatedAmt > 0 ? String(calculatedAmt) : '');
    } else if (!val) {
      setInvoiceDiscountAmount('');
    }
  };

  const handleDiscountAmountChange = (val) => {
    setInvoiceDiscountAmount(val);
    const amt = parseFloat(val);
    const base = globalDiscountType === 'pre_tax' ? preTaxBase : (preTaxBase + totalCgst + totalSgst + totalCess);
    if (!isNaN(amt) && base > 0) {
      const calculatedPct = +(((amt / base) * 100)).toFixed(2);
      setInvoiceDiscountPct(calculatedPct > 0 ? String(calculatedPct) : '');
    } else if (!val) {
      setInvoiceDiscountPct('');
    }
  };

  // Calculations for Totals Card, Flexible Global Discount & Indian GST Invoice Verification
  const {
    grossSubtotal,
    totalLineDiscounts,
    preTaxBase,
    discountAmountNum,
    discountPctNum,
    totalTaxable,
    totalCgst,
    totalSgst,
    totalCess,
    totalTax,
    subtotal,
    rawTotal,
    roundOff,
    grandTotal,
    hasDiscrepancy,
    discrepancy
  } = useMemo(() => {
    let gross = 0;
    let lineDiscountsSum = 0;
    let cessSum = 0;
    let sumLineCgst = 0;
    let sumLineSgst = 0;
    let sumLineTaxable = 0;

    (items || []).forEach((it) => {
      if (!it) return;
      const q = Math.max(0, Number(it.quantity ?? it.qty) || 1);
      const r = Math.max(0, Number(it.rate ?? it.price_before_gst ?? it.purchase_price) || 0);
      const lineGross = +(q * r).toFixed(2);
      gross += lineGross;

      const lineDisc = Number(it.discount_amount ?? it.discount) || 0;
      lineDiscountsSum += lineDisc;

      const taxable = Number(it.taxable_amount) || Math.max(0, +(lineGross - lineDisc).toFixed(2));
      sumLineTaxable += taxable;

      sumLineCgst += Number(it.cgst_amount) || 0;
      sumLineSgst += Number(it.sgst_amount) || 0;
      cessSum += Number(it.cess_amount || it.cess) || 0;
    });

    const cleanGross = +gross.toFixed(2);
    const cleanLineDiscounts = +lineDiscountsSum.toFixed(2);
    const cleanPreTaxBase = +sumLineTaxable.toFixed(2);

    // Global Discount Calculation
    let globalDiscAmt = parseFloat(invoiceDiscountAmount) || 0;
    let globalDiscPct = parseFloat(invoiceDiscountPct) || 0;

    let netTaxable = cleanPreTaxBase;
    let cgstFinal = 0;
    let sgstFinal = 0;
    let rawTot = 0;

    if (globalDiscountType === 'pre_tax') {
      // PRE-TAX TRADE DISCOUNT:
      // Applied on pre-tax taxable base BEFORE GST is calculated
      const discountBase = cleanPreTaxBase > 0 ? cleanPreTaxBase : cleanGross;

      if (globalDiscAmt === 0 && globalDiscPct > 0 && discountBase > 0) {
        globalDiscAmt = +((discountBase * (globalDiscPct / 100))).toFixed(2);
      } else if (globalDiscAmt > 0 && globalDiscPct === 0 && discountBase > 0) {
        globalDiscPct = +(((globalDiscAmt / discountBase) * 100)).toFixed(2);
      }
      globalDiscAmt = Math.min(discountBase, Math.max(0, globalDiscAmt));

      netTaxable = Math.max(0, +(discountBase - globalDiscAmt).toFixed(2));

      // Compute CGST and SGST on reduced net taxable base
      let effectiveCgstRate = 0.025;
      let effectiveSgstRate = 0.025;
      if (cleanPreTaxBase > 0) {
        effectiveCgstRate = sumLineCgst / cleanPreTaxBase;
        effectiveSgstRate = sumLineSgst / cleanPreTaxBase;
      }
      cgstFinal = +((netTaxable * effectiveCgstRate)).toFixed(2);
      sgstFinal = +((netTaxable * effectiveSgstRate)).toFixed(2);

      // If no global discount, preserve exact sum of line CGST & SGST
      if (globalDiscAmt === 0) {
        cgstFinal = +sumLineCgst.toFixed(2);
        sgstFinal = +sumLineSgst.toFixed(2);
      }

      rawTot = +(netTaxable + cgstFinal + sgstFinal + cessSum).toFixed(2);
    } else {
      // POST-TAX / CASH DISCOUNT (CD):
      // GST computed on FULL taxable base, discount subtracted directly from (Taxable + Tax)
      netTaxable = cleanPreTaxBase;
      cgstFinal = +sumLineCgst.toFixed(2);
      sgstFinal = +sumLineSgst.toFixed(2);
      const postTaxSum = +(netTaxable + cgstFinal + sgstFinal + cessSum).toFixed(2);

      if (globalDiscAmt === 0 && globalDiscPct > 0 && postTaxSum > 0) {
        globalDiscAmt = +((postTaxSum * (globalDiscPct / 100))).toFixed(2);
      } else if (globalDiscAmt > 0 && globalDiscPct === 0 && postTaxSum > 0) {
        globalDiscPct = +(((globalDiscAmt / postTaxSum) * 100)).toFixed(2);
      }
      globalDiscAmt = Math.min(postTaxSum, Math.max(0, globalDiscAmt));

      rawTot = Math.max(0, +(postTaxSum - globalDiscAmt).toFixed(2));
    }

    const cessFinal = +cessSum.toFixed(2);
    const taxFinal = +(cgstFinal + sgstFinal + cessFinal).toFixed(2);

    let grandTot = Math.round(rawTot);
    // If vendor printed total is available and within standard rounding off (<= ₹1.00), match printed total
    if (vendorPrintedGrandTotal !== null && vendorPrintedGrandTotal > 0 && Math.abs(vendorPrintedGrandTotal - rawTot) <= 1.0) {
      grandTot = vendorPrintedGrandTotal;
    }

    const roundOffAmt = +(grandTot - rawTot).toFixed(2);

    // Verification check against vendor's printed grand total
    const diff = vendorPrintedGrandTotal !== null && vendorPrintedGrandTotal > 0
      ? +(grandTot - vendorPrintedGrandTotal).toFixed(2)
      : 0;
    const isDiscrepant = vendorPrintedGrandTotal !== null && vendorPrintedGrandTotal > 0 && Math.abs(diff) > 1.0;

    return {
      grossSubtotal: cleanGross,
      totalLineDiscounts: cleanLineDiscounts,
      preTaxBase: cleanPreTaxBase,
      discountAmountNum: globalDiscAmt,
      discountPctNum: globalDiscPct,
      totalTaxable: netTaxable,
      totalCgst: cgstFinal,
      totalSgst: sgstFinal,
      totalCess: cessFinal,
      totalTax: taxFinal,
      subtotal: cleanGross,
      rawTotal: rawTot,
      roundOff: roundOffAmt,
      grandTotal: grandTot,
      hasDiscrepancy: isDiscrepant,
      discrepancy: diff
    };
  }, [items, invoiceDiscountAmount, invoiceDiscountPct, globalDiscountType, vendorPrintedGrandTotal]);

  // Direct Column Totals for Table <tfoot> Row
  const tableColumnTotals = useMemo(() => {
    let qtySum = 0;
    let discountSum = 0;
    let taxableSum = 0;
    let cgstSum = 0;
    let sgstSum = 0;
    let cessSum = 0;
    let grossSum = 0;

    (items || []).forEach((it) => {
      if (!it) return;
      const q = Math.max(0, Number(it.quantity ?? it.qty) || 0);
      const r = Math.max(0, Number(it.rate ?? it.price_before_gst ?? it.purchase_price) || 0);
      const disc = Number(it.discount_amount ?? it.discount) || 0;
      const taxable = Number(it.taxable_amount) || Math.max(0, +((q * r) - disc).toFixed(2));
      const cgst = Number(it.cgst_amount) || 0;
      const sgst = Number(it.sgst_amount) || 0;
      const cess = Number(it.cess_amount || it.cess) || 0;
      const gross = Number(it.total_amount ?? it.price_after_gst) || 0;

      qtySum += q;
      discountSum += disc;
      taxableSum += taxable;
      cgstSum += cgst;
      sgstSum += sgst;
      cessSum += cess;
      grossSum += gross;
    });

    return {
      qtySum,
      discountSum: +discountSum.toFixed(2),
      taxableSum: +taxableSum.toFixed(2),
      cgstSum: +cgstSum.toFixed(2),
      sgstSum: +sgstSum.toFixed(2),
      cessSum: +cessSum.toFixed(2),
      grossSum: +grossSum.toFixed(2)
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
        subtotal: grossSubtotal,
        gross_subtotal: grossSubtotal,
        discount_amount: discountAmountNum,
        discount_pct: discountPctNum,
        discount: discountAmountNum,
        global_discount_type: globalDiscountType,
        round_off_amount: roundOff,
        round_off: roundOff,
        total_taxable_amount: totalTaxable,
        total_tax_amount: totalTax,
        grand_total: grandTotal,
        vendor_grand_total: vendorPrintedGrandTotal,
        has_discrepancy: hasDiscrepancy,
        discrepancy: discrepancy,
        bill_image_url: uniqueBillUrls[0] || billPreviewUrl || '',
        bill_image_urls: uniqueBillUrls,
        vendor_details: sellerData,
        tax_summary: {
          gross_subtotal: grossSubtotal,
          total_line_discounts: totalLineDiscounts,
          pre_tax_base: preTaxBase,
          discount_amount: discountAmountNum,
          discount_pct: discountPctNum,
          discount_type: globalDiscountType,
          total_taxable: totalTaxable,
          total_cgst: totalCgst,
          total_sgst: totalSgst,
          total_cess: totalCess,
          total_tax: totalTax,
          subtotal: grossSubtotal,
          round_off: roundOff,
          grand_total: grandTotal,
          vendor_grand_total: vendorPrintedGrandTotal,
          has_discrepancy: hasDiscrepancy,
          discrepancy: discrepancy
        },
        status: 'verified'
      };

      if (rawOcrData && typeof rawOcrData === 'object' && Object.keys(rawOcrData).length > 0) {
        invoicePayload.raw_ocr_data = rawOcrData;
        invoicePayload.extracted_json = rawOcrData;
      }

      // Format items with detailed GST fields & unit for purchase_items & inventory sync
      const formattedItems = (items || []).map((it) => {
        const qty = Math.max(1, Number(it.quantity ?? it.qty) || 1);
        const rate = Math.max(0, Number(it.rate ?? it.price_before_gst ?? it.purchase_price) || 0);
        const disc = Number(it.discount_amount ?? it.discount) || 0;
        const taxable = Number(it.taxable_amount ?? it.taxable) || Math.max(0, (qty * rate) - disc);
        const cgst = Number(it.cgst_pct || 0);
        const sgst = Number(it.sgst_pct || 0);
        const igst = Number(it.igst_pct || 0);
        let gstRate = Number(it.gst_pct ?? it.gst_rate ?? it.gst_percentage ?? 0);
        if (gstRate === 0 && (cgst > 0 || sgst > 0)) {
          gstRate = +(cgst + sgst).toFixed(2);
        } else if (gstRate === 0 && igst > 0) {
          gstRate = igst;
        }

        const cgstPct = cgst > 0 ? cgst : +(gstRate / 2).toFixed(2);
        const sgstPct = sgst > 0 ? sgst : +(gstRate / 2).toFixed(2);
        const cgstAmt = Number(it.cgst_amount) || +((taxable * (cgstPct / 100))).toFixed(2);
        const sgstAmt = Number(it.sgst_amount) || +((taxable * (sgstPct / 100))).toFixed(2);
        const cessAmt = Number(it.cess_amount ?? it.cess) || 0;
        const cessPct = Number(it.cess_pct) || 0;
        const total = Number(it.total_amount ?? it.price_after_gst ?? it.total) || +((taxable + cgstAmt + sgstAmt + cessAmt)).toFixed(2);
        const landedCost = qty > 0 ? +((total / qty)).toFixed(2) : total;

        const mrp = Number(it.mrp) || 0;
        const marginAmount = +(mrp - landedCost).toFixed(2);
        const marginPercentage = mrp > 0 ? +((marginAmount / mrp) * 100).toFixed(2) : 0;

        return {
          ...it,
          barcode: (it.barcode || '').toString().trim() || null,
          item_name: (it.item_name || 'Item').toString().trim(),
          hsn_code: (it.hsn_code || '').toString().trim() || null,
          unit: (it.unit || 'PCS').toString().toUpperCase().trim(),
          quantity: qty,
          qty: qty,
          purchase_price: rate,
          rate: rate,
          price_before_gst: rate,
          discount_type: it.discount_type || '%',
          discount_value: Number(it.discount_value) || 0,
          discount: disc,
          discount_amount: disc,
          taxable_amount: taxable,
          taxable: taxable,
          gst_pct: gstRate,
          gst_rate: gstRate,
          gst_percentage: gstRate,
          cgst_pct: cgstPct,
          cgst_amount: cgstAmt,
          sgst_pct: sgstPct,
          sgst_amount: sgstAmt,
          igst_pct: igst,
          cess_pct: cessPct,
          cess_amount: cessAmt,
          cess: cessAmt,
          price_after_gst: total,
          total_amount: total,
          total: total,
          landing_cost: landedCost,
          landed_cost: landedCost,
          landed_cost_per_unit: landedCost,
          mrp,
          margin_amount: marginAmount,
          margin_percentage: marginPercentage,
          margin_pct: marginPercentage
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
    setInvoiceDiscountAmount('');
    setInvoiceDiscountPct('');
    setGlobalDiscountType('pre_tax');
    setVendorPrintedGrandTotal(null);
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
        {/* LEFT COLUMN: NARROW NAVIGATION SIDEBAR (250px - 280px / 64px Collapsed) */}
        {/* ======================================================== */}
        <aside
          className={`w-full bg-slate-950/90 border-b lg:border-b-0 lg:border-r border-slate-800 shrink-0 flex flex-col justify-between transition-all duration-200 ${
            isSidebarCollapsed ? 'lg:w-16 p-2' : 'lg:w-64 xl:w-72 p-4'
          }`}
        >
          <div className="space-y-4">
            {/* Top Row: Back to Admin Hub + Collapse/Expand Toggle */}
            <div className={`flex items-center ${isSidebarCollapsed ? 'flex-col gap-2' : 'gap-2'}`}>
              {onBackToHub && (
                <button
                  type="button"
                  onClick={onBackToHub}
                  className={`flex-1 flex items-center ${
                    isSidebarCollapsed ? 'w-full justify-center p-2' : 'gap-2 px-3 py-2'
                  } rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition text-xs font-semibold cursor-pointer shadow-sm`}
                  title="Back to Admin Hub"
                >
                  <ArrowLeft className="w-4 h-4 text-amber-400 shrink-0" />
                  {!isSidebarCollapsed && <span>← Back to Admin Hub</span>}
                </button>
              )}

              {/* Sidebar Collapse/Expand Toggle Button */}
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                className={`hidden lg:flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer shadow-sm ${
                  isSidebarCollapsed ? 'w-full p-2' : 'p-2 shrink-0'
                }`}
                title={isSidebarCollapsed ? 'Expand Sidebar (»)' : 'Collapse Sidebar («)'}
                aria-label={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-amber-400" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Brand Header */}
            {isSidebarCollapsed ? (
              <div
                className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md"
                title="Purchase Hub - Enterprise Inward & Sync"
              >
                <FileSpreadsheet className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 border border-amber-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h1 className="text-sm font-black text-white tracking-wide">Purchase Hub</h1>
                    <span className="text-[10px] font-semibold text-amber-400/90">Enterprise Inward & Sync</span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <nav className="space-y-1 text-xs font-bold">
              {/* Tab 1: Add New Purchase */}
              <button
                type="button"
                onClick={() => setActiveTab('new')}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5'
                } rounded-xl transition text-left cursor-pointer relative ${
                  activeTab === 'new'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
                title="Add New Purchase"
              >
                <div className={`flex items-center ${isSidebarCollapsed ? '' : 'gap-2.5'}`}>
                  <Plus className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>📥 Add New Purchase</span>}
                </div>
                {billQueue.length > 0 && (
                  isSidebarCollapsed ? (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center shadow">
                      {billQueue.length}
                    </span>
                  ) : (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        activeTab === 'new' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {billQueue.length}
                    </span>
                  )
                )}
              </button>

              {/* Tab 2: Invoices Ledger */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('history');
                  loadHistory();
                }}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5'
                } rounded-xl transition text-left cursor-pointer relative ${
                  activeTab === 'history'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
                title={`Invoices Ledger (${invoicesHistory.length})`}
              >
                <div className={`flex items-center ${isSidebarCollapsed ? '' : 'gap-2.5'}`}>
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>📜 Invoices Ledger</span>}
                </div>
                {isSidebarCollapsed ? (
                  invoicesHistory.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-slate-800 text-slate-300 text-[9px] font-bold border border-slate-700 flex items-center justify-center">
                      {invoicesHistory.length}
                    </span>
                  )
                ) : (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      activeTab === 'history' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {invoicesHistory.length}
                  </span>
                )}
              </button>

              {/* Tab 3: Item & Stock Master */}
              <button
                type="button"
                onClick={() => setActiveTab('items')}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5'
                } rounded-xl transition text-left cursor-pointer ${
                  activeTab === 'items'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
                title="Item & Stock Master (Live)"
              >
                <div className={`flex items-center ${isSidebarCollapsed ? '' : 'gap-2.5'}`}>
                  <Package className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>📦 Item & Stock Master</span>}
                </div>
                {!isSidebarCollapsed && <span className="text-[10px] font-semibold text-emerald-400">Live</span>}
              </button>

              {/* Tab 4: Vendors Directory */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('vendors');
                  loadVendors();
                }}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5'
                } rounded-xl transition text-left cursor-pointer relative ${
                  activeTab === 'vendors'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
                title={`Vendors Directory (${vendorsList.length})`}
              >
                <div className={`flex items-center ${isSidebarCollapsed ? '' : 'gap-2.5'}`}>
                  <Building2 className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>🏢 Vendors Directory</span>}
                </div>
                {isSidebarCollapsed ? (
                  vendorsList.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-slate-800 text-slate-300 text-[9px] font-bold border border-slate-700 flex items-center justify-center">
                      {vendorsList.length}
                    </span>
                  )
                ) : (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      activeTab === 'vendors' ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {vendorsList.length}
                  </span>
                )}
              </button>

              {/* Tab 5: Sale Return / Debit Note */}
              <button
                type="button"
                onClick={() => setActiveTab('debit_notes')}
                className={`w-full flex items-center ${
                  isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5'
                } rounded-xl transition text-left cursor-pointer ${
                  activeTab === 'debit_notes'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
                title="Sale Return / Debit Note"
              >
                <div className={`flex items-center ${isSidebarCollapsed ? '' : 'gap-2.5'}`}>
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  {!isSidebarCollapsed && <span>🔄 Sale Return / Debit Note</span>}
                </div>
              </button>
            </nav>
          </div>

          {/* Left Sidebar Footer */}
          {isSidebarCollapsed ? (
            <div className="pt-2 border-t border-slate-900 text-center hidden lg:block" title="Jal Jeevan Enterprise v2.5">
              <span className="font-mono text-[10px] text-emerald-400 font-bold">v2.5</span>
            </div>
          ) : (
            <div className="pt-4 border-t border-slate-900 text-[11px] text-slate-500 space-y-1 hidden lg:block">
              <div className="flex items-center justify-between font-semibold text-slate-400">
                <span>Jal Jeevan Enterprise</span>
                <span className="font-mono text-emerald-400">v2.5</span>
              </div>
              <p className="text-[10px] text-slate-600">
                Permanent archival, Groq Vision OCR & automatic stock syncing.
              </p>
            </div>
          )}
        </aside>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: FLUID WORKSPACE AREA */}
        {/* ======================================================== */}
        <main
          className={`flex-1 min-w-0 p-3 sm:p-5 lg:p-6 overflow-y-auto transition-all duration-200 ${
            isSidebarCollapsed ? 'pl-2 lg:pl-4' : ''
          }`}
        >
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
                        Universal Barcode assignment, HSN codes, Line discounts, Taxable amounts, CGST, SGST and CESS auto-calculations.
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

                  {/* Bill Verification & Discrepancy Alert */}
                  {hasDiscrepancy && (
                    <div className="rounded-xl bg-amber-500/15 border-2 border-amber-500/50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200 shadow-lg">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-amber-300">
                            ⚠️ Bill Discrepancy Detected: Calculated ₹{grandTotal.toFixed(2)} vs Vendor Printed ₹{vendorPrintedGrandTotal.toFixed(2)} (Difference: {discrepancy >= 0 ? `+₹${discrepancy.toFixed(2)}` : `-₹${Math.abs(discrepancy).toFixed(2)}`})
                          </p>
                          <p className="text-[11px] text-amber-400/80 mt-0.5">
                            Independent mathematical tally does not match the vendor's printed bill total. Please check line item rates, quantities, discounts, or tax rates.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVendorPrintedGrandTotal(null)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/30 transition cursor-pointer self-start sm:self-auto shrink-0"
                        title="Dismiss discrepancy warning"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {!hasDiscrepancy && vendorPrintedGrandTotal !== null && vendorPrintedGrandTotal > 0 && (
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 flex items-center justify-between gap-2 text-emerald-300 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          ✓ Bill Verified: Math matches vendor printed total of <strong>₹{vendorPrintedGrandTotal.toFixed(2)}</strong> (Difference: ₹{discrepancy.toFixed(2)})
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-400/70">100% Math Match</span>
                    </div>
                  )}

                  {/* Comprehensive Line Items Table */}
                  <div className="w-full overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/60 shadow-inner">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-900 border-b border-slate-800 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                          <th className="py-2.5 px-2 min-w-[50px] text-center">#</th>
                          <th className="py-2.5 px-2.5 min-w-[150px]">Barcode / EAN</th>
                          <th className="py-2.5 px-2.5 min-w-[280px] w-[320px]">Item Name</th>
                          <th className="py-2.5 px-2 min-w-[75px]">HSN</th>
                          <th className="py-2.5 px-2 min-w-[65px] text-right">Qty</th>
                          <th className="py-2.5 px-2 min-w-[75px]">Unit</th>
                          <th className="py-2.5 px-2 min-w-[75px] text-right">MRP (₹)</th>
                          <th className="py-2.5 px-2 min-w-[80px] text-right">Rate (₹)</th>
                          <th className="py-2.5 px-2 min-w-[110px] text-right">DISC</th>
                          <th className="py-2.5 px-2 min-w-[90px] text-right">Taxable (₹)</th>
                          <th className="py-2.5 px-2 min-w-[75px] text-right">GST %</th>
                          <th className="py-2.5 px-2 min-w-[80px] text-right">CGST (₹)</th>
                          <th className="py-2.5 px-2 min-w-[80px] text-right">SGST (₹)</th>
                          <th className="py-2.5 px-2 min-w-[75px] text-right">CESS (₹)</th>
                          <th className="py-2.5 px-2 min-w-[105px] text-right">Landing Cost</th>
                          <th className="py-2.5 px-2.5 min-w-[145px] text-right">Margin (₹ & %)</th>
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
                              {/* Serial Number (S.No / #) */}
                              <td className="py-2 px-2 min-w-[50px] text-center">
                                <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-slate-800/80 text-slate-300 font-mono font-bold text-[11px] border border-slate-700/50 shadow-inner">
                                  {it.sn || (idx + 1)}
                                </span>
                              </td>

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
                              <td className="py-2 px-2.5 min-w-[280px] w-[320px]">
                                <input
                                  type="text"
                                  value={it.item_name}
                                  onChange={(e) => handleItemFieldChange(idx, 'item_name', e.target.value)}
                                  placeholder="Product Description"
                                  title={it.item_name || it.name || it.description || ''}
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

                              {/* Line-Level Discount (DISC) */}
                              <td className="py-2 px-2 min-w-[110px]">
                                <div className="flex items-center bg-slate-900 border border-slate-800 focus-within:border-emerald-500 rounded-lg overflow-hidden h-8">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={it.discount_value !== undefined && it.discount_value !== 0 ? it.discount_value : ''}
                                    placeholder="0"
                                    onChange={(e) => handleItemFieldChange(idx, 'discount_value', e.target.value)}
                                    className="w-full h-full px-1.5 bg-transparent text-white text-right font-mono text-xs focus:outline-none"
                                    title={it.discount_type === '%' ? `Line Discount: ${it.discount_value || 0}% (₹${Number(it.discount_amount || 0).toFixed(2)})` : `Line Discount: ₹${it.discount_value || 0}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleItemFieldChange(idx, 'discount_type', it.discount_type === '₹' ? '%' : '₹')}
                                    className={`px-1.5 h-full text-[11px] font-bold border-l border-slate-800 transition cursor-pointer select-none shrink-0 ${
                                      it.discount_type === '₹'
                                        ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                                        : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                    }`}
                                    title="Click to toggle between % and ₹"
                                  >
                                    {it.discount_type === '₹' ? '₹' : '%'}
                                  </button>
                                </div>
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
                                  value={it.gst_pct ?? it.gst_rate ?? 0}
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

                              {/* Landing Cost (Net Unit Cost) */}
                              <td className="py-2 px-2 min-w-[105px] text-right font-mono">
                                {(() => {
                                  const lc = Number(it.landing_cost ?? it.landed_cost ?? (it.quantity > 0 ? (it.total_amount ?? it.price_after_gst ?? 0) / it.quantity : 0));
                                  return (
                                    <span
                                      className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] shadow-sm font-mono"
                                      title="Landing Cost per unit = Net Purchase Price + GST + Cess"
                                    >
                                      ₹{lc.toFixed(2)}
                                    </span>
                                  );
                                })()}
                              </td>

                              {/* Margin (₹ and %) */}
                              <td className="py-2 px-2.5 min-w-[145px] text-right font-mono">
                                {(() => {
                                  const lc = Number(it.landing_cost ?? it.landed_cost ?? (it.quantity > 0 ? (it.total_amount ?? it.price_after_gst ?? 0) / it.quantity : 0));
                                  return renderMarginBadge(it.mrp, lc, it.margin_amount, it.margin_percentage);
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
                            <td colSpan="19" className="py-8 text-center text-slate-500">
                              No line items entered yet. Click "Add Line Item" or click "⚡ Process This Bill" from the queue above.
                            </td>
                          </tr>
                        )}
                      </tbody>

                      {/* Dedicated Column Totals Summary Footer */}
                      <tfoot className="bg-slate-900/95 border-t-2 border-emerald-500/50 font-semibold sticky bottom-0 backdrop-blur-sm z-10 shadow-lg">
                        <tr>
                          {/* S.No / Barcode / Item Name / HSN (4 Columns Spanned) */}
                          <td colSpan={4} className="py-2.5 px-3 text-left font-bold text-xs uppercase tracking-wider text-emerald-400">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                              <span>TOTALS {items.length > 0 && `(${items.length} ${items.length === 1 ? 'ITEM' : 'ITEMS'})`}</span>
                            </div>
                          </td>

                          {/* QTY Column */}
                          <td className="py-2.5 px-2 min-w-[65px] text-right font-mono font-bold text-white text-xs">
                            <span className="text-emerald-300 font-black">{tableColumnTotals.qtySum}</span>
                          </td>

                          {/* Unit Column */}
                          <td className="py-2.5 px-2 min-w-[75px] text-center text-slate-500">—</td>

                          {/* MRP Column */}
                          <td className="py-2.5 px-2 min-w-[75px] text-right text-slate-500">—</td>

                          {/* Rate Column */}
                          <td className="py-2.5 px-2 min-w-[80px] text-right text-slate-500">—</td>

                          {/* Line Discount Column (DISC) */}
                          <td className="py-2.5 px-2 min-w-[110px] text-right font-mono font-bold text-rose-400">
                            {tableColumnTotals.discountSum > 0 ? `₹${tableColumnTotals.discountSum.toFixed(2)}` : '—'}
                          </td>

                          {/* Taxable Amount Column */}
                          <td className="py-2.5 px-2 min-w-[90px] text-right font-mono font-bold text-slate-200">
                            ₹{tableColumnTotals.taxableSum.toFixed(2)}
                          </td>

                          {/* GST % Column */}
                          <td className="py-2.5 px-2 min-w-[75px] text-center text-slate-500">—</td>

                          {/* CGST Column */}
                          <td className="py-2.5 px-2 min-w-[80px] text-right font-mono font-bold text-amber-400">
                            ₹{tableColumnTotals.cgstSum.toFixed(2)}
                          </td>

                          {/* SGST Column */}
                          <td className="py-2.5 px-2 min-w-[80px] text-right font-mono font-bold text-amber-400">
                            ₹{tableColumnTotals.sgstSum.toFixed(2)}
                          </td>

                          {/* CESS Column */}
                          <td className="py-2.5 px-2 min-w-[75px] text-right font-mono font-bold text-cyan-400">
                            ₹{tableColumnTotals.cessSum.toFixed(2)}
                          </td>

                          {/* Landing Cost Column */}
                          <td className="py-2.5 px-2 min-w-[105px] text-right font-mono text-slate-500">—</td>

                          {/* Margin Column */}
                          <td className="py-2.5 px-2.5 min-w-[145px] text-right font-mono text-slate-500">—</td>

                          {/* Total Column */}
                          <td className="py-2.5 px-2 min-w-[95px] text-right font-mono font-black text-emerald-400 text-sm">
                            ₹{tableColumnTotals.grossSum.toFixed(2)}
                          </td>

                          {/* Action Column */}
                          <td className="py-2.5 px-2 min-w-[45px] text-center"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Summary Bar & Commit Button */}
                  <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4 pt-3 border-t border-slate-800 bg-slate-950/80 p-3.5 rounded-2xl shadow-xl">
                    <div className="flex items-center gap-2.5 flex-wrap text-xs">
                      {/* Gross Subtotal */}
                      <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 shadow-sm flex items-center gap-1.5">
                        <span className="text-slate-400 font-medium">Gross Subtotal:</span>
                        <span className="font-mono font-bold text-white">₹{grossSubtotal.toFixed(2)}</span>
                      </div>

                      {/* Line Discounts (if any) */}
                      {totalLineDiscounts > 0 && (
                        <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 shadow-sm flex items-center gap-1.5">
                          <span className="text-slate-400 font-medium">Line Disc:</span>
                          <span className="font-mono font-bold text-rose-400">-₹{totalLineDiscounts.toFixed(2)}</span>
                        </div>
                      )}

                      {/* Bill-Level Global Discount with Pre-Tax vs Post-Tax toggle */}
                      <div className="px-3 py-1.5 rounded-xl bg-rose-950/25 border border-rose-500/40 text-rose-300 shadow-sm flex items-center gap-2.5 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-rose-400" />
                          <span className="font-semibold text-rose-400 text-xs">Bill Discount:</span>
                        </div>

                        {/* Mode Toggle: Pre-Tax vs Post-Tax */}
                        <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setGlobalDiscountType('pre_tax')}
                            className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                              globalDiscountType === 'pre_tax'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title="Pre-Tax Trade Discount: Deducts from taxable base before computing GST"
                          >
                            Pre-Tax (Trade)
                          </button>
                          <button
                            type="button"
                            onClick={() => setGlobalDiscountType('post_tax')}
                            className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                              globalDiscountType === 'post_tax'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title="Post-Tax / Cash Discount (CD): Computes GST on full taxable base, deducts from bill total"
                          >
                            Post-Tax (Cash / CD)
                          </button>
                        </div>

                        {/* Amount and Percentage Inputs */}
                        <div className="flex items-center gap-1.5">
                          {/* Amount Input */}
                          <div className="flex items-center bg-slate-900/90 border border-rose-500/40 rounded-lg px-2 py-0.5 focus-within:border-rose-400">
                            <span className="text-rose-400/80 font-bold text-xs mr-0.5">[- ₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={invoiceDiscountAmount}
                              onChange={(e) => handleDiscountAmountChange(e.target.value)}
                              className="w-20 bg-transparent text-right font-mono font-bold text-rose-200 text-xs focus:outline-none"
                              title={globalDiscountType === 'pre_tax' ? 'Discount Amount in ₹ (Subtracts before GST)' : 'Cash Discount Amount in ₹ (Subtracts after GST)'}
                            />
                            <span className="text-rose-400/80 font-bold text-xs ml-0.5">]</span>
                          </div>

                          {/* Percentage Input */}
                          <div className="flex items-center bg-slate-900/90 border border-rose-500/40 rounded-lg px-1.5 py-0.5 focus-within:border-rose-400">
                            <span className="text-rose-400/80 font-bold text-xs mr-0.5">(</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="0"
                              value={invoiceDiscountPct}
                              onChange={(e) => handleDiscountPctChange(e.target.value)}
                              className="w-12 bg-transparent text-right font-mono font-bold text-rose-300 text-xs focus:outline-none"
                              title="Discount Percentage (%)"
                            />
                            <span className="text-rose-400/80 font-bold text-xs ml-0.5">%)</span>
                          </div>
                        </div>
                      </div>

                      {/* Taxable Base */}
                      <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 shadow-sm flex items-center gap-1.5">
                        <span className="text-slate-400 font-medium">Taxable Base:</span>
                        <span className="font-mono font-bold text-white">₹{totalTaxable.toFixed(2)}</span>
                      </div>

                      {/* CGST */}
                      <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 shadow-sm flex items-center gap-1.5">
                        <span className="text-slate-400 font-medium">CGST:</span>
                        <span className="font-mono font-bold text-amber-400">₹{totalCgst.toFixed(2)}</span>
                      </div>

                      {/* SGST */}
                      <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 shadow-sm flex items-center gap-1.5">
                        <span className="text-slate-400 font-medium">SGST:</span>
                        <span className="font-mono font-bold text-amber-400">₹{totalSgst.toFixed(2)}</span>
                      </div>

                      {totalCess > 0 && (
                        <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5">
                          <span className="text-slate-400 font-medium">CESS:</span>
                          <span className="font-mono font-bold text-cyan-400">₹{totalCess.toFixed(2)}</span>
                        </div>
                      )}

                      {/* Round Off */}
                      <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 shadow-sm flex items-center gap-1.5">
                        <span className="text-slate-400 font-medium">Round Off:</span>
                        <span className={`font-mono font-bold ${roundOff === 0 ? 'text-slate-400' : roundOff > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                        </span>
                      </div>

                      {/* Grand Total (Highlight badge) */}
                      <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-2 border-emerald-500/40 text-emerald-300 shadow-lg shadow-emerald-500/10 flex items-center gap-2">
                        <span className="font-bold text-emerald-400">Grand Total:</span>
                        <span className="font-mono font-black text-emerald-300 text-sm sm:text-base">₹{grandTotal.toFixed(2)}</span>
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
                              setLedgerDocRotation(0);
                              setIsDocPanelCollapsed(false);
                              setIsDocPanelExpanded(false);
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
                  <div className="text-[11px] text-slate-400 flex items-center gap-3 flex-wrap">
                    <span>Date: <strong>{selectedLedgerInvoice.invoice_date || 'N/A'}</strong></span>
                    {selectedLedgerInvoice.seller_gst && (
                      <span>GST: <strong>{selectedLedgerInvoice.seller_gst}</strong></span>
                    )}
                    <span>Grand Total: <strong className="text-emerald-400 font-mono">₹{Number(selectedLedgerInvoice.grand_total || 0).toFixed(2)}</strong></span>
                    {selectedLedgerInvoice.vendor_grand_total && Math.abs(Number(selectedLedgerInvoice.grand_total || 0) - Number(selectedLedgerInvoice.vendor_grand_total)) > 1.0 && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                        ⚠️ Discrepancy: Printed ₹{Number(selectedLedgerInvoice.vendor_grand_total).toFixed(2)}
                      </span>
                    )}
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

            {/* Split Body: Side-by-side with Asymmetric Ratio */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
              {/* Left Pane: Original Bill Document Viewer (Collapsible, 25-30% width by default) */}
              {!isDocPanelCollapsed && (
                <div
                  className={`w-full ${
                    isDocPanelExpanded
                      ? 'lg:w-1/2'
                      : 'lg:w-[320px] xl:w-[360px] 2xl:w-[400px]'
                  } border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-950 flex flex-col shrink-0 overflow-hidden transition-all duration-300`}
                >
                  <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs gap-1.5 shrink-0">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5 truncate">
                      <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">Archived Bill</span>
                    </span>

                    {/* Toolbar: Rotate, Zoom, Compact/Expand, Fullscreen, Collapse */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* 90-degree Rotation Button */}
                      <button
                        type="button"
                        onClick={() => setLedgerDocRotation((r) => (r + 90) % 360)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 text-xs transition flex items-center gap-1"
                        title="Rotate 90° Clockwise"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span className="hidden xl:inline text-[10px] font-semibold">90°</span>
                      </button>

                      {/* Zoom Controls */}
                      <button
                        type="button"
                        onClick={() => setLedgerDocZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono text-[10px] text-slate-400 px-0.5 min-w-[32px] text-center">
                        {Math.round(ledgerDocZoom * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setLedgerDocZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>

                      {/* Reset Zoom & Rotation */}
                      {(ledgerDocZoom !== 1 || ledgerDocRotation !== 0) && (
                        <button
                          type="button"
                          onClick={() => {
                            setLedgerDocZoom(1);
                            setLedgerDocRotation(0);
                          }}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition"
                          title="Reset Zoom & Rotation"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Toggle Compact / Expanded Width */}
                      <button
                        type="button"
                        onClick={() => setIsDocPanelExpanded((e) => !e)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition"
                        title={isDocPanelExpanded ? 'Compact Bill View (~30%)' : 'Expand Bill View (~50%)'}
                      >
                        {isDocPanelExpanded ? (
                          <Minimize2 className="w-3.5 h-3.5" />
                        ) : (
                          <Maximize2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Open Full Image in New Tab */}
                      {(selectedLedgerInvoice.bill_image_urls?.[0] || selectedLedgerInvoice.bill_image_url) && (
                        <a
                          href={selectedLedgerInvoice.bill_image_urls?.[0] || selectedLedgerInvoice.bill_image_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 transition"
                          title="Open Full Image"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {/* Collapse / Hide Bill Panel */}
                      <button
                        type="button"
                        onClick={() => setIsDocPanelCollapsed(true)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition"
                        title="Collapse Bill Panel (Full Table Width)"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Document Display Area with smooth zoom/pan & rotation */}
                  <div className="flex-1 overflow-auto p-3 flex items-center justify-center bg-slate-950/95 relative select-none">
                    {(selectedLedgerInvoice.bill_image_urls?.[0] || selectedLedgerInvoice.bill_image_url) ? (
                      <div className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden">
                        <img
                          src={selectedLedgerInvoice.bill_image_urls?.[0] || selectedLedgerInvoice.bill_image_url}
                          alt="Archived Bill"
                          style={{
                            transform: `scale(${ledgerDocZoom}) rotate(${ledgerDocRotation}deg)`,
                            transformOrigin: 'center center',
                            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-slate-800"
                        />
                      </div>
                    ) : (
                      <div className="text-center text-slate-500 text-xs space-y-2 p-6">
                        <ImageIcon className="w-12 h-12 mx-auto text-slate-700" />
                        <p>No original document scan was stored for this legacy invoice.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Right Pane: Full Itemized Ledger Lines & Barcodes (Expanded to 70-75% or 100%) */}
              <div className="flex-1 min-w-0 flex flex-col bg-slate-900/60 overflow-hidden">
                <div className="p-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    {/* Collapsed Panel Quick Re-open Button */}
                    {isDocPanelCollapsed && (
                      <button
                        type="button"
                        onClick={() => setIsDocPanelCollapsed(false)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                        title="Show Archived Bill Document"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Show Bill Scan</span>
                      </button>
                    )}
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Itemized Ledger Lines & Barcodes</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
                        {(selectedLedgerInvoice.purchase_items || selectedLedgerInvoice.items || []).length} items
                      </span>
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    Click "No Barcode" to assign universal SKU code
                  </span>
                </div>

                {/* Table Container with Horizontal & Vertical Scrolling and Sticky Headers */}
                <div className="flex-1 overflow-x-auto overflow-y-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                    <thead className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-sm shadow-md border-b border-slate-800">
                      <tr className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                        <th className="py-2.5 px-2.5 text-center min-w-[45px]">S.No</th>
                        <th className="py-2.5 px-2.5 min-w-[150px]">Barcode</th>
                        <th className="py-2.5 px-3 min-w-[180px]">Item Name</th>
                        <th className="py-2.5 px-2 min-w-[70px]">HSN</th>
                        <th className="py-2.5 px-2 text-right min-w-[65px]">QTY</th>
                        <th className="py-2.5 px-2 text-center min-w-[65px]">Unit</th>
                        <th className="py-2.5 px-2 text-right min-w-[75px]">MRP</th>
                        <th className="py-2.5 px-2 text-right min-w-[75px]">Rate</th>
                        <th className="py-2.5 px-2 text-right min-w-[70px]">DISC</th>
                        <th className="py-2.5 px-2 text-right min-w-[85px]">Taxable</th>
                        <th className="py-2.5 px-2 text-right min-w-[65px]">GST %</th>
                        <th className="py-2.5 px-2 text-right min-w-[110px]">Taxes (CGST/SGST)</th>
                        <th className="py-2.5 px-2 text-right min-w-[110px]">Landing Cost/Unit</th>
                        <th className="py-2.5 px-2.5 text-right min-w-[145px]">Margin (₹ & %)</th>
                        <th className="py-2.5 px-3 text-right min-w-[95px]">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-slate-200">
                      {(() => {
                        const itemsList = selectedLedgerInvoice.purchase_items || selectedLedgerInvoice.items || [];
                        if (itemsList.length === 0) {
                          return (
                            <tr>
                              <td colSpan={15} className="py-8 text-center text-slate-500">
                                No items found in this invoice entry.
                              </td>
                            </tr>
                          );
                        }
                        return itemsList.map((item, idx) => {
                          const hasBarcode = Boolean(item.barcode);
                          const isEditingBarcode = assigningBarcodeRowId === item.id;

                          // Dynamic Fallback Calculations in the Item Rows (as specified by user)
                          const qty = Math.max(1, Number(item.qty || item.quantity) || 1);
                          const rate = Number(item.rate || item.purchase_price || item.price_before_gst || 0);
                          const disc = Number(item.discount_amount || item.discount || 0);
                          const taxable = Number(item.taxable_amount || Math.max(0, (qty * rate) - disc));
                          const cgstPct = Number(item.cgst_pct || 0);
                          const sgstPct = Number(item.sgst_pct || 0);
                          const igstPct = Number(item.igst_pct || 0);
                          let gstPct = Number(item.gst_pct ?? item.gst_rate ?? 0);
                          if (gstPct === 0 && (cgstPct > 0 || sgstPct > 0)) {
                            gstPct = cgstPct + sgstPct;
                          } else if (gstPct === 0 && igstPct > 0) {
                            gstPct = igstPct;
                          }

                          const cgst = Number(item.cgst_amount || 0);
                          const sgst = Number(item.sgst_amount || 0);
                          const cess = Number(item.cess_amount || item.cess || 0);
                          const totalTaxes = (cgst + sgst > 0) ? (cgst + sgst + cess) : +(taxable * (gstPct / 100)).toFixed(2);
                          const landedUnit = Number(item.landing_cost || item.landed_cost || item.landed_cost_per_unit || (qty > 0 ? (taxable + totalTaxes) / qty : 0));
                          const lineTotal = Number(item.total || item.total_amount || item.price_after_gst || (taxable + totalTaxes));
                          const displayRate = rate > 0 ? rate : (taxable > 0 && qty > 0 ? +(taxable / qty).toFixed(2) : 0);

                          const mrp = Number(item.mrp || 0);
                          let marginAmount = Number(item.margin_amount ?? 0);
                          let marginPercentage = Number(item.margin_percentage ?? 0);
                          if ((!marginAmount && !marginPercentage) && mrp > 0 && landedUnit > 0) {
                            marginAmount = mrp - landedUnit;
                            marginPercentage = (marginAmount / mrp) * 100;
                          }

                          return (
                            <tr key={item.id || idx} className="hover:bg-slate-800/40 transition-colors">
                              {/* S.No */}
                              <td className="py-2 px-2 text-center text-slate-400 font-mono text-[11px] font-semibold">
                                {idx + 1}
                              </td>

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
                                      placeholder="Enter barcode"
                                      className="w-32 h-7 px-2 bg-slate-950 border border-amber-500 rounded text-xs font-mono text-white focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      disabled={isAssigningBarcode}
                                      onClick={() => handleAssignBarcodeToLedgerItem(item)}
                                      className="px-2 py-1 bg-amber-500 text-slate-950 font-bold rounded text-[10px] hover:bg-amber-400 transition cursor-pointer"
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
                                    <span>⚠️ No Barcode</span>
                                  </button>
                                )}
                              </td>

                              {/* Item Name */}
                              <td className="py-2 px-3 font-bold text-white max-w-[220px] truncate" title={item.item_name}>
                                {item.item_name}
                              </td>

                              {/* HSN */}
                              <td className="py-2 px-2 font-mono text-slate-400 text-[11px]">
                                {item.hsn_code || '—'}
                              </td>

                              {/* QTY */}
                              <td className="py-2 px-2 text-right font-bold font-mono text-emerald-400">
                                {qty}
                              </td>

                              {/* Unit */}
                              <td className="py-2 px-2 text-center font-medium text-slate-400 text-[11px] uppercase">
                                {item.unit || 'PCS'}
                              </td>

                              {/* MRP */}
                              <td className="py-2 px-2 text-right font-mono text-slate-300">
                                ₹{Number(item.mrp || 0).toFixed(2)}
                              </td>

                              {/* Rate */}
                              <td className="py-2 px-2 text-right font-mono text-slate-300">
                                ₹{displayRate.toFixed(2)}
                              </td>

                              {/* DISC */}
                              <td className="py-2 px-2 text-right font-mono text-rose-400 text-[11px]">
                                {disc > 0 ? `₹${disc.toFixed(2)}` : '—'}
                              </td>

                              {/* Taxable */}
                              <td className="py-2 px-2 text-right font-mono font-semibold text-slate-200">
                                ₹{taxable.toFixed(2)}
                              </td>

                              {/* GST % */}
                              <td className="py-2 px-2 text-right font-mono text-slate-400">
                                {gstPct}%
                              </td>

                              {/* Taxes (CGST/SGST) */}
                              <td className="py-2 px-2 text-right font-mono">
                                <span className="text-amber-400 font-semibold" title={`CGST: ₹${(cgst || totalTaxes / 2).toFixed(2)} | SGST: ₹${(sgst || totalTaxes / 2).toFixed(2)}${cess > 0 ? ` | CESS: ₹${cess.toFixed(2)}` : ''}`}>
                                  ₹{totalTaxes.toFixed(2)}
                                </span>
                                <div className="text-[9px] text-slate-500 font-normal">
                                  ({(cgst || totalTaxes / 2).toFixed(1)} + {(sgst || totalTaxes / 2).toFixed(1)})
                                </div>
                              </td>

                              {/* Landed Cost/Unit */}
                              <td className="py-2 px-2 text-right font-mono">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-bold text-[10px]">
                                  ₹{landedUnit.toFixed(2)}
                                </span>
                              </td>

                              {/* Margin (₹ & %) */}
                              <td className="py-2 px-2.5 text-right font-mono">
                                {renderMarginBadge(mrp, landedUnit, marginAmount, marginPercentage)}
                              </td>

                              {/* Total */}
                              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                                ₹{lineTotal.toFixed(2)}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>

                    {/* Dedicated Column Totals Summary Footer */}
                    {(() => {
                      const itemsList = selectedLedgerInvoice.purchase_items || selectedLedgerInvoice.items || [];
                      if (itemsList.length === 0) return null;

                      let sumQty = 0;
                      let sumDiscount = 0;
                      let sumTaxable = 0;
                      let sumTaxes = 0;
                      let sumGross = 0;

                      itemsList.forEach((it) => {
                        const q = Math.max(1, Number(it.qty || it.quantity) || 1);
                        const r = Number(it.rate || it.purchase_price || it.price_before_gst || 0);
                        const d = Number(it.discount_amount || it.discount || 0);
                        const t = Number(it.taxable_amount || Math.max(0, (q * r) - d));
                        const cgstP = Number(it.cgst_pct || 0);
                        const sgstP = Number(it.sgst_pct || 0);
                        const igstP = Number(it.igst_pct || 0);
                        let g = Number(it.gst_pct ?? it.gst_rate ?? 0);
                        if (g === 0 && (cgstP > 0 || sgstP > 0)) {
                          g = cgstP + sgstP;
                        } else if (g === 0 && igstP > 0) {
                          g = igstP;
                        }
                        const c = Number(it.cgst_amount || 0);
                        const s = Number(it.sgst_amount || 0);
                        const cs = Number(it.cess_amount || it.cess || 0);
                        const taxes = (c + s > 0) ? (c + s + cs) : +(t * (g / 100)).toFixed(2);
                        const lineTot = Number(it.total || it.total_amount || it.price_after_gst || (t + taxes));

                        sumQty += q;
                        sumDiscount += d;
                        sumTaxable += t;
                        sumTaxes += taxes;
                        sumGross += lineTot;
                      });

                      const finalTaxable = Number(selectedLedgerInvoice.total_taxable_amount) || sumTaxable;
                      const finalTaxes = Number(selectedLedgerInvoice.total_tax_amount) || sumTaxes;
                      const finalGrandTot = Number(selectedLedgerInvoice.grand_total) || sumGross;

                      return (
                        <tfoot className="sticky bottom-0 z-20 bg-slate-950/95 backdrop-blur-sm border-t-2 border-emerald-500/40 font-semibold shadow-inner">
                          <tr>
                            <td colSpan={4} className="py-2.5 px-3 text-left font-bold text-xs uppercase tracking-wider text-emerald-400">
                              TOTALS ({itemsList.length} items)
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-300">
                              {sumQty}
                            </td>
                            <td className="py-2.5 px-2 text-center text-slate-500">—</td>
                            <td className="py-2.5 px-2 text-right text-slate-500">—</td>
                            <td className="py-2.5 px-2 text-right text-slate-500">—</td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-rose-400">
                              {sumDiscount > 0 ? `₹${sumDiscount.toFixed(2)}` : '—'}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-200">
                              ₹{finalTaxable.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-2 text-center text-slate-500">—</td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-amber-400">
                              ₹{finalTaxes.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-2 text-center text-slate-500">—</td>
                            <td className="py-2.5 px-2.5 text-center text-slate-500">—</td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-400 text-sm">
                              ₹{finalGrandTot.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      );
                    })()}
                  </table>
                </div>

                {/* Footer Tax Summary */}
                {(() => {
                  const itemsList = selectedLedgerInvoice.purchase_items || selectedLedgerInvoice.items || [];
                  let sumTaxable = 0;
                  let sumTaxes = 0;
                  let sumGross = 0;

                  itemsList.forEach((it) => {
                    const q = Math.max(1, Number(it.qty || it.quantity) || 1);
                    const r = Number(it.rate || it.purchase_price || it.price_before_gst || 0);
                    const t = Number(it.taxable_amount || (q * r));
                    const g = Number(it.gst_pct || it.gst_rate || ((Number(it.cgst_pct || 0) + Number(it.sgst_pct || 0))) || 5);
                    const c = Number(it.cgst_amount || 0);
                    const s = Number(it.sgst_amount || 0);
                    const cs = Number(it.cess_amount || it.cess || 0);
                    const taxes = (c + s > 0) ? (c + s + cs) : +(t * (g / 100)).toFixed(2);
                    const lineTot = Number(it.total || it.total_amount || it.price_after_gst || (t + taxes));

                    sumTaxable += t;
                    sumTaxes += taxes;
                    sumGross += lineTot;
                  });

                  const finalTaxable = Number(selectedLedgerInvoice.total_taxable_amount) || sumTaxable;
                  const finalTaxes = Number(selectedLedgerInvoice.total_tax_amount) || sumTaxes;
                  const finalGrandTot = Number(selectedLedgerInvoice.grand_total) || sumGross;

                  return (
                    <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs flex-wrap gap-2 shrink-0">
                      <span className="text-slate-400">
                        Total Taxable: <strong className="text-white">₹{finalTaxable.toFixed(2)}</strong>
                      </span>
                      <span className="text-slate-400">
                        Total Tax: <strong className="text-amber-400">₹{finalTaxes.toFixed(2)}</strong>
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
                        Grand Total: <strong className="font-mono text-sm">₹{finalGrandTot.toFixed(2)}</strong>
                      </span>
                    </div>
                  );
                })()}
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
