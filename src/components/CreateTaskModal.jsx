import React, { useState } from 'react';
import { X, PackagePlus, Hash, IndianRupee, MapPin, Landmark, User, Loader2, Sparkles } from 'lucide-react';

export default function CreateTaskModal({ isOpen, onClose, drivers = [], onCreateTask }) {
  const [orderNumber, setOrderNumber] = useState(`JJ-${Math.floor(1000 + Math.random() * 9000)}`);
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount in ₹');
      return;
    }
    if (!address.trim()) {
      setError('Delivery address is required');
      return;
    }

    const assignedDriver = drivers.find((d) => d.id === selectedDriverId);

    try {
      setLoading(true);
      await onCreateTask({
        orderNumber: orderNumber.trim(),
        amount: parseFloat(amount),
        address: address.trim(),
        landmark: landmark.trim(),
        customerPhone: customerPhone.trim(),
        driverId: selectedDriverId || null,
        driverName: assignedDriver ? assignedDriver.name : null
      });

      // Reset
      generateNewOrderNo();
      setAmount('');
      setAddress('');
      setLandmark('');
      setCustomerPhone('');
      setSelectedDriverId('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center">
              <PackagePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Create Delivery Task</h3>
              <p className="text-[11px] text-slate-400">Dispatch a new water or package order</p>
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl">
              {error}
            </div>
          )}

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
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Amount (₹)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <IndianRupee className="w-4 h-4" />
                </div>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Delivery Address
            </label>
            <div className="relative">
              <div className="absolute top-3 left-3.5 pointer-events-none text-slate-500">
                <MapPin className="w-4 h-4" />
              </div>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House/Flat #, Building name, Street, Area..."
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

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
                placeholder="e.g. Near Mother Dairy / Opp Metro Gate 2"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Select Delivery Boy */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Select Delivery Boy
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
                <option value="">-- Unassigned (Pending Dispatch) --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.phone})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {selectedDriverId
                ? 'Order will be immediately sent to driver\'s queue.'
                : 'You can assign a driver now or later from the status board.'}
            </p>
          </div>

          {/* Customer Phone (Admin internal only) */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Customer Contact Phone <span className="text-slate-500">(Admin records only - hidden from driver)</span>
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. 9812345678"
              className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700/70 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-slate-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3">
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
                <span>Dispatch Task</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
