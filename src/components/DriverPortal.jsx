import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  ShieldAlert,
  Star,
  Award,
  Wifi,
  WifiOff,
  RefreshCw,
  Sparkles,
  Check
} from 'lucide-react';
import ProofOfDeliveryModal from './ProofOfDeliveryModal';
import {
  acceptOrderDelivery,
  fetchRewardSettings,
  recordDriverAttendance,
  checkDriverAttendanceToday,
  fetchStoreSettings,
  updateDriverLocation,
  defaultStoreSettings
} from '../lib/supabase';
import {
  calculateDistanceMeters,
  calculateEtaMinutes
} from '../lib/geoUtils';

export default function DriverPortal({
  currentDriver,
  drivers = [],
  orders = [],
  onLogin,
  onLogout,
  onPinLocation,
  onCompleteDelivery,
  onAcceptOrder
}) {
  const todayStr = new Date().toISOString().split('T')[0];

  // Login Form State
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Portal Tab State: 'pool' | 'active' | 'history'
  const [activeTab, setActiveTab] = useState('pool');
  const [selectedOrderForPod, setSelectedOrderForPod] = useState(null);
  const [pinningOrderId, setPinningOrderId] = useState(null);
  const [gpsError, setGpsError] = useState(null);

  // Attendance Geofence State
  const [storeHub, setStoreHub] = useState(() => {
    try {
      const saved = localStorage.getItem('jal_jivan_store_settings');
      return saved ? JSON.parse(saved) : defaultStoreSettings;
    } catch {
      return defaultStoreSettings;
    }
  });

  const [isPunchedIn, setIsPunchedIn] = useState(() => {
    if (!currentDriver) return false;
    try {
      const saved = localStorage.getItem(`jal_jivan_punched_in_${currentDriver.id}_${todayStr}`);
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const [hubDistance, setHubDistance] = useState(null);
  const [verifyingLocation, setVerifyingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [driverCoords, setDriverCoords] = useState(null);

  // Reward Rule State
  const [rewardRule, setRewardRule] = useState({ min_deliveries: 5, stars_rewarded: 1 });

  // Geoguard State (GPS & Network Monitoring)
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasGps, setHasGps] = useState(true);
  const [guardDismissed, setGuardDismissed] = useState(false);

  // Load Reward Settings & Dynamic Store Hub Geofence
  useEffect(() => {
    async function loadInitialSettings() {
      const [rules, hub] = await Promise.all([
        fetchRewardSettings(),
        fetchStoreSettings()
      ]);
      if (rules) setRewardRule(rules);
      if (hub) setStoreHub(hub);
    }
    loadInitialSettings();
  }, []);

  // Check Attendance on Load
  useEffect(() => {
    if (!currentDriver) return;
    async function checkAttendance() {
      const alreadyCheckedIn = await checkDriverAttendanceToday(currentDriver.id);
      if (alreadyCheckedIn) {
        setIsPunchedIn(true);
        try {
          localStorage.setItem(`jal_jivan_punched_in_${currentDriver.id}_${todayStr}`, 'true');
        } catch (e) {
          // ignore
        }
      }
    }
    checkAttendance();
  }, [currentDriver, todayStr]);

  // Geoguard: Listen to online/offline and GPS watch
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let watchId;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setHasGps(true);
          setDriverCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        () => {
          setHasGps(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } else {
      setHasGps(false);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (watchId && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // Check Distance from Store Hub
  const verifyHubDistance = useCallback(() => {
    setVerifyingLocation(true);
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setVerifyingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setDriverCoords({ lat: latitude, lng: longitude });
        const dist = calculateDistanceMeters(
          latitude,
          longitude,
          storeHub.latitude,
          storeHub.longitude
        );
        setHubDistance(dist);
        setVerifyingLocation(false);
      },
      (err) => {
        setLocationError('Unable to fetch your location: ' + (err.message || 'GPS denied'));
        setVerifyingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [storeHub.latitude, storeHub.longitude]);

  useEffect(() => {
    if (currentDriver && !isPunchedIn) {
      verifyHubDistance();
    }
  }, [currentDriver, isPunchedIn, verifyHubDistance]);

  // Real-Time Rider Location Tracking (Active on Duty)
  useEffect(() => {
    if (!currentDriver || !isPunchedIn) return;

    let watchId = null;
    let timerId = null;

    const pushLocation = (lat, lng) => {
      if (lat === null || lat === undefined || lng === null || lng === undefined) return;
      updateDriverLocation({
        driverId: currentDriver.id,
        driverName: currentDriver.name,
        latitude: lat,
        longitude: lng
      }).catch((e) => console.warn('Silent driver location update error', e));
    };

    // If we already have live coords, push immediately
    if (driverCoords?.lat && driverCoords?.lng) {
      pushLocation(driverCoords.lat, driverCoords.lng);
    }

    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setDriverCoords({ lat: latitude, lng: longitude });
          pushLocation(latitude, longitude);
        },
        (err) => console.warn('Driver geolocation watch warning:', err),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    }

    // 15-second recurring interval
    timerId = setInterval(() => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            setDriverCoords({ lat: latitude, lng: longitude });
            pushLocation(latitude, longitude);
          },
          () => {
            if (driverCoords?.lat && driverCoords?.lng) {
              pushLocation(driverCoords.lat, driverCoords.lng);
            }
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else if (driverCoords?.lat && driverCoords?.lng) {
        pushLocation(driverCoords.lat, driverCoords.lng);
      }
    }, 15000);

    return () => {
      if (watchId && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [currentDriver, isPunchedIn, driverCoords?.lat, driverCoords?.lng]);

  // Punch In Handler
  const handlePunchIn = async (overrideLat = null, overrideLng = null) => {
    setVerifyingLocation(true);
    const lat = overrideLat !== null ? overrideLat : driverCoords?.lat || storeHub.latitude;
    const lng = overrideLng !== null ? overrideLng : driverCoords?.lng || storeHub.longitude;

    try {
      await recordDriverAttendance({
        driverId: currentDriver.id,
        checkInLat: lat,
        checkInLng: lng
      });

      // Immediately sync driver location
      await updateDriverLocation({
        driverId: currentDriver.id,
        driverName: currentDriver.name,
        latitude: lat,
        longitude: lng
      });

      setIsPunchedIn(true);
      try {
        localStorage.setItem(`jal_jivan_punched_in_${currentDriver.id}_${todayStr}`, 'true');
      } catch (e) {
        // ignore
      }
    } catch (err) {
      setLocationError('Failed to record attendance: ' + err.message);
    } finally {
      setVerifyingLocation(false);
    }
  };

  // Punch Out Handler
  const handlePunchOut = () => {
    setIsPunchedIn(false);
    try {
      localStorage.removeItem(`jal_jivan_punched_in_${currentDriver.id}_${todayStr}`);
    } catch (e) {
      // ignore
    }
  };

  // Handle Driver Login Submit
  const handleLoginSubmit = async (e) => {
    e?.preventDefault();
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

  // Pin Current Location (GPS)
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

  // Accept Pool Order Handler
  const handleAcceptPoolOrder = async (order) => {
    const eta = calculateEtaMinutes(
      order.latitude,
      order.longitude,
      driverCoords?.lat,
      driverCoords?.lng
    );

    if (onAcceptOrder) {
      await onAcceptOrder(order.id, eta);
    } else {
      await acceptOrderDelivery(order.id, currentDriver.id, currentDriver.name, eta);
    }

    // Switch to active tab so the driver immediately sees their new task
    setActiveTab('active');
  };

  // Computed Orders
  // 1. Available Pool: orders where status is 'Pending' and unassigned
  const poolOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.status === 'Pending' &&
        (!o.assigned_driver_id || o.assigned_driver_id === null) &&
        (!o.driver_id || o.driver_id === null)
    );
  }, [orders]);

  // 2. Active Deliveries: orders assigned to current driver that are not yet Delivered
  const activeDeliveries = useMemo(() => {
    if (!currentDriver) return [];
    return orders.filter(
      (o) =>
        (o.assigned_driver_id === currentDriver.id || o.driver_id === currentDriver.id) &&
        o.status !== 'Delivered'
    );
  }, [orders, currentDriver]);

  // 3. Delivered History for current driver
  const deliveredHistory = useMemo(() => {
    if (!currentDriver) return [];
    return orders.filter(
      (o) =>
        (o.assigned_driver_id === currentDriver.id || o.driver_id === currentDriver.id) &&
        o.status === 'Delivered'
    );
  }, [orders, currentDriver]);

  // 4. Completed deliveries TODAY for current driver (for Star Rewards)
  const completedTodayCount = useMemo(() => {
    return deliveredHistory.filter((o) => {
      const dateStr = o.delivered_at || o.created_at;
      return dateStr && dateStr.startsWith(todayStr);
    }).length;
  }, [deliveredHistory, todayStr]);

  // Star Reward Calculation
  const minPerStar = rewardRule.min_deliveries || 5;
  const starsPerTier = rewardRule.stars_rewarded || 1;
  const starsEarned = Math.floor(completedTodayCount / minPerStar) * starsPerTier;

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

  // Determine if driver is within geofence radius (<= storeHub.radius_meters)
  const isInsideHubGeofence = hubDistance !== null && hubDistance <= (storeHub.radius_meters || 150);

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-16 pt-2">
      {/* Geoguard Alert Overlay if Internet or GPS lost */}
      {(!isOnline || !hasGps) && !guardDismissed && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in select-none">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mb-4 animate-pulse border border-rose-500/30">
            {!isOnline ? <WifiOff className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
          </div>
          <h2 className="text-xl font-black text-white mb-2 tracking-tight">
            ⚠️ GPS and Mobile Data must remain ON during duty.
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">
            {!isOnline && !hasGps
              ? 'Both Internet and GPS are turned off. Please turn on Mobile Data/Wi-Fi and enable Location Services to proceed.'
              : !isOnline
              ? 'Internet connection lost. Please turn on Mobile Data or Wi-Fi to proceed with live dispatching.'
              : 'Location services (GPS) are disabled. Please enable GPS and allow location access in your browser.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-xs">
            <button
              onClick={() => {
                setIsOnline(navigator.onLine);
                verifyHubDistance();
              }}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Connection / GPS</span>
            </button>
            <button
              onClick={() => setGuardDismissed(true)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition"
            >
              Bypass for Browser Testing
            </button>
          </div>
        </div>
      )}

      {/* Driver Header Card */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-base border border-emerald-500/30">
              {currentDriver.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-white text-base">{currentDriver.name}</h2>
                <span
                  className={`text-[10px] border px-2 py-0.5 rounded-full font-bold uppercase ${
                    isPunchedIn
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {isPunchedIn ? 'On Duty (Punched In)' : 'Off Duty'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Phone: {currentDriver.phone}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isPunchedIn && (
              <button
                onClick={handlePunchOut}
                className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 py-1.5 px-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all font-medium"
                title="Punch out from duty"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Punch Out</span>
              </button>
            )}

            <button
              onClick={onLogout}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400 py-1.5 px-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/10 border border-slate-700/80 transition-all font-medium"
              title="Log out from driver portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>

        {/* Feature 2: Daily Deliveries & Star Rewards Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl">
            <span className="text-slate-300">
              Deliveries Today: <strong className="text-white font-bold">{completedTodayCount}</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{starsEarned} Stars</span>
            </span>
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              ({minPerStar} del = {starsPerTier} star)
            </span>
          </div>

          {/* Attendance Status Pill */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className={`w-2 h-2 rounded-full ${isPunchedIn ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-400">
              Hub Geofence:{' '}
              <strong className={isPunchedIn ? 'text-emerald-400' : 'text-amber-400'}>
                {isPunchedIn ? 'Verified' : 'Pending Check-In'}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Feature 3: Store Hub Attendance Geofencing Modal/Card (if NOT punched in) */}
      {!isPunchedIn ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl mx-auto flex items-center justify-center">
            <MapPin className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-bold text-white">Daily Attendance Check-In</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Drivers must punch in at the store hub ({storeHub.store_name}) before viewing or accepting delivery orders.
            </p>
          </div>

          {/* Distance Alert */}
          {hubDistance !== null ? (
            <div
              className={`p-3 rounded-xl text-xs font-semibold border ${
                isInsideHubGeofence
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              }`}
            >
              {isInsideHubGeofence ? (
                <span>📍 Verified at {storeHub.store_name} ({hubDistance}m away, within {storeHub.radius_meters}m).</span>
              ) : (
                <span>
                  ⚠️ You are {hubDistance} meters away from {storeHub.store_name}. Move closer to punch in.
                </span>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl text-xs bg-slate-800/60 border border-slate-700 text-slate-300 flex items-center justify-center gap-2">
              <Compass className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Acquiring GPS position from store hub...</span>
            </div>
          )}

          {locationError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
              {locationError}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              onClick={verifyHubDistance}
              disabled={verifyingLocation}
              className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifyingLocation ? 'animate-spin' : ''}`} />
              <span>Recheck Location</span>
            </button>

            <button
              id="driver-punch-in-btn"
              onClick={() => handlePunchIn()}
              disabled={!isInsideHubGeofence || verifyingLocation}
              className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
                isInsideHubGeofence && !verifyingLocation
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-[0.98]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }`}
            >
              {verifyingLocation ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Punch In</span>
                </>
              )}
            </button>
          </div>

          {/* Demo Testing Override Helper */}
          <div className="pt-2 border-t border-slate-800/80 text-center">
            <button
              type="button"
              onClick={() => handlePunchIn(storeHub.latitude, storeHub.longitude)}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1.5 py-1 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>⚡ Simulate Hub Location & Punch In (Testing Override)</span>
            </button>
          </div>
        </div>
      ) : (
        /* FEATURE 1: TABS (Available Pool vs Active Deliveries vs History) */
        <>
          {/* Tabs Navigator */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
            <button
              id="tab-available-pool"
              onClick={() => setActiveTab('pool')}
              className={`py-2 px-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'pool'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pool ({poolOrders.length})</span>
            </button>

            <button
              id="tab-active-deliveries"
              onClick={() => setActiveTab('active')}
              className={`py-2 px-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'active'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>My Tasks ({activeDeliveries.length})</span>
            </button>

            <button
              id="tab-history"
              onClick={() => setActiveTab('history')}
              className={`py-2 px-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'history'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>History ({deliveredHistory.length})</span>
            </button>
          </div>

          {/* TAB 1: AVAILABLE DELIVERY OPEN POOL */}
          {activeTab === 'pool' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Open Delivery Pool (Ready for Pickup)
                </span>
                <span className="text-xs text-emerald-400 font-semibold">
                  {poolOrders.length} Available
                </span>
              </div>

              {poolOrders.length === 0 ? (
                <div className="glass-card p-10 text-center rounded-2xl border border-slate-800 space-y-2">
                  <Truck className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-white font-bold text-sm">No orders waiting in pool right now</p>
                  <p className="text-xs text-slate-400">
                    New delivery requests dispatched by the admin will appear here automatically.
                  </p>
                </div>
              ) : (
                poolOrders.map((order) => {
                  const eta = calculateEtaMinutes(
                    order.latitude,
                    order.longitude,
                    driverCoords?.lat,
                    driverCoords?.lng
                  );

                  return (
                    <div
                      key={order.id}
                      className="glass-card rounded-2xl border border-slate-800 p-4 shadow-lg hover:border-emerald-500/40 transition-all space-y-3"
                    >
                      {/* Top Bar: Order Number, ETA badge, Amount */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-white tracking-wide">
                            #{order.order_number}
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            ~{eta} mins ETA
                          </span>
                        </div>

                        <div className="text-emerald-400 font-black text-base">
                          <span>₹{order.amount}</span>
                        </div>
                      </div>

                      {/* Address & Customer Details */}
                      <div className="space-y-1.5 text-xs text-slate-200">
                        {order.customer_name && (
                          <p className="font-semibold text-white">{order.customer_name}</p>
                        )}
                        <div className="flex items-start gap-1.5 text-slate-300">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{order.address}</span>
                        </div>
                        {order.landmark && (
                          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] pl-5">
                            <Landmark className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>Landmark: {order.landmark}</span>
                          </div>
                        )}
                      </div>

                      {/* Action Button: Accept Delivery */}
                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
                        <span className="text-[11px] text-slate-400">
                          Speed: 25 km/h avg + 5m prep
                        </span>
                        <button
                          onClick={() => handleAcceptPoolOrder(order)}
                          className="py-2.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all flex items-center gap-1.5"
                        >
                          <Truck className="w-4 h-4" />
                          <span>Accept Delivery</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: MY ACTIVE DELIVERIES */}
          {activeTab === 'active' && (
            <div className="space-y-3">
              {activeDeliveries.length === 0 ? (
                <div className="glass-card p-10 text-center rounded-2xl border border-slate-800 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto opacity-70" />
                  <p className="text-white font-bold text-sm">All accepted tasks completed!</p>
                  <p className="text-xs text-slate-400">
                    Switch to the &ldquo;Pool&rdquo; tab to accept ready delivery tasks.
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
                          {order.estimated_minutes && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                              ~{order.estimated_minutes}m ETA
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-emerald-400 font-black text-base">
                          <span>₹{order.amount}</span>
                        </div>
                      </div>

                      {/* Privacy Compliant Address Details */}
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
                          <span>Customer privacy protected. Contact dispatch for special instructions.</span>
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
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-sky-400 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm group"
                          >
                            <Navigation className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
                            <span>
                              Open in Google Maps ({order.latitude?.toFixed(4)}, {order.longitude?.toFixed(4)})
                            </span>
                            <ExternalLink className="w-3 h-3 ml-auto opacity-60" />
                          </a>
                        ) : (
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

          {/* TAB 3: COMPLETED / HISTORY */}
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
                      <span className="text-slate-400">
                        Payment: <strong className="text-emerald-300">{order.payment_method || 'Cash'}</strong>
                      </span>
                      {order.delivered_at && (
                        <span className="text-slate-500">
                          {new Date(order.delivered_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
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
        </>
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
