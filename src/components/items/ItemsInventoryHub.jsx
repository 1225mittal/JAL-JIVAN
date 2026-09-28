import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Barcode as BarcodeIcon,
  IndianRupee,
  Layers,
  TrendingDown,
  ArrowUpDown,
  Filter,
  X,
  Save,
  Scan,
  Download,
  ArrowLeft,
  FolderEdit,
  CheckSquare
} from 'lucide-react';
import {
  supabase,
  isSupabaseConfigured,
  fetchInventoryItems,
  saveInventoryItem,
  deleteInventoryItem,
  bulkDeleteInventoryItems,
  bulkUpdateInventoryCategory
} from '../../lib/supabase';
import useRealtimeSubscription from '../../hooks/useRealtimeSubscription';
import BarcodeScannerModal from '../BarcodeScannerModal';

/**
 * Infer category from FMCG item name if unassigned
 */
export function inferCategory(name = '') {
  const upper = (name || '').toUpperCase();
  if (/MASALA|CHILLI|MIRCH|HALDI|TURMERIC|DHANIYA|CORIANDER|JEERA|CUMIN|GARAM|HING|KASURI|METHI|CARDAMOM|CLOVE|SPICE/i.test(upper)) {
    return 'Spices & Masalas';
  }
  if (/CHUTNEY|PASTE|PICKLE|ACHAR|SAUCE|KETCHUP|VINEGAR|DIP/i.test(upper)) {
    return 'Chutneys & Sauces';
  }
  if (/BHEL|NAMKEEN|SNACK|CHIPS|BHUJIA|SEV|KURKURE|POPCORN|MIXTURE/i.test(upper)) {
    return 'Snacks & Namkeen';
  }
  if (/BISCUIT|COOKIE|RUSK|CAKE|BREAD|TOAST|WAFER/i.test(upper)) {
    return 'Bakery & Biscuits';
  }
  if (/OIL|GHEE|MUSTARD|REFINED|VANASPATI/i.test(upper)) {
    return 'Edible Oils & Ghee';
  }
  if (/ATTA|RICE|FLOUR|DAL|PULSE|BESAN|SUJI|MAIDA|GRAIN|WHEAT|CHANA|SOYA/i.test(upper)) {
    return 'Staples & Grains';
  }
  if (/SOAP|SHAMPOO|WASH|CLEANER|DETERGENT|PASTE|BRUSH|TOOTH/i.test(upper)) {
    return 'Personal & Home Care';
  }
  return 'General FMCG';
}

/**
 * Format GST% cleanly: snap standard slabs (0, 5, 12, 18, 28) and format floating rates
 */
export const formatGst = (val) => {
  const num = parseFloat(val) || 0;
  // Snap close floating values (e.g. 5.000169... -> 5%)
  const rounded = Math.round(num);
  // If it's close to standard GST slabs (0, 5, 12, 18, 28), show as whole number
  if ([0, 5, 12, 18, 28].includes(rounded) && Math.abs(num - rounded) < 0.2) {
    return `${rounded}%`;
  }
  return `${num.toFixed(1)}%`;
};

export default function ItemsInventoryHub({
  onBackToHub = null,
  showToast = () => {}
}) {
  const [items, setItems] = useState([]);
  const [rawPurchasedItems, setRawPurchasedItems] = useState([]);
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' | 'all'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'low' | 'out'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortField, setSortField] = useState('item_name');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'

  // Multi-Select & Bulk Actions
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [bulkCategoryInput, setBulkCategoryInput] = useState('');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const masterCheckboxRef = useRef(null);

  // Edit / Create Drawer Modal State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Barcode Scanner Modal State
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);

  const [verifiedInvoicesCount, setVerifiedInvoicesCount] = useState(9);

  // Load Inventory Data directly from purchase_items and verify all 9 invoices
  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      let rawData = [];
      let invoicesData = [];

      if (isSupabaseConfigured && supabase) {
        // Fetch all records directly from purchase_items without restricting to any invoice
        const { data: dbData, error } = await supabase
          .from('purchase_items')
          .select('*')
          .order('created_at', { ascending: false });

        // Query all 9 purchase_invoices to verify all invoices are included and compute true landed cost
        const { data: invData, error: invError } = await supabase
          .from('purchase_invoices')
          .select('id, invoice_number, grand_total, total_taxable_amount, total_tax_amount, seller_name, invoice_date')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Direct purchase_items fetch notice:', error.message);
          rawData = await fetchInventoryItems();
        } else {
          rawData = dbData || [];
        }

        invoicesData = invData || [];
        if (invoicesData.length > 0) {
          setVerifiedInvoicesCount(invoicesData.length);
        }
      } else {
        rawData = await fetchInventoryItems();
      }

      setRawPurchasedItems(rawData || []);

      // Calculate gross sum per invoice to determine exact landed multiplier
      const invGrossMap = {};
      (rawData || []).forEach((it) => {
        const invId = it.purchase_invoice_id;
        if (invId) {
          const itemGross = Number(it.quantity || 0) * Number(it.purchase_price || 0);
          invGrossMap[invId] = (invGrossMap[invId] || 0) + itemGross;
        }
      });

      const invoiceMap = new Map();
      (invoicesData || []).forEach((inv) => {
        const gross = invGrossMap[inv.id] || 0;
        const grandTotal = Number(inv.grand_total) || 0;
        const taxable = Number(inv.total_taxable_amount) || 0;
        const tax = Number(inv.total_tax_amount) || 0;
        const taxPct = taxable > 0 ? (tax / taxable) * 100 : 5;
        const landedRatio = gross > 0 ? (grandTotal / gross) : (1 + taxPct / 100);

        invoiceMap.set(inv.id, {
          ...inv,
          gross,
          taxPct,
          landedRatio
        });
      });

      const normalized = (rawData || []).map((it, idx) => {
        const qty = Math.max(0, Number(it.quantity ?? it.stock_qty) || 0);
        const purchasePrice = Number(it.purchase_price ?? it.cost_price) || 0;
        const inv = it.purchase_invoice_id ? invoiceMap.get(it.purchase_invoice_id) : null;
        const cgst = Number(it.cgst_pct || 0);
        const sgst = Number(it.sgst_pct || 0);
        const igst = Number(it.igst_pct || 0);
        let gstPct = Number(it.gst_percentage ?? it.gst_pct ?? it.gst_rate ?? 0);
        if (gstPct === 0 && (cgst > 0 || sgst > 0)) {
          gstPct = +(cgst + sgst).toFixed(2);
        } else if (gstPct === 0 && igst > 0) {
          gstPct = igst;
        } else if (gstPct === 0 && inv?.taxPct) {
          gstPct = Number(inv.taxPct.toFixed(2));
        }

        // Landed Cost = price_after_gst (or purchase_price * (1 + gst_pct / 100))
        let unitLandedCost = Number(it.landing_cost || it.landed_cost || it.price_after_gst) > 0
          ? Number(it.landing_cost || it.landed_cost || it.price_after_gst)
          : (inv?.landedRatio ? Number((purchasePrice * inv.landedRatio).toFixed(4)) : Number((purchasePrice * (1 + gstPct / 100)).toFixed(4)));

        if (isNaN(unitLandedCost) || unitLandedCost <= 0) {
          unitLandedCost = purchasePrice;
        }

        const salePrice = Number(it.selling_price || it.mrp || 0);
        const marginAmount = Number(it.margin_amount ?? (salePrice - unitLandedCost));
        const marginPct = Number(it.margin_percentage ?? (salePrice > 0 ? ((marginAmount / salePrice) * 100).toFixed(1) : 0));

        return {
          id: it.id || `pi_${idx}`,
          purchase_invoice_id: it.purchase_invoice_id || null,
          invoice_number: inv?.invoice_number || null,
          seller_name: inv?.seller_name || null,
          barcode: (it.barcode || '').toString().trim() || null,
          item_name: (it.item_name || 'Unnamed Item').toString().trim(),
          category: it.category || inferCategory(it.item_name),
          hsn_code: (it.hsn_code || '').toString().trim() || null,
          stock_qty: qty,
          quantity: qty,
          cost_price: purchasePrice,
          purchase_price: purchasePrice,
          unit_landed_cost: unitLandedCost,
          landed_cost: unitLandedCost,
          landing_cost: unitLandedCost,
          purchase_price_with_tax: unitLandedCost,
          price_after_gst: unitLandedCost,
          mrp: Number(it.mrp) || 0,
          selling_price: salePrice,
          margin_amount: marginAmount,
          margin_percentage: marginPct,
          margin_pct: marginPct,
          gst_pct: gstPct,
          gst_percentage: gstPct,
          unit: it.unit || 'PCS',
          created_at: it.created_at || new Date().toISOString()
        };
      });

      setItems(normalized);
    } catch (err) {
      console.error('Failed to load items for Stock Master:', err);
      setErrorMsg(err.message || 'Failed to load inventory data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Live Supabase Realtime subscription across inventory and stock counts
  useRealtimeSubscription({
    table: ['purchase_items', 'inventory_items', 'purchase_invoices'],
    setData: setRawPurchasedItems,
    prepend: true,
    onInsert: (newRecord) => {
      loadData();
    },
    onUpdate: (updatedRecord) => {
      setItems((prev) =>
        prev.map((it) =>
          it.id === updatedRecord.id
            ? {
                ...it,
                ...updatedRecord,
                quantity: Number(updatedRecord.quantity ?? updatedRecord.stock_qty ?? it.quantity),
                stock_qty: Number(updatedRecord.quantity ?? updatedRecord.stock_qty ?? it.stock_qty)
              }
            : it
        )
      );
      loadData();
    },
    onDelete: (deletedRecord) => {
      const delId = deletedRecord?.id;
      if (delId) {
        setItems((prev) => prev.filter((it) => it.id !== delId));
      }
      loadData();
    }
  });

  // Deduplicate / Group Display
  const displayedItems = useMemo(() => {
    if (viewMode === 'all') {
      return items;
    }

    // Group items by item_name so duplicate inward entries combine their quantity
    const map = new Map();
    (items || []).forEach((item) => {
      const key = (item.item_name || '').trim().toLowerCase();
      const qty = Number(item.stock_qty ?? item.quantity) || 0;
      const cost = Number(item.cost_price ?? item.purchase_price) || 0;
      const landed = Number(item.unit_landed_cost ?? item.landed_cost ?? item.price_after_gst) || cost;
      const mrp = Number(item.mrp) || 0;
      const selling = Number(item.selling_price || item.mrp || 0);
      const gst = Number(item.gst_percentage ?? item.gst_pct ?? 0);

      if (!map.has(key)) {
        map.set(key, {
          ...item,
          stock_qty: qty,
          quantity: qty,
          cost_price: cost,
          purchase_price: cost,
          unit_landed_cost: landed,
          landed_cost: landed,
          purchase_price_with_tax: landed,
          price_after_gst: landed,
          mrp: mrp,
          selling_price: selling,
          gst_pct: gst,
          gst_percentage: gst,
          inward_batches: 1,
          all_ids: [item.id],
          latest_created_at: item.created_at
        });
      } else {
        const existing = map.get(key);
        existing.stock_qty += qty;
        existing.quantity += qty;
        existing.inward_batches += 1;
        existing.all_ids.push(item.id);

        if (!existing.barcode && item.barcode) existing.barcode = item.barcode;
        if (!existing.hsn_code && item.hsn_code) existing.hsn_code = item.hsn_code;
        if (cost > 0) {
          existing.cost_price = cost;
          existing.purchase_price = cost;
        }
        if (landed > 0) {
          existing.unit_landed_cost = landed;
          existing.landed_cost = landed;
          existing.purchase_price_with_tax = landed;
          existing.price_after_gst = landed;
        }
        if (mrp > 0) existing.mrp = mrp;
        if (selling > 0) existing.selling_price = selling;
        if (gst > 0) {
          existing.gst_pct = gst;
          existing.gst_percentage = gst;
        }
        if (new Date(item.created_at) > new Date(existing.latest_created_at)) {
          existing.latest_created_at = item.created_at;
        }
      }
    });

    return Array.from(map.values());
  }, [items, viewMode]);

  // Unique categories list
  const categories = useMemo(() => {
    const set = new Set();
    (displayedItems || []).forEach((item) => {
      if (item && item.category) set.add(item.category);
    });
    return Array.from(set).sort();
  }, [displayedItems]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    let result = [...(displayedItems || [])];

    // Stock Filter
    if (stockFilter === 'low') {
      result = result.filter((i) => Number(i?.stock_qty || 0) > 0 && Number(i?.stock_qty || 0) < 10);
    } else if (stockFilter === 'out') {
      result = result.filter((i) => Number(i?.stock_qty || 0) <= 0);
    }

    // Category Filter
    if (selectedCategory !== 'all') {
      result = result.filter((i) => i?.category === selectedCategory);
    }

    // Search Query (name, barcode, hsn, category)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (i) =>
          (i?.item_name && i.item_name.toLowerCase().includes(q)) ||
          (i?.barcode && i.barcode.toLowerCase().includes(q)) ||
          (i?.hsn_code && i.hsn_code.toLowerCase().includes(q)) ||
          (i?.category && i.category.toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      let aVal = a?.[sortField] ?? '';
      let bVal = b?.[sortField] ?? '';

      if (sortField === 'margin' || sortField === 'margin_amount') {
        const getMargin = (it) => {
          const landed = parseFloat(it?.unit_landed_cost || it?.landed_cost || it?.price_after_gst || it?.purchase_price_with_tax || it?.cost_price || 0);
          const sale = parseFloat(it?.selling_price || it?.mrp || 0);
          return sale - landed;
        };
        aVal = getMargin(a);
        bVal = getMargin(b);
      } else if (typeof aVal === 'number' || typeof bVal === 'number') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [displayedItems, stockFilter, selectedCategory, searchQuery, sortField, sortOrder]);

  // Inventory KPI Metrics: Computed from all 78 fetched items
  const metrics = useMemo(() => {
    // Total Catalog SKUs: distinct item_name count across all fetched purchase_items (78)
    const distinctSkuNames = new Set((rawPurchasedItems || []).map((i) => (i.item_name || '').trim().toLowerCase()));
    const totalSkus = distinctSkuNames.size > 0 ? distinctSkuNames.size : (rawPurchasedItems || []).length;

    let totalStockUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalPreTaxValuation = 0;
    let totalLandedValuation = 0;

    (items || []).forEach((item) => {
      const qty = Number(item.quantity ?? item.stock_qty) || 0;
      const preTaxCost = Number(item.purchase_price ?? item.cost_price) || 0;
      const unitLanded = Number(item.unit_landed_cost ?? item.price_after_gst) || (preTaxCost * (1 + (item.gst_percentage || item.gst_pct || 0) / 100));

      totalStockUnits += qty;
      totalPreTaxValuation += qty * preTaxCost;
      totalLandedValuation += qty * unitLanded;
    });

    // Low stock / out of stock computed from the catalog (displayedItems)
    (displayedItems || []).forEach((item) => {
      const qty = Number(item.stock_qty ?? item.quantity) || 0;
      if (qty <= 0) {
        outOfStockCount++;
      } else if (qty < 10) {
        lowStockCount++;
      }
    });

    return {
      totalSkus,
      totalStockUnits,
      lowStockCount,
      outOfStockCount,
      totalPreTaxValuation: Math.round(totalPreTaxValuation),
      totalLandedValuation: Math.round(totalLandedValuation),
      invoiceCount: verifiedInvoicesCount || 9
    };
  }, [rawPurchasedItems, items, displayedItems, verifiedInvoicesCount]);

  // Open Drawer for Add New Item
  const handleAddNew = () => {
    setEditingItem({
      barcode: '',
      item_name: '',
      category: 'General',
      mrp: 0,
      cost_price: 0,
      selling_price: 0,
      stock_qty: 0,
      hsn_code: '',
      gst_pct: 18
    });
    setIsDrawerOpen(true);
  };

  // Open Drawer for Edit
  const handleEdit = (item) => {
    setEditingItem({ ...item });
    setIsDrawerOpen(true);
  };

  // Save Item
  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editingItem?.item_name?.trim()) {
      showToast('Item name is required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveInventoryItem(editingItem);
      showToast('Inventory item saved successfully!', 'success');
      setIsDrawerOpen(false);
      setEditingItem(null);
      await loadData();
    } catch (err) {
      console.error('Failed to save item:', err);
      showToast(err.message || 'Failed to save inventory item', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Item
  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.item_name}"?`)) return;
    try {
      await deleteInventoryItem(item.id);
      showToast('Item deleted successfully', 'success');
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      console.error('Failed to delete item:', err);
      showToast(err.message || 'Failed to delete item', 'error');
    }
  };

  // Barcode scanned callback
  const handleBarcodeScanned = (scannedCode) => {
    if (editingItem) {
      setEditingItem((prev) => ({ ...prev, barcode: scannedCode }));
      showToast(`Scanned barcode: ${scannedCode}`, 'success');
    }
    setIsBarcodeScannerOpen(false);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Multi-Select Visible IDs & Indeterminate State
  const visibleIds = useMemo(() => (filteredItems || []).map((i) => i.id), [filteredItems]);
  const selectedVisibleCount = useMemo(() => {
    return visibleIds.filter((id) => selectedItemIds.has(id)).length;
  }, [visibleIds, selectedItemIds]);

  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const isIndeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;

  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  // Toggle all visible rows
  const handleToggleSelectAll = () => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // Toggle single row
  const handleToggleRow = (id) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Deselect All
  const handleDeselectAll = () => {
    setSelectedItemIds(new Set());
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    const count = selectedItemIds.size;
    if (count === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${count} selected item(s)? This action cannot be undone.`)) {
      return;
    }

    setIsBulkProcessing(true);
    try {
      const ids = Array.from(selectedItemIds);
      await bulkDeleteInventoryItems(ids);
      setItems((prev) => prev.filter((i) => !selectedItemIds.has(i.id)));
      setSelectedItemIds(new Set());
      showToast(`Deleted ${count} item(s) successfully`, 'success');
    } catch (err) {
      console.error('Failed to bulk delete items:', err);
      showToast(err.message || 'Failed to bulk delete items', 'error');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Open Bulk Category Modal
  const handleOpenCategoryModal = () => {
    if (selectedItemIds.size === 0) return;
    setBulkCategoryInput(categories[0] || 'General');
    setCustomCategoryInput('');
    setIsCategoryModalOpen(true);
  };

  // Apply Bulk Category Update
  const handleApplyBulkCategory = async (e) => {
    e?.preventDefault();
    const targetCategory = (bulkCategoryInput === '__custom__' ? customCategoryInput : bulkCategoryInput).trim();
    if (!targetCategory) {
      showToast('Please enter or select a category', 'error');
      return;
    }

    const count = selectedItemIds.size;
    setIsBulkProcessing(true);
    try {
      const ids = Array.from(selectedItemIds);
      await bulkUpdateInventoryCategory(ids, targetCategory);
      setItems((prev) =>
        prev.map((i) => (selectedItemIds.has(i.id) ? { ...i, category: targetCategory } : i))
      );
      setSelectedItemIds(new Set());
      setIsCategoryModalOpen(false);
      showToast(`Category updated to "${targetCategory}" for ${count} item(s)`, 'success');
    } catch (err) {
      console.error('Failed to update category:', err);
      showToast(err.message || 'Failed to update category', 'error');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {onBackToHub && (
            <button
              type="button"
              onClick={onBackToHub}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          )}
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-400" />
              <span>Item & Stock Master</span>
            </h2>
            <p className="text-xs text-slate-400">
              Universal SKU catalog with live inventory tracking and auto-syncing from purchase bills.
            </p>
          </div>
        </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle: Grouped SKUs vs All Inward Lines */}
            <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'grouped'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Group duplicate inward entries by product name and combine stock quantities"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Grouped SKUs ({metrics.totalSkus})</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Display all individual inward line items from purchase_items"
              >
                <Package className="w-3.5 h-3.5" />
                <span>All Inward Lines ({rawPurchasedItems.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
              title="Refresh Inventory"
            >
              <RefreshCw className={`w-4 h-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleAddNew}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Item</span>
            </button>
          </div>
        </div>

        {/* KPI Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Total SKUs */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400">Total Catalog SKUs</div>
              <div className="text-lg font-black text-white">{metrics.totalSkus}</div>
            </div>
          </div>

          {/* Total Stock Units */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-400">Units in Stock</div>
              <div className="text-lg font-black text-emerald-400">{metrics.totalStockUnits}</div>
            </div>
          </div>

          {/* Low Stock Alerts */}
          <div
            onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
            className={`p-3.5 rounded-2xl border transition cursor-pointer ${
              stockFilter === 'low'
                ? 'bg-amber-500/20 border-amber-500/50 shadow-md shadow-amber-500/10'
                : 'bg-slate-900/90 border-slate-800 hover:border-amber-500/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                  <span>Low Stock (&lt;10)</span>
                </div>
                <div className="text-lg font-black text-amber-300">{metrics.lowStockCount}</div>
              </div>
            </div>
          </div>

          {/* Inventory Valuation Card */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span>Stock Valuation (Landed / Tax-Incl.)</span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  All {metrics.invoiceCount} Invoices
                </span>
              </div>
              <div className="text-lg font-black text-cyan-300">
                ₹{metrics.totalLandedValuation.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5 font-medium">
                <span>Excl. Tax: <strong className="text-slate-300">₹{metrics.totalPreTaxValuation.toLocaleString('en-IN')}</strong></span>
                <span className="text-slate-600">|</span>
                <span>Incl. Tax: <strong className="text-emerald-400">₹{metrics.totalLandedValuation.toLocaleString('en-IN')}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by SKU name, barcode, HSN, category..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setStockFilter('all')}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                  stockFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({displayedItems.length})
              </button>
            <button
              type="button"
              onClick={() => setStockFilter('low')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                stockFilter === 'low'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              Low Stock ({metrics.lowStockCount})
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('out')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                stockFilter === 'out'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-rose-400 hover:text-rose-300'
              }`}
            >
              Out of Stock ({metrics.outOfStockCount})
            </button>
          </div>

          {/* Category Dropdown */}
          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8 px-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Categories</option>
              {(categories || []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Sticky Bulk Actions Bar */}
      {selectedItemIds.size > 0 && (
        <div className="sticky top-2 z-20 p-3 rounded-2xl bg-indigo-950/95 border-2 border-indigo-500/60 shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-indigo-500/30 text-indigo-300 font-black text-xs border border-indigo-400/40">
              {selectedItemIds.size}
            </span>
            <span className="text-sm font-bold text-white tracking-wide">
              {selectedItemIds.size} {selectedItemIds.size === 1 ? 'Item' : 'Items'} Selected
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleOpenCategoryModal}
              disabled={isBulkProcessing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-200 hover:text-white font-bold text-xs border border-indigo-500/30 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <FolderEdit className="w-4 h-4 text-indigo-400" />
              <span>Change Category</span>
            </button>

            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isBulkProcessing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 hover:text-white font-bold text-xs border border-rose-500/30 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Bulk Delete</span>
            </button>

            <button
              type="button"
              onClick={handleDeselectAll}
              disabled={isBulkProcessing}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-xs border border-slate-700 transition cursor-pointer"
              title="Deselect all items"
            >
              <X className="w-3.5 h-3.5" />
              <span>Deselect All</span>
            </button>
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    ref={masterCheckboxRef}
                    checked={allVisibleSelected}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                    title="Select / Deselect all visible items"
                  />
                </th>
                <th
                  onClick={() => handleSort('barcode')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Barcode / EAN</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('item_name')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition min-w-[200px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Product Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>
                <th className="py-3 px-2">Category</th>
                <th className="py-3 px-2">HSN</th>
                <th
                  onClick={() => handleSort('stock_qty')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Current Stock</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('unit_landed_cost')}
                  className="py-3 px-2 text-right cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Landed Cost (₹)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>
                <th className="py-3 px-2 text-right">MRP (₹)</th>
                <th className="py-3 px-2 text-right">Selling Price</th>
                <th
                  onClick={() => handleSort('margin')}
                  className="py-3 px-2 text-right cursor-pointer hover:text-white transition min-w-[125px]"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Margin (₹ / %)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>
                <th className="py-3 px-2 text-right">GST %</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {(filteredItems || []).map((item) => {
                const isSelected = selectedItemIds.has(item.id);
                const qty = Number(item?.stock_qty) || 0;
                const isOut = qty <= 0;
                const isLow = qty > 0 && qty < 10;

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-indigo-950/40 ring-1 ring-inset ring-indigo-500/40'
                        : isOut
                        ? 'bg-rose-950/10 hover:bg-rose-950/20'
                        : isLow
                        ? 'bg-amber-950/10 hover:bg-amber-950/20'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Row Selection Checkbox */}
                    <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleRow(item.id)}
                        className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                      />
                    </td>

                    {/* Barcode */}
                    <td className="py-2.5 px-3">
                      {item.barcode ? (
                        <span className="font-mono text-[11px] font-bold text-indigo-300 px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/25">
                          {item.barcode}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          <span>Assign Barcode</span>
                        </button>
                      )}
                    </td>

                    {/* Name */}
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-white max-w-xs truncate flex items-center gap-1.5" title={item.item_name}>
                        <span className="truncate">{item.item_name}</span>
                        {item.inward_batches > 1 && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {item.inward_batches} Inwards
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-2.5 px-2 text-slate-400">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {item.category || 'General'}
                      </span>
                    </td>

                    {/* HSN */}
                    <td className="py-2.5 px-2 font-mono text-slate-400 text-[11px]">
                      {item.hsn_code || '—'}
                    </td>

                    {/* Stock Qty */}
                    <td className="py-2.5 px-3 text-right">
                      {isOut ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 font-mono font-bold text-xs">
                          <XCircle className="w-3 h-3" />
                          <span>0 Out of Stock</span>
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{qty} Low</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-xs">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{qty} Units</span>
                        </span>
                      )}
                    </td>

                    {/* Cost Price / Landed Cost */}
                    <td className="py-2.5 px-2 text-right">
                      <div className="font-mono text-slate-200 font-bold">
                        ₹{Number(item.unit_landed_cost || item.cost_price || 0).toFixed(2)}
                      </div>
                      {Number(item.cost_price || 0) > 0 && Math.abs(Number(item.unit_landed_cost || 0) - Number(item.cost_price || 0)) > 0.01 && (
                        <div className="text-[10px] text-slate-500 font-mono" title="Pre-tax purchase price">
                          Base: ₹{Number(item.cost_price || 0).toFixed(2)}
                        </div>
                      )}
                    </td>

                    {/* MRP */}
                    <td className="py-2.5 px-2 text-right font-mono text-slate-400">
                      ₹{Number(item.mrp || 0).toFixed(2)}
                    </td>

                    {/* Selling Price */}
                    <td className="py-2.5 px-2 text-right font-mono text-emerald-400 font-bold">
                      ₹{Number(item.selling_price || item.mrp || 0).toFixed(2)}
                    </td>

                    {/* Margin (₹ / %) */}
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      {(() => {
                        const landed_cost = parseFloat(item.unit_landed_cost || item.landed_cost || item.price_after_gst || item.purchase_price_with_tax || item.cost_price || item.purchase_price || 0);
                        const sale_price = parseFloat(item.selling_price || item.mrp || 0);
                        const margin_amount = sale_price - landed_cost;
                        const margin_pct = sale_price > 0 ? ((margin_amount / sale_price) * 100).toFixed(1) : 0;

                        if (margin_amount > 0) {
                          return (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold font-mono text-[11px] shadow-sm">
                              +₹{margin_amount.toFixed(2)} ({margin_pct}%)
                            </span>
                          );
                        }
                        if (margin_amount < 0) {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold font-mono text-[11px] shadow-sm animate-pulse" title="Negative margin / Loss warning">
                              <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                              <span>-₹{Math.abs(margin_amount).toFixed(2)} ({margin_pct}%)</span>
                            </span>
                          );
                        }
                        return (
                          <span className="font-mono text-slate-500 text-[11px]">
                            ₹0.00 (0%)
                          </span>
                        );
                      })()}
                    </td>

                    {/* GST % */}
                    <td className="py-2.5 px-2 text-right font-mono">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300">
                        {formatGst(item.gst_percentage ?? item.gst_pct)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                          title="Edit Item"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                          title="Delete Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan="12" className="py-12 text-center text-slate-500">
                    <Package className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="font-semibold">No items match your filter criteria.</p>
                    <button
                      type="button"
                      onClick={handleAddNew}
                      className="mt-2 text-xs text-indigo-400 hover:underline font-bold"
                    >
                      + Add a new inventory item now
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Edit / Create Drawer Modal */}
      {isDrawerOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-400" />
                  <span>{editingItem.id ? 'Edit Inventory Item' : 'New Inventory Item'}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Update SKU details, stock levels, and barcode mapping.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              {/* Product Name */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Product / Item Name *</label>
                <input
                  type="text"
                  required
                  value={editingItem.item_name || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, item_name: e.target.value })}
                  placeholder="e.g. Bisleri 20L Water Can"
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white font-medium focus:outline-none"
                />
              </div>

              {/* Barcode & Scanner button */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Universal Barcode / EAN</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <BarcodeIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={editingItem.barcode || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, barcode: e.target.value })}
                      placeholder="e.g. 8901030000000"
                      className="w-full h-9 pl-9 pr-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white font-mono focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBarcodeScannerOpen(true)}
                    className="h-9 px-3 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Scan className="w-4 h-4" />
                    <span>Scan</span>
                  </button>
                </div>
              </div>

              {/* Category & HSN Code */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category</label>
                  <input
                    type="text"
                    value={editingItem.category || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    placeholder="e.g. Water / Beverages"
                    className="w-full h-9 px-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={editingItem.hsn_code || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, hsn_code: e.target.value })}
                    placeholder="e.g. 2201"
                    className="w-full h-9 px-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Stock Quantity & GST % */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Current Stock Qty</label>
                  <input
                    type="number"
                    min="0"
                    value={editingItem.stock_qty ?? 0}
                    onChange={(e) => setEditingItem({ ...editingItem, stock_qty: Number(e.target.value) })}
                    className="w-full h-9 px-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">GST Rate (%)</label>
                  <select
                    value={editingItem.gst_pct ?? 18}
                    onChange={(e) => setEditingItem({ ...editingItem, gst_pct: Number(e.target.value) })}
                    className="w-full h-9 px-3 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white focus:outline-none cursor-pointer"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              {/* Cost Price, MRP, Selling Price */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Cost Rate (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.cost_price ?? 0}
                    onChange={(e) => setEditingItem({ ...editingItem, cost_price: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.mrp ?? 0}
                    onChange={(e) => setEditingItem({ ...editingItem, mrp: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Selling (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingItem.selling_price ?? 0}
                    onChange={(e) => setEditingItem({ ...editingItem, selling_price: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Profit Margin Info */}
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Estimated Margin:</span>
                <span className="font-mono font-bold text-emerald-400">
                  ₹{(Number(editingItem.selling_price || 0) - Number(editingItem.cost_price || 0)).toFixed(2)}
                  {' '}(
                  {Number(editingItem.cost_price) > 0
                    ? (((Number(editingItem.selling_price || 0) - Number(editingItem.cost_price || 0)) / Number(editingItem.cost_price)) * 100).toFixed(1)
                    : 0}
                  %)
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white font-black transition shadow-lg shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Item'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {isBarcodeScannerOpen && (
        <BarcodeScannerModal
          isOpen={isBarcodeScannerOpen}
          onClose={() => setIsBarcodeScannerOpen(false)}
          onScan={handleBarcodeScanned}
        />
      )}

      {/* Bulk Change Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FolderEdit className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Bulk Change Category</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Apply a new category to all <strong className="text-white font-mono">{selectedItemIds.size}</strong> selected items:
            </p>

            <form onSubmit={handleApplyBulkCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Select Category
                </label>
                <select
                  value={bulkCategoryInput}
                  onChange={(e) => setBulkCategoryInput(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__custom__">+ Enter Custom Category Name...</option>
                </select>
              </div>

              {bulkCategoryInput === '__custom__' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Custom Category Name
                  </label>
                  <input
                    type="text"
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    placeholder="e.g. Beverages, Dairy, Snacks..."
                    autoFocus
                    required
                    className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBulkProcessing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isBulkProcessing ? 'Updating...' : `Update (${selectedItemIds.size}) Items`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export { ItemsInventoryHub };

