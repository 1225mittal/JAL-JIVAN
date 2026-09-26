import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from './components/Navbar';
import AdminHub from './components/AdminHub';
import DamageReturnHub from './components/damage/DamageReturnHub';
import AdminPanel, { AdminDashboard } from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import StaffPortal from './components/StaffPortal';
import PurchaseInwardHub from './components/PurchaseInwardHub';
import PlannedModuleView from './components/PlannedModuleView';
import DriverPortal from './components/DriverPortal';
import AddDriverModal from './components/AddDriverModal';
import CreateTaskModal from './components/CreateTaskModal';
import SupabaseInfoModal from './components/SupabaseInfoModal';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { ArrowLeft } from 'lucide-react';
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

// ==========================================
// 1. CLEAN URL ROUTE PARSER (NO MESSY QUERY PARAMS)
// ==========================================
export function parseRoute() {
  if (typeof window === 'undefined') {
    return { type: 'driver', module: null, pathname: '/' };
  }

  let pathname = (window.location.pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
  const hash = (window.location.hash || '').toLowerCase().replace(/^#\/?/, '').replace(/\/+$/, '');
  const search = new URLSearchParams(window.location.search);
  const legacyModule = search.get('module');

  // Support SPA deep link fallback via hash
  if (pathname === '/' && hash) {
    pathname = '/' + hash;
  }

  // Handle legacy query params (?module=...)
  if (legacyModule) {
    const mod = legacyModule === 'hub' ? 'hub' : legacyModule;
    if (mod === 'hub') {
      return { type: 'admin-hub', module: 'hub', pathname: '/admin' };
    }
    return { type: 'admin-module', module: mod, pathname: `/admin/${mod}` };
  }

  // Route 1: Staff Portal (/staff or /staff/login)
  if (pathname === '/staff' || pathname === '/staff/login') {
    return { type: 'staff', module: null, pathname: '/staff' };
  }

  // Route 2: Dedicated Admin Login (/admin/login)
  if (pathname === '/admin/login') {
    return { type: 'admin-login', module: null, pathname: '/admin/login' };
  }

  // Route 3: Dedicated Admin Modules (/admin/delivery, /admin/damage, /admin/purchase, /admin/sales, etc.)
  const adminModMatch = pathname.match(
    /^\/admin\/(delivery|damage|purchase|sales|marketing|finance|staff|settings|config)$/
  );
  if (adminModMatch) {
    const rawMod = adminModMatch[1];
    const mod = rawMod === 'config' ? 'settings' : rawMod;
    return { type: 'admin-module', module: mod, pathname: `/admin/${mod}` };
  }

  // Route 4: Master Executive Hub (/admin or /admin/hub)
  if (pathname === '/admin' || pathname === '/admin/hub' || pathname === '/hub') {
    return { type: 'admin-hub', module: 'hub', pathname: '/admin' };
  }

  // Route 5: Default Driver Portal (/)
  return { type: 'driver', module: null, pathname: '/' };
}

function getModuleTitle(moduleKey) {
  switch (moduleKey) {
    case 'delivery':
      return 'Delivery & Dispatch Console';
    case 'damage':
      return 'Damage & Returns Management';
    case 'purchase':
      return 'Purchase & Inward Management';
    case 'sales':
      return 'Sales & Billing';
    case 'marketing':
      return 'Marketing & Broadcasts';
    case 'finance':
      return 'Bahi Khata & Finance';
    case 'staff':
      return 'Staff & Attendance';
    case 'settings':
    case 'config':
      return 'Store & System Config';
    default:
      return 'Enterprise Module';
  }
}

export default function App() {
  // Current Route State
  const [routeState, setRouteState] = useState(() => parseRoute());

  // Admin Authentication State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    try {
      const session = localStorage.getItem(ADMIN_SESSION_KEY);
      return Boolean(session);
    } catch {
      return false;
    }
  });

  // Common Staff Session State
  const [staffSession, setStaffSession] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_STAFF_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Authenticated Driver State
  const [currentDriver, setCurrentDriver] = useState(() => {
    try {
      const saved = localStorage.getItem(LOGGED_IN_DRIVER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Toast Notification
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  // Clean Navigation Helper
  const navigate = useCallback((targetUrl, replace = false) => {
    try {
      if (replace) {
        window.history.replaceState({}, '', targetUrl);
      } else {
        window.history.pushState({}, '', targetUrl);
      }
    } catch (e) {}
    setRouteState(parseRoute());
  }, []);

  // Listen to browser navigation (back/forward) & clean legacy query params
  useEffect(() => {
    const handleLocationChange = () => {
      setRouteState(parseRoute());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    // Strip legacy ?module=... query params and rewrite cleanly
    const search = new URLSearchParams(window.location.search);
    if (search.has('module')) {
      const legacyMod = search.get('module');
      search.delete('module');
      const remainingQuery = search.toString() ? `?${search.toString()}` : '';
      const newPath = legacyMod === 'hub' ? '/admin' : `/admin/${legacyMod}`;
      try {
        window.history.replaceState({}, '', `${newPath}${remainingQuery}`);
        setRouteState(parseRoute());
      } catch (e) {}
    }

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

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

  // Multi-device synchronization
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

  // Realtime multi-phone synchronization
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
          .channel('app-realtime-global-sync')
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
  // AUTHENTICATION & NAVIGATION HANDLERS
  // ==========================================

  // Admin Login Success
  const handleAdminLoginSuccess = () => {
    setIsAdminLoggedIn(true);
    navigate('/admin');
    showToast('Admin authenticated successfully! Welcome to Master Hub.', 'success');
  };

  // Admin Logout (strictly navigates to /admin/login)
  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    try {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      localStorage.removeItem('jal_jivan_admin_logged_in');
    } catch (e) {}
    navigate('/admin/login');
    showToast('Logged out of Admin Portal', 'info');
  };

  // Staff Login Success
  const handleStaffLoginSuccess = (staff) => {
    setStaffSession(staff);
    try {
      localStorage.setItem(STORAGE_STAFF_KEY, JSON.stringify(staff));
    } catch (e) {}

    // If single module allowed: redirect directly to that module URL (e.g. /admin/delivery)
    if (Array.isArray(staff.allowed_modules) && staff.allowed_modules.length === 1) {
      const singleMod = staff.allowed_modules[0];
      navigate(`/admin/${singleMod}`);
      showToast(`Welcome, ${staff.name}! Authorized for ${singleMod} operations.`, 'success');
    } else {
      // Multiple modules allowed: stay at /staff showing minimal permitted workspace
      navigate('/staff');
      showToast(`Welcome, ${staff.name}! Staff workspace active.`, 'success');
    }
  };

  // Staff Logout
  const handleStaffLogout = () => {
    setStaffSession(null);
    try {
      localStorage.removeItem(STORAGE_STAFF_KEY);
    } catch (e) {}
    navigate('/staff');
    showToast('Logged out of Staff Portal', 'info');
  };

  // Back to Hub Handler:
  // If staff member: navigates to /staff (never sees owner hub!)
  // If admin: navigates to /admin
  const handleBackToHub = () => {
    if (staffSession && !isAdminLoggedIn) {
      navigate('/staff');
    } else {
      navigate('/admin');
    }
  };

  // Operational Action Handlers
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
        driverId ? `Order assigned to ${driverName}` : 'Order set to unassigned',
        'info'
      );
    } catch (err) {
      showToast(err.message || 'Failed to assign driver', 'error');
    }
  };

  // Driver Login & Actions
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

  // Determine which sub-view is active
  const isViewAdmin = routeState.type.startsWith('admin');
  const isViewStaff = routeState.type === 'staff';

  return (
    <div className="min-h-full w-full max-w-[100vw] overflow-x-hidden flex flex-col bg-[#0b1329] text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        isAdminRoute={isViewAdmin}
        isAdminView={isViewAdmin}
        adminSubView={routeState.module || (routeState.type === 'admin-hub' ? 'hub' : '')}
        onNavigateToAdminHub={() => navigate('/admin')}
        currentDriver={currentDriver}
        onDriverLogout={handleDriverLogout}
        onOpenDbInfo={() => setIsDbInfoOpen(true)}
        isAdminLoggedIn={isAdminLoggedIn}
        onAdminLogout={handleAdminLogout}
        isStaffView={isViewStaff}
        staffSession={staffSession}
        onStaffLogout={handleStaffLogout}
      />

      {/* Main Routing Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-3 sm:py-6 overflow-x-hidden">
        {/* ======================================================== */}
        {/* ROUTE 1: /staff or /staff/login (COMMON STAFF LOGIN & WORKSPACE) */}
        {/* ======================================================== */}
        {routeState.type === 'staff' ? (
          <StaffPortal
            staffSession={staffSession}
            onStaffLoginSuccess={handleStaffLoginSuccess}
            onStaffLogout={handleStaffLogout}
            onNavigate={(path) => navigate(path)}
            onNavigateToAdminLogin={() => navigate('/admin/login')}
          />
        ) : routeState.type === 'admin-login' ? (
          /* ======================================================== */
          /* ROUTE 2: /admin/login (DEDICATED ADMIN LOGIN) */
          /* ======================================================== */
          isAdminLoggedIn ? (
            // If already logged in, navigate straight to /admin
            <div className="p-8 text-center">
              <p className="text-slate-400">Admin session active. Redirecting to Master Hub...</p>
              <button
                onClick={() => navigate('/admin')}
                className="mt-4 px-4 py-2 bg-emerald-600 rounded-xl text-white font-bold text-xs"
              >
                Go to Hub
              </button>
            </div>
          ) : (
            <AdminLogin
              onLoginSuccess={handleAdminLoginSuccess}
              onNavigateToStaffLogin={() => navigate('/staff')}
            />
          )
        ) : routeState.type === 'admin-hub' ? (
          /* ======================================================== */
          /* ROUTE 3: /admin (CLEAN EXECUTIVE MASTER HUB) */
          /* ======================================================== */
          !isAdminLoggedIn ? (
            // Protected: Not logged in as Admin
            staffSession ? (
              // Staff members are never allowed to see the Owner Hub!
              <div className="p-8 text-center space-y-4">
                <p className="text-amber-400 font-bold">
                  Owner Hub is restricted to Store Owner & Super Administrator.
                </p>
                <button
                  onClick={() => navigate('/staff')}
                  className="px-4 py-2 bg-cyan-600 rounded-xl text-white font-bold text-xs"
                >
                  Return to Staff Workspace
                </button>
              </div>
            ) : (
              <AdminLogin
                onLoginSuccess={handleAdminLoginSuccess}
                onNavigateToStaffLogin={() => navigate('/staff')}
              />
            )
          ) : (
            <AdminHub onNavigate={(path) => navigate(path)} />
          )
        ) : routeState.type === 'admin-module' ? (
          /* ======================================================== */
          /* ROUTE 4: /admin/{module} (DEDICATED MODULE PAGES) */
          /* ======================================================== */
          !isAdminLoggedIn && !staffSession ? (
            // Protected: unauthenticated
            <AdminLogin
              onLoginSuccess={handleAdminLoginSuccess}
              onNavigateToStaffLogin={() => navigate('/staff')}
            />
          ) : !isAdminLoggedIn &&
            staffSession &&
            Array.isArray(staffSession.allowed_modules) &&
            !staffSession.allowed_modules.includes(routeState.module) ? (
            // Protected: Staff member without permission for this module
            <div className="p-8 text-center space-y-4 bg-slate-900 border border-slate-800 rounded-3xl">
              <p className="text-rose-400 font-bold text-sm">
                Access Denied: You do not have permission for the {getModuleTitle(routeState.module)} module.
              </p>
              <button
                onClick={() => navigate('/staff')}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white font-bold text-xs transition"
              >
                Return to Staff Workspace
              </button>
            </div>
          ) : (
            <div>
              {/* Clean Module Top Bar: Back to Hub + Module Title (NO Switcher lines) */}
              <div className="flex items-center justify-between gap-3 mb-4 px-3.5 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs shadow-md w-full max-w-full">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={handleBackToHub}
                    className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5 transition-colors shrink-0 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 shadow-sm"
                    title={
                      staffSession && !isAdminLoggedIn
                        ? 'Return to Staff Workspace'
                        : 'Return to Master Hub'
                    }
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>
                      {staffSession && !isAdminLoggedIn ? '← Back to Workspace' : '← Back to Hub'}
                    </span>
                  </button>
                  <span className="text-slate-600 font-bold">/</span>
                  <span className="text-white font-semibold truncate">
                    {getModuleTitle(routeState.module)}
                  </span>
                </div>
              </div>

              {/* Render Selected Module Component */}
              {routeState.module === 'delivery' ? (
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
                    onBackToHub={handleBackToHub}
                  />
                </ErrorBoundary>
              ) : routeState.module === 'purchase' ? (
                <PurchaseInwardHub
                  onBackToHub={handleBackToHub}
                  showToast={showToast}
                />
              ) : routeState.module === 'damage' ? (
                <DamageReturnHub
                  onBackToHub={handleBackToHub}
                  drivers={drivers}
                />
              ) : (
                <PlannedModuleView
                  moduleId={routeState.module}
                  onBackToHub={handleBackToHub}
                />
              )}
            </div>
          )
        ) : (
          /* ======================================================== */
          /* ROUTE 5: / (EXCLUSIVELY DRIVER PORTAL) */
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
