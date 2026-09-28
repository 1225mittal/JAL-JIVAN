import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Barcode,
  Search,
  Mic,
  MicOff,
  PauseCircle,
  PlayCircle,
  Trash2,
  Plus,
  Minus,
  Printer,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  QrCode,
  CreditCard,
  Banknote,
  BookOpen,
  Receipt,
  ArrowLeft,
  History,
  Sparkles,
  X,
  ChevronRight,
  User,
  Phone,
  ShoppingBag,
  RefreshCw,
  Keyboard,
  Percent,
  DollarSign,
  Layers,
  ArrowDownLeft,
  FileText,
  Clock,
  Check,
  PackageCheck
} from 'lucide-react';

import DynamicUpiQr from '../components/sales/DynamicUpiQr';
import ThermalReceipt from '../components/sales/ThermalReceipt';
import { voiceCart } from '../lib/geminiVoiceCart';
import {
  playBarcodeScanBeep,
  playCashRegisterChime,
  playVoiceListenChime
} from '../lib/soundEffects';
import {
  fetchInventoryItems,
  saveSalesInvoice,
  fetchSalesInvoices,
  getLocalSalesInvoices
} from '../lib/supabase';

// Local storage keys
const PARKED_CARTS_KEY = 'jal_jivan_pos_parked_carts';
const RECENT_CUSTOMERS_KEY = 'jal_jivan_pos_customers';

// Sample fallback FMCG Catalog for instant counter readiness
const DEFAULT_FMCG_CATALOG = [
  { id: 'cat-1', barcode: '8901234567890', item_name: 'Bisleri 20L Water Can', category: 'Packaged Water', hsn_code: '2201', unit: 'CAN', mrp: 90, selling_price: 85, cost_price: 65, gst_percentage: 18, stock_qty: 120 },
  { id: 'cat-2', barcode: '8901234567891', item_name: 'Kinley 1L Water Bottle (Case of 12)', category: 'Packaged Water', hsn_code: '2201', unit: 'CASE', mrp: 240, selling_price: 220, cost_price: 180, gst_percentage: 18, stock_qty: 45 },
  { id: 'cat-3', barcode: '8901234567892', item_name: 'Aquafina 500ml (Pack of 24)', category: 'Packaged Water', hsn_code: '2201', unit: 'PACK', mrp: 240, selling_price: 215, cost_price: 175, gst_percentage: 18, stock_qty: 30 },
  { id: 'cat-4', barcode: '8901234567893', item_name: 'AM Masala Kaju 350g', category: 'Dry Fruits & Snacks', hsn_code: '2008', unit: 'PKT', mrp: 380, selling_price: 350, cost_price: 290, gst_percentage: 12, stock_qty: 60 },
  { id: 'cat-5', barcode: '8901234567894', item_name: 'Salted Roasted Badam 250g', category: 'Dry Fruits & Snacks', hsn_code: '2008', unit: 'PKT', mrp: 320, selling_price: 295, cost_price: 240, gst_percentage: 12, stock_qty: 40 },
  { id: 'cat-6', barcode: '8901234567895', item_name: 'Fortune Sunlite Sunflower Oil 1L', category: 'Cooking Oils', hsn_code: '1512', unit: 'POUCH', mrp: 165, selling_price: 155, cost_price: 138, gst_percentage: 5, stock_qty: 85 },
  { id: 'cat-7', barcode: '8901234567896', item_name: 'Tata Salt Vacuum Evaporated 1kg', category: 'Grocery Staples', hsn_code: '2501', unit: 'PKT', mrp: 30, selling_price: 28, cost_price: 24, gst_percentage: 0, stock_qty: 150 },
  { id: 'cat-8', barcode: '8901234567897', item_name: 'Aashirvaad Shudh Chakki Atta 10kg', category: 'Flour & Grains', hsn_code: '1101', unit: 'BAG', mrp: 460, selling_price: 430, cost_price: 385, gst_percentage: 5, stock_qty: 55 },
  { id: 'cat-9', barcode: '8901234567898', item_name: 'Amul Butter 500g', category: 'Dairy', hsn_code: '0405', unit: 'BRICK', mrp: 285, selling_price: 275, cost_price: 250, gst_percentage: 12, stock_qty: 35 },
  { id: 'cat-10', barcode: '8901234567899', item_name: 'Real Fruit Power Mixed Fruit 1L', category: 'Beverages', hsn_code: '2009', unit: 'TETRA', mrp: 135, selling_price: 125, cost_price: 105, gst_percentage: 12, stock_qty: 50 }
];

export default function SalesBillingHub({ onBackToHub = () => {}, showToast = () => {} }) {
  // 1. Catalog & Master State
  const [catalog, setCatalog] = useState([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  // 2. Cart & Row Selection State
  const [cartItems, setCartItems] = useState([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);

  // 3. Inputs & Scanner State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // 4. Voice Billing State
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceNotice, setVoiceNotice] = useState('');

  // 5. Customer Profile State
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  // 6. Payment Modes & Cash Settlement State
  // Modes: 'CASH' | 'DYNAMIC_UPI' | 'SPLIT' | 'KHATA'
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [cashTendered, setCashTendered] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [splitUpi, setSplitUpi] = useState('');

  // 7. Parked Carts State
  const [parkedCarts, setParkedCarts] = useState(() => {
    try {
      const saved = localStorage.getItem(PARKED_CARTS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isParkedModalOpen, setIsParkedModalOpen] = useState(false);

  // 8. Completed Invoices & Thermal Receipt Preview
  const [completedInvoice, setCompletedInvoice] = useState(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isSavingBill, setIsSavingBill] = useState(false);
  const [isRecentBillsModalOpen, setIsRecentBillsModalOpen] = useState(false);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Element Refs for Auto-Focus & Shortcuts
  const barcodeInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const cashInputRef = useRef(null);

  // ========================================================
  // INITIAL DATA LOADING (CATALOG & RECENT INVOICES)
  // ========================================================
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoadingCatalog(true);
      try {
        const items = await fetchInventoryItems();
        if (isMounted) {
          if (Array.isArray(items) && items.length > 0) {
            // Deduplicate items by barcode or item_name
            const seen = new Set();
            const cleanCatalog = [];
            for (const it of items) {
              const key = (it.barcode || it.item_name || '').toLowerCase().trim();
              if (key && !seen.has(key)) {
                seen.add(key);
                cleanCatalog.push({
                  ...it,
                  mrp: Number(it.mrp) || Number(it.selling_price) || 0,
                  selling_price: Number(it.selling_price) || Number(it.mrp) || 0,
                  cost_price: Number(it.unit_landed_cost || it.cost_price || it.purchase_price) || 0,
                  gst_percentage: Number(it.gst_percentage ?? it.gst_pct ?? 0)
                });
              }
            }
            setCatalog(cleanCatalog.length > 0 ? cleanCatalog : DEFAULT_FMCG_CATALOG);
          } else {
            setCatalog(DEFAULT_FMCG_CATALOG);
          }
        }
      } catch (err) {
        console.warn('Catalog fetch warning, fallback to default FMCG catalog:', err);
        if (isMounted) setCatalog(DEFAULT_FMCG_CATALOG);
      } finally {
        if (isMounted) setIsLoadingCatalog(false);
      }

      // Load recent customers
      try {
        const custs = localStorage.getItem(RECENT_CUSTOMERS_KEY);
        if (custs && isMounted) {
          setRecentCustomers(JSON.parse(custs));
        }
      } catch (e) {}

      // Load recent invoices
      try {
        const invs = await fetchSalesInvoices(30);
        if (isMounted && Array.isArray(invs)) {
          setRecentInvoices(invs);
        }
      } catch (e) {}
    }

    loadData();

    // Focus Barcode on mount (F1 rule)
    if (barcodeInputRef.current) {
      setTimeout(() => barcodeInputRef.current?.focus(), 150);
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Save parked carts on change
  useEffect(() => {
    try {
      localStorage.setItem(PARKED_CARTS_KEY, JSON.stringify(parkedCarts));
    } catch (e) {}
  }, [parkedCarts]);

  // ========================================================
  // BILL CALCULATIONS (LIVE TOTALS, GST, PROFIT RADAR)
  // ========================================================
  const billMetrics = useMemo(() => {
    let grossSubtotal = 0; // Taxable sum
    let totalCgst = 0;
    let totalSgst = 0;
    let totalCost = 0;
    let totalMrpGross = 0;
    let totalUnits = 0;

    cartItems.forEach((item) => {
      const qty = Number(item.qty || 1);
      const rate = Number(item.rate || 0);
      const mrp = Number(item.mrp || rate);
      const discPct = Number(item.discount_pct || 0);
      const gstPct = Number(item.gst_pct || 0);
      const costPrice = Number(item.cost_price || 0);

      totalUnits += qty;
      totalMrpGross += qty * mrp;
      totalCost += qty * costPrice;

      // Rate in Indian FMCG is Tax-Inclusive MRP/Selling Rate
      const lineEffectiveTotal = Math.max(0, qty * rate * (1 - discPct / 100));
      const taxableAmount = gstPct > 0 ? lineEffectiveTotal / (1 + gstPct / 100) : lineEffectiveTotal;
      const gstAmount = lineEffectiveTotal - taxableAmount;

      grossSubtotal += taxableAmount;
      totalCgst += gstAmount / 2;
      totalSgst += gstAmount / 2;
    });

    const totalGst = totalCgst + totalSgst;
    const unroundedGrandTotal = grossSubtotal + totalGst;
    const grandTotal = Math.round(unroundedGrandTotal);
    const roundOff = +(grandTotal - unroundedGrandTotal).toFixed(2);

    const netProfit = +(grandTotal - totalCost).toFixed(2);
    const profitMargin = grandTotal > 0 ? +((netProfit / grandTotal) * 100).toFixed(1) : 0;
    const mrpSavings = Math.max(0, +(totalMrpGross - grandTotal).toFixed(2));

    return {
      grossSubtotal: +grossSubtotal.toFixed(2),
      totalCgst: +totalCgst.toFixed(2),
      totalSgst: +totalSgst.toFixed(2),
      totalGst: +totalGst.toFixed(2),
      roundOff,
      grandTotal,
      totalCost: +totalCost.toFixed(2),
      netProfit,
      profitMargin,
      mrpSavings,
      totalUnits,
      itemCount: cartItems.length
    };
  }, [cartItems]);

  // Auto-sync cash tender default when grand total changes
  useEffect(() => {
    if (paymentMode === 'CASH' && billMetrics.grandTotal > 0 && !cashTendered) {
      setCashTendered(billMetrics.grandTotal.toString());
    } else if (billMetrics.grandTotal === 0) {
      setCashTendered('');
    }
  }, [billMetrics.grandTotal, paymentMode]);

  // Next Invoice Sequence Preview
  const nextInvoiceNo = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = recentInvoices.length + 1;
    return `INV-${todayStr}-${count.toString().padStart(4, '0')}`;
  }, [recentInvoices.length]);

  // ========================================================
  // SMART ITEM SEARCH & BARCODE HANDLERS
  // ========================================================
  // Search query filter
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setSearchResults([]);
      setIsSearchOpen(false);
      return;
    }

    const matches = catalog.filter((it) => {
      const name = (it.item_name || '').toLowerCase();
      const code = (it.barcode || '').toLowerCase();
      const hsn = (it.hsn_code || '').toLowerCase();
      const cat = (it.category || '').toLowerCase();
      return name.includes(q) || code.includes(q) || hsn.includes(q) || cat.includes(q);
    }).slice(0, 8);

    setSearchResults(matches);
    setIsSearchOpen(matches.length > 0);
  }, [searchQuery, catalog]);

  // Add Item to Cart Helper
  const addItemToCart = useCallback((item, requestedQty = 1) => {
    playBarcodeScanBeep();
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (ci) => (ci.barcode && ci.barcode === item.barcode) ||
                (ci.item_name.toLowerCase() === (item.item_name || '').toLowerCase())
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        const current = updated[existingIdx];
        const newQty = Number(current.qty || 1) + requestedQty;
        const lineTotal = +(newQty * current.rate * (1 - (current.discount_pct || 0) / 100)).toFixed(2);
        updated[existingIdx] = {
          ...current,
          qty: newQty,
          quantity: newQty,
          total: lineTotal
        };
        setSelectedRowIndex(existingIdx);
        return updated;
      }

      const mrp = Number(item.mrp) || Number(item.selling_price) || 0;
      const rate = Number(item.selling_price) || mrp || 0;
      const lineTotal = +(requestedQty * rate).toFixed(2);

      const newItem = {
        id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        barcode: item.barcode || '',
        item_name: item.item_name || 'Standard Item',
        hsn_code: item.hsn_code || '2201',
        qty: requestedQty,
        quantity: requestedQty,
        unit: item.unit || 'PCS',
        mrp,
        rate,
        discount_pct: 0,
        discount_amount: 0,
        gst_pct: Number(item.gst_percentage ?? item.gst_pct ?? 0),
        cost_price: Number(item.cost_price || item.purchase_price || item.unit_landed_cost || 0),
        taxable_amount: lineTotal,
        total: lineTotal
      };

      const nextCart = [newItem, ...prev];
      setSelectedRowIndex(0);
      return nextCart;
    });

    showToast(`Added "${item.item_name}" to cart`, 'success');
  }, [showToast]);

  // Handle Barcode Scanner Enter
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    // 1. Direct match by barcode
    let matched = catalog.find((c) => (c.barcode || '').trim().toLowerCase() === code.toLowerCase());

    // 2. Fallback match by exact item name
    if (!matched) {
      matched = catalog.find((c) => (c.item_name || '').trim().toLowerCase() === code.toLowerCase());
    }

    if (matched) {
      addItemToCart(matched, 1);
      setBarcodeInput('');
    } else {
      // Prompt quick custom item addition
      const customItem = {
        id: `custom_${Date.now()}`,
        barcode: code,
        item_name: `SKU-${code}`,
        hsn_code: '2201',
        unit: 'PCS',
        mrp: 100,
        selling_price: 100,
        cost_price: 80,
        gst_percentage: 18
      };
      addItemToCart(customItem, 1);
      setBarcodeInput('');
      showToast(`Scanned new barcode: ${code} (Added as default item)`, 'info');
    }
  };

  // Update Cart Line Item
  const updateCartItem = (index, field, value) => {
    setCartItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };

      if (field === 'qty') {
        const q = Math.max(1, parseInt(value) || 1);
        item.qty = q;
        item.quantity = q;
      } else if (field === 'rate') {
        item.rate = Math.max(0, parseFloat(value) || 0);
      } else if (field === 'mrp') {
        item.mrp = Math.max(0, parseFloat(value) || 0);
      } else if (field === 'discount_pct') {
        item.discount_pct = Math.min(100, Math.max(0, parseFloat(value) || 0));
      } else if (field === 'gst_pct') {
        item.gst_pct = Math.max(0, parseFloat(value) || 0);
      }

      // Recompute line total
      const lineEffectiveTotal = Math.max(0, item.qty * item.rate * (1 - (item.discount_pct || 0) / 100));
      item.total = +lineEffectiveTotal.toFixed(2);
      updated[index] = item;
      return updated;
    });
  };

  // Delete Cart Line Item
  const removeCartItem = (index) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
    if (selectedRowIndex === index) {
      setSelectedRowIndex(-1);
    } else if (selectedRowIndex > index) {
      setSelectedRowIndex((prev) => prev - 1);
    }
  };

  // ========================================================
  // VOICE-TO-CART (GEMINI 2.5 FLASH / WEBSPEECH)
  // ========================================================
  const toggleVoiceBilling = () => {
    if (isVoiceListening) {
      voiceCart.stop();
      setIsVoiceListening(false);
      setVoiceNotice('Voice billing stopped.');
    } else {
      if (!voiceCart.isSupported()) {
        showToast('Speech recognition not supported in this browser. Please use Chrome or Edge.', 'error');
        return;
      }
      playVoiceListenChime();
      setIsVoiceListening(true);
      setVoiceTranscript('');
      setVoiceNotice('Listening in Hindi/English... Speak (e.g. "5 Bisleri 20L can aur 2 packet kaju")');

      voiceCart.start({
        catalog,
        onTranscript: (text) => {
          setVoiceTranscript(text);
        },
        onResult: (matchedItems, transcript) => {
          setIsVoiceListening(false);
          setVoiceNotice(`Processed: "${transcript}"`);
          if (matchedItems && matchedItems.length > 0) {
            matchedItems.forEach((it) => {
              addItemToCart(it, it.qty || 1);
            });
            showToast(`Voice added ${matchedItems.length} items to cart!`, 'success');
          }
        },
        onError: (err) => {
          setIsVoiceListening(false);
          setVoiceNotice(err.message || 'Voice error occurred');
          showToast(`Voice billing: ${err.message}`, 'error');
        },
        onEnd: () => {
          setIsVoiceListening(false);
        }
      });
    }
  };

  // ========================================================
  // PARK & RESUME CARTS (KEYBOARD SHORTCUT F4)
  // ========================================================
  const parkCurrentCart = () => {
    if (cartItems.length === 0) {
      showToast('Cannot park an empty cart.', 'warning');
      return;
    }

    const parkedEntry = {
      id: `parked_${Date.now()}`,
      parked_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      date: new Date().toLocaleDateString('en-IN'),
      customer_name: customerName || 'Walk-in Customer',
      customer_phone: customerPhone || '',
      items: [...cartItems],
      grandTotal: billMetrics.grandTotal,
      itemCount: cartItems.length,
      units: billMetrics.totalUnits
    };

    setParkedCarts((prev) => [parkedEntry, ...prev]);
    setCartItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setSelectedRowIndex(-1);
    showToast(`Cart parked successfully (${parkedEntry.itemCount} items).`, 'info');

    // Refocus barcode input for next customer
    barcodeInputRef.current?.focus();
  };

  const resumeParkedCart = (parked) => {
    if (cartItems.length > 0) {
      const confirmSwitch = window.confirm(
        'You have items in your active cart. Do you want to park the current cart before resuming?'
      );
      if (confirmSwitch) {
        parkCurrentCart();
      }
    }

    setCartItems(parked.items || []);
    setCustomerName(parked.customer_name === 'Walk-in Customer' ? '' : parked.customer_name);
    setCustomerPhone(parked.customer_phone || '');
    setParkedCarts((prev) => prev.filter((p) => p.id !== parked.id));
    setIsParkedModalOpen(false);
    showToast(`Resumed parked cart with ${parked.items?.length || 0} items.`, 'success');
  };

  const discardParkedCart = (id) => {
    setParkedCarts((prev) => prev.filter((p) => p.id !== id));
    showToast('Parked cart removed.', 'info');
  };

  // Clear Active Cart
  const clearCart = () => {
    if (cartItems.length === 0) return;
    if (window.confirm('Are you sure you want to clear the active cart?')) {
      setCartItems([]);
      setSelectedRowIndex(-1);
      setCashTendered('');
      showToast('Active cart cleared.', 'info');
      barcodeInputRef.current?.focus();
    }
  };

  // ========================================================
  // CUSTOMER AUTO-COMPLETE
  // ========================================================
  const handleCustomerPhoneChange = (val) => {
    setCustomerPhone(val);
    if (val.length >= 3) {
      const matches = recentCustomers.filter(
        (c) => (c.phone || '').includes(val) || (c.name || '').toLowerCase().includes(val.toLowerCase())
      );
      setShowCustomerSuggestions(matches.length > 0);
    } else {
      setShowCustomerSuggestions(false);
    }
  };

  const selectSuggestedCustomer = (cust) => {
    setCustomerName(cust.name || '');
    setCustomerPhone(cust.phone || '');
    setShowCustomerSuggestions(false);
  };

  // ========================================================
  // CHECKOUT & SETTLEMENT ENGINE (F8: SAVE & PRINT)
  // ========================================================
  const processCheckout = async (shouldPrint = true) => {
    if (cartItems.length === 0) {
      showToast('Cannot checkout with an empty cart. Please add items.', 'warning');
      barcodeInputRef.current?.focus();
      return;
    }

    if (paymentMode === 'KHATA' && !customerPhone.trim()) {
      showToast('Customer phone number is required for Khata / Udhaar transactions.', 'warning');
      return;
    }

    setIsSavingBill(true);

    try {
      const finalCustomerName = customerName.trim() || 'Walk-in Customer';
      const finalCustomerPhone = customerPhone.trim();

      // Tender and change calculations
      const grandTotal = billMetrics.grandTotal;
      let tendered = grandTotal;
      let change = 0;
      let splitCashVal = 0;
      let splitUpiVal = 0;

      if (paymentMode === 'CASH') {
        tendered = parseFloat(cashTendered) || grandTotal;
        change = Math.max(0, tendered - grandTotal);
      } else if (paymentMode === 'SPLIT') {
        splitCashVal = parseFloat(splitCash) || 0;
        splitUpiVal = parseFloat(splitUpi) || 0;
        tendered = splitCashVal + splitUpiVal;
      }

      const invoicePayload = {
        invoice_number: nextInvoiceNo,
        invoice_date: new Date().toISOString().slice(0, 10),
        invoice_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        customer_name: finalCustomerName,
        customer_phone: finalCustomerPhone,
        payment_mode: paymentMode,
        subtotal: billMetrics.grossSubtotal,
        cgst_amount: billMetrics.totalCgst,
        sgst_amount: billMetrics.totalSgst,
        total_tax: billMetrics.totalGst,
        round_off: billMetrics.roundOff,
        grand_total: grandTotal,
        tendered_amount: tendered,
        change_returned: change,
        split_cash: splitCashVal,
        split_upi: splitUpiVal,
        profit_amount: billMetrics.netProfit,
        status: paymentMode === 'KHATA' ? 'udhaar_pending' : 'completed',
        items: cartItems.map((ci) => ({
          barcode: ci.barcode || null,
          item_name: ci.item_name,
          hsn_code: ci.hsn_code || '2201',
          quantity: ci.qty || 1,
          unit: ci.unit || 'PCS',
          mrp: ci.mrp || ci.rate,
          cost_price: ci.cost_price || 0,
          rate: ci.rate,
          discount_pct: ci.discount_pct || 0,
          discount_amount: +(ci.qty * ci.rate * (ci.discount_pct / 100)).toFixed(2),
          taxable_amount: +(ci.qty * ci.rate * (1 - (ci.discount_pct || 0) / 100) / (1 + (ci.gst_pct || 0) / 100)).toFixed(2),
          gst_pct: ci.gst_pct || 0,
          cgst_amount: +(ci.total * (ci.gst_pct / 200)).toFixed(2),
          sgst_amount: +(ci.total * (ci.gst_pct / 200)).toFixed(2),
          total: ci.total
        }))
      };

      // Save via Supabase / Local fallback
      const savedInvoice = await saveSalesInvoice(invoicePayload);
      playCashRegisterChime();

      // Update recent customers
      if (finalCustomerPhone) {
        const updatedCusts = [
          { name: finalCustomerName, phone: finalCustomerPhone, last_visit: new Date().toISOString() },
          ...recentCustomers.filter((c) => c.phone !== finalCustomerPhone)
        ].slice(0, 50);
        setRecentCustomers(updatedCusts);
        try {
          localStorage.setItem(RECENT_CUSTOMERS_KEY, JSON.stringify(updatedCusts));
        } catch (e) {}
      }

      // Add to recent invoices list
      setRecentInvoices((prev) => [savedInvoice, ...prev]);

      // Complete and Reset Cart
      setCompletedInvoice(savedInvoice);
      setCartItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setSelectedRowIndex(-1);
      setCashTendered('');
      setSplitCash('');
      setSplitUpi('');

      if (shouldPrint) {
        setIsReceiptModalOpen(true);
      } else {
        showToast(`Bill #${savedInvoice.invoice_number} saved successfully!`, 'success');
        barcodeInputRef.current?.focus();
      }
    } catch (err) {
      console.error('Checkout error:', err);
      showToast(`Failed to save invoice: ${err.message}`, 'error');
    } finally {
      setIsSavingBill(false);
    }
  };

  // ========================================================
  // GLOBAL KEYBOARD SHORTCUT LISTENER (F1, F2, F4, F8, Del, Space)
  // ========================================================
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. F1: Focus Barcode Scanner
      if (e.key === 'F1') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        showToast('Focused Barcode Scanner (F1)', 'info');
        return;
      }

      // 2. F2: Focus Smart Search
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        showToast('Focused Smart Search (F2)', 'info');
        return;
      }

      // 3. F4: Park Current Cart or Toggle Parked Modal
      if (e.key === 'F4') {
        e.preventDefault();
        if (cartItems.length > 0) {
          parkCurrentCart();
        } else if (parkedCarts.length > 0) {
          setIsParkedModalOpen(true);
        } else {
          showToast('No active or parked carts (F4)', 'info');
        }
        return;
      }

      // 4. F8: Save & Print Thermal Receipt
      if (e.key === 'F8') {
        e.preventDefault();
        processCheckout(true);
        return;
      }

      // 5. Delete Key: Remove currently selected row
      if (e.key === 'Delete') {
        const isEditingInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        if (!isEditingInput && selectedRowIndex >= 0 && selectedRowIndex < cartItems.length) {
          e.preventDefault();
          removeCartItem(selectedRowIndex);
          showToast('Item deleted from cart', 'info');
          return;
        }
      }

      // 6. Escape Key: Clear search or modals
      if (e.key === 'Escape') {
        if (isSearchOpen) {
          setIsSearchOpen(false);
          setSearchQuery('');
        } else if (isParkedModalOpen) {
          setIsParkedModalOpen(false);
        } else if (isReceiptModalOpen) {
          setIsReceiptModalOpen(false);
        } else if (isShortcutsModalOpen) {
          setIsShortcutsModalOpen(false);
        } else if (isRecentBillsModalOpen) {
          setIsRecentBillsModalOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cartItems,
    parkedCarts,
    selectedRowIndex,
    isSearchOpen,
    isParkedModalOpen,
    isReceiptModalOpen,
    isShortcutsModalOpen,
    isRecentBillsModalOpen,
    showToast
  ]);

  // Quick tender calculator for CASH
  const changeToReturn = useMemo(() => {
    if (paymentMode !== 'CASH') return 0;
    const tendered = parseFloat(cashTendered) || 0;
    return Math.max(0, tendered - billMetrics.grandTotal);
  }, [paymentMode, cashTendered, billMetrics.grandTotal]);

  const tenderDifference = useMemo(() => {
    if (paymentMode !== 'CASH') return 0;
    const tendered = parseFloat(cashTendered) || 0;
    return tendered - billMetrics.grandTotal;
  }, [paymentMode, cashTendered, billMetrics.grandTotal]);

  return (
    <div className="min-h-screen bg-[#070d1e] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* ======================================================== */}
      {/* 1. TOP HEADER & POS STATUS BAR */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Hub Navigation & Counter Identity */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToHub}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
              title="Return to Master Admin Hub"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Hub</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-black tracking-tight uppercase text-white">
                    Retail Sales & POS Counter
                  </h1>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Counter #01 - Active
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                  <span>Next: <strong className="text-emerald-400">{nextInvoiceNo}</strong></span>
                  <span>•</span>
                  <span>Catalog: {catalog.length} SKUs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Toolbar: Parked Carts, Recent Bills, Hotkeys Guide */}
          <div className="flex items-center gap-2">
            {/* Parked Carts Pill Badge (F4) */}
            <button
              type="button"
              onClick={() => setIsParkedModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                parkedCarts.length > 0
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 shadow-sm shadow-amber-500/20'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
              }`}
              title="View & Resume Parked Carts (F4)"
            >
              <PauseCircle className="w-4 h-4 text-amber-400" />
              <span>Parked</span>
              <span className="px-1.5 py-0.2 rounded-md bg-amber-500/30 text-amber-200 text-[10px] font-mono">
                {parkedCarts.length}
              </span>
              <span className="hidden md:inline text-[10px] text-amber-400/80 font-mono">[F4]</span>
            </button>

            {/* Recent Completed Bills */}
            <button
              type="button"
              onClick={() => setIsRecentBillsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 text-xs font-semibold transition cursor-pointer"
              title="Recent Sales Register & Invoices"
            >
              <History className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline">Bills</span>
            </button>

            {/* Keyboard Shortcuts Cheat Sheet */}
            <button
              type="button"
              onClick={() => setIsShortcutsModalOpen(true)}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 text-xs transition cursor-pointer"
              title="POS Keyboard Shortcuts Reference"
            >
              <Keyboard className="w-4 h-4 text-purple-400" />
            </button>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. MAIN WORKSPACE: 65% / 35% DUAL-PANE COUNTER LAYOUT */}
      {/* ======================================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-5 flex flex-col lg:flex-row gap-5">
        
        {/* ======================================================== */}
        {/* LEFT PANE (65%): ACTIVE CART, SCANNER & VOICE BILLING */}
        {/* ======================================================== */}
        <section className="w-full lg:w-[65%] flex flex-col gap-4">
          
          {/* TOP BAR: BARCODE, SMART SEARCH, VOICE BILLING & PARK CART */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/90 shadow-xl flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
              
              {/* 1. Barcode Input (Auto-focused, F1) */}
              <form
                onSubmit={handleBarcodeSubmit}
                className="md:col-span-6 relative flex items-center"
              >
                <div className="absolute left-3 text-slate-400 pointer-events-none">
                  <Barcode className="w-4 h-4 text-emerald-400" />
                </div>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan Barcode / SKU + Enter... [F1]"
                  className="w-full pl-9 pr-14 py-2 bg-slate-950/90 border border-slate-700/80 focus:border-emerald-500 rounded-xl text-xs sm:text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition"
                />
                <span className="absolute right-2 px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400 font-bold">
                  F1
                </span>
              </form>

              {/* 2. Smart Item Search Box (Fuzzy Lookup, F2) */}
              <div className="md:col-span-6 relative">
                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-400 pointer-events-none">
                    <Search className="w-4 h-4 text-blue-400" />
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (searchQuery.trim().length > 0 && searchResults.length > 0) {
                        setIsSearchOpen(true);
                      }
                    }}
                    placeholder="Search Name, HSN or Category... [F2]"
                    className="w-full pl-9 pr-14 py-2 bg-slate-950/90 border border-slate-700/80 focus:border-blue-500 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setIsSearchOpen(false);
                      }}
                      className="absolute right-7 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                  <span className="absolute right-2 px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400 font-bold">
                    F2
                  </span>
                </div>

                {/* Search Results Dropdown */}
                {isSearchOpen && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-slate-950/90 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                      <span>Matching Products ({searchResults.length})</span>
                      <span>Click to Add</span>
                    </div>
                    {searchResults.map((item) => (
                      <button
                        key={item.id || item.barcode}
                        type="button"
                        onClick={() => {
                          addItemToCart(item, 1);
                          setSearchQuery('');
                          setIsSearchOpen(false);
                        }}
                        className="w-full px-3 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-slate-800/80 border-b border-slate-800/50 last:border-b-0 transition cursor-pointer group"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-100 group-hover:text-emerald-300">
                            {item.item_name}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 font-mono">
                            <span>HSN: {item.hsn_code || '2201'}</span>
                            <span>•</span>
                            <span className="text-slate-300 font-semibold">{item.category || 'General'}</span>
                            {item.stock_qty !== undefined && (
                              <span className="text-emerald-400">Stock: {item.stock_qty}</span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-black font-mono text-emerald-400">
                            ₹{item.selling_price || item.mrp || 0}
                          </div>
                          {item.mrp && item.mrp > item.selling_price && (
                            <div className="text-[10px] text-slate-400 line-through font-mono">
                              ₹{item.mrp}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions Bar: Voice Billing & Park Cart Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-xs">
              <div className="flex items-center gap-2">
                {/* Voice Billing Button */}
                <button
                  type="button"
                  onClick={toggleVoiceBilling}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer border ${
                    isVoiceListening
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-lg shadow-rose-500/30 animate-pulse'
                      : 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 hover:from-blue-600/40 hover:to-purple-600/40 text-blue-300 border-blue-500/40'
                  }`}
                  title="Speak in Hindi/English to add products (e.g. '5 Bisleri 20L can aur 2 packet kaju')"
                >
                  {isVoiceListening ? (
                    <>
                      <MicOff className="w-4 h-4 text-rose-400 animate-spin" />
                      <span>Listening... (Click to stop)</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 text-blue-400" />
                      <span>Voice Billing (Gemini)</span>
                      <span className="text-[10px] px-1 rounded bg-blue-500/20 text-blue-300 font-mono">
                        Space
                      </span>
                    </>
                  )}
                </button>

                {/* Park Cart Quick Button */}
                <button
                  type="button"
                  onClick={parkCurrentCart}
                  disabled={cartItems.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
                  title="Park this cart for another customer (F4)"
                >
                  <PauseCircle className="w-4 h-4 text-amber-400" />
                  <span>Park Cart</span>
                  <span className="text-[10px] text-slate-400 font-mono">[F4]</span>
                </button>
              </div>

              {/* Status / Instruction Snippet */}
              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                {isVoiceListening && voiceTranscript ? (
                  <span className="text-emerald-400 font-medium italic animate-pulse truncate max-w-xs">
                    "{voiceTranscript}"
                  </span>
                ) : voiceNotice ? (
                  <span className="text-slate-300 truncate max-w-xs">{voiceNotice}</span>
                ) : (
                  <span className="text-slate-400 font-mono">
                    Active Items: <strong className="text-emerald-400">{cartItems.length}</strong> ({billMetrics.totalUnits} Units)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* LINE ITEMS TABLE */}
          <div className="flex-1 bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-xl overflow-hidden flex flex-col min-h-[380px]">
            {/* Table Header Bar */}
            <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Current Counter Bill</span>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-400 font-normal">
                  Shortcut: <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300">Del</kbd> to delete row
                </span>
                {cartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[500px]">
              {cartItems.length === 0 ? (
                /* Empty Cart State with Quick Pick SKUs */
                <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
                    <ShoppingBag className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-200 mb-1">
                    Cart is Currently Empty
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mb-4">
                    Scan a barcode <kbd className="px-1 rounded bg-slate-800 text-slate-300">[F1]</kbd>, search product <kbd className="px-1 rounded bg-slate-800 text-slate-300">[F2]</kbd>, or speak in Hindi/English to add line items.
                  </p>

                  {/* Fast Pick Popular Catalog Items */}
                  <div className="w-full max-w-md">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Quick Add Popular FMCG SKUs:
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {catalog.slice(0, 6).map((item) => (
                        <button
                          key={item.id || item.item_name}
                          type="button"
                          onClick={() => addItemToCart(item, 1)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/90 border border-slate-700/70 text-slate-300 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer group"
                        >
                          <Plus className="w-3 h-3 text-emerald-400 group-hover:scale-125 transition" />
                          <span className="truncate max-w-[140px]">{item.item_name}</span>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold">
                            ₹{item.selling_price || item.mrp}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Active Table */
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-bold text-[11px] sticky top-0 z-10 border-b border-slate-800 select-none">
                    <tr>
                      <th className="py-2.5 px-2 text-center w-8">#</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-2 text-center">HSN</th>
                      <th className="py-2.5 px-2 text-center w-28">Qty</th>
                      <th className="py-2.5 px-2 text-center">Unit</th>
                      <th className="py-2.5 px-2 text-right">MRP</th>
                      <th className="py-2.5 px-2 text-right w-16">Disc %</th>
                      <th className="py-2.5 px-2 text-right w-20">Rate (₹)</th>
                      <th className="py-2.5 px-2 text-center">GST</th>
                      <th className="py-2.5 px-3 text-right">Total (₹)</th>
                      <th className="py-2.5 px-2 text-center w-10">Act</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {cartItems.map((item, idx) => {
                      const isSelected = selectedRowIndex === idx;
                      return (
                        <tr
                          key={item.id || idx}
                          onClick={() => setSelectedRowIndex(idx)}
                          className={`transition cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/10 border-l-2 border-emerald-400'
                              : 'hover:bg-slate-800/40'
                          }`}
                        >
                          {/* Row Number */}
                          <td className="py-2 px-2 text-center text-slate-400 font-bold">
                            {idx + 1}
                          </td>

                          {/* Item Name */}
                          <td className="py-2 px-3 font-sans">
                            <div className="font-bold text-slate-100 flex items-center gap-1.5">
                              <span>{item.item_name}</span>
                              {item.barcode && (
                                <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1 rounded">
                                  {item.barcode.slice(-4)}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Cost: ₹{item.cost_price || 0} | Unit Margin: ₹
                              {Math.max(0, (item.rate || 0) - (item.cost_price || 0)).toFixed(2)}
                            </div>
                          </td>

                          {/* HSN */}
                          <td className="py-2 px-2 text-center text-slate-400 text-[11px]">
                            {item.hsn_code || '2201'}
                          </td>

                          {/* Qty with Quick +/- Buttons */}
                          <td className="py-2 px-2 text-center">
                            <div className="inline-flex items-center justify-center bg-slate-950 rounded-lg border border-slate-700 p-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateCartItem(idx, 'qty', Math.max(1, (item.qty || 1) - 1));
                                }}
                                className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.qty}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateCartItem(idx, 'qty', e.target.value)}
                                className="w-10 text-center bg-transparent font-bold text-white text-xs focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateCartItem(idx, 'qty', (item.qty || 1) + 1);
                                }}
                                className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </td>

                          {/* Unit */}
                          <td className="py-2 px-2 text-center text-slate-400 text-[11px]">
                            {item.unit || 'PCS'}
                          </td>

                          {/* MRP */}
                          <td className="py-2 px-2 text-right text-slate-400">
                            ₹{item.mrp || item.rate}
                          </td>

                          {/* Disc % */}
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discount_pct || 0}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateCartItem(idx, 'discount_pct', e.target.value)}
                              className="w-12 text-right px-1 py-0.5 bg-slate-950 border border-slate-750 focus:border-emerald-500 rounded text-xs text-white"
                            />
                          </td>

                          {/* Rate (Editable) */}
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={item.rate}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateCartItem(idx, 'rate', e.target.value)}
                              className="w-16 text-right px-1 py-0.5 bg-slate-950 border border-slate-750 focus:border-emerald-500 rounded text-xs font-bold text-white"
                            />
                          </td>

                          {/* GST % Badge */}
                          <td className="py-2 px-2 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              {item.gst_pct || 0}%
                            </span>
                          </td>

                          {/* Total Amount */}
                          <td className="py-2 px-3 text-right font-black text-emerald-400 text-xs">
                            ₹{item.total?.toFixed(2) || '0.00'}
                          </td>

                          {/* Actions (Delete) */}
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeCartItem(idx);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Cart Table Footer Summary */}
            {cartItems.length > 0 && (
              <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <span>Selected Row: {selectedRowIndex >= 0 ? `#${selectedRowIndex + 1}` : 'None'}</span>
                  <span>•</span>
                  <span>Items: <strong className="text-white">{cartItems.length}</strong></span>
                  <span>•</span>
                  <span>Units: <strong className="text-white">{billMetrics.totalUnits}</strong></span>
                </div>
                {billMetrics.mrpSavings > 0 && (
                  <div className="text-emerald-400 font-bold">
                    Customer Saved ₹{billMetrics.mrpSavings} on MRP!
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ======================================================== */}
        {/* RIGHT PANE (35%): BILL SUMMARY, PAYMENT & SPEED CHECKOUT */}
        {/* ======================================================== */}
        <section className="w-full lg:w-[35%] flex flex-col gap-4">
          
          {/* CUSTOMER PROFILE CARD (ON THE FLY CREATION & SEARCH) */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/90 shadow-xl relative">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <User className="w-4 h-4 text-emerald-400" />
                <span>Customer Profile</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {customerPhone ? 'Registered Customer' : 'Walk-in Mode'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Phone Input with Autocomplete */}
              <div className="relative">
                <div className="relative flex items-center">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => handleCustomerPhoneChange(e.target.value)}
                    placeholder="Mobile (10 digits)"
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none transition"
                  />
                </div>

                {/* Suggestions dropdown */}
                {showCustomerSuggestions && recentCustomers.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                    {recentCustomers.slice(0, 5).map((c) => (
                      <button
                        key={c.phone}
                        type="button"
                        onClick={() => selectSuggestedCustomer(c)}
                        className="w-full px-2.5 py-1.5 text-left hover:bg-slate-800 text-xs flex justify-between items-center transition"
                      >
                        <span className="font-bold text-slate-200">{c.name}</span>
                        <span className="font-mono text-[10px] text-emerald-400">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Name Input */}
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer Name"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* LIVE PROFIT RADAR CARD */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/25 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-300">
                  Live Profit Radar
                </h4>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide border ${
                billMetrics.profitMargin >= 20
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : billMetrics.profitMargin >= 10
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}>
                {billMetrics.profitMargin >= 20 ? 'High Margin' : billMetrics.profitMargin >= 10 ? 'Healthy' : 'Low Margin'}
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Net Estimated Profit</div>
                <div className="text-xl font-black font-mono text-emerald-400">
                  Profit: ₹{billMetrics.netProfit}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Margin</div>
                <div className="text-base font-black font-mono text-white">
                  {billMetrics.profitMargin}%
                </div>
              </div>
            </div>

            {/* Profit Margin Gauge Bar */}
            <div className="mt-2 w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  billMetrics.profitMargin >= 20
                    ? 'bg-emerald-400'
                    : billMetrics.profitMargin >= 10
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, billMetrics.profitMargin))}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-mono text-slate-400">
              <span>Cost: ₹{billMetrics.totalCost}</span>
              <span>Billing: ₹{billMetrics.grandTotal}</span>
            </div>
          </div>

          {/* TOTALS BREAKDOWN & GRAND TOTAL */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/90 shadow-xl space-y-2.5">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1.5 flex justify-between">
              <span>Totals Breakdown</span>
              <span>GST Split Compliant</span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-300">
              {/* Gross Subtotal (Taxable) */}
              <div className="flex justify-between">
                <span className="text-slate-400">Gross Subtotal (Taxable):</span>
                <span className="font-mono font-semibold">₹{billMetrics.grossSubtotal.toFixed(2)}</span>
              </div>

              {/* GST Split (CGST + SGST) */}
              <div className="flex justify-between">
                <span className="text-slate-400">
                  Total GST (<span className="text-blue-400 font-mono">CGST: ₹{billMetrics.totalCgst}</span> + <span className="text-purple-400 font-mono">SGST: ₹{billMetrics.totalSgst}</span>):
                </span>
                <span className="font-mono font-semibold text-slate-200">
                  ₹{billMetrics.totalGst.toFixed(2)}
                </span>
              </div>

              {/* Round Off */}
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Auto Round-Off:</span>
                <span className={`font-mono font-semibold ${billMetrics.roundOff >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {billMetrics.roundOff >= 0 ? `+₹${billMetrics.roundOff.toFixed(2)}` : `-₹${Math.abs(billMetrics.roundOff).toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Grand Total Banner */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-black">
                  Grand Total
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {cartItems.length} SKUs • {billMetrics.totalUnits} Units
                </div>
              </div>

              <div className="text-3xl font-black font-mono text-emerald-400 tracking-tight drop-shadow-md">
                ₹{billMetrics.grandTotal}
              </div>
            </div>
          </div>

          {/* PAYMENT MODE SELECTOR TABS */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/90 shadow-xl space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Payment Mode
            </div>

            {/* Mode Pills */}
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'CASH', label: 'Cash', icon: Banknote },
                { id: 'DYNAMIC_UPI', label: 'UPI QR', icon: QrCode },
                { id: 'SPLIT', label: 'Split', icon: CreditCard },
                { id: 'KHATA', label: 'Khata', icon: BookOpen }
              ].map((m) => {
                const IconComponent = m.icon;
                const isActive = paymentMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMode(m.id)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition cursor-pointer border ${
                      isActive
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span className="text-[11px]">{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* MODE CONTENT: 1. CASH */}
            {paymentMode === 'CASH' && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold">Tendered Cash:</span>
                  <div className="relative w-32">
                    <span className="absolute left-2.5 top-1.5 text-slate-400 font-mono">₹</span>
                    <input
                      ref={cashInputRef}
                      type="number"
                      min="0"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-6 pr-2 py-1 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg text-right font-mono font-bold text-white text-xs"
                    />
                  </div>
                </div>

                {/* Quick Tender Preset Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[billMetrics.grandTotal, 100, 200, 500, 1000, 2000]
                    .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
                    .map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCashTendered(val.toString())}
                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-mono font-bold text-slate-300 hover:text-white transition cursor-pointer"
                      >
                        {val === billMetrics.grandTotal ? 'Exact' : `₹${val}`}
                      </button>
                    ))}
                </div>

                {/* Change Return Calculator Banner */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Change Return:</span>
                  <span
                    className={`font-black text-sm ${
                      tenderDifference >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {tenderDifference >= 0
                      ? `₹${changeToReturn.toFixed(2)}`
                      : `Short by ₹${Math.abs(tenderDifference).toFixed(2)}`}
                  </span>
                </div>
              </div>
            )}

            {/* MODE CONTENT: 2. DYNAMIC UPI QR */}
            {paymentMode === 'DYNAMIC_UPI' && (
              <DynamicUpiQr
                grandTotal={billMetrics.grandTotal}
                upiId="jaljivan@icici"
                payeeName="JAL JIVAN ENTERPRISE"
                invoiceNumber={nextInvoiceNo}
                compact={true}
                onPaymentConfirmed={() => {
                  showToast('Payment verified via UPI!', 'success');
                  processCheckout(true);
                }}
              />
            )}

            {/* MODE CONTENT: 3. SPLIT PAYMENT */}
            {paymentMode === 'SPLIT' && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Cash Received:</span>
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1.5 text-slate-400 font-mono">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={splitCash}
                      onChange={(e) => setSplitCash(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-6 pr-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-right font-mono font-bold text-white text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">UPI Received:</span>
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1.5 text-slate-400 font-mono">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={splitUpi}
                      onChange={(e) => setSplitUpi(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-6 pr-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-right font-mono font-bold text-white text-xs"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between font-mono text-[11px]">
                  <span className="text-slate-400">Total Tendered:</span>
                  <span className="font-bold text-white">
                    ₹{((parseFloat(splitCash) || 0) + (parseFloat(splitUpi) || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* MODE CONTENT: 4. KHATA / UDHAAR */}
            {paymentMode === 'KHATA' && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-300">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span>Bahi Khata / Udhaar Account</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  This bill of <strong>₹{billMetrics.grandTotal}</strong> will be debited to customer's personal credit ledger balance.
                </p>
                {!customerPhone && (
                  <p className="text-[10px] text-rose-400 font-bold pt-1">
                    * Please enter customer mobile number above.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ACTION BUTTONS (F8 SAVE & PRINT, SAVE WITHOUT PRINT, CLEAR CART) */}
          <div className="space-y-2">
            {/* Primary Checkout: Save & Print Thermal Bill (F8) */}
            <button
              type="button"
              onClick={() => processCheckout(true)}
              disabled={cartItems.length === 0 || isSavingBill}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition transform active:scale-[0.98] cursor-pointer"
            >
              {isSavingBill ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Processing Bill...</span>
                </>
              ) : (
                <>
                  <Printer className="w-5 h-5" />
                  <span>Save & Print Bill (3" Thermal)</span>
                  <span className="px-2 py-0.5 rounded-md bg-black/20 text-xs font-mono font-bold">
                    F8
                  </span>
                </>
              )}
            </button>

            {/* Secondary Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => processCheckout(false)}
                disabled={cartItems.length === 0 || isSavingBill}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Save Without Print</span>
              </button>

              <button
                type="button"
                onClick={clearCart}
                disabled={cartItems.length === 0}
                className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-500/40 disabled:opacity-40 text-rose-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Clear Cart</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* ======================================================== */}
      {/* 3. MODALS & DRAWERS */}
      {/* ======================================================== */}

      {/* MODAL 1: 3-INCH THERMAL RECEIPT MODAL */}
      <ThermalReceipt
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          barcodeInputRef.current?.focus();
        }}
        invoice={completedInvoice}
        autoPrint={true}
      />

      {/* MODAL 2: PARKED CARTS MANAGEMENT MODAL (F4) */}
      {isParkedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-2">
                <PauseCircle className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Parked Carts Manager ({parkedCarts.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsParkedModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {parkedCarts.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No parked carts found. Press <kbd className="px-1 bg-slate-800 rounded text-slate-300">F4</kbd> during an active bill to park it.
                </div>
              ) : (
                parkedCarts.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 hover:border-amber-500/40 transition"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-200">
                        {p.customer_name || 'Walk-in'} {p.customer_phone ? `(${p.customer_phone})` : ''}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Parked at {p.parked_at}</span>
                        <span>•</span>
                        <span>{p.itemCount} items ({p.units} units)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right mr-2 font-mono">
                        <div className="text-xs font-black text-emerald-400">
                          ₹{p.grandTotal}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => resumeParkedCart(p)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Resume</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => discardParkedCart(p.id)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Discard Parked Cart"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RECENT INVOICES REGISTER */}
      {isRecentBillsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Recent Sales Invoices Register
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRecentBillsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-2">
              {recentInvoices.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No sales invoices recorded today yet.
                </div>
              ) : (
                recentInvoices.map((inv) => (
                  <div
                    key={inv.id || inv.invoice_number}
                    className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-100 flex items-center gap-2">
                        <span className="font-mono text-emerald-400">{inv.invoice_number}</span>
                        <span>•</span>
                        <span>{inv.customer_name || 'Walk-in'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>{inv.invoice_date}</span>
                        <span>{inv.invoice_time}</span>
                        <span>•</span>
                        <span className="uppercase text-blue-400 font-bold">{inv.payment_mode}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right font-mono">
                        <div className="font-black text-white">₹{inv.grand_total}</div>
                        <div className="text-[10px] text-emerald-400">
                          Profit: ₹{inv.profit_amount || 0}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setCompletedInvoice(inv);
                          setIsRecentBillsModalOpen(false);
                          setIsReceiptModalOpen(true);
                        }}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        title="Reprint 3-Inch Receipt"
                      >
                        <Printer className="w-4 h-4 text-emerald-400" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: KEYBOARD SHORTCUTS REFERENCE */}
      {isShortcutsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  POS Keyboard Hotkeys
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsShortcutsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { key: 'F1', desc: 'Focus Barcode Scanner Input' },
                { key: 'F2', desc: 'Focus Smart Item Search Box' },
                { key: 'Space', desc: 'Voice Billing (Gemini Speech-to-Cart)' },
                { key: 'F4', desc: 'Park Current Cart / Open Parked Carts' },
                { key: 'F8', desc: 'Save & Print Bill (3-Inch Thermal Receipt)' },
                { key: 'Delete', desc: 'Remove Selected Row in Line Items Table' },
                { key: 'Esc', desc: 'Close Modals / Dismiss Search Dropdown' }
              ].map((s) => (
                <div
                  key={s.key}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950 border border-slate-800"
                >
                  <span className="text-slate-300">{s.desc}</span>
                  <kbd className="px-2 py-1 rounded bg-slate-800 font-mono text-emerald-400 font-bold text-xs">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
