import { createClient } from '@supabase/supabase-js';
import { initialDrivers, initialOrders } from './mockData';

let rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// If user pasted dashboard link e.g. https://supabase.com/dashboard/project/xyz
const matchDashboard = rawUrl.match(/supabase\.com\/dashboard\/project\/([a-zA-Z0-9_-]+)/);
if (matchDashboard) {
  rawUrl = `https://${matchDashboard[1]}.supabase.co`;
}

// Check if valid credentials are provided
export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawUrl.startsWith('http') &&
  !rawUrl.includes('PASTE_YOUR_NEW_SUPABASE_URL_HERE') &&
  rawAnonKey &&
  !rawAnonKey.includes('PASTE_YOUR_NEW_ANON_KEY_HERE')
);

// Initialize Supabase Client
export const supabase = isSupabaseConfigured
  ? createClient(rawUrl, rawAnonKey)
  : createClient('https://placeholder.supabase.co', 'dummy-anon-key-placeholder');

// Storage keys for demo fallback
const STORAGE_DRIVERS = 'jal_jivan_drivers';
const STORAGE_ORDERS = 'jal_jivan_orders';

const getLocalDrivers = () => {
  try {
    const saved = localStorage.getItem(STORAGE_DRIVERS);
    if (!saved) {
      localStorage.setItem(STORAGE_DRIVERS, JSON.stringify(initialDrivers));
      return initialDrivers;
    }
    return JSON.parse(saved);
  } catch (e) {
    return initialDrivers;
  }
};

const saveLocalDrivers = (drivers) => {
  try {
    localStorage.setItem(STORAGE_DRIVERS, JSON.stringify(drivers));
  } catch (e) {
    console.error('Failed saving drivers locally', e);
  }
};

const getLocalOrders = () => {
  try {
    const saved = localStorage.getItem(STORAGE_ORDERS);
    if (!saved) {
      localStorage.setItem(STORAGE_ORDERS, JSON.stringify(initialOrders));
      return initialOrders;
    }
    return JSON.parse(saved);
  } catch (e) {
    return initialOrders;
  }
};

const saveLocalOrders = (orders) => {
  try {
    localStorage.setItem(STORAGE_ORDERS, JSON.stringify(orders));
  } catch (e) {
    console.error('Failed saving orders locally', e);
  }
};

// ==========================================
// DRIVER OPERATIONS
// ==========================================

export async function fetchDrivers() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('Supabase fetchDrivers failed, falling back to local store:', err.message);
    }
  }
  return getLocalDrivers();
}

export async function addDriver({ name, phone, pin }) {
  const newDriver = {
    id: 'drv-' + Date.now(),
    name: name.trim(),
    phone: phone.trim(),
    pin: pin.trim(),
    status: 'active',
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .insert([{
          name: newDriver.name,
          phone: newDriver.phone,
          pin: newDriver.pin,
          status: 'active'
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase addDriver failed, saving to local store:', err.message);
    }
  }

  const drivers = getLocalDrivers();
  const updated = [newDriver, ...drivers];
  saveLocalDrivers(updated);
  return newDriver;
}

export async function driverLogin(phone, pin) {
  const cleanPhone = phone.trim();
  const cleanPin = pin.trim();

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('phone', cleanPhone)
        .eq('pin', cleanPin)
        .maybeSingle();

      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.warn('Supabase driverLogin query failed, checking local store:', err.message);
    }
  }

  const drivers = getLocalDrivers();
  const found = drivers.find(
    (d) => d.phone.replace(/\D/g, '') === cleanPhone.replace(/\D/g, '') && d.pin === cleanPin
  );
  return found || null;
}

// ==========================================
// ORDER OPERATIONS
// ==========================================

export async function fetchOrders() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('Supabase fetchOrders failed, falling back to local store:', err.message);
    }
  }
  return getLocalOrders();
}

export async function createOrder({ orderNumber, amount, address, landmark, customerPhone, driverId, driverName, latitude, longitude }) {
  const newOrder = {
    id: 'ord-' + Date.now(),
    order_number: orderNumber || `JJ-${Math.floor(1000 + Math.random() * 9000)}`,
    amount: parseFloat(amount) || 0,
    address,
    landmark: landmark || '',
    customer_phone: customerPhone || '',
    assigned_driver_id: driverId || null,
    driver_name: driverName || 'Unassigned',
    status: driverId ? 'Out for Delivery' : 'Pending',
    latitude: latitude || null,
    longitude: longitude || null,
    payment_method: null,
    payment_proof_url: null,
    delivery_proof_url: null,
    delivered_at: null,
    notes: '',
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .insert([{
          order_number: newOrder.order_number,
          amount: newOrder.amount,
          address: newOrder.address,
          landmark: newOrder.landmark,
          customer_phone: newOrder.customer_phone,
          assigned_driver_id: newOrder.assigned_driver_id,
          driver_name: newOrder.driver_name,
          status: newOrder.status,
          latitude: newOrder.latitude,
          longitude: newOrder.longitude
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase createOrder failed, saving locally:', err.message);
    }
  }

  const orders = getLocalOrders();
  const updated = [newOrder, ...orders];
  saveLocalOrders(updated);
  return newOrder;
}

export async function updateOrderStatus(orderId, newStatus) {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase updateOrderStatus failed, updating locally:', err.message);
    }
  }

  const orders = getLocalOrders();
  const updated = orders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o));
  saveLocalOrders(updated);
  return updated.find((o) => o.id === orderId);
}

export async function updateOrderLocation(orderId, latitude, longitude) {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ latitude, longitude })
        .eq('id', orderId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase updateOrderLocation failed, updating locally:', err.message);
    }
  }

  const orders = getLocalOrders();
  const updated = orders.map((o) =>
    o.id === orderId ? { ...o, latitude, longitude } : o
  );
  saveLocalOrders(updated);
  return updated.find((o) => o.id === orderId);
}

export async function completeDelivery(orderId, { paymentMethod, paymentProofUrl, deliveryProofUrl, notes }) {
  const updates = {
    status: 'Delivered',
    payment_method: paymentMethod,
    payment_proof_url: paymentProofUrl || null,
    delivery_proof_url: deliveryProofUrl || null,
    delivered_at: new Date().toISOString(),
    notes: notes || null
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase completeDelivery failed, updating locally:', err.message);
    }
  }

  const orders = getLocalOrders();
  const updated = orders.map((o) =>
    o.id === orderId ? { ...o, ...updates } : o
  );
  saveLocalOrders(updated);
  return updated.find((o) => o.id === orderId);
}

// ==========================================
// STORAGE UPLOAD (Supabase 'delivery-proofs' bucket)
// ==========================================

export async function uploadDeliveryFile(file, folder = 'proofs') {
  if (!file) return null;

  if (isSupabaseConfigured) {
    try {
      const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
      const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('delivery-proofs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('delivery-proofs')
        .getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    } catch (err) {
      console.warn('Supabase storage upload failed, converting to local data URL:', err.message);
    }
  }

  // Fallback to Data URL for instant previews and local demo persistence
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
