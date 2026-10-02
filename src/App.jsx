import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import AdminHub from './components/AdminHub';
import DamageReturnHub from './components/damage/DamageReturnHub';
import DistributorMaster from './components/damage/DistributorMaster';
import { AdminDashboard } from './components/AdminPanel';
import PurchaseInwardHub from './components/PurchaseInwardHub';
import ItemsInventoryHub from './components/items/ItemsInventoryHub';
import PlannedModuleView from './components/PlannedModuleView';
import SalesBillingHub from './pages/SalesBillingHub';
import DriverPortal from './components/DriverPortal';
import MobileInwardCapture from './components/purchase/MobileInwardCapture';
import ModularSidebar from './components/ModularSidebar';
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
  fetchDistributors
} from './lib/supabase';

const LOGGED_IN_DRIVER_KEY = 'jal_jivan_current_driver';

// ==========================================
// 1. CLEAN URL ROUTE & MODULE PARSER
// Root ('/') and /admin completely bypassed into direct POS
// ==========================================
export const getInitialModule = () => {
  if (typeof window === 'undefined') return 'pos';
  const route = parseRoute();
  if (route.type === 'driver') return 'driver';
  if (route.module) return route.module;
  return 'pos';
};

export function parseRoute() {
  if (typeof window === 'undefined') {
    return { type: 'pos', module: 'pos', pathname: '/' };
  }

  let pathname = (window.location.pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
  const hash = (window.location.hash || '').toLowerCase().replace(/^#\/?/, '').replace(/\/+$/, '');
  const search = new URLSearchParams(window.location.search);

  // Support SPA deep link fallback via hash
  if (pathname === '/' && hash) {
    pathname = '/' + hash;
  }

  // 1. ROOT (/), /pos, /sales, /admin, /login -> Directly main POS Billing module without any auth barriers
  if (
    pathname === '/' ||
    pathname === '' ||
    pathname === '/pos' ||
    pathname === '/sales' ||
    pathname === '/admin' ||
    pathname === '/admin/login' ||
    pathname === '/login' ||
    pathname === '/admin/hub'
  ) {
    return { type: 'pos', module: 'pos', pathname: '/pos' };
  }

  // 2. Dedicated Public Mobile Inward Camera (/scan-inward)
  if (pathname === '/scan-inward' || pathname.startsWith('/scan-inward')) {
    const sessionId = search.get('session') || '';
    return { type: 'scan-inward', module: null, pathname: '/scan-inward', sessionId };
  }

  // 3. Dedicated Rider Portal (/rider, with /driver as legacy alias)
  if (pathname === '/rider' || pathname === '/driver') {
    return { type: 'driver', module: null, pathname: '/rider' };
  }

  // 4. Purchase Invoices (/purchase, /inward, /invoices)
  if (pathname === '/purchase' || pathname === '/inward' || pathname === '/invoices' || pathname.startsWith('/purchase')) {
    return { type: 'purchase', module: 'purchase', pathname: '/purchase' };
  }

  // 5. Inventory & Stock (/inventory, /items)
  if (pathname === '/inventory' || pathname === '/items' || pathname.startsWith('/inventory') || pathname.startsWith('/items')) {
    return { type: 'items', module: 'items', pathname: '/inventory' };
  }

  // 6. Damage & Expiry (/damage, /expiry)
  if (pathname === '/damage' || pathname === '/expiry' || pathname.startsWith('/damage')) {
    return { type: 'damage', module: 'damage', pathname: '/damage' };
  }

  // 7. Distributors Directory (/distributors, /vendors)
  if (pathname === '/distributors' || pathname === '/vendors' || pathname.startsWith('/distributors')) {
    return { type: 'distributors', module: 'distributors', pathname: '/distributors' };
  }

  // 8. Reports & Ledgers (/reports, /finance, /ledger)
  if (pathname === '/reports' || pathname === '/finance' || pathname === '/ledger' || pathname.startsWith('/reports')) {
    return { type: 'reports', module: 'reports', pathname: '/reports' };
  }

  // 9. Store Settings & Config (/settings, /config)
  if (pathname === '/settings' || pathname === '/config' || pathname.startsWith('/settings')) {
    return { type: 'settings', module: 'settings', pathname: '/settings' };
  }

  // 10. Delivery Dispatch (/delivery)
  if (pathname === '/delivery' || pathname.startsWith('/delivery')) {
    return { type: 'delivery', module: 'delivery', pathname: '/delivery' };
  }

  // 11. Modules Overview Hub (/hub, /dashboard)
  if (pathname === '/hub' || pathname === '/dashboard') {
    return { type: 'hub', module: 'hub', pathname: '/hub' };
  }

  // 12. Backward-compatible mapping for any legacy multi-tenant URLs
  const segments = pathname.replace(/^\//, '').split('/');
  const subRoute = segments[1] || '';
  if (subRoute === 'purchase' || subRoute === 'inward') {
    return { type: 'purchase', module: 'purchase', pathname: '/purchase' };
  }
  if (subRoute === 'items' || subRoute === 'inventory') {
    return { type: 'items', module: 'items', pathname: '/inventory' };
  }
  if (subRoute === 'damage' || subRoute === 'expiry') {
    return { type: 'damage', module: 'damage', pathname: '/damage' };
  }
  if (subRoute === 'distributors' || subRoute === 'vendors') {
    return { type: 'distributors', module: 'distributors', pathname: '/distributors' };
  }
  if (subRoute === 'reports' || subRoute === 'finance') {
    return { type: 'reports', module: 'reports', pathname: '/reports' };
  }
  if (subRoute === 'settings') {
    return { type: 'settings', module: 'settings', pathname: '/settings' };
  }
  if (subRoute === 'delivery') {
    return { type: 'delivery', module: 'delivery', pathname: '/delivery' };
  }

  // Default fallback -> Main POS Billing
  return { type: 'pos', module: 'pos', pathname: '/pos' };
}

export default function App() {
  // Current Active Module State
  const [currentModule, setCurrentModule] = useState(getInitialModule);

  // Current Route State
  const [routeState, setRouteState] = useState(() => parseRoute());

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
    } else {
      setCurrentModule('pos');
    }
  }, []);

  // Sync currentModule with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('active_module', currentModule);
    } catch (e) {}
  }, [currentModule]);

  // Listen to browser navigation (back/forward)
  useEffect(() => {
    const handleLocationChange = () => {
      const newRoute = parseRoute();
      setRouteState(newRoute);
      if (newRoute.type === 'driver') {
        setCurrentModule('driver');
      } else if (newRoute.module) {
        setCurrentModule(newRoute.module);
      } else {
        setCurrentModule('pos');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

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
  const [distributors, setDistributors] = useState([]);
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

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [driversData, ordersData, productsData, damagesData, distributorsData] = await Promise.all([
        fetchDrivers().catch(() => []),
        fetchOrdersFromApi().catch(() => []),
        fetchProducts().catch(() => []),
        fetchProductDamages().catch(() => []),
        fetchDistributors().catch(() => [])
      ]);
      setDrivers(driversData || []);
      setOrders(ordersData || []);
      setProducts(productsData || []);
      setDamages(damagesData || []);
      setDistributors(distributorsData || []);
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

  // Live Supabase Realtime subscription for Delivery & Orders
  useRealtimeSubscription({
    table: ['orders', 'deliveries', 'settlements'],
    setData: setOrders,
    prepend: true,
    onChange: () => {
      syncAllData();
    }
  });

  // Back to POS Billing
  const handleBackToHub = () => {
    navigate('/pos');
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
      showToast('Driver removed from fleet', 'info');
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
      showToast('Address updated!', 'success');
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
      showToast('Address removed', 'info');
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
      showToast(`Status updated: ${newStatus}`, 'success');
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
        driverId ? `Assigned to ${driverName}` : 'Order unassigned',
        'info'
      );
    } catch (err) {
      showToast(err.message || 'Failed to assign driver', 'error');
    }
  };

  // Driver Login & Actions (for /rider portal)
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
    showToast('Logged out of rider portal', 'info');
    window.location.href = '/rider';
  };

  const handlePinLocation = async (orderId, latitude, longitude) => {
    try {
      await updateOrderLocation(orderId, latitude, longitude);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, latitude, longitude } : o))
      );
      showToast(`Location coordinates saved`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update location', 'error');
    }
  };

  const handleCompleteDelivery = async (orderId, podData) => {
    try {
      const updated = await completeDelivery(orderId, podData);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o))
      );
      showToast(`Delivery completed! POD captured.`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save delivery proof', 'error');
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
      showToast('Order accepted! Out for delivery.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to accept order', 'error');
    }
  };

  // Dedicated Mobile Inward Camera (/scan-inward)
  const isScanInwardRoute =
    typeof window !== 'undefined' &&
    (window.location.pathname.toLowerCase().includes('/scan-inward') ||
      (window.location.hash && window.location.hash.toLowerCase().includes('/scan-inward')));

  if (isScanInwardRoute) {
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const sessionId = searchParams?.get('session') || routeState?.sessionId || '';
    return <MobileInwardCapture sessionId={sessionId} />;
  }

  // Dedicated Rider Portal (/rider)
  const isDriverRoute =
    typeof window !== 'undefined' &&
    (window.location.pathname.toLowerCase().includes('/rider') ||
      window.location.pathname.toLowerCase().includes('/driver') ||
      (window.location.hash &&
        (window.location.hash.toLowerCase().includes('/rider') ||
          window.location.hash.toLowerCase().includes('/driver'))));

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

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden flex flex-col bg-[#0b1329] text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        adminSubView={currentModule}
        onNavigateToAdminHub={() => navigate('/pos')}
        onOpenDbInfo={() => setIsDbInfoOpen(true)}
      />

      <div className="flex flex-1 w-full overflow-hidden">
        {/* Modular Sidebar with the 7 Core Modules */}
        <ModularSidebar
          currentModule={currentModule}
          onNavigate={(path) => navigate(path)}
        />

        {/* Main Application Container */}
        <main
          className={`flex-1 w-full mx-auto overflow-x-hidden ${
            currentModule === 'purchase' || currentModule === 'items' || currentModule === 'pos'
              ? 'max-w-[99vw] px-2 md:px-3 py-2'
              : 'max-w-7xl px-3 sm:px-4 py-3 sm:py-6'
          }`}
        >
          {/* MODULE 1: POS Billing */}
          {currentModule === 'pos' || currentModule === 'sales' ? (
            <ErrorBoundary title="Retail Sales & POS Billing">
              <SalesBillingHub
                onBackToHub={handleBackToHub}
                showToast={showToast}
              />
            </ErrorBoundary>
          ) : /* MODULE 2: Purchase Invoices */
          currentModule === 'purchase' ? (
            <ErrorBoundary title="Purchase Invoices & Inward">
              <PurchaseInwardHub
                onBackToHub={handleBackToHub}
                showToast={showToast}
              />
            </ErrorBoundary>
          ) : /* MODULE 3: Inventory & Stock */
          currentModule === 'items' || currentModule === 'inventory' ? (
            <ErrorBoundary title="Inventory & Stock Master">
              <ItemsInventoryHub
                onBackToHub={handleBackToHub}
                showToast={showToast}
              />
            </ErrorBoundary>
          ) : /* MODULE 4: Damage & Expiry */
          currentModule === 'damage' ? (
            <ErrorBoundary title="Damage & Expiry Hub">
              <DamageReturnHub
                onBackToHub={handleBackToHub}
                drivers={drivers}
                distributors={distributors}
              />
            </ErrorBoundary>
          ) : /* MODULE 5: Distributors Directory */
          currentModule === 'distributors' ? (
            <ErrorBoundary title="Distributors Directory">
              <DistributorMaster
                distributors={distributors}
                onDistributorsChange={setDistributors}
                onBackToInventory={handleBackToHub}
              />
            </ErrorBoundary>
          ) : /* MODULE 6: Reports & Ledgers */
          currentModule === 'reports' || currentModule === 'finance' ? (
            <ErrorBoundary title="Reports & Financial Ledgers">
              <PlannedModuleView
                moduleId="finance"
                onBackToHub={handleBackToHub}
              />
            </ErrorBoundary>
          ) : /* MODULE 7: Store Settings */
          currentModule === 'settings' ? (
            <ErrorBoundary title="Store Settings">
              <PlannedModuleView
                moduleId="settings"
                onBackToHub={handleBackToHub}
              />
            </ErrorBoundary>
          ) : /* Delivery & Dispatch (Extra Operations Console) */
          currentModule === 'delivery' ? (
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
                onLogout={() => navigate('/pos')}
                onBackToHub={handleBackToHub}
              />
            </ErrorBoundary>
          ) : (
            /* Modules Overview Hub */
            <AdminHub onNavigate={(path) => navigate(path)} />
          )}
        </main>
      </div>

      {/* Operational Modals */}
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
