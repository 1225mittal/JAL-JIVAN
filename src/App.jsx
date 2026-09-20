import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import AdminPanel, { AdminDashboard } from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import DriverPortal from './components/DriverPortal';
import AddDriverModal from './components/AddDriverModal';
import CreateTaskModal from './components/CreateTaskModal';
import SupabaseInfoModal from './components/SupabaseInfoModal';
import Toast from './components/Toast';
import {
  fetchDrivers,
  addDriver,
  driverLogin,
  fetchOrders,
  createOrder,
  updateOrderStatus,
  updateOrderLocation,
  completeDelivery,
  acceptOrderDelivery,
  fetchProducts,
  addProduct,
  deleteProduct
} from './lib/supabase';

const LOGGED_IN_DRIVER_KEY = 'jal_jivan_current_driver';
const ADMIN_SESSION_KEY = 'admin_session';

// Robust helper to determine if current URL path, hash, or query points to admin
function checkIsAdminUrl() {
  if (typeof window === 'undefined') return false;
  try {
    const pathname = (window.location.pathname || '').toLowerCase().replace(/\/+$/, '');
    const hash = (window.location.hash || '').toLowerCase().replace(/\/+$/, '');
    const search = (window.location.search || '').toLowerCase();

    // 1. Path check: /admin, .../admin, ending in "admin"
    const isPathAdmin =
      pathname === '/admin' ||
      pathname.endsWith('/admin') ||
      pathname.endsWith('admin') ||
      pathname.split('/').includes('admin');

    // 2. Hash check (supports hash routing e.g. #/admin, #admin)
    const isHashAdmin =
      hash === '#/admin' ||
      hash === '#admin' ||
      hash.endsWith('/admin') ||
      hash.endsWith('admin');

    // 3. Search query check (e.g. ?admin or ?view=admin)
    const isSearchAdmin =
      search === '?admin' ||
      search.includes('admin');

    return Boolean(isPathAdmin || isHashAdmin || isSearchAdmin);
  } catch {
    return false;
  }
}

export default function App() {
  // Admin View State: true when visiting /admin or any URL ending in "admin"
  const [isAdminView, setIsAdminView] = useState(() => checkIsAdminUrl());
  // Alias for backward compatibility
  const isAdminRoute = isAdminView;

  // Listen to popstate, hashchange, and custom navigation events so refreshes & navigation persist
  useEffect(() => {
    const handleUrlChange = () => {
      setIsAdminView(checkIsAdminUrl());
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Admin Authentication State (persists across refreshes on /admin)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    try {
      const session = localStorage.getItem(ADMIN_SESSION_KEY);
      return Boolean(session);
    } catch {
      return false;
    }
  });

  // Data State
  const [drivers, setDrivers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Authenticated Driver State
  const [currentDriver, setCurrentDriver] = useState(() => {
    try {
      const saved = localStorage.getItem(LOGGED_IN_DRIVER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

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

  // Load Data
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [driversData, ordersData, productsData] = await Promise.all([
        fetchDrivers(),
        fetchOrders(),
        fetchProducts()
      ]);
      setDrivers(driversData || []);
      setOrders(ordersData || []);
      setProducts(productsData || []);
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

  // Admin Login & Logout handlers
  const handleAdminLoginSuccess = () => {
    setIsAdminLoggedIn(true);
    showToast('Welcome back, Admin Mittal!', 'success');
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    try {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      localStorage.removeItem('jal_jivan_admin_logged_in');
    } catch (e) {
      console.error('Failed to clear admin session', e);
    }
    showToast('Logged out of Admin Panel', 'info');
  };

  // Add Delivery Boy (Admin)
  const handleAddDriver = async ({ name, phone, pin }) => {
    try {
      const created = await addDriver({ name, phone, pin });
      setDrivers((prev) => [created, ...prev]);
      showToast(`Driver ${created.name} registered successfully!`, 'success');
      return created;
    } catch (err) {
      showToast(err.message || 'Error registering driver', 'error');
      throw err;
    }
  };

  // Create Delivery Task (Admin)
  const handleCreateTask = async (taskData) => {
    try {
      const created = await createOrder(taskData);
      setOrders((prev) => [created, ...prev]);
      showToast(`Task #${created.order_number} dispatched successfully!`, 'success');
      return created;
    } catch (err) {
      showToast(err.message || 'Error creating task', 'error');
      throw err;
    }
  };

  // Add Product (Admin)
  const handleAddProduct = async (productData) => {
    try {
      const created = await addProduct(productData);
      setProducts((prev) => [created, ...prev]);
      showToast(`Product "${created.name}" added to catalog!`, 'success');
      return created;
    } catch (err) {
      showToast(err.message || 'Error adding product', 'error');
      throw err;
    }
  };

  // Delete Product (Admin)
  const handleDeleteProduct = async (productId) => {
    try {
      await deleteProduct(productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      showToast('Product deleted from catalog', 'info');
    } catch (err) {
      showToast(err.message || 'Error deleting product', 'error');
      throw err;
    }
  };

  // Update Status (Admin)
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

  // Assign Driver (Admin)
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

  // Driver Logout (Driver Portal)
  const handleDriverLogout = () => {
    setCurrentDriver(null);
    localStorage.removeItem(LOGGED_IN_DRIVER_KEY);
    showToast('Logged out of driver portal', 'info');
  };

  // Pin Current Location (GPS)
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

  // Complete Delivery with POD (Driver Portal)
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

  // Accept Open Pool Order (Driver Portal)
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
    <div className="min-h-full flex flex-col bg-[#0b1329] text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        isAdminView={isAdminView}
        isAdminRoute={isAdminView}
        currentDriver={currentDriver}
        onDriverLogout={handleDriverLogout}
        onOpenDbInfo={() => setIsDbInfoOpen(true)}
        isAdminLoggedIn={isAdminLoggedIn}
        onAdminLogout={handleAdminLogout}
      />

      {/* Main Container: Distinct Routes */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 sm:py-6">
        {isAdminView ? (
          /* ROUTE /admin OR ENDING IN "admin": ADMIN PANEL VIEW */
          isAdminLoggedIn ? (
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
              onDeleteProduct={handleDeleteProduct}
              onRefresh={loadInitialData}
              onLogout={handleAdminLogout}
            />
          ) : (
            <AdminLogin onLoginSuccess={handleAdminLoginSuccess} />
          )
        ) : (
          /* ROUTE /: EXCLUSIVELY DRIVER PORTAL VIEW */
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
