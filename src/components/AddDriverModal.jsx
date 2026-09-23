import React, { useState } from 'react';
import { X, UserPlus, Phone, KeyRound, User, Loader2, Truck } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export default function AddDriverModal({ isOpen, onClose, onAddDriver }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanPin = pin.trim();
    const cleanVehicle = vehicleNumber.trim();

    if (!trimmedName) {
      setError('Please enter the delivery boy full name');
      return;
    }
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile phone number');
      return;
    }
    if (!/^\d{4}$/.test(cleanPin)) {
      setError('PIN must be exactly 4 digits (e.g. 1234)');
      return;
    }

    try {
      setLoading(true);

      let created = null;

      if (isSupabaseConfigured) {
        // 1. Target 'delivery_boys' with requested schema columns: name, phone, vehicle_number, status
        const insertPayload = {
          name: trimmedName,
          phone: cleanPhone,
          vehicle_number: cleanVehicle || null,
          status: 'active'
        };

        let { data, error } = await supabase
          .from('delivery_boys')
          .insert([insertPayload])
          .select();

        // If schema cache does not have vehicle_number or status, adapt gracefully to live DB columns
        if (error && error.code === 'PGRST204') {
          console.warn('Adapting delivery_boys payload for database schema compatibility...', error.message);
          const adapted = {
            name: trimmedName,
            phone: cleanPhone,
            pin: cleanPin,
            active: true
          };
          const retry = await supabase.from('delivery_boys').insert([adapted]).select();
          if (!retry.error) {
            data = retry.data;
            error = null;
          } else {
            error = retry.error;
          }
        }

        // Required error logging and alert as per specification
        if (error) {
          console.error('Supabase Add Delivery Boy Error:', error);
          alert(`Failed to add delivery boy: ${error.message}`);
          return;
        }

        created = data && data[0] ? data[0] : null;

        // Keep drivers table in sync for relational integrity with orders
        if (created) {
          try {
            await supabase.from('drivers').insert([{
              id: created.id,
              name: created.name,
              phone: created.phone,
              pin: cleanPin,
              status: 'active'
            }]);
          } catch (drvErr) {
            // ignore if already present
          }
        }
      }

      if (!created) {
        created = {
          id: 'drv-' + Date.now(),
          name: trimmedName,
          phone: cleanPhone,
          vehicle_number: cleanVehicle || null,
          pin: cleanPin,
          status: 'active',
          active: true,
          created_at: new Date().toISOString()
        };
      }

      // Notify parent to refresh/update admin state optimistically
      if (onAddDriver) {
        await onAddDriver(created);
      }

      setName('');
      setPhone('');
      setVehicleNumber('');
      setPin('');
      onClose();
    } catch (err) {
      console.error('Add delivery boy submission error:', err);
      setError(err.message || 'Failed to add delivery boy');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-white text-base">Add Delivery Boy</h3>
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

          {/* Name Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Phone Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Phone Number (10 Digits)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="tel"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 9876543210"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 tracking-wider transition-all"
              />
            </div>
          </div>

          {/* Vehicle Number Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Vehicle / Bike Number <span className="text-slate-500 font-normal normal-case">(Optional)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Truck className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="e.g. UP 14 AB 1234"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 uppercase transition-all"
              />
            </div>
          </div>

          {/* 4-digit PIN */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              4-Digit Access PIN
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 tracking-widest focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              The driver will use this PIN to log into their mobile portal.
            </p>
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
                  <span>Saving...</span>
                </>
              ) : (
                <span>Add Driver</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
