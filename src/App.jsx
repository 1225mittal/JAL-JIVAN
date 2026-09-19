import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import AdminPanel from './components/AdminPanel';
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
  completeDelivery
} from './lib/supabase';

const LOGGED_IN_DRIVER_KEY = 'jal_jivan_current_driver';

export default function App() {
  // Navigation State
  const [activeView, setActiveView] = useState('admin'); // 'admin' | 'driver'

  // Data State
  const [drivers, setDrivers] = useState([]);
  const [orders, setOrders] = useState([]);
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
      const [driversData, ordersData] = await Promise.all([
        fetchDrivers(),
        fetchOrders()
      ]);
      setDrivers(driversData || []);
      setOrders(ordersData || []);
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

  // Add Delivery Boy
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

  // Create Delivery Task
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

  // Update Status
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

  // Assign Driver
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

  // Driver Login
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

  // Driver Logout
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

  // Complete Delivery with POD
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

  return (
    <div className="min-h-full flex flex-col bg-[#0b1329] text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        currentDriver={currentDriver}
        onDriverLogout={handleDriverLogout}
        onOpenDbInfo={() => setIsDbInfoOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 sm:py-6">
        {activeView === 'admin' ? (
          <AdminPanel
            orders={orders}
            drivers={drivers}
            loading={loading}
            onOpenAddDriver={() => setIsAddDriverOpen(true)}
            onOpenCreateTask={() => setIsCreateTaskOpen(true)}
            onUpdateStatus={handleUpdateStatus}
            onAssignDriver={handleAssignDriver}
            onRefresh={loadInitialData}
          />
        ) : (
          <DriverPortal
            currentDriver={currentDriver}
            drivers={drivers}
            orders={orders}
            onLogin={handleDriverLogin}
            onLogout={handleDriverLogout}
            onPinLocation={handlePinLocation}
            onCompleteDelivery={handleCompleteDelivery}
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
