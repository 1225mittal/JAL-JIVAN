import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from './components/Navbar';
import AdminHub from './components/AdminHub';
import DamageReturnHub from './components/damage/DamageReturnHub';
import AdminPanel, { AdminDashboard } from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import PurchaseInwardHub from './components/PurchaseInwardHub';
import StaffDirectoryHub from './components/staff/StaffDirectoryHub';
import ItemsInventoryHub from './components/items/ItemsInventoryHub';
import PlannedModuleView from './components/PlannedModuleView';
import SalesBillingHub from './pages/SalesBillingHub';
import DriverPortal from './components/DriverPortal';
import MobileInwardCapture from './components/purchase/MobileInwardCapture';
import AddDriverModal from './components/AddDriverModal';
import CreateTaskModal from './components/CreateTaskModal';
import SupabaseInfoModal from './components/SupabaseInfoModal';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import useRealtimeSubscription from './hooks/useRealtimeSubscription';
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
  isSupabaseConfigured
} from './lib/supabase';

const LOGGED_IN_DRIVER_KEY = 'jal_jivan_current_driver';
const ADMIN_SESSION_KEY = 'admin_session';

// ==========================================
// 1. CLEAN URL ROUTE & MODULE PARSER (PREVENTS HUB OVERRIDE)
// ==========================================
export const getInitialModule = () => {
  if (typeof window === 'undefined') return 'hub';
  const path = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const queryModule = params.get('module');

  // Explicit path matching takes absolute priority
  if (path.includes('/rider') || path.includes('/driver')) {
    return 'driver';
  }
  if (path.includes('/admin/staff') || queryModule === 'staff') {
    return 'staff';
  }
  if (path.includes('/admin/sales') || queryModule === 'sales') {
    return 'sales';
  }
  if (path.includes('/admin/items') || path.includes('/admin/inventory') || queryModule === 'items' || queryModule === 'inventory') {
    return 'items';
  }
  if (path.includes('/admin/purchase') || queryModule === 'purchase') {
    return 'purchase';
  }
  if (path.includes('/admin/delivery') || queryModule === 'delivery') {
    return 'delivery';
  }
  if (path.includes('/admin/damage') || queryModule === 'damage') {
    return 'damage';
  }
  return 'hub';
};

export function parseRoute() {
  if (typeof window === 'undefined') {
    return { type: 'admin-hub', module: 'hub', pathname: '/admin' };
  }

  let pathname = (window.location.pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
  const hash = (window.location.hash || '').toLowerCase().replace(/^#\/?/, '').replace(/\/+$/, '');
  const search = new URLSearchParams(window.location.search);
  const legacyModule = search.get('module');

  // Support SPA deep link fallback via hash
  if (pathname === '/' && hash) {
    pathname = '/' + hash;
  }

  // Route 0: Dedicated Public Mobile Inward Camera (/scan-inward)
  if (pathname === '/scan-inward' || pathname.startsWith('/scan-inward')) {
    const sessionId = search.get('session') || '';
    return { type: 'scan-inward', module: null, pathname: '/scan-inward', sessionId };
  }

  // Explicit pathname matching takes absolute priority over legacy query params
  // Route 1: Dedicated Rider Portal (/rider, with /driver as legacy alias)
  if (pathname === '/rider' || pathname === '/driver') {
    return { type: 'driver', module: null, pathname: '/rider' };
  }

  // Route 2: Dedicated Admin Login (/admin/login)
  if (pathname === '/admin/login') {
    return { type: 'admin-login', module: null, pathname: '/admin/login' };
  }

  // Route 3: Dedicated Admin Modules (/admin/delivery, /admin/damage, /admin/purchase, /admin/items, /admin/staff, etc.)
  const adminModMatch = pathname.match(
    /^\/admin\/(delivery|damage|purchase|items|inventory|staff|sales|marketing|finance|settings|config)$/
  );
  if (adminModMatch) {
    const rawMod = adminModMatch[1];
    const mod = rawMod === 'config' ? 'settings' : rawMod === 'inventory' ? 'items' : rawMod;
    return { type: 'admin-module', module: mod, pathname: `/admin/${mod}` };
  }

  // Route 5: Master Executive Hub (/admin or /admin/hub)
  if (pathname === '/admin' || pathname === '/admin/hub' || pathname === '/hub') {
    return { type: 'admin-hub', module: 'hub', pathname: '/admin' };
  }

  // Handle legacy query params (?module=...) only for root '/' or fallback
  if (legacyModule) {
    const mod = legacyModule === 'hub' ? 'hub' : legacyModule;
    if (mod === 'hub') {
      return { type: 'admin-hub', module: 'hub', pathname: '/admin' };
    }
    return { type: 'admin-module', module: mod, pathname: `/admin/${mod}` };
  }

  // Route 6: Root (/) defaults to Master Executive Hub (/admin)
  return { type: 'admin-hub', module: 'hub', pathname: '/admin' };
}

function getModuleTitle(moduleKey) {
  switch (moduleKey) {
    case 'delivery':
      return 'Delivery & Dispatch Console';
    case 'damage':
      return 'Damage & Returns Management';
    case 'purchase':
      return 'Purchase & Inward Management';
    case 'staff':
      return 'Staff & Roles Directory';
    case 'sales':
      return 'Sales & Billing';
    case 'marketing':
      return 'Marketing & Broadcasts';
    case 'finance':
      return 'Bahi Khata & Finance';
    case 'settings':
    case 'config':
      return 'Store & System Config';
    default:
      return 'Enterprise Module';
  }
}

export default function App() {
  // Current Active Module State (checked from URL before localStorage)
  const [currentModule, setCurrentModule] = useState(getInitialModule);

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
    const newRoute = parseRoute();
    setRouteState(newRoute);
    if (newRoute.type === 'driver') {
      setCurrentModule('driver');
    } else if (newRoute.module) {
      setCurrentModule(newRoute.module);
    } else if (newRoute.type === 'admin-hub') {
      setCurrentModule('hub');
    }
  }, []);

  // Sync currentModule with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('active_module', currentModule);
    } catch (e) {}
  }, [currentModule]);

  // Listen to browser navigation (back/forward) & clean legacy query params
  useEffect(() => {
    const handleLocationChange = () => {
      const newRoute = parseRoute();
      setRouteState(newRoute);
      if (newRoute.type === 'driver') {
        setCurrentModule('driver');
      } else if (newRoute.module) {
        setCurrentModule(newRoute.module);
      } else if (newRoute.type === 'admin-hub') {
        setCurrentModule('hub');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    // Strip legacy ?module=... query params and rewrite cleanly without overriding direct URLs
    const search = new URLSearchParams(window.location.search);
    if (search.has('module')) {
      const legacyMod = search.get('module');
      search.delete('module');
      const remainingQuery = search.toString() ? `?${search.toString()}` : '';
      const currentPath = (window.location.pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
      let newPath = currentPath;
      if (currentPath === '/' || currentPath === '') {
        newPath = legacyMod === 'hub' ? '/admin' : `/admin/${legacyMod}`;
      }
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

  // Live Supabase Realtime subscription for Delivery & Dispatch Console
  useRealtimeSubscription({
    table: ['orders', 'deliveries', 'settlements'],
    setData: setOrders,
    prepend: true,
    onChange: () => {
      syncAllData();
    }
  });

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

  // Back to Hub Handler
  const handleBackToHub = () => {
    navigate('/admin');
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
    localStorage.setItem('driver_session', JSON.stringify(driver));
    localStorage.setItem('active_role', 'driver');
    localStorage.setItem('active_module', 'driver');
    showToast(`Welcome back, ${driver.name}!`, 'success');
    return driver;
  };

  const handleDriverLogout = () => {
    setCurrentDriver(null);
    localStorage.clear();
    showToast('Logged out of rider portal', 'info');
    window.location.href = '/rider';
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

  // Dedicated Public Route for Mobile Inward Camera (/scan-inward)
  // Accessible at /scan-inward?session=:sessionId without requiring admin login
  const isScanInwardRoute =
    typeof window !== 'undefined' &&
    (window.location.pathname.toLowerCase().includes('/scan-inward') ||
     (window.location.hash && window.location.hash.toLowerCase().includes('/scan-inward')));

  if (isScanInwardRoute) {
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const sessionId = searchParams?.get('session') || routeState?.sessionId || '';
    return <MobileInwardCapture sessionId={sessionId} />;
  }

  // Simple, resilient path checking for rider route (/rider or legacy /driver)
  // ONLY URLs explicitly containing /rider or /driver render DriverPortal
  const isDriverRoute =
    typeof window !== 'undefined' &&
    (window.location.pathname.toLowerCase().includes('/rider') ||
     window.location.pathname.toLowerCase().includes('/driver') ||
     (window.location.hash &&
       (window.location.hash.toLowerCase().includes('/rider') ||
        window.location.hash.toLowerCase().includes('/driver'))));

  // When isDriverRoute is true:
  // Render ONLY the <DriverPortal /> component without ErrorBoundary, Navbar, or Admin panels.
  if (isDriverRoute) {
    return (
      <DriverPortal
        currentDriver={currentDriver}
        drivers={drivers}
        orders={orders}
        onLogin={handleDriverLogin}
        onLogout={handleDriverLogout}
        onBack={handleBackToHub}
        onPinLocation={handlePinLocation}
        onCompleteDelivery={handleCompleteDelivery}
        onAcceptOrder={handleAcceptOrder}
      />
    );
  }

  const isViewAdmin = routeState.type.startsWith('admin');

  return (
    <div className="min-h-full w-full max-w-[100vw] overflow-x-hidden flex flex-col bg-[#0b1329] text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        isAdminRoute={isViewAdmin}
        isAdminView={isViewAdmin}
        adminSubView={routeState.module || (routeState.type === 'admin-hub' ? 'hub' : '')}
        onNavigateToAdminHub={() => navigate('/admin')}
        onOpenDbInfo={() => setIsDbInfoOpen(true)}
        isAdminLoggedIn={isAdminLoggedIn}
        onAdminLogout={handleAdminLogout}
      />

      {/* Main Routing Container */}
      <main className={`flex-1 w-full mx-auto overflow-x-hidden ${routeState.module === 'purchase' || routeState.module === 'items' ? 'max-w-[98vw] px-2 md:px-4 py-2' : 'max-w-6xl px-3 sm:px-4 py-3 sm:py-6'}`}>
        {routeState.type === 'admin-login' ? (
          /* ======================================================== */
          /* ROUTE: /admin/login (DEDICATED ADMIN LOGIN) */
          /* ======================================================== */
          isAdminLoggedIn ? (
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
            <AdminLogin onLoginSuccess={handleAdminLoginSuccess} />
          )
        ) : routeState.type === 'admin-hub' ? (
          /* ======================================================== */
          /* ROUTE: /admin (CLEAN EXECUTIVE MASTER HUB) */
          /* ======================================================== */
          !isAdminLoggedIn ? (
            <AdminLogin onLoginSuccess={handleAdminLoginSuccess} />
          ) : (
            <AdminHub onNavigate={(path) => window.open(path, '_blank', 'noopener,noreferrer')} />
          )
        ) : routeState.type === 'admin-module' ? (
          /* ======================================================== */
          /* ROUTE: /admin/{module} (DEDICATED MODULE PAGES) */
          /* ======================================================== */
          !isAdminLoggedIn ? (
            <AdminLogin onLoginSuccess={handleAdminLoginSuccess} />
          ) : routeState.module === 'delivery' ? (
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
            <ErrorBoundary title="Purchase & Inward Hub">
              <PurchaseInwardHub
                onBackToHub={handleBackToHub}
                showToast={showToast}
              />
            </ErrorBoundary>
          ) : routeState.module === 'items' ? (
            <ErrorBoundary title="Items & Inventory Hub">
              <ItemsInventoryHub
                onBackToHub={handleBackToHub}
                showToast={showToast}
              />
            </ErrorBoundary>
          ) : routeState.module === 'damage' ? (
            <ErrorBoundary title="Damage & Returns Hub">
              <DamageReturnHub
                onBackToHub={handleBackToHub}
                drivers={drivers}
              />
            </ErrorBoundary>
          ) : routeState.module === 'staff' ? (
            <ErrorBoundary title="Staff Directory Hub">
              <StaffDirectoryHub
                onBackToHub={handleBackToHub}
                showToast={showToast}
              />
            </ErrorBoundary>
          ) : routeState.module === 'sales' ? (
            <ErrorBoundary title="Retail Sales & POS Billing">
              <SalesBillingHub
                onBackToHub={handleBackToHub}
                showToast={showToast}
              />
            </ErrorBoundary>
          ) : (
            <PlannedModuleView
              moduleId={routeState.module}
              onBackToHub={handleBackToHub}
            />
          )
        ) : (
          /* ======================================================== */
          /* ROOT / OR DEFAULT EXECUTIVE ADMIN HUB */
          /* ======================================================== */
          isAdminLoggedIn ? (
            <AdminHub onNavigate={(path) => window.open(path, '_blank', 'noopener,noreferrer')} />
          ) : (
            <AdminLogin onLoginSuccess={handleAdminLoginSuccess} />
          )
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
