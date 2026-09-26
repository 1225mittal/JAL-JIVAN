import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import AdminHub from './components/AdminHub';
import DamageReturnHub from './components/damage/DamageReturnHub';
import DamageManagement from './components/DamageManagement';
import AdminPanel, { AdminDashboard } from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import StaffPortal from './components/StaffPortal';
import DriverPortal from './components/DriverPortal';
import AddDriverModal from './components/AddDriverModal';
import CreateTaskModal from './components/CreateTaskModal';
import SupabaseInfoModal from './components/SupabaseInfoModal';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import {
  fetchDrivers,
  addDriver,
  driverLogin,
  fetchOrders as fetchOrdersFromApi,
  createOrder,
  updateOrderStatus,
  updateOrderLocation,
  completeDelivery,
  acceptOrderDelivery,
  fetchProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  updateOrder,
  deleteOrder,
  updateDeliveryBoy,
  deleteDeliveryBoy,
  updateSavedAddress,
  deleteSavedAddress,
  fetchProductDamages,
  supabase,
  isSupabaseConfigured,
  STORAGE_STAFF_KEY
} from './lib/supabase';

const LOGGED_IN_DRIVER_KEY = 'jal_jivan_current_driver';
const ADMIN_SESSION_KEY = 'admin_session';

// Robust helper to parse URL into application route state
function parseUrlRoute() {
  if (typeof window === 'undefined') {
    return { isStaff: false, isAdminLogin: false, isAdmin: false, module: 'hub' };
  }
  try {
    const pathname = (window.location.pathname || '').toLowerCase().replace(/\/+$/, '');
    const hash = (window.location.hash || '').toLowerCase().replace(/\/+$/, '');
    const search = new URLSearchParams(window.location.search);
    const moduleParam = search.get('module');

    // 1. Common Staff Path (/staff)
    const isStaff =
      pathname === '/staff' ||
      pathname.endsWith('/staff') ||
      pathname.split('/').includes('staff') ||
      hash === '#/staff' ||
      hash === '#staff' ||
      hash.includes('staff');

    // 2. Dedicated Admin Sign-In Path (/admin/login)
    const isAdminLogin =
      pathname === '/admin/login' ||
      pathname.endsWith('/admin/login') ||
      hash === '#/admin/login' ||
      hash === '#admin/login' ||
      hash.includes('admin/login');

    // 3. General Admin / Hub / Module path
    const isAdmin = !isStaff && (
      isAdminLogin ||
      pathname === '/admin' ||
      pathname.startsWith('/admin') ||
      pathname === '/hub' ||
      pathname.includes('delivery') ||
      pathname.includes('dispatch') ||
      pathname.includes('damage') ||
      hash.includes('admin') ||
      hash.includes('hub') ||
      hash.includes('delivery') ||
      hash.includes('dispatch') ||
      Boolean(moduleParam)
    );

    let module = moduleParam || 'hub';
    if (!moduleParam) {
      if (pathname.includes('delivery') || hash.includes('delivery')) module = 'delivery';
      else if (pathname.includes('damage') || hash.includes('damage')) module = 'damage';
    }

    return { isStaff, isAdminLogin, isAdmin, module };
  } catch {
    return { isStaff: false, isAdminLogin: false, isAdmin: false, module: 'hub' };
  }
}

export default function App() {
  // Routing States
  const [isStaffRoute, setIsStaffRoute] = useState(() => parseUrlRoute().isStaff);
  const [isAdminRoute, setIsAdminRoute] = useState(() => parseUrlRoute().isAdmin);
  const [isAdminLoginRoute, setIsAdminLoginRoute] = useState(() => parseUrlRoute().isAdminLogin);
  const [currentModule, setCurrentModule] = useState(() => parseUrlRoute().module);

  // Synchronize route states on browser navigation (Back, Forward, PushState, Hash)
  useEffect(() => {
    const handleUrlChange = () => {
      const parsed = parseUrlRoute();
      setIsStaffRoute(parsed.isStaff);
      setIsAdminRoute(parsed.isAdmin);
      setIsAdminLoginRoute(parsed.isAdminLogin);
      if (parsed.module) {
        setCurrentModule(parsed.module);
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Admin Authentication State (persists across page reloads via session token)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    try {
      const session = localStorage.getItem(ADMIN_SESSION_KEY);
      return Boolean(session);
    } catch {
      return false;
    }
  });

  // Common Staff Session State (persists across page reloads via session token)
  const [staffSession, setStaffSession] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_STAFF_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Authenticated Driver State (persists in localStorage)
  const [currentDriver, setCurrentDriver] = useState(() => {
    try {
      const saved = localStorage.getItem(LOGGED_IN_DRIVER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Sync active module with browser URL query string for instant bookmarking & reload safety
  useEffect(() => {
    if (typeof window !== 'undefined' && isAdminRoute && !isAdminLoginRoute) {
      try {
        const url = new URL(window.location.href);
        if (currentModule === 'hub') {
          if (url.searchParams.has('module')) {
            url.searchParams.delete('module');
            window.history.replaceState(null, '', url.pathname + (url.search ? url.search : ''));
          }
        } else {
          if (url.searchParams.get('module') !== currentModule) {
            url.searchParams.set('module', currentModule);
            window.history.replaceState(null, '', url.toString());
          }
        }
      } catch (e) {}
    }
  }, [currentModule, isAdminRoute, isAdminLoginRoute]);

  // Aliases for submodules
  const adminSubView = currentModule;
  const setAdminSubView = setCurrentModule;

  // Data States
  const [drivers, setDrivers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [damages, setDamages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddDriverOpen, setIsAddDriverOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isDbInfoOpen, setIsDbInfoOpen] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  // Multi-device synchronization: fetch latest orders, drivers & damages
  const syncAllData = useCallback(async () => {
    try {
      const [driversData, ordersData] = await Promise.all([
        fetchDrivers().catch(() => null),
        fetchOrdersFromApi().catch(() => null)
      ]);
      if (Array.isArray(driversData) && driversData.length > 0) {
        setDrivers(driversData);
      }
      if (Array.isArray(ordersData)) {
        setOrders(ordersData);
      }
    } catch (err) {
      console.warn('Background sync error:', err);
    }
  }, []);

  // Fetch orders and update state
  const fetchOrders = useCallback(async () => {
    try {
      const data = await fetchOrdersFromApi();
      if (Array.isArray(data)) {
        setOrders(data);
      }
      return data;
    } catch (err) {
      console.error('Error fetching orders:', err);
    }
  }, []);

  // Load Data
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [driversData, ordersData, productsData, damagesData] = await Promise.all([
        fetchDrivers(),
        fetchOrdersFromApi(),
        fetchProducts(),
        fetchProductDamages()
      ]);
      setDrivers(driversData || []);
      setOrders(ordersData || []);
      setProducts(productsData || []);
      setDamages(damagesData || []);
    } catch (err) {
      console.error('Error loading data:', err);
      showToast('Failed to load live data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Robust Multi-Device Real-Time Synchronization
  useEffect(() => {
    fetchOrders();

    const syncInterval = setInterval(() => {
      syncAllData();
    }, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncAllData();
      }
    };
    const handleFocus = () => syncAllData();
    const handleOnline = () => syncAllData();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    let realtimeChannel = null;
    if (isSupabaseConfigured) {
      try {
        realtimeChannel = supabase
          .channel('app-multiphone-realtime-channel')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            () => syncAllData()
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'delivery_boys' },
            () => syncAllData()
          )
          .subscribe();
      } catch (err) {
        console.warn('Supabase Realtime subscription notice:', err.message);
      }
    }

    return () => {
      clearInterval(syncInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [fetchOrders, syncAllData]);

  // ==========================================
  // AUTHENTICATION & PORTAL NAVIGATION HANDLERS
  // ==========================================

  // 1. Admin Sign-In Success Handler
  const handleAdminLoginSuccess = () => {
    setIsAdminLoggedIn(true);
    setIsAdminLoginRoute(false);
    setIsAdminRoute(true);
    setIsStaffRoute(false);
    setCurrentModule('hub');
    try {
      window.history.pushState({}, '', '/admin');
    } catch (e) {}
    showToast('Admin authenticated successfully! Welcome to Master Hub.', 'success');
  };

  // 2. Admin Logout Handler
  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    try {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      localStorage.removeItem('jal_jivan_admin_logged_in');
    } catch (e) {}
    setIsAdminRoute(true);
    setIsAdminLoginRoute(true);
    setIsStaffRoute(false);
    setCurrentModule('hub');
    try {
      window.history.pushState({}, '', '/admin/login');
    } catch (e) {}
    showToast('Logged out of Admin Portal', 'info');
  };

  // 3. Staff Sign-In Success Handler
  const handleStaffLoginSuccess = (staff) => {
    setStaffSession(staff);
    try {
      localStorage.setItem(STORAGE_STAFF_KEY, JSON.stringify(staff));
    } catch (e) {}

    // Redirection Logic upon verification:
    // If allowed_modules contains only ONE item (e.g. delivery), route immediately to /admin?module=delivery without ever showing the Master Hub.
    if (Array.isArray(staff.allowed_modules) && staff.allowed_modules.length === 1) {
      const singleMod = staff.allowed_modules[0];
      setCurrentModule(singleMod);
      setIsStaffRoute(false);
      setIsAdminRoute(true);
      setIsAdminLoginRoute(false);
      try {
        window.history.pushState({}, '', `/admin?module=${singleMod}`);
      } catch (e) {}
      showToast(`Welcome, ${staff.name}! Authorized for ${singleMod} operations.`, 'success');
    } else {
      // If allowed_modules contains multiple items, display streamlined restricted staff hub
      setCurrentModule('hub');
      setIsStaffRoute(true);
      setIsAdminRoute(false);
      setIsAdminLoginRoute(false);
      try {
        window.history.pushState({}, '', '/staff');
      } catch (e) {}
      showToast(`Welcome back, ${staff.name}!`, 'success');
    }
  };

  // 4. Staff Logout Handler
  const handleStaffLogout = () => {
    setStaffSession(null);
    try {
      localStorage.removeItem(STORAGE_STAFF_KEY);
    } catch (e) {}
    setIsStaffRoute(true);
    setIsAdminRoute(false);
    setIsAdminLoginRoute(false);
    setCurrentModule('hub');
    try {
      window.history.pushState({}, '', '/staff');
    } catch (e) {}
    showToast('Logged out of Staff Portal', 'info');
  };

  // 5. Switch to Staff Portal
  const handleNavigateToStaff = () => {
    setIsStaffRoute(true);
    setIsAdminRoute(false);
    setIsAdminLoginRoute(false);
    try {
      window.history.pushState({}, '', '/staff');
    } catch (e) {}
  };

  // 6. Switch to Admin Login
  const handleNavigateToAdminLogin = () => {
    setIsStaffRoute(false);
    setIsAdminRoute(true);
    setIsAdminLoginRoute(true);
    try {
      window.history.pushState({}, '', '/admin/login');
    } catch (e) {}
  };

  // 7. Back to Hub Navigation (from submodules e.g. delivery or damage)
  const handleBackToHub = () => {
    setCurrentModule('hub');
    if (isStaffRoute || (staffSession && !isAdminLoggedIn)) {
      setIsStaffRoute(true);
      setIsAdminRoute(false);
      setIsAdminLoginRoute(false);
      try {
        window.history.pushState({}, '', '/staff');
      } catch (e) {}
    } else {
      setIsAdminRoute(true);
      setIsStaffRoute(false);
      setIsAdminLoginRoute(false);
      try {
        window.history.pushState({}, '', '/admin');
      } catch (e) {}
    }
  };

  // 8. Toggle Admin / Driver View from Navbar
  const handleToggleAdminView = () => {
    if (isAdminRoute || isStaffRoute) {
      setIsAdminRoute(false);
      setIsStaffRoute(false);
      setIsAdminLoginRoute(false);
      try {
        window.history.pushState({}, '', '/');
      } catch (e) {}
    } else {
      setIsAdminRoute(true);
      setIsStaffRoute(false);
      if (!isAdminLoggedIn) {
        setIsAdminLoginRoute(true);
        try {
          window.history.pushState({}, '', '/admin/login');
        } catch (e) {}
      } else {
        setIsAdminLoginRoute(false);
        try {
          window.history.pushState({}, '', '/admin');
        } catch (e) {}
      }
    }
  };

  // ==========================================
  // OPERATIONAL DATA ACTIONS (DELIVERY, ORDERS, DRIVERS)
  // ==========================================

  const handleAddDriver = async (driverData) => {
    try {
      const newDriver = await addDriver(driverData);
      setDrivers((prev) => [...prev, newDriver]);
      showToast(`Driver ${newDriver.name} added successfully!`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to add driver', 'error');
    }
  };

  const handleCreateTask = async (taskData) => {
    try {
      const newOrder = await createOrder(taskData);
      setOrders((prev) => [newOrder, ...prev]);
      showToast('Delivery task created successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to create task', 'error');
    }
  };

  const handleAddProduct = async (productData) => {
    try {
      const newProduct = await addProduct(productData);
      setProducts((prev) => [...prev, newProduct]);
      showToast(`Product "${newProduct.name}" added successfully!`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to add product', 'error');
      throw err;
    }
  };

  const handleUpdateProduct = async (id, updates) => {
    try {
      const updated = await updateProduct(id, updates);
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      showToast('Product updated successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update product', 'error');
      throw err;
    }
  };

  const handleDeleteProduct = async (id) => {
    try {
      await deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      showToast('Product deleted from inventory', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to delete product', 'error');
      throw err;
    }
  };

  const handleUpdateOrder = async (orderId, updates) => {
    try {
      const updated = await updateOrder(orderId, updates);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)));
      showToast('Order details updated!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update order', 'error');
      throw err;
    }
  };

  const handleDeleteOrder = async (orderId) => {
    try {
      await deleteOrder(orderId);
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      showToast('Order deleted successfully', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to delete order', 'error');
      throw err;
    }
  };

  const handleUpdateDriver = async (driverId, updates) => {
    try {
      const updated = await updateDeliveryBoy(driverId, updates);
      setDrivers((prev) => prev.map((d) => (d.id === driverId ? { ...d, ...updated } : d)));
      showToast('Driver details updated!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update driver', 'error');
      throw err;
    }
  };

  const handleDeleteDriver = async (driverId) => {
    try {
      await deleteDeliveryBoy(driverId);
      setDrivers((prev) => prev.filter((d) => d.id !== driverId));
      showToast('Driver removed from active fleet', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to delete driver', 'error');
      throw err;
    }
  };

  const handleUpdateAddress = async (oldAddressStr, newAddressData) => {
    try {
      await updateSavedAddress(oldAddressStr, newAddressData);
      setOrders((prev) =>
        prev.map((o) =>
          (o.address || '').trim().toLowerCase() === (oldAddressStr || '').trim().toLowerCase()
            ? {
                ...o,
                address: newAddressData.address || o.address,
                landmark: newAddressData.landmark !== undefined ? newAddressData.landmark : o.landmark,
                phone: newAddressData.phone || o.phone,
                customer_name: newAddressData.customer_name || o.customer_name,
                latitude: newAddressData.latitude !== undefined ? newAddressData.latitude : o.latitude,
                longitude: newAddressData.longitude !== undefined ? newAddressData.longitude : o.longitude
              }
            : o
        )
      );
      showToast('Address updated & synced with past orders!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update address', 'error');
      throw err;
    }
  };

  const handleDeleteAddress = async (addressStr, opts) => {
    try {
      await deleteSavedAddress(addressStr, opts);
      if (opts?.alsoRemoveFromOrders) {
        setOrders((prev) =>
          prev.map((o) =>
            (o.address || '').trim().toLowerCase() === (addressStr || '').trim().toLowerCase()
              ? { ...o, address: 'Archived / Removed Address', landmark: '' }
              : o
          )
        );
      }
      showToast('Address removed from directory', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to delete address', 'error');
      throw err;
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      showToast(`Order status updated to "${newStatus}"`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update order status', 'error');
    }
  };

  const handleAssignDriver = async (orderId, driverId, driverName) => {
    try {
      const newStatus = driverId ? 'Out for Delivery' : 'Pending';
      await updateOrderStatus(orderId, newStatus);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                assigned_driver_id: driverId,
                driver_name: driverName || 'Unassigned',
                status: newStatus
              }
            : o
        )
      );
      showToast(
        driverId
          ? `Order assigned to ${driverName}`
          : 'Order set to unassigned',
        'info'
      );
    } catch (err) {
      showToast(err.message || 'Failed to assign driver', 'error');
    }
  };

  // Driver Login (Driver Portal)
  const handleDriverLogin = async (phone, pin) => {
    const driver = await driverLogin(phone, pin);
    if (!driver) {
      throw new Error('Invalid mobile phone number or 4-digit PIN');
    }
    setCurrentDriver(driver);
    localStorage.setItem(LOGGED_IN_DRIVER_KEY, JSON.stringify(driver));
    showToast(`Welcome back, ${driver.name}!`, 'success');
    return driver;
  };

  const handleDriverLogout = () => {
    setCurrentDriver(null);
    localStorage.removeItem(LOGGED_IN_DRIVER_KEY);
    showToast('Logged out of driver portal', 'info');
  };

  const handlePinLocation = async (orderId, latitude, longitude) => {
    try {
      await updateOrderLocation(orderId, latitude, longitude);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, latitude, longitude } : o))
      );
      showToast(`📍 Location pinned successfully (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update location coordinates', 'error');
    }
  };

  const handleCompleteDelivery = async (orderId, podData) => {
    try {
      const updated = await completeDelivery(orderId, podData);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o))
      );
      showToast(`🎉 Order marked as Delivered! POD captured.`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save proof of delivery', 'error');
      throw err;
    }
  };

  const handleAcceptOrder = async (orderId, estimatedMinutes) => {
    try {
      if (!currentDriver) {
        showToast('Please log in as a driver first', 'error');
        return;
      }
      await acceptOrderDelivery(orderId, currentDriver.id, currentDriver.name, estimatedMinutes);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                assigned_driver_id: currentDriver.id,
                driver_id: currentDriver.id,
                driver_name: currentDriver.name,
                status: 'Out for Delivery',
                accepted_at: new Date().toISOString(),
                estimated_minutes: estimatedMinutes
              }
            : o
        )
      );
      showToast('Order accepted! Status updated to Out for Delivery', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to accept order', 'error');
    }
  };

  return (
    <div className="min-h-full w-full max-w-[100vw] overflow-x-hidden flex flex-col bg-[#0b1329] text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        isAdminView={isAdminRoute && !isAdminLoginRoute}
        isAdminRoute={isAdminRoute}
        adminSubView={currentModule}
        onSelectAdminSubView={(mod) => setCurrentModule(mod)}
        onToggleAdminView={handleToggleAdminView}
        currentDriver={currentDriver}
        onDriverLogout={handleDriverLogout}
        onOpenDbInfo={() => setIsDbInfoOpen(true)}
        isAdminLoggedIn={isAdminLoggedIn}
        onAdminLogout={handleAdminLogout}
        isStaffView={isStaffRoute}
        staffSession={staffSession}
        onStaffLogout={handleStaffLogout}
        onNavigateToStaff={handleNavigateToStaff}
        onNavigateToAdmin={handleNavigateToAdminLogin}
      />

      {/* Main Container: Distinct Routes */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-3 sm:py-6 overflow-x-hidden">
        {isStaffRoute ? (
          /* ======================================================== */
          /* ROUTE /staff: COMMON STAFF PORTAL (LOGIN & RESTRICTED HUB) */
          /* ======================================================== */
          <StaffPortal
            staffSession={staffSession}
            onStaffLoginSuccess={handleStaffLoginSuccess}
            onStaffLogout={handleStaffLogout}
            onSelectModule={(mod) => {
              setCurrentModule(mod);
              setIsAdminRoute(true);
              setIsStaffRoute(false);
              try {
                window.history.pushState({}, '', `/admin?module=${mod}`);
              } catch (e) {}
            }}
            onNavigateToAdminLogin={handleNavigateToAdminLogin}
          />
        ) : isAdminRoute ? (
          /* ======================================================== */
          /* ROUTE /admin OR /admin/login: EXCLUSIVE MASTER ADMIN HUB */
          /* ======================================================== */
          isAdminLoginRoute || !isAdminLoggedIn ? (
            <AdminLogin
              onLoginSuccess={handleAdminLoginSuccess}
              onNavigateToStaffLogin={handleNavigateToStaff}
            />
          ) : (
            <div>
              {/* Persistent Breadcrumb Navigation Bar when inside sub-modules */}
              {currentModule !== 'hub' && (
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs shadow-md w-full max-w-full">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                    <button
                      type="button"
                      onClick={handleBackToHub}
                      className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition-colors shrink-0"
                    >
                      ← <span className="hidden xs:inline">Back to</span> Hub
                    </button>
                    <span className="text-slate-600 font-bold">/</span>
                    <span className="text-white font-semibold truncate max-w-[170px] sm:max-w-none">
                      {currentModule === 'delivery'
                        ? 'Delivery & Dispatch System'
                        : 'Damage & Returns Management'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {currentModule === 'delivery' ? (
                      <button
                        type="button"
                        onClick={() => setCurrentModule('damage')}
                        className="text-xs text-rose-300 hover:text-white px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all font-medium"
                      >
                        <span className="hidden sm:inline">Switch to </span>Damage Portal →
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCurrentModule('delivery')}
                        className="text-xs text-emerald-300 hover:text-white px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all font-medium"
                      >
                        <span className="hidden sm:inline">Switch to </span>Dispatch Console →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Render Selected Admin Sub-Module */}
              {currentModule === 'hub' ? (
                <AdminHub
                  onSelectModule={(mod) => setCurrentModule(mod)}
                  orders={orders}
                  drivers={drivers}
                  damages={damages}
                  onOpenCreateTask={() => setIsCreateTaskOpen(true)}
                  onOpenAddDriver={() => setIsAddDriverOpen(true)}
                  onRefreshAll={loadInitialData}
                  onAdminLogout={handleAdminLogout}
                />
              ) : currentModule === 'damage' ? (
                <DamageReturnHub
                  onBackToHub={handleBackToHub}
                  drivers={drivers}
                />
              ) : (
                <ErrorBoundary title="Delivery & Dispatch Console">
                  <AdminDashboard
                    orders={orders}
                    drivers={drivers}
                    products={products}
                    loading={loading}
                    onOpenAddDriver={() => setIsAddDriverOpen(true)}
                    onOpenCreateTask={() => setIsCreateTaskOpen(true)}
                    onUpdateStatus={handleUpdateStatus}
                    onAssignDriver={handleAssignDriver}
                    onAddProduct={handleAddProduct}
                    onUpdateProduct={handleUpdateProduct}
                    onDeleteProduct={handleDeleteProduct}
                    onUpdateOrder={handleUpdateOrder}
                    onDeleteOrder={handleDeleteOrder}
                    onUpdateDriver={handleUpdateDriver}
                    onDeleteDriver={handleDeleteDriver}
                    onUpdateAddress={handleUpdateAddress}
                    onDeleteAddress={handleDeleteAddress}
                    onRefresh={loadInitialData}
                    onLogout={handleAdminLogout}
                  />
                </ErrorBoundary>
              )}
            </div>
          )
        ) : (
          /* ======================================================== */
          /* ROUTE /: EXCLUSIVELY DRIVER PORTAL VIEW */
          /* ======================================================== */
          <DriverPortal
            currentDriver={currentDriver}
            drivers={drivers}
            orders={orders}
            onLogin={handleDriverLogin}
            onLogout={handleDriverLogout}
            onPinLocation={handlePinLocation}
            onCompleteDelivery={handleCompleteDelivery}
            onAcceptOrder={handleAcceptOrder}
          />
        )}
      </main>

      {/* Modals */}
      <AddDriverModal
        isOpen={isAddDriverOpen}
        onClose={() => setIsAddDriverOpen(false)}
        onAddDriver={handleAddDriver}
      />

      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        drivers={drivers}
        products={products}
        orders={orders}
        onCreateTask={handleCreateTask}
      />

      <SupabaseInfoModal
        isOpen={isDbInfoOpen}
        onClose={() => setIsDbInfoOpen(false)}
      />

      {/* Toast Feedback */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
