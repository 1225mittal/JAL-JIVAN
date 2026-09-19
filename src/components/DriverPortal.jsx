import React, { useState } from 'react';
import {
  Truck,
  Phone,
  KeyRound,
  MapPin,
  Navigation,
  CheckCircle2,
  Clock,
  LogOut,
  Camera,
  AlertCircle,
  Loader2,
  IndianRupee,
  Landmark,
  Compass,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import ProofOfDeliveryModal from './ProofOfDeliveryModal';

export default function DriverPortal({
  currentDriver,
  drivers = [],
  orders = [],
  onLogin,
  onLogout,
  onPinLocation,
  onCompleteDelivery
}) {
  // Login Form State
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Portal State
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [selectedOrderForPod, setSelectedOrderForPod] = useState(null);
  const [pinningOrderId, setPinningOrderId] = useState(null);
  const [gpsError, setGpsError] = useState(null);

  // Handle Driver Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!phone.trim()) {
      setLoginError('Please enter your 10-digit mobile number');
      return;
    }
    if (!pin.trim()) {
      setLoginError('Please enter your 4-digit PIN');
      return;
    }

    try {
      setLoginLoading(true);
      await onLogin(phone.trim(), pin.trim());
    } catch (err) {
      setLoginError(err.message || 'Invalid phone number or PIN. Please check again.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Quick Login for testing convenience
  const handleQuickLogin = (driver) => {
    setPhone(driver.phone);
    setPin(driver.pin);
    onLogin(driver.phone, driver.pin);
  };

  // GPS Pinning using HTML5 Geolocation
  const handlePinCurrentLocation = (orderId) => {
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setPinningOrderId(orderId);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onPinLocation(orderId, latitude, longitude);
        setPinningOrderId(null);
      },
      (error) => {
        setPinningOrderId(null);
        let msg = 'Unable to retrieve your location.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission was denied. Please allow GPS access in your browser.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Location information is currently unavailable.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Location request timed out. Try again.';
        }
        setGpsError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // If driver is not logged in, render Mobile Driver Login Screen
  if (!currentDriver) {
    return (
      <div className="max-w-md mx-auto py-4 sm:py-8 px-2">
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
          {/* Logo & Welcome */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Truck className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Driver Portal</h2>
            <p className="text-xs text-slate-400">
              Sign in with your registered phone number & 4-digit PIN
            </p>
          </div>

          {loginError && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Driver Mobile Phone
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
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 tracking-wider transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                4-Digit Driver PIN
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
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl text-base font-bold text-white placeholder-slate-500 tracking-widest focus:outline-none focus:border-emerald-500 transition-all text-center"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loginLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Log In to Deliveries</span>
              )}
            </button>
          </form>

          {/* Quick Demo Login Helpers */}
          {drivers.length > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-2 text-center">
              <span className="text-[11px] text-slate-400 font-medium">Quick Test Login (Demo):</span>
              <div className="flex flex-wrap justify-center gap-1.5">
                {drivers.slice(0, 3).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleQuickLogin(d)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-emerald-300 border border-slate-700 transition-colors"
                  >
                    {d.name} ({d.pin})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Filter deliveries for currently logged-in driver
  const myDeliveries = orders.filter((o) => o.assigned_driver_id === currentDriver.id);
  const activeDeliveries = myDeliveries.filter((o) => o.status !== 'Delivered');
  const deliveredHistory = myDeliveries.filter((o) => o.status === 'Delivered');

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-16 pt-2">
      {/* Driver Header Card */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-base border border-emerald-500/30">
            {currentDriver.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-white text-base">{currentDriver.name}</h2>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                Driver Online
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Phone: {currentDriver.phone}</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400 py-1.5 px-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/10 border border-slate-700/80 transition-all font-medium"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>
      </div>

      {/* GPS Error Banner */}
      {gpsError && (
        <div className="p-3 text-xs bg-rose-500/15 border border-rose-500/40 text-rose-200 rounded-2xl flex items-center justify-between gap-2 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{gpsError}</span>
          </div>
          <button
            onClick={() => setGpsError(null)}
            className="text-slate-400 hover:text-white text-sm px-1.5"
          >
            &times;
          </button>
        </div>
      )}

      {/* Tabs: Active vs Completed */}
      <div className="grid grid-cols-2 gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
        <button
          onClick={() => setActiveTab('active')}
          className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'active'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Active Tasks ({activeDeliveries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Completed ({deliveredHistory.length})</span>
        </button>
      </div>

      {/* ACTIVE DELIVERIES TAB */}
      {activeTab === 'active' && (
        <div className="space-y-3">
          {activeDeliveries.length === 0 ? (
            <div className="glass-card p-10 text-center rounded-2xl border border-slate-800 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto opacity-70" />
              <p className="text-white font-bold text-sm">All deliveries completed!</p>
              <p className="text-xs text-slate-400">
                You have no pending deliveries in your queue. Take a rest or check with dispatch.
              </p>
            </div>
          ) : (
            activeDeliveries.map((order) => {
              const hasCoordinates =
                order.latitude !== null &&
                order.latitude !== undefined &&
                order.longitude !== null &&
                order.longitude !== undefined;

              const mapsUrl = hasCoordinates
                ? `https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`
                : null;

              const isPinning = pinningOrderId === order.id;

              return (
                <div
                  key={order.id}
                  className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-lg hover:border-emerald-500/30 transition-all space-y-3 p-4"
                >
                  {/* Top: Order #, Amount, Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-white tracking-wide">
                        #{order.order_number}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase">
                        {order.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-emerald-400 font-black text-base">
                      <span>₹{order.amount}</span>
                    </div>
                  </div>

                  {/* Privacy Compliant Address Details (DO NOT SHOW CUSTOMER PHONE) */}
                  <div className="space-y-2 py-1">
                    <div className="flex items-start gap-2 text-xs text-slate-200">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-white leading-relaxed">{order.address}</p>
                        {order.landmark && (
                          <p className="text-emerald-300 font-medium mt-1 flex items-center gap-1">
                            <Landmark className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>Landmark: {order.landmark}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Privacy Note Badge */}
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                      <ShieldAlert className="w-3 h-3 text-slate-500" />
                      <span>Customer privacy protected. Contact admin dispatch for special instructions.</span>
                    </div>

                    {order.notes && (
                      <p className="text-[11px] text-slate-300 italic pl-6">
                        Note: &ldquo;{order.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Location Action Buttons */}
                  <div className="pt-1">
                    {hasCoordinates ? (
                      /* Google Maps Link */
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-sky-400 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm group"
                      >
                        <Navigation className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
                        <span>Open in Google Maps ({order.latitude?.toFixed(4)}, {order.longitude?.toFixed(4)})</span>
                        <ExternalLink className="w-3 h-3 ml-auto opacity-60" />
                      </a>
                    ) : (
                      /* Pin Current Location (GPS) */
                      <button
                        onClick={() => handlePinCurrentLocation(order.id)}
                        disabled={isPinning}
                        className="w-full py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      >
                        {isPinning ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Acquiring GPS Fix...</span>
                          </>
                        ) : (
                          <>
                            <Compass className="w-3.5 h-3.5 text-amber-400" />
                            <span>📍 Pin Current Location (Use Phone GPS)</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Proof of Delivery / Complete Action */}
                  <div className="pt-2 border-t border-slate-800">
                    <button
                      onClick={() => setSelectedOrderForPod(order)}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take POD Photo & Deliver (₹{order.amount})</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* COMPLETED / HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {deliveredHistory.length === 0 ? (
            <div className="glass-card p-10 text-center rounded-2xl border border-slate-800">
              <Clock className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-white font-bold text-sm">No completed deliveries yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Completed orders with photo proof will appear here.
              </p>
            </div>
          ) : (
            deliveredHistory.map((order) => (
              <div
                key={order.id}
                className="glass-card p-4 rounded-2xl border border-slate-800 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">#{order.order_number}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Delivered
                    </span>
                  </div>
                  <span className="font-bold text-emerald-400 text-sm">₹{order.amount}</span>
                </div>

                <div className="text-slate-300">
                  <p className="line-clamp-1">{order.address}</p>
                  {order.landmark && <p className="text-slate-400 italic">Landmark: {order.landmark}</p>}
                </div>

                <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Payment: <strong className="text-emerald-300">{order.payment_method || 'Cash'}</strong></span>
                  {order.delivered_at && (
                    <span className="text-slate-500">
                      {new Date(order.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {order.delivery_proof_url && (
                  <div className="mt-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">POD Photo Proof</span>
                    <img
                      src={order.delivery_proof_url}
                      alt="Proof"
                      className="w-full h-32 object-cover rounded-xl mt-1 border border-slate-800"
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Proof of Delivery Modal */}
      {selectedOrderForPod && (
        <ProofOfDeliveryModal
          isOpen={Boolean(selectedOrderForPod)}
          onClose={() => setSelectedOrderForPod(null)}
          order={selectedOrderForPod}
          onCompleteDelivery={onCompleteDelivery}
        />
      )}
    </div>
  );
}
