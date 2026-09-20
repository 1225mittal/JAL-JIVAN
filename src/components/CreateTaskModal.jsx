import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  PackagePlus,
  Hash,
  IndianRupee,
  MapPin,
  Landmark,
  User,
  Phone,
  Loader2,
  Sparkles,
  Search,
  Check,
  Plus,
  Minus,
  Package,
  BookOpen,
  CheckCircle2,
  Navigation,
  FileText,
  Camera,
  Upload
} from 'lucide-react';
import { fetchSavedAddresses, supabase, isSupabaseConfigured, uploadOrderSlip } from '../lib/supabase';
import { extractOrderFromSlip } from '../lib/geminiOcr';

export default function CreateTaskModal({
  isOpen,
  onClose,
  drivers = [],
  products = [],
  orders = [],
  onCreateTask
}) {
  const [orderNumber, setOrderNumber] = useState(`JJ-${Math.floor(1000 + Math.random() * 9000)}`);
  const [amount, setAmount] = useState('');
  const [isAmountManuallyEdited, setIsAmountManuallyEdited] = useState(false);
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [pinnedLat, setPinnedLat] = useState(null);
  const [pinnedLng, setPinnedLng] = useState(null);

  // Address Autocomplete State
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [isAddressDropdownOpen, setIsAddressDropdownOpen] = useState(false);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const addressContainerRef = useRef(null);

  // Product Selection State: { [productId]: quantity }
  const [selectedQuantities, setSelectedQuantities] = useState({});

  // Handwritten Paper Slip Photo State
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState('');
  const slipInputRef = useRef(null);
  const [isAnalyzingSlip, setIsAnalyzingSlip] = useState(false);
  const [aiParseSuccess, setAiParseSuccess] = useState(false);
  const [aiExtractedNotes, setAiExtractedNotes] = useState('');
  const [customItems, setCustomItems] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSlipChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSlipFile(file);
    const url = URL.createObjectURL(file);
    setSlipPreview(url);
    setAiParseSuccess(false);

    // Automatically trigger AI handwriting extraction with Gemini 1.5 Flash
    console.log("Gemini Key Exists:", !!import.meta.env.VITE_GEMINI_API_KEY);
    try {
      setIsAnalyzingSlip(true);
      const parsed = await extractOrderFromSlip(file);
      if (parsed) {
        if (parsed.customer_name) {
          setCustomerName(parsed.customer_name);
        }
        if (parsed.customer_phone) {
          setCustomerPhone(parsed.customer_phone);
        }
        if (parsed.delivery_address) {
          setAddress(parsed.delivery_address);
        }
        if (parsed.landmark) {
          setLandmark(parsed.landmark);
        }
        if (parsed.notes) {
          setAiExtractedNotes(parsed.notes);
        }

        // Map parsed items into order items
        if (Array.isArray(parsed.items) && parsed.items.length > 0) {
          const updatedQuantities = { ...selectedQuantities };
          const newCustomList = [];

          parsed.items.forEach((item) => {
            const rawName = (item.item_name || '').toLowerCase();
            const matchedProduct = products.find((p) => {
              const pName = (p.name || '').toLowerCase();
              return (
                pName.includes(rawName) ||
                rawName.includes(pName) ||
                (rawName.includes('20') && pName.includes('20')) ||
                (rawName.includes('jar') && pName.includes('can')) ||
                (rawName.includes('can') && pName.includes('can'))
              );
            });

            if (matchedProduct) {
              updatedQuantities[matchedProduct.id] =
                (updatedQuantities[matchedProduct.id] || 0) + (Number(item.quantity) || 1);
            } else {
              const qty = Number(item.quantity) || 1;
              const unitPrice = Number(item.price) || 0;
              newCustomList.push({
                id: 'ai-item-' + Math.random().toString(36).substring(2, 9),
                name: item.item_name || 'Handwritten Item',
                unit: 'Slip Item',
                quantity: qty,
                price: unitPrice,
                total: qty * unitPrice
              });
            }
          });

          setSelectedQuantities(updatedQuantities);
          if (newCustomList.length > 0) {
            setCustomItems(newCustomList);
          }
        }

        // Set total amount
        if (parsed.total_amount && Number(parsed.total_amount) > 0) {
          setAmount(String(parsed.total_amount));
          setIsAmountManuallyEdited(true);
        }

        setAiParseSuccess(true);
      }
    } catch (ocrErr) {
      console.warn('AI OCR extraction skipped or encountered an error:', ocrErr?.message || ocrErr);
    } finally {
      setIsAnalyzingSlip(false);
    }
  };

  const handleRemoveSlip = () => {
    setSlipFile(null);
    if (slipPreview) {
      URL.revokeObjectURL(slipPreview);
      setSlipPreview('');
    }
    if (slipInputRef.current) {
      slipInputRef.current.value = '';
    }
    setAiParseSuccess(false);
    setIsAnalyzingSlip(false);
    setAiExtractedNotes('');
  };

  // 1. Fetch real saved addresses on modal open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadAddresses = async () => {
      setIsLoadingAddresses(true);
      try {
        const addressMap = new Map();

        const addRecord = (item) => {
          if (!item) return;
          const raw = (item.address_line || item.address || item.full_address || item.fullAddress || '').trim();
          if (!raw) return;

          // Strictly filter out any legacy dummy mock entries
          const lower = raw.toLowerCase();
          const nameLower = (item.name || item.customer_name || '').toLowerCase();
          if (
            lower.includes('kavi nagar') ||
            lower.includes('shanti kunj') ||
            lower.includes('shanti vihar') ||
            lower.includes('green avenue') ||
            lower.includes('royal palms') ||
            lower.includes('surya enclave') ||
            lower.includes('shivalik') ||
            nameLower.includes('anita devi') ||
            nameLower.includes('sanjay malik') ||
            nameLower.includes('anil mehra') ||
            nameLower.includes('vikas gupta') ||
            nameLower.includes('pooja verma') ||
            nameLower.includes('ramesh kumar') ||
            nameLower.includes('suresh sharma') ||
            nameLower.includes('amit patel')
          ) {
            return;
          }

          const key = lower;
          const lat =
            item.latitude !== null && item.latitude !== undefined && !isNaN(Number(item.latitude))
              ? Number(item.latitude)
              : null;
          const lng =
            item.longitude !== null && item.longitude !== undefined && !isNaN(Number(item.longitude))
              ? Number(item.longitude)
              : null;

          if (!addressMap.has(key)) {
            addressMap.set(key, {
              id: item.id || `addr-${addressMap.size + 1}`,
              address: raw,
              landmark: (item.landmark || '').trim(),
              phone: (item.customer_phone || item.phone || '').trim(),
              name: (item.customer_name || item.name || '').trim(),
              latitude: lat,
              longitude: lng
            });
          } else {
            const existing = addressMap.get(key);
            if (existing.latitude === null && lat !== null) {
              existing.latitude = lat;
              existing.longitude = lng;
            }
            if (!existing.landmark && item.landmark) existing.landmark = item.landmark.trim();
            if (!existing.phone && (item.customer_phone || item.phone)) {
              existing.phone = (item.customer_phone || item.phone).trim();
            }
            if (!existing.name && (item.customer_name || item.name)) {
              existing.name = (item.customer_name || item.name).trim();
            }
          }
        };

        if (isSupabaseConfigured) {
          // 1. Query past orders from Supabase (as requested)
          try {
            const { data: orderData } = await supabase
              .from('orders')
              .select('address, landmark, customer_phone, latitude, longitude')
              .not('address', 'is', null)
              .order('created_at', { ascending: false });

            if (Array.isArray(orderData)) {
              orderData.forEach(addRecord);
            }
          } catch (err) {
            console.warn('Orders query in CreateTaskModal failed:', err);
          }

          // 2. Query addresses table (select id, address_line, landmark, latitude, longitude - NO created_at order)
          try {
            const { data: addrsData } = await supabase
              .from('addresses')
              .select('id, address_line, landmark, latitude, longitude');
            if (Array.isArray(addrsData)) {
              addrsData.forEach(addRecord);
            }
          } catch (err) {
            console.warn('Addresses query in CreateTaskModal failed:', err);
          }
        }

        // Merge live orders from props
        if (Array.isArray(orders)) {
          orders.forEach(addRecord);
        }

        // Also fetch from helper
        try {
          const helperAddrs = await fetchSavedAddresses();
          if (Array.isArray(helperAddrs)) {
            helperAddrs.forEach(addRecord);
          }
        } catch (e) {
          // ignore
        }

        if (isMounted) {
          setSavedAddresses(Array.from(addressMap.values()));
        }
      } catch (err) {
        console.warn('Failed to load saved addresses:', err);
      } finally {
        if (isMounted) setIsLoadingAddresses(false);
      }
    };

    loadAddresses();
    return () => {
      isMounted = false;
    };
  }, [isOpen, orders]);

  // Click outside to close address dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (addressContainerRef.current && !addressContainerRef.current.contains(event.target)) {
        setIsAddressDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter saved addresses based on address, name, phone, or landmark
  const filteredAddresses = useMemo(() => {
    if (!address.trim()) {
      return savedAddresses;
    }
    const q = address.toLowerCase().trim();
    return savedAddresses.filter((item) => {
      const matchAddr = (item.address || '').toLowerCase().includes(q);
      const matchName = (item.name || '').toLowerCase().includes(q);
      const matchPhone = (item.phone || '').toLowerCase().includes(q);
      const matchLandmark = (item.landmark || '').toLowerCase().includes(q);
      return matchAddr || matchName || matchPhone || matchLandmark;
    });
  }, [savedAddresses, address]);

  // Handle selecting an address from autocomplete
  const handleSelectAddress = (item) => {
    setAddress(item.address || '');
    if (item.landmark) setLandmark(item.landmark);
    if (item.phone) setCustomerPhone(item.phone);
    if (item.name) setCustomerName(item.name);
    if (item.latitude !== null && item.latitude !== undefined && item.longitude !== null && item.longitude !== undefined) {
      setPinnedLat(Number(item.latitude));
      setPinnedLng(Number(item.longitude));
    } else {
      setPinnedLat(null);
      setPinnedLng(null);
    }
    setIsAddressDropdownOpen(false);
  };

  // 2. Calculate dynamic order amount based on chosen products and any AI-extracted custom items
  const calculatedItems = useMemo(() => {
    const catalogItems = products
      .filter((p) => (selectedQuantities[p.id] || 0) > 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        price: Number(p.price) || 0,
        quantity: selectedQuantities[p.id] || 0,
        total: (Number(p.price) || 0) * (selectedQuantities[p.id] || 0)
      }));

    return [...catalogItems, ...customItems];
  }, [products, selectedQuantities, customItems]);

  const calculatedTotal = useMemo(() => {
    return calculatedItems.reduce((acc, item) => acc + item.total, 0);
  }, [calculatedItems]);

  // Update amount automatically unless user manually edited it to a different custom value with 0 items
  useEffect(() => {
    if (calculatedItems.length > 0) {
      setAmount(calculatedTotal.toFixed(2));
      setIsAmountManuallyEdited(false);
    } else if (!isAmountManuallyEdited && !amount) {
      // Keep blank or manual
    }
  }, [calculatedTotal, calculatedItems.length, isAmountManuallyEdited]);

  // Quantity stepper handlers
  const handleQuantityChange = (productId, delta) => {
    setSelectedQuantities((prev) => {
      const current = prev[productId] || 0;
      const updated = Math.max(0, current + delta);
      const next = { ...prev };
      if (updated === 0) {
        delete next[productId];
      } else {
        next[productId] = updated;
      }
      return next;
    });
  };

  if (!isOpen) return null;

  const generateNewOrderNo = () => {
    setOrderNumber(`JJ-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!orderNumber.trim()) {
      setError('Order number is required');
      return;
    }
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0 && !slipFile && calculatedItems.length === 0) {
      setError('Please enter a valid amount, select products, or attach a handwritten slip');
      return;
    }
    if (!address.trim()) {
      setError('Delivery address is required');
      return;
    }

    const assignedDriver = drivers.find((d) => d.id === selectedDriverId);

    try {
      setLoading(true);

      // Upload handwritten slip if selected
      let uploadedSlipUrl = null;
      if (slipFile) {
        uploadedSlipUrl = await uploadOrderSlip(slipFile);
      }

      // If user only provides an image and leaves the items field blank, default the item name to "Handwritten Paper Order"
      let finalItems = calculatedItems;
      if (finalItems.length === 0 && (slipFile || uploadedSlipUrl)) {
        finalItems = [
          {
            id: 'slip-order-' + Date.now(),
            name: 'Handwritten Paper Order',
            unit: 'Paper Slip',
            price: numAmount,
            quantity: 1,
            total: numAmount
          }
        ];
      }

      await onCreateTask({
        orderNumber: orderNumber.trim(),
        amount: numAmount,
        address: address.trim(),
        landmark: landmark.trim(),
        customerPhone: customerPhone.trim(),
        customerName: customerName.trim(),
        driverId: selectedDriverId || null,
        driverName: assignedDriver ? assignedDriver.name : null,
        latitude: pinnedLat,
        longitude: pinnedLng,
        items: finalItems,
        notes: aiExtractedNotes || '',
        slipImageUrl: uploadedSlipUrl,
        slip_image_url: uploadedSlipUrl
      });

      // Reset
      generateNewOrderNo();
      setAmount('');
      setAddress('');
      setLandmark('');
      setCustomerPhone('');
      setCustomerName('');
      setSelectedDriverId('');
      setPinnedLat(null);
      setPinnedLng(null);
      setSelectedQuantities({});
      setCustomItems([]);
      setAiExtractedNotes('');
      setIsAmountManuallyEdited(false);
      handleRemoveSlip();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <PackagePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Create Delivery Task</h3>
              <p className="text-[11px] text-slate-400">Dispatch water jars or select catalog items</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl">
              {error}
            </div>
          )}

          {/* SECTION 1: PRODUCT PICKER */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-400" />
                <span>Select Products & Packaging</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {calculatedItems.length} {calculatedItems.length === 1 ? 'item selected' : 'items selected'}
              </span>
            </div>

            {products.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                No products configured yet. You can manually enter the total amount below.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {products.map((product) => {
                  const qty = selectedQuantities[product.id] || 0;
                  const isSelected = qty > 0;

                  return (
                    <div
                      key={product.id}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-emerald-950/25 border-emerald-500/40 shadow-sm'
                          : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Thumbnail */}
                        <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <Package className="w-5 h-5 text-slate-600" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate" title={product.name}>
                            {product.name}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                            <span className="text-emerald-400 font-bold">
                              ₹{Number(product.price).toFixed(0)}
                            </span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-400 truncate">{product.unit || '20L Can'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Stepper Controls */}
                      <div className="shrink-0 flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg p-1">
                        {qty > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(product.id, -1)}
                              className="w-6 h-6 rounded flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                              title="Decrease"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-5 text-center text-xs font-bold text-emerald-400">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(product.id, 1)}
                              className="w-6 h-6 rounded flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white transition"
                              title="Increase"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(product.id, 1)}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 rounded transition flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Selected Items Summary Pill */}
            {calculatedItems.length > 0 && (
              <div className="p-2 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-emerald-400 font-bold">Basket:</span>
                {calculatedItems.map((item) => (
                  <span
                    key={item.id}
                    className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-slate-200"
                  >
                    {item.quantity}x {item.name} (₹{item.total.toFixed(0)})
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* OPTIONAL: HANDWRITTEN PAPER SLIP / NOTE PHOTO */}
          <div className="space-y-2 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>Handwritten Paper Slip / Note Photo</span>
              </label>
              {slipFile && (
                <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Slip Attached
                </span>
              )}
            </div>

            <input
              ref={slipInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleSlipChange}
              className="hidden"
              id="slip-image-upload"
            />

            {!slipPreview ? (
              <label
                htmlFor="slip-image-upload"
                className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-slate-700/80 hover:border-amber-400/60 rounded-xl cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition-all group"
              >
                <div className="flex items-center gap-2 text-slate-400 group-hover:text-amber-300 transition-colors">
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium">Take Photo / Upload Slip or Invoice</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 text-center">
                  Direct camera capture on mobile. Saves drivers time reading handwritten orders.
                </p>
              </label>
            ) : (
              <div className="flex items-center gap-3 p-2 bg-slate-900 rounded-xl border border-slate-800">
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-700 shrink-0 relative bg-black/40">
                  <img
                    src={slipPreview}
                    alt="Slip Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">
                    {slipFile?.name || 'Handwritten Slip'}
                  </p>
                  <p className="text-[11px] text-emerald-400">
                    {slipFile ? `${(slipFile.size / 1024).toFixed(0)} KB • Ready to upload` : 'Attached'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveSlip}
                  className="px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors flex items-center gap-1 font-medium"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              </div>
            )}

            {/* AI Handwriting Extraction Spinner Badge */}
            {isAnalyzingSlip && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                <span>Analyzing handwriting with Gemini 1.5 Flash... ✨</span>
              </div>
            )}

            {/* AI OCR Success Alert */}
            {aiParseSuccess && !isAnalyzingSlip && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold animate-fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Parsed! Review and tweak the details if needed.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAiParseSuccess(false)}
                  className="text-emerald-400 hover:text-white text-[11px] underline ml-2 shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Extracted Notes from Slip */}
            {aiExtractedNotes && (
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2">
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold shrink-0">
                  Note
                </span>
                <span className="italic">{aiExtractedNotes}</span>
              </div>
            )}
          </div>

          {/* SECTION 2: ORDER NUMBER & AMOUNT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Order # */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Order #
                </label>
                <button
                  type="button"
                  onClick={generateNewOrderNo}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                >
                  <Sparkles className="w-3 h-3" /> Auto
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Hash className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="e.g. JJ-1045"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm font-semibold text-emerald-400 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all uppercase"
                />
              </div>
            </div>

            {/* Amount ₹ */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Total Amount (₹) *
                </label>
                {calculatedItems.length > 0 && (
                  <span className="text-[11px] text-emerald-400 font-medium">
                    Auto-calculated
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setIsAmountManuallyEdited(true);
                  }}
                  placeholder="0.00"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: DELIVERY ADDRESS WITH AUTOCOMPLETE DROPDOWN */}
          <div ref={addressContainerRef} className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Delivery Address *
              </label>
              {pinnedLat && pinnedLng && (
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  GPS Pinned ({pinnedLat.toFixed(3)}, {pinnedLng.toFixed(3)})
                </span>
              )}
            </div>

            <div className="relative">
              <div className="absolute top-3 left-3.5 pointer-events-none text-slate-500">
                <MapPin className="w-4 h-4" />
              </div>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setIsAddressDropdownOpen(true);
                }}
                onFocus={() => setIsAddressDropdownOpen(true)}
                placeholder="Type or select saved customer address..."
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            {/* FLOATING AUTOCOMPLETE DROPDOWN */}
            {isAddressDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700 shadow-2xl rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-800 animate-scale-up">
                <div className="p-2 bg-slate-950/80 text-[11px] font-semibold text-slate-400 flex items-center justify-between border-b border-slate-800">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    Saved Address Directory ({filteredAddresses.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddressDropdownOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {filteredAddresses.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No saved addresses match. Type to enter a new location.
                  </div>
                ) : (
                  filteredAddresses.map((item) => {
                    const hasPin = item.latitude !== null && item.latitude !== undefined && item.longitude !== null && item.longitude !== undefined;

                    return (
                      <div
                        key={item.id || item.address}
                        onClick={() => handleSelectAddress(item)}
                        className="p-3 hover:bg-slate-800/80 cursor-pointer transition-colors space-y-1 text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-white line-clamp-1">
                            {item.address}
                          </p>
                          {hasPin ? (
                            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              <MapPin className="w-2.5 h-2.5" />
                              Pinned
                            </span>
                          ) : (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">
                              No GPS
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          {item.name && (
                            <span className="flex items-center gap-1 text-slate-300">
                              <User className="w-3 h-3 text-slate-500" />
                              {item.name}
                            </span>
                          )}
                          {item.phone && (
                            <span className="flex items-center gap-1 text-slate-400 font-mono">
                              <Phone className="w-3 h-3 text-slate-500" />
                              {item.phone}
                            </span>
                          )}
                          {item.landmark && (
                            <span className="flex items-center gap-1 text-emerald-400/80 italic">
                              <Landmark className="w-3 h-3 text-slate-500" />
                              {item.landmark}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* SECTION 4: LANDMARK & CUSTOMER CONTACT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Landmark */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Landmark / Location Hint
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Landmark className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Near Mother Dairy / Opp Metro Gate"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Customer Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Customer Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Vikas Gupta"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: CUSTOMER PHONE & DRIVER ASSIGNMENT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Customer Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Customer Phone
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 9812345678"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Select Delivery Boy */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Assign Delivery Boy
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer transition-all"
                >
                  <option value="">-- Unassigned (Available Pool) --</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.phone})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Dispatch Notice */}
          <p className="text-[11px] text-slate-400">
            {selectedDriverId
              ? 'Order will be immediately assigned to the chosen rider.'
              : 'Order will be placed into the Available Order Pool for any punched-in driver to claim.'}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-300 text-sm font-medium hover:bg-slate-800 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <span>
                  {selectedDriverId ? 'Dispatch to Rider' : 'Add to Order Pool'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
