import React, { useState, useMemo, useRef } from 'react';
import {
  Package,
  Plus,
  Trash2,
  Pencil,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Search,
  IndianRupee,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  Layers,
  Check
} from 'lucide-react';
import { uploadProductImage } from '../lib/supabase';

const UNIT_PRESETS = ['20L Can', '12x 1L Pack', '24x 500ml Pack', '1L Bottle', '1 Piece', '1 Set'];

export default function ProductCatalog({
  products = [],
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  loading = false
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStock, setFilterStock] = useState('ALL'); // 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New product form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('20L Can');
  const [inStock, setInStock] = useState(true);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit product state
  const [editingProduct, setEditingProduct] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editUnit, setEditUnit] = useState('20L Can');
  const [editInStock, setEditInStock] = useState(true);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editFormError, setEditFormError] = useState('');

  // Delete confirm state
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchesSearch =
        (prod.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (prod.unit || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterStock === 'IN_STOCK') return Boolean(prod.in_stock);
      if (filterStock === 'OUT_OF_STOCK') return !prod.in_stock;
      return true;
    });
  }, [products, searchQuery, filterStock]);

  // Image selection for new product
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (PNG, JPG, WebP)');
      return;
    }

    setImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setFormError('');
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Image selection for editing product
  const handleEditImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setEditFormError('Please select a valid image file (PNG, JPG, WebP)');
      return;
    }

    setEditImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setEditImagePreview(previewUrl);
    setEditFormError('');
  };

  const handleEditClearImage = () => {
    setEditImageFile(null);
    setEditImagePreview('');
    if (editFileInputRef.current) editFileInputRef.current.value = '';
  };

  // Open edit modal
  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setEditName(product.name || '');
    setEditPrice(String(product.price !== undefined ? product.price : ''));
    setEditUnit(product.unit || '20L Can');
    setEditInStock(product.in_stock !== undefined ? Boolean(product.in_stock) : true);
    setEditImageFile(null);
    setEditImagePreview(product.image_url || '');
    setEditFormError('');
  };

  // Submit new product
  const handleSubmitNewProduct = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Product name is required');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError('Please enter a valid price in ₹');
      return;
    }

    try {
      setIsSubmitting(true);
      let uploadedUrl = '';

      if (imageFile) {
        uploadedUrl = await uploadProductImage(imageFile);
      }

      if (onAddProduct) {
        await onAddProduct({
          name: name.trim(),
          price: priceNum,
          unit: unit.trim() || '20L Can',
          imageUrl: uploadedUrl || imagePreview || '',
          inStock
        });
      }

      // Reset form & close modal
      setName('');
      setPrice('');
      setUnit('20L Can');
      setInStock(true);
      setImageFile(null);
      setImagePreview('');
      setIsAddModalOpen(false);
    } catch (err) {
      setFormError(err.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit edit product
  const handleSubmitEditProduct = async (e) => {
    e.preventDefault();
    setEditFormError('');

    if (!editName.trim()) {
      setEditFormError('Product name is required');
      return;
    }

    const priceNum = parseFloat(editPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setEditFormError('Please enter a valid price in ₹');
      return;
    }

    try {
      setIsEditSubmitting(true);
      let finalImageUrl = editImagePreview || '';

      if (editImageFile) {
        finalImageUrl = await uploadProductImage(editImageFile);
      }

      if (onUpdateProduct) {
        await onUpdateProduct({
          id: editingProduct.id,
          name: editName.trim(),
          price: priceNum,
          unit: editUnit.trim() || '20L Can',
          imageUrl: finalImageUrl,
          inStock: editInStock
        });
      }

      setEditingProduct(null);
    } catch (err) {
      setEditFormError(err.message || 'Failed to update product');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Handle confirm delete
  const handleConfirmDelete = async () => {
    if (!deleteConfirmProduct) return;
    try {
      setIsDeleting(true);
      if (onDeleteProduct) {
        await onDeleteProduct(deleteConfirmProduct.id);
      }
      setDeleteConfirmProduct(null);
    } catch (err) {
      console.error('Error deleting product', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Header & Add Action */}
      <div className="glass-card p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Product Catalog</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              {products.length} {products.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage water jars, bottle packs, dispensers, and pricing for order pool dispatch
          </p>
        </div>

        <button
          id="admin-add-product-btn"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-emerald-600/25 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by name or packaging (e.g. 20L, Bisleri, 1L)..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setFilterStock('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterStock === 'ALL'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({products.length})
          </button>
          <button
            onClick={() => setFilterStock('IN_STOCK')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterStock === 'IN_STOCK'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            In Stock
          </button>
          <button
            onClick={() => setFilterStock('OUT_OF_STOCK')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterStock === 'OUT_OF_STOCK'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Out of Stock
          </button>
        </div>
      </div>

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-2xl border border-slate-800">
          <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-semibold text-sm">
            {products.length === 0 ? 'No products registered yet' : 'No products match your search filter'}
          </p>
          <p className="text-slate-500 text-xs mt-1">
            {products.length === 0
              ? 'Click "Add New Product" above to create your first water dispatch item.'
              : 'Try clearing your search query or switching stock filter to "All".'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="glass-card rounded-2xl border border-slate-800 overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-all group"
            >
              {/* Product Image Thumbnail */}
              <div className="relative aspect-video sm:aspect-[4/3] bg-slate-950/80 overflow-hidden border-b border-slate-800/80 flex items-center justify-center">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.classList.add('flex', 'items-center', 'justify-center');
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-slate-950">
                    <ImageIcon className="w-10 h-10 mb-1 opacity-50" />
                    <span className="text-[10px] text-slate-500">No Image</span>
                  </div>
                )}

                {/* Stock Status Badge */}
                <div className="absolute top-2.5 left-2.5">
                  {product.in_stock ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/90 text-white shadow-sm backdrop-blur-sm">
                      <CheckCircle2 className="w-3 h-3" />
                      In Stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/90 text-white shadow-sm backdrop-blur-sm">
                      <XCircle className="w-3 h-3" />
                      Out of Stock
                    </span>
                  )}
                </div>

                {/* Packaging Unit Pill */}
                <div className="absolute bottom-2.5 right-2.5">
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-900/90 text-slate-200 border border-slate-700/80 backdrop-blur-sm shadow-sm">
                    {product.unit || '20L Can'}
                  </span>
                </div>
              </div>

              {/* Product Details */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="font-bold text-white text-sm line-clamp-2" title={product.name}>
                    {product.name}
                  </h3>
                </div>

                {/* Price & Action Buttons (Edit + Delete) */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                      Unit Price
                    </span>
                    <span className="text-base font-black text-emerald-400">
                      ₹{Number(product.price).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(product)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      title="Edit product"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmProduct(product)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add New Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 animate-scale-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">Add New Product</h3>
                  <p className="text-[11px] text-slate-400">
                    Add item to Jal-Jivan water dispatch catalog
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewProduct} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 20L Mineral Water Jar (Bisleri)"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Price & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Price (₹) *
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm font-semibold text-emerald-400 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Packaging / Unit *
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="e.g. 20L Can, 1L Bottle"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Unit Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 font-medium">Presets:</span>
                {UNIT_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setUnit(p)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition ${
                      unit === p
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* In Stock Toggle */}
              <div className="p-3 bg-slate-800/50 border border-slate-700/70 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Stock Availability</span>
                  <span className="text-[11px] text-slate-400">Allow dispatchers to select this item for deliveries</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inStock}
                    onChange={(e) => setInStock(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>

              {/* Product Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Product Image (Supabase Storage)
                </label>

                {imagePreview ? (
                  <div className="relative rounded-xl border border-slate-700 bg-slate-950 p-2 flex items-center gap-3">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-16 h-16 rounded-lg object-cover border border-slate-800"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium truncate">
                        {imageFile ? imageFile.name : 'Selected image'}
                      </p>
                      <p className="text-[11px] text-emerald-400 mt-0.5">
                        Will be uploaded to bucket 'product-images'
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-emerald-500/70 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/40 hover:bg-slate-950/70 group"
                  >
                    <Upload className="w-8 h-8 text-slate-500 group-hover:text-emerald-400 mx-auto mb-2 transition-colors" />
                    <p className="text-xs font-semibold text-slate-300 group-hover:text-white">
                      Click to upload product image
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      PNG, JPG, WebP up to 5MB (Uploads to bucket 'product-images')
                    </p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-300 text-sm font-medium hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Product...</span>
                    </>
                  ) : (
                    <span>Save Product</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 animate-scale-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">Edit Product</h3>
                  <p className="text-[11px] text-slate-400">
                    Modify product details, packaging unit, or pricing
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEditProduct} className="p-5 space-y-4">
              {editFormError && (
                <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editFormError}</span>
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. 20L Mineral Water Jar"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Price & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Price (₹) *
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm font-semibold text-emerald-400 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Packaging / Unit *
                  </label>
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    placeholder="e.g. 20L Can, 1L Bottle"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Unit Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 font-medium">Presets:</span>
                {UNIT_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEditUnit(p)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition ${
                      editUnit === p
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* In Stock Toggle */}
              <div className="p-3 bg-slate-800/50 border border-slate-700/70 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Stock Availability</span>
                  <span className="text-[11px] text-slate-400">Allow dispatchers to select this item for deliveries</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editInStock}
                    onChange={(e) => setEditInStock(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
                </label>
              </div>

              {/* Product Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Product Image
                </label>

                {editImagePreview ? (
                  <div className="relative rounded-xl border border-slate-700 bg-slate-950 p-2 flex items-center gap-3">
                    <img
                      src={editImagePreview}
                      alt="Preview"
                      className="w-16 h-16 rounded-lg object-cover border border-slate-800"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium truncate">
                        {editImageFile ? editImageFile.name : 'Current Image'}
                      </p>
                      <button
                        type="button"
                        onClick={() => editFileInputRef.current?.click()}
                        className="text-[11px] text-emerald-400 hover:underline mt-0.5 block"
                      >
                        Change photo
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleEditClearImage}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => editFileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-emerald-500/70 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/40 hover:bg-slate-950/70 group"
                  >
                    <Upload className="w-8 h-8 text-slate-500 group-hover:text-emerald-400 mx-auto mb-2 transition-colors" />
                    <p className="text-xs font-semibold text-slate-300 group-hover:text-white">
                      Click to upload product image
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      PNG, JPG, WebP up to 5MB (Uploads to bucket 'product-images')
                    </p>
                  </div>
                )}

                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleEditImageSelect}
                  className="hidden"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  disabled={isEditSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-300 text-sm font-medium hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
                >
                  {isEditSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating Product...</span>
                    </>
                  ) : (
                    <span>Update Product</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      {deleteConfirmProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Delete this item?</h3>
                <p className="text-xs text-slate-400">Permanently removes item from catalog</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              Are you sure you want to delete <strong className="text-white">"{deleteConfirmProduct.name}"</strong> ({deleteConfirmProduct.unit})? This item will no longer appear in order creation.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmProduct(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-300 text-sm font-medium hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Product</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
