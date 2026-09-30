import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from './components/Navbar';
import AdminHub from './components/AdminHub';
import DamageReturnHub from './components/damage/DamageReturnHub';
import AdminPanel, { AdminDashboard } from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import Login from './pages/Login';
import PublicLandingPage from './pages/PublicLandingPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import SuperAdminAuth from './pages/SuperAdminAuth';
import MasterHQConsole from './pages/MasterHQConsole';
import PurchaseInwardHub from './components/PurchaseInwardHub';
import StaffDirectoryHub from './components/staff/StaffDirectoryHub';
import ItemsInventoryHub from './components/items/ItemsInventoryHub';
import PlannedModuleView from './components/PlannedModuleView';
import SalesBillingHub from './pages/SalesBillingHub';
import DriverPortal from './components/DriverPortal';
import MobileInwardCapture from './components/purchase/MobileInwardCapture';
import ModularSidebar from './components/ModularSidebar';
import StaffSettingsPage from './pages/StaffSettingsPage';
import StoreDeliveryPortal from './pages/StoreDeliveryPortal';
import { useAuth, DEFAULT_STORE } from './context/AuthContext';
import { Store, ShieldAlert, AlertTriangle } from 'lucide-react';
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
  const route = parseRoute();
  if (route.type === 'driver') return 'driver';
  if (route.type === 'store-delivery') return 'delivery';
  if (route.module) return route.module;
  return 'hub';
};

export function parseRoute() {
  if (typeof window === 'undefined') {
    return { type: 'public-landing', pathname: '/' };
  }

  let pathname = (window.location.pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
  const hash = (window.location.hash || '').toLowerCase().replace(/^#\/?/, '').replace(/\/+$/, '');
  const search = new URLSearchParams(window.location.search);

  // Support SPA deep link fallback via hash
  if (pathname === '/' && hash) {
    pathname = '/' + hash;
  }

  // 1. PUBLIC ROOT (/) - SaaS Landing & Store Login
  if (pathname === '/' || pathname === '') {
    return { type: 'public-landing', pathname: '/' };
  }

  // 2. Dedicated Public Mobile Inward Camera (/scan-inward)
  if (pathname === '/scan-inward' || pathname.startsWith('/scan-inward')) {
    const sessionId = search.get('session') || '';
    return { type: 'scan-inward', module: null, pathname: '/scan-inward', sessionId };
  }

  // 3. Standalone Super Admin HQ Console (/hq-console and /hq-console/auth)
  if (pathname === '/hq-console/auth' || pathname.startsWith('/hq-console/auth')) {
    return { type: 'hq-auth', module: null, pathname: '/hq-console/auth' };
  }
  if (pathname === '/hq-console' || pathname.startsWith('/hq-console') || pathname === '/super-admin') {
    return { type: 'hq-console', module: null, pathname: '/hq-console' };
  }

  // 4. Dedicated Rider Portal (/rider, with /driver as legacy alias)
  if (pathname === '/rider' || pathname === '/driver') {
    return { type: 'driver', module: null, pathname: '/rider' };
  }

  // 5. Dedicated Store Delivery Route:
  // - /store/:storeSlug/delivery OR /:storeSlug/delivery
  const legacyStoreDeliveryMatch = pathname.match(/^\/store\/([a-zA-Z0-9_-]+)\/delivery\/?$/);
  if (legacyStoreDeliveryMatch) {
    return { type: 'store-delivery', storeSlug: legacyStoreDeliveryMatch[1], pathname };
  }

  // 6. Dedicated Store Login Screen (/login or /admin/login)
  if (pathname === '/admin/login' || pathname === '/login') {
    return { type: 'admin-login', module: null, pathname: '/login' };
  }

  // 7. Settings Staff (/settings/staff)
  if (pathname === '/settings/staff' || pathname.startsWith('/settings/staff')) {
    return { type: 'settings-staff', module: 'staff-settings', pathname: '/settings/staff' };
  }

  // 8. Legacy /admin or /admin/:mod routes
  const adminModMatch = pathname.match(
    /^\/admin\/(delivery|damage|purchase|items|inventory|staff|sales|marketing|finance|settings|config)$/
  );
  if (adminModMatch) {
    const rawMod = adminModMatch[1];
    const mod = rawMod === 'config' ? 'settings' : rawMod === 'inventory' ? 'items' : rawMod;
    if (mod === 'delivery') {
      return { type: 'store-delivery', storeSlug: 'mittal-store', pathname: '/admin/delivery' };
    }
    return { type: 'admin-module', module: mod, pathname: `/admin/${mod}` };
  }
  if (pathname === '/admin' || pathname === '/admin/hub' || pathname === '/hub') {
    return { type: 'admin-hub', module: 'hub', pathname: '/admin' };
  }

  // 9. DYNAMIC STORE SCOPED ROUTES (/:storeSlug, /:storeSlug/admin, /:storeSlug/:module)
  const segments = pathname.replace(/^\//, '').split('/');
  const potentialSlug = segments[0];

  const reserved = [
    '',
    'scan-inward',
    'rider',
    'driver',
    'hq-console',
    'super-admin',
    'login',
    'admin',
    'store',
    'api',
    'assets',
    'settings'
  ];

  if (potentialSlug && !reserved.includes(potentialSlug)) {
    const subRoute = segments[1] || '';

    // Subroute: delivery (/:storeSlug/delivery)
    if (subRoute === 'delivery') {
      return { type: 'store-delivery', storeSlug: potentialSlug, pathname };
    }

    // Subroute: staff (/:storeSlug/staff)
    if (subRoute === 'staff') {
      return { type: 'store-scoped', storeSlug: potentialSlug, module: 'staff-settings', pathname };
    }

    // Subroute: hub (/:storeSlug or /:storeSlug/admin or /:storeSlug/hub)
    if (!subRoute || subRoute === 'admin' || subRoute === 'hub') {
      return { type: 'store-scoped', storeSlug: potentialSlug, module: 'hub', pathname: `/${potentialSlug}` };
    }

    // Subroute: modules (sales, purchase, items, inventory, damage, marketing, finance, settings)
    const normalizedMod = subRoute === 'inventory' ? 'items' : subRoute;
    return {
      type: 'store-scoped',
      storeSlug: potentialSlug,
      module: normalizedMod,
      pathname: `/${potentialSlug}/${subRoute}`
    };
  }

  // Default fallback: Public Landing Page
  return { type: 'public-landing', pathname: '/' };
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
  const {
    currentStore,
    setCurrentStore,
    userRole,
    isSuperAdmin,
    isOwner,
    userProfile,
    logoutUser
  } = useAuth();

  // Current Active Module State (checked from URL before localStorage)
  const [currentModule, setCurrentModule] = useState(getInitialModule);

  // Current Route State
  const [routeState, setRouteState] = useState(() => parseRoute());

  // Store Scoping and Multi-Tenant Isolation States
  const [storeNotFound, setStoreNotFound] = useState(false);
  const [tenantAccessDenied, setTenantAccessDenied] = useState(false);

  // Admin Authentication State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    try {
      const session = localStorage.getItem(ADMIN_SESSION_KEY) || localStorage.getItem('jaljivan_store_session');
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
    } else if (newRoute.type === 'store-delivery') {
      setCurrentModule('delivery');
    } else if (newRoute.module) {
      setCurrentModule(newRoute.module);
    } else if (newRoute.type === 'admin-hub' || newRoute.type === 'store-scoped') {
      setCurrentModule('hub');
    }
  }, []);

  // Sync currentModule with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('active_module', currentModule);
    } catch (e) {}
  }, [currentModule]);

  // Multi-Tenant Isolation & Store Verification Effect
  useEffect(() => {
    async function verifyTenantStore() {
      if (routeState.type !== 'store-scoped' && routeState.type !== 'store-delivery') {
        setTenantAccessDenied(false);
        setStoreNotFound(false);
        return;
      }

      const routeSlug = routeState.storeSlug;
      if (!routeSlug) return;

      // 1. If currently loaded store matches routeSlug
      if (currentStore?.slug === routeSlug) {
        if (
          isAdminLoggedIn &&
          userProfile?.store_id &&
          userProfile.store_id !== currentStore.id &&
          userRole !== 'super_admin'
        ) {
          setTenantAccessDenied(true);
        } else {
          setTenantAccessDenied(false);
        }
        setStoreNotFound(false);
        return;
      }

      // 2. Fetch the store corresponding to routeSlug
      let matchedStore = null;
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('stores')
            .select('*')
            .eq('slug', routeSlug)
            .single();
          if (!error && data) {
            matchedStore = data;
          }
        } catch (e) {}
      }

      if (!matchedStore) {
        try {
          const localStores = JSON.parse(localStorage.getItem('jal_jivan_all_stores') || '[]');
          matchedStore = localStores.find((s) => s.slug === routeSlug);
        } catch (e) {}
      }

      if (!matchedStore && (routeSlug === 'mittal-store' || routeSlug === DEFAULT_STORE.slug || routeSlug === 'default')) {
        matchedStore = DEFAULT_STORE;
      }

      if (!matchedStore) {
        setStoreNotFound(true);
        setTenantAccessDenied(false);
        return;
      }

      setStoreNotFound(false);

      // Verify user permission for this store
      if (isAdminLoggedIn) {
        const userStoreId = userProfile?.store_id;
        const hasAccess = userRole === 'super_admin' || !userStoreId || userStoreId === matchedStore.id;

        if (!hasAccess) {
          setTenantAccessDenied(true);
          return;
        }

        setTenantAccessDenied(false);
        setCurrentStore(matchedStore);
      }
    }

    verifyTenantStore();
  }, [routeState.type, routeState.storeSlug, currentStore, isAdminLoggedIn, userProfile, userRole, setCurrentStore]);

  // Requirement 4: Clean auto-redirect away from /login if already logged in
  useEffect(() => {
    if (routeState.type === 'admin-login' && isAdminLoggedIn) {
      const targetSlug = currentStore?.slug || 'mittal-store';
      navigate(`/${targetSlug}`, true);
    }
  }, [routeState.type, isAdminLoggedIn, currentStore?.slug, navigate]);

  // Check if active module is permitted for this store's subscription license
  const isModulePermitted = useCallback((mod) => {
    if (!mod || mod === 'hub') return true;
    if (mod === 'staff-settings' || mod === 'staff') return isOwner;
    if (mod === 'items' || mod === 'damage') return true;
    const modules = currentStore?.enabled_modules;
    if (!modules) return true;
    if (mod === 'sales' && modules.pos === false) return false;
    if (mod === 'purchase' && modules.inward_ocr === false) return false;
    if (mod === 'delivery' && modules.delivery === false) return false;
    if (mod === 'finance' && modules.ledger === false) return false;
    return true;
  }, [currentStore?.enabled_modules, isOwner]);

  // Listen to browser navigation (back/forward) & clean legacy query params
  useEffect(() => {
    const handleLocationChange = () => {
      const newRoute = parseRoute();
      setRouteState(newRoute);
      if (newRoute.type === 'driver') {
        setCurrentModule('driver');
      } else if (newRoute.type === 'store-delivery') {
        setCurrentModule('delivery');
      } else if (newRoute.module) {
        setCurrentModule(newRoute.module);
      } else if (newRoute.type === 'admin-hub' || newRoute.type === 'store-scoped') {
        setCurrentModule('hub');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    // Clean legacy query params
    const search = new URLSearchParams(window.location.search);
    const currentPath = (window.location.pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
    if (search.has('module') && currentPath !== '/' && currentPath !== '') {
      const legacyMod = search.get('module');
      search.delete('module');
      const remainingQuery = search.toString() ? `?${search.toString()}` : '';
      let newPath = currentPath;
      if (currentPath === '/admin' && legacyMod) {
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

  // Admin Login Success (supports role-based redirect target)
  const handleAdminLoginSuccess = (redirectPath) => {
    setIsAdminLoggedIn(true);
    const target =
      typeof redirectPath === 'string' && redirectPath
        ? redirectPath
        : `/${currentStore?.slug || 'mittal-store'}`;
    navigate(target);
    showToast('Authenticated successfully! Welcome back.', 'success');
  };

  // Admin Logout (navigates to /login)
  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    logoutUser?.();
    try {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      localStorage.removeItem('jal_jivan_admin_logged_in');
      localStorage.removeItem('jaljivan_store_session');
    } catch (e) {}
    navigate('/login');
    showToast('Logged out of Store Terminal', 'info');
  };

  // Back to Hub Handler
  const handleBackToHub = () => {
    const slug = currentStore?.slug || routeState.storeSlug || 'mittal-store';
    navigate(`/${slug}`);
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

  // Dedicated Public SaaS Landing Page (/)
  if (routeState.type === 'public-landing') {
    return (
      <PublicLandingPage
        onLoginSuccess={(targetPath) => navigate(targetPath)}
        onNavigate={(targetPath) => navigate(targetPath)}
      />
    );
  }

  // Dedicated Dynamic Store Delivery Route (/store/:storeSlug/delivery or /:storeSlug/delivery)
  const isStoreDeliveryRoute =
    routeState.type === 'store-delivery' ||
    (typeof window !== 'undefined' &&
      (/^\/store\/([a-zA-Z0-9_-]+)\/delivery\/?$/.test(window.location.pathname) ||
       /^\/([a-zA-Z0-9_-]+)\/delivery\/?$/.test(window.location.pathname)));

  if (isStoreDeliveryRoute && (!isAdminLoggedIn || !isOwner)) {
    const slugMatch =
      typeof window !== 'undefined'
        ? window.location.pathname.match(/^\/store\/([a-zA-Z0-9_-]+)\/delivery\/?$/) ||
          window.location.pathname.match(/^\/([a-zA-Z0-9_-]+)\/delivery\/?$/)
        : null;
    const activeSlug =
      routeState.storeSlug || slugMatch?.[1] || currentStore?.slug || 'mittal-store';
    return <StoreDeliveryPortal storeSlug={activeSlug} />;
  }

  // Dedicated Isolated Master HQ Console Routes (/hq-console and /hq-console/auth)
  // Completely detached from store layout (no store Navbar, no store ModularSidebar)
  const isHqAuthRoute =
    routeState.type === 'hq-auth' ||
    (typeof window !== 'undefined' &&
      (window.location.pathname.toLowerCase().startsWith('/hq-console/auth') ||
       (window.location.hash && window.location.hash.toLowerCase().startsWith('/hq-console/auth'))));

  if (isHqAuthRoute) {
    return (
      <SuperAdminAuth
        onAuthSuccess={() => navigate('/hq-console')}
        onNavigate={(path) => navigate(path)}
      />
    );
  }

  const isHqConsoleRoute =
    routeState.type === 'hq-console' ||
    (typeof window !== 'undefined' &&
      (window.location.pathname.toLowerCase() === '/hq-console' ||
       window.location.pathname.toLowerCase() === '/hq-console/' ||
       window.location.pathname.toLowerCase() === '/super-admin' ||
       (window.location.hash && window.location.hash.toLowerCase().includes('/hq-console'))));

  if (isHqConsoleRoute) {
    return (
      <MasterHQConsole
        onNavigate={(path) => navigate(path)}
        showToast={showToast}
      />
    );
  }

  const isViewAdmin =
    routeState.type === 'store-scoped' ||
    routeState.type.startsWith('admin') ||
    routeState.type === 'settings-staff';

  return (
    <div className="min-h-full w-full max-w-[100vw] overflow-x-hidden flex flex-col bg-[#0b1329] text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        isAdminRoute={isViewAdmin}
        isAdminView={isViewAdmin}
        adminSubView={
          routeState.module ||
          (routeState.type === 'admin-hub' || routeState.type === 'store-scoped'
            ? 'hub'
            : routeState.type === 'settings-staff'
            ? 'staff'
            : '')
        }
        storeName={currentStore?.name || 'Mittal Departmental Store'}
        storeSlug={currentStore?.slug || 'mittal-store'}
        onNavigateToAdminHub={() => navigate(`/${currentStore?.slug || 'mittal-store'}`)}
        onOpenDbInfo={() => setIsDbInfoOpen(true)}
        isAdminLoggedIn={isAdminLoggedIn}
        onAdminLogout={handleAdminLogout}
      />

      <div className="flex flex-1 w-full overflow-hidden">
        {/* Modular Sidebar Navigation (honors store.enabled_modules and role) */}
        {isAdminLoggedIn && routeState.type !== 'admin-login' && !storeNotFound && !tenantAccessDenied && (
          <ModularSidebar
            currentModule={
              routeState.module ||
              (routeState.type === 'admin-hub' || routeState.type === 'store-scoped'
                ? 'hub'
                : routeState.type === 'settings-staff'
                ? 'staff-settings'
                : '')
            }
            onNavigate={(path) => navigate(path)}
            onLogout={handleAdminLogout}
          />
        )}

        {/* Main Routing Container */}
        <main className={`flex-1 w-full mx-auto overflow-x-hidden ${routeState.module === 'purchase' || routeState.module === 'items' ? 'max-w-[98vw] px-2 md:px-4 py-2' : 'max-w-6xl px-3 sm:px-4 py-3 sm:py-6'}`}>
          {storeNotFound ? (
            /* STORE NOT FOUND */
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                <Store className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-white">Store Not Found</h2>
              <p className="text-slate-400 text-sm mt-2 max-w-md">
                The store with identifier <span className="font-mono text-amber-300 font-bold">"/{routeState.storeSlug}"</span> does not exist or has been decommissioned.
              </p>
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => navigate('/')}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
                >
                  Platform Home
                </button>
                {isAdminLoggedIn && (
                  <button
                    onClick={() => navigate(`/${currentStore?.slug || 'mittal-store'}`)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition"
                  >
                    Go to My Store ({currentStore?.name})
                  </button>
                )}
              </div>
            </div>
          ) : tenantAccessDenied ? (
            /* TENANT ACCESS RESTRICTED */
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-500/10">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-xs font-bold mb-3">
                CROSS-TENANT ISOLATION ACTIVE
              </div>
              <h2 className="text-2xl font-black text-white">Store Access Restricted</h2>
              <p className="text-slate-400 text-sm mt-2 max-w-md">
                You are currently signed in as <span className="text-white font-semibold">{userProfile?.full_name || 'Store Staff'}</span> assigned to{' '}
                <span className="text-emerald-400 font-semibold">{currentStore?.name}</span>. You do not have permissions to access{' '}
                <span className="font-mono text-rose-300">"/{routeState.storeSlug}"</span>.
              </p>
              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => navigate(`/${currentStore?.slug || 'mittal-store'}`)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition"
                >
                  Go to My Store ({currentStore?.name})
                </button>
                <button
                  onClick={handleAdminLogout}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition"
                >
                  Sign Out / Switch Account
                </button>
              </div>
            </div>
          ) : !isModulePermitted(routeState.module || 'hub') ? (
            /* MODULE DISABLED BY LICENSE */
            <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-300">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold mb-3">
                MODULE DISABLED BY LICENSE
              </div>
              <h2 className="text-xl font-bold text-white">Module Not Included in Store Plan</h2>
              <p className="text-slate-400 text-sm mt-2 max-w-md">
                This module is currently disabled in the subscription license for <span className="text-white font-semibold">{currentStore?.name}</span>.
                Contact your Super Administrator via the HQ Console to activate this module.
              </p>
              <button
                onClick={handleBackToHub}
                className="mt-6 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
              >
                Return to Store Hub
              </button>
            </div>
          ) : !isAdminLoggedIn ? (
            /* STORE LOGIN SCREEN (WHEN NOT LOGGED IN) */
            <Login onLoginSuccess={handleAdminLoginSuccess} />
          ) : routeState.type === 'admin-login' ? (
            /* ROUTE: /login (ALREADY LOGGED IN -> LOADING SPINNER WHILE REDIRECTING) */
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400 font-mono">Redirecting to your store dashboard...</span>
            </div>
          ) : routeState.type === 'settings-staff' || routeState.module === 'staff-settings' ? (
            /* ======================================================== */
            /* ROUTE: /settings/staff (STAFF MANAGEMENT - STORE OWNER ONLY) */
            /* ======================================================== */
            <ErrorBoundary title="Store Staff Management">
              <StaffSettingsPage
                onBackToHub={handleBackToHub}
                showToast={showToast}
              />
            </ErrorBoundary>
          ) : (routeState.type === 'store-scoped' || routeState.type === 'admin-hub') && (!routeState.module || routeState.module === 'hub') ? (
            /* ======================================================== */
            /* ROUTE: /:storeSlug (EXECUTIVE STORE HUB) */
            /* ======================================================== */
            <AdminHub onNavigate={(path) => navigate(path)} />
          ) : routeState.module === 'delivery' || routeState.type === 'store-delivery' ? (
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
          )}
        </main>
      </div>

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
