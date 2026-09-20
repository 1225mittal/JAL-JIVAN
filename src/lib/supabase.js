import { createClient } from '@supabase/supabase-js';
import {
  initialDrivers,
  initialOrders,
  initialStoreSettings,
  initialDriverLocations,
  initialProducts,
  initialAddressBook
} from './mockData';

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
const STORAGE_PRODUCTS = 'jal_jivan_products';
const STORAGE_ADDRESS_BOOK = 'jal_jivan_address_book';

const getLocalProducts = () => {
  try {
    const saved = localStorage.getItem(STORAGE_PRODUCTS);
    if (!saved) {
      localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(initialProducts));
      return initialProducts;
    }
    return JSON.parse(saved);
  } catch (e) {
    return initialProducts;
  }
};

const saveLocalProducts = (products) => {
  try {
    localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(products));
  } catch (e) {
    console.error('Failed to save products locally', e);
  }
};

const DUMMY_NAMES_AND_ADDRESSES = [
  'anita devi',
  'sanjay malik',
  'anil mehra',
  'vikas gupta',
  'pooja verma',
  'deepak sethi',
  'rajesh tyagi',
  'meena sharma',
  'sunil yadav',
  'ravi kumar',
  'rohit verma',
  'ramesh kumar',
  'suresh sharma',
  'amit patel',
  'kavi nagar',
  'shanti kunj',
  'shanti vihar',
  'green avenue',
  'royal palms',
  'surya enclave',
  'shivalik',
  'patel nagar',
  'ganga heights',
  'silver oak',
  'navrang plaza'
];

export function isDummyEntry(item) {
  if (!item) return false;
  const str = `${item.name || ''} ${item.customer_name || ''} ${item.address || ''} ${item.fullAddress || ''} ${item.landmark || ''}`.toLowerCase();
  return DUMMY_NAMES_AND_ADDRESSES.some((dummy) => str.includes(dummy));
}

const getLocalAddressBook = () => {
  try {
    const saved = localStorage.getItem(STORAGE_ADDRESS_BOOK);
    if (!saved) {
      return [];
    }
    const parsed = JSON.parse(saved);
    const cleaned = Array.isArray(parsed) ? parsed.filter((a) => !isDummyEntry(a)) : [];
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_ADDRESS_BOOK, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
};

const saveLocalAddressBook = (entries) => {
  try {
    const cleaned = Array.isArray(entries) ? entries.filter((a) => !isDummyEntry(a)) : [];
    localStorage.setItem(STORAGE_ADDRESS_BOOK, JSON.stringify(cleaned));
  } catch (e) {
    console.error('Failed to save address book locally', e);
  }
};

const getLocalDrivers = () => {
  try {
    const saved = localStorage.getItem(STORAGE_DRIVERS);
    if (!saved) {
      return [];
    }
    const parsed = JSON.parse(saved);
    const cleaned = Array.isArray(parsed)
      ? parsed.filter(
          (d) =>
            d &&
            d.name !== 'Ramesh Kumar' &&
            d.name !== 'Suresh Sharma' &&
            d.name !== 'Amit Patel'
        )
      : [];
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_DRIVERS, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
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
      return [];
    }
    const parsed = JSON.parse(saved);
    const cleaned = Array.isArray(parsed) ? parsed.filter((o) => !isDummyEntry(o)) : [];
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_ORDERS, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (e) {
    return [];
  }
};

const saveLocalOrders = (orders) => {
  try {
    const cleaned = Array.isArray(orders) ? orders.filter((o) => !isDummyEntry(o)) : [];
    localStorage.setItem(STORAGE_ORDERS, JSON.stringify(cleaned));
  } catch (e) {
    console.error('Failed saving orders locally', e);
  }
};

// ==========================================
// DRIVER OPERATIONS
// ==========================================

export async function fetchDeliveryBoys() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('delivery_boys')
        .select('id, name, phone, is_online, current_lat, current_lng, last_seen_at')
        .order('name', { ascending: true });
      if (!error && Array.isArray(data)) {
        return data;
      }
    } catch (err) {
      console.warn('Supabase fetchDeliveryBoys error:', err.message);
    }

    try {
      const { data: dData, error: dError } = await supabase
        .from('drivers')
        .select('id, name, phone, is_online, current_lat, current_lng, last_seen_at')
        .order('name', { ascending: true });
      if (!dError && Array.isArray(dData)) {
        return dData;
      }
    } catch (err) {
      // ignore
    }
    return [];
  }
  return getLocalDrivers();
}

export async function fetchDrivers() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('delivery_boys')
        .select('*')
        .order('name', { ascending: true });
      if (!error && Array.isArray(data)) {
        return data;
      }
    } catch (err) {
      // ignore
    }

    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        return data;
      }
    } catch (err) {
      console.warn('Supabase fetchDrivers failed:', err.message);
    }
    return [];
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

export async function createOrder({
  orderNumber,
  amount,
  address,
  landmark,
  customerPhone,
  customerName,
  driverId,
  driverName,
  latitude,
  longitude,
  items = []
}) {
  const newOrder = {
    id: 'ord-' + Date.now(),
    order_number: orderNumber || `JJ-${Math.floor(1000 + Math.random() * 9000)}`,
    amount: parseFloat(amount) || 0,
    address,
    landmark: landmark || '',
    customer_name: customerName || '',
    customer_phone: customerPhone || '',
    assigned_driver_id: driverId || null,
    driver_name: driverName || 'Unassigned',
    status: driverId ? 'Out for Delivery' : 'Pending',
    latitude: latitude || null,
    longitude: longitude || null,
    items: Array.isArray(items) ? items : [],
    payment_method: null,
    payment_proof_url: null,
    delivery_proof_url: null,
    delivered_at: null,
    notes: '',
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    try {
      const insertPayload = {
        order_number: newOrder.order_number,
        amount: newOrder.amount,
        address: newOrder.address,
        landmark: newOrder.landmark,
        customer_phone: newOrder.customer_phone,
        customer_name: newOrder.customer_name,
        assigned_driver_id: newOrder.assigned_driver_id,
        driver_name: newOrder.driver_name,
        status: newOrder.status,
        latitude: newOrder.latitude,
        longitude: newOrder.longitude,
        items: newOrder.items
      };

      let { data, error } = await supabase
        .from('orders')
        .insert([insertPayload])
        .select()
        .single();

      // Graceful retry without items/customer_name if columns are not yet in remote schema
      if (error && (error.message?.includes('items') || error.message?.includes('customer_name') || error.code === 'PGRST204')) {
        delete insertPayload.items;
        delete insertPayload.customer_name;
        const res = await supabase.from('orders').insert([insertPayload]).select().single();
        data = res.data;
        error = res.error;
      }

      if (error) throw error;
      if (data) {
        // Also save address book record
        saveAddressBookEntry({
          name: newOrder.customer_name,
          phone: newOrder.customer_phone,
          address: newOrder.address,
          landmark: newOrder.landmark,
          latitude: newOrder.latitude,
          longitude: newOrder.longitude
        }).catch(() => {});
        return { ...newOrder, ...data };
      }
    } catch (err) {
      console.warn('Supabase createOrder failed, saving locally:', err.message);
    }
  }

  const orders = getLocalOrders();
  const updated = [newOrder, ...orders];
  saveLocalOrders(updated);

  // Save to local address book
  saveAddressBookEntry({
    name: newOrder.customer_name,
    phone: newOrder.customer_phone,
    address: newOrder.address,
    landmark: newOrder.landmark,
    latitude: newOrder.latitude,
    longitude: newOrder.longitude
  }).catch(() => {});

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

// ==========================================
// POOL ORDER ACCEPTANCE
// ==========================================

export async function acceptOrderDelivery(orderId, driverId, driverName, estimatedMinutes = 15) {
  const updates = {
    status: 'Out for Delivery',
    assigned_driver_id: driverId,
    driver_id: driverId,
    driver_name: driverName,
    accepted_at: new Date().toISOString(),
    estimated_minutes: estimatedMinutes
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
      console.warn('Supabase acceptOrderDelivery failed, updating locally:', err.message);
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
// REWARD SETTINGS (Driver Stars)
// ==========================================

const STORAGE_REWARDS = 'jal_jivan_reward_settings';

export async function fetchRewardSettings() {
  const defaultSettings = { min_deliveries: 5, stars_rewarded: 1 };
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('reward_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (!error && data) {
        return {
          min_deliveries: data.min_deliveries || 5,
          stars_rewarded: data.stars_rewarded || 1
        };
      }
    } catch (err) {
      console.warn('Supabase fetchRewardSettings failed, using local store:', err.message);
    }
  }

  try {
    const saved = localStorage.getItem(STORAGE_REWARDS);
    return saved ? JSON.parse(saved) : defaultSettings;
  } catch (e) {
    return defaultSettings;
  }
}

export async function saveRewardSettings({ minDeliveries, starsRewarded }) {
  const settings = {
    id: 1,
    min_deliveries: Number(minDeliveries) || 5,
    stars_rewarded: Number(starsRewarded) || 1,
    updated_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('reward_settings')
        .upsert(settings)
        .select()
        .single();
      if (error) throw error;
      localStorage.setItem(STORAGE_REWARDS, JSON.stringify(settings));
      return data;
    } catch (err) {
      console.warn('Supabase saveRewardSettings failed, saving locally:', err.message);
    }
  }

  try {
    localStorage.setItem(STORAGE_REWARDS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed saving reward settings locally', e);
  }
  return settings;
}

// ==========================================
// DRIVER ATTENDANCE (Geofencing Store Hub)
// ==========================================

const STORAGE_ATTENDANCE = 'jal_jivan_driver_attendance';

export async function recordDriverAttendance({ driverId, checkInLat, checkInLng }) {
  const attendanceRecord = {
    id: 'att-' + Date.now(),
    driver_id: driverId,
    check_in_lat: checkInLat,
    check_in_lng: checkInLng,
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('driver_attendance')
        .insert([{
          driver_id: driverId,
          check_in_lat: checkInLat,
          check_in_lng: checkInLng
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase recordDriverAttendance failed, saving locally:', err.message);
    }
  }

  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_ATTENDANCE) || '[]');
    const updated = [attendanceRecord, ...existing];
    localStorage.setItem(STORAGE_ATTENDANCE, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save attendance locally', e);
  }
  return attendanceRecord;
}

export async function checkDriverAttendanceToday(driverId) {
  const today = new Date().toISOString().split('T')[0];
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('driver_attendance')
        .select('*')
        .eq('driver_id', driverId)
        .gte('created_at', `${today}T00:00:00.000Z`)
        .limit(1);
      if (!error && data && data.length > 0) {
        return true;
      }
    } catch (err) {
      console.warn('Supabase checkDriverAttendanceToday failed, checking locally:', err.message);
    }
  }

  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_ATTENDANCE) || '[]');
    return existing.some(
      (a) => a.driver_id === driverId && a.created_at && a.created_at.startsWith(today)
    );
  } catch (e) {
    return false;
  }
}

// ==========================================
// STORE HUB SETTINGS & GEOFENCE
// ==========================================

const STORAGE_STORE_SETTINGS = 'jal_jivan_store_settings';

export const defaultStoreSettings = initialStoreSettings;

export async function fetchStoreSettings() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('id', 'main_store')
        .maybeSingle();
      if (!error && data) {
        return {
          id: data.id || 'main_store',
          store_name: data.store_name || 'Store Central Hub (Ghaziabad)',
          latitude: Number(data.latitude) || 28.6692,
          longitude: Number(data.longitude) || 77.4538,
          radius_meters: Number(data.radius_meters) || 150,
          updated_at: data.updated_at || new Date().toISOString()
        };
      }
    } catch (err) {
      console.warn('Supabase fetchStoreSettings failed, using local store:', err.message);
    }
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_STORE_SETTINGS);
      if (saved) {
        return JSON.parse(saved);
      }
      localStorage.setItem(STORAGE_STORE_SETTINGS, JSON.stringify(defaultStoreSettings));
    }
    return defaultStoreSettings;
  } catch (e) {
    return defaultStoreSettings;
  }
}

export async function saveStoreSettings({ storeName, latitude, longitude, radiusMeters }) {
  const settings = {
    id: 'main_store',
    store_name: storeName ? storeName.trim() : 'Store Central Hub (Ghaziabad)',
    latitude: Number(latitude) || 28.6692,
    longitude: Number(longitude) || 77.4538,
    radius_meters: Number(radiusMeters) || 150,
    updated_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('store_settings')
        .upsert([settings])
        .select()
        .single();
      if (error) throw error;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_STORE_SETTINGS, JSON.stringify(settings));
      }
      return data;
    } catch (err) {
      console.warn('Supabase saveStoreSettings failed, saving locally:', err.message);
    }
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_STORE_SETTINGS, JSON.stringify(settings));
    }
  } catch (e) {
    console.error('Failed saving store settings locally', e);
  }
  return settings;
}

// ==========================================
// LIVE DRIVER LOCATIONS TRACKING
// ==========================================

const STORAGE_DRIVER_LOCATIONS = 'jal_jivan_driver_locations';

export async function fetchDriverLocations() {
  const mergedMap = new Map();

  if (isSupabaseConfigured) {
    // 1. Fetch from 'driver_locations'
    try {
      const { data: dlData, error: dlError } = await supabase
        .from('driver_locations')
        .select('*');
      if (!dlError && Array.isArray(dlData)) {
        dlData.forEach((row) => {
          mergedMap.set(row.driver_id, {
            driver_id: row.driver_id,
            driver_name: row.driver_name || '',
            latitude: row.latitude,
            longitude: row.longitude,
            updated_at: row.updated_at || row.last_seen_at,
            last_seen_at: row.last_seen_at || row.updated_at
          });
        });
      }
    } catch (err) {
      console.warn('Supabase fetch driver_locations error:', err.message);
    }

    // 2. Fetch from 'delivery_boys' to join/enrich
    try {
      const { data: dbData, error: dbError } = await supabase
        .from('delivery_boys')
        .select('*');
      if (!dbError && Array.isArray(dbData)) {
        dbData.forEach((row) => {
          const existing = mergedMap.get(row.id) || {};
          mergedMap.set(row.id, {
            driver_id: row.id,
            driver_name: row.name || existing.driver_name || '',
            latitude: existing.latitude !== undefined && existing.latitude !== null ? existing.latitude : row.current_lat,
            longitude: existing.longitude !== undefined && existing.longitude !== null ? existing.longitude : row.current_lng,
            is_online: row.is_online !== undefined ? row.is_online : existing.is_online,
            updated_at: existing.updated_at || row.updated_at || row.last_seen_at,
            last_seen_at: existing.last_seen_at || row.last_seen_at || row.updated_at
          });
        });
      }
    } catch (err) {
      // ignore
    }

    // 3. Also check 'drivers' table
    try {
      const { data: dData, error: dError } = await supabase
        .from('drivers')
        .select('*');
      if (!dError && Array.isArray(dData)) {
        dData.forEach((row) => {
          const existing = mergedMap.get(row.id) || {};
          mergedMap.set(row.id, {
            driver_id: row.id,
            driver_name: row.name || existing.driver_name || '',
            latitude: existing.latitude !== undefined && existing.latitude !== null ? existing.latitude : row.current_lat,
            longitude: existing.longitude !== undefined && existing.longitude !== null ? existing.longitude : row.current_lng,
            is_online: row.is_online !== undefined ? row.is_online : existing.is_online,
            updated_at: existing.updated_at || row.updated_at || row.last_seen_at,
            last_seen_at: existing.last_seen_at || row.last_seen_at || row.updated_at
          });
        });
      }
    } catch (err) {
      // ignore
    }

    if (mergedMap.size > 0) {
      return Array.from(mergedMap.values());
    }
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_DRIVER_LOCATIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        const cleaned = Array.isArray(parsed)
          ? parsed.filter(
              (l) =>
                l &&
                l.driver_name !== 'Ramesh Kumar' &&
                l.driver_name !== 'Suresh Sharma' &&
                l.driver_name !== 'Amit Patel'
            )
          : [];
        return cleaned;
      }
    }
    return [];
  } catch (e) {
    return [];
  }
}

export async function updateDriverLocation({ driverId, driverName, latitude, longitude }) {
  if (!driverId || latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return null;
  }

  const now = new Date().toISOString();
  const latNum = Number(latitude);
  const lngNum = Number(longitude);

  const locationRecord = {
    driver_id: driverId,
    driver_name: driverName || '',
    latitude: latNum,
    longitude: lngNum,
    updated_at: now,
    last_seen_at: now
  };

  console.log('Location heartbeat sent:', latNum, lngNum);

  if (isSupabaseConfigured) {
    // 1. Upsert into driver_locations
    try {
      await supabase
        .from('driver_locations')
        .upsert([locationRecord]);
    } catch (err) {
      console.warn('Supabase update driver_locations failed:', err.message);
    }

    // 2. Also update delivery_boys table
    try {
      await supabase
        .from('delivery_boys')
        .update({
          is_online: true,
          current_lat: latNum,
          current_lng: lngNum,
          last_seen_at: now,
          updated_at: now
        })
        .eq('id', driverId);
    } catch (err) {
      // ignore
    }

    // 3. Also update drivers table
    try {
      await supabase
        .from('drivers')
        .update({
          is_online: true,
          current_lat: latNum,
          current_lng: lngNum,
          last_seen_at: now,
          updated_at: now
        })
        .eq('id', driverId);
    } catch (err) {
      // ignore
    }
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const existing = JSON.parse(localStorage.getItem(STORAGE_DRIVER_LOCATIONS) || '[]');
      const filtered = existing.filter((item) => item.driver_id !== driverId);
      const updated = [locationRecord, ...filtered];
      localStorage.setItem(STORAGE_DRIVER_LOCATIONS, JSON.stringify(updated));

      // Also update driver in local drivers cache
      const localDrivers = JSON.parse(localStorage.getItem(STORAGE_DRIVERS) || '[]');
      const updatedDrivers = localDrivers.map((d) =>
        d.id === driverId
          ? {
              ...d,
              is_online: true,
              current_lat: latNum,
              current_lng: lngNum,
              last_seen_at: now,
              updated_at: now
            }
          : d
      );
      localStorage.setItem(STORAGE_DRIVERS, JSON.stringify(updatedDrivers));
    }
  } catch (e) {
    console.error('Failed updating driver location locally', e);
  }

  return locationRecord;
}

// ==========================================
// PRODUCT CATALOG OPERATIONS
// ==========================================

export async function fetchProducts() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        if (data.length > 0) return data;
        // If table exists but empty, check local
        const local = getLocalProducts();
        return local.length > 0 ? local : [];
      }
    } catch (err) {
      console.warn('Supabase fetchProducts failed, falling back to local store:', err.message);
    }
  }
  return getLocalProducts();
}

export async function addProduct({ name, price, unit = '20L Can', imageUrl = '', inStock = true }) {
  const newProduct = {
    id: 'prod-' + Date.now(),
    name: name.trim(),
    price: parseFloat(price) || 0,
    unit: unit.trim() || '20L Can',
    image_url: imageUrl || '',
    in_stock: Boolean(inStock),
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{
          name: newProduct.name,
          price: newProduct.price,
          unit: newProduct.unit,
          image_url: newProduct.image_url,
          in_stock: newProduct.in_stock
        }])
        .select()
        .single();
      if (!error && data) {
        // Also update local
        const local = getLocalProducts();
        saveLocalProducts([data, ...local]);
        return data;
      }
      if (error) console.warn('Supabase addProduct warning:', error.message);
    } catch (err) {
      console.warn('Supabase addProduct failed, saving locally:', err.message);
    }
  }

  const products = getLocalProducts();
  const updated = [newProduct, ...products];
  saveLocalProducts(updated);
  return newProduct;
}

export async function deleteProduct(productId) {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
      if (error) console.warn('Supabase deleteProduct error:', error.message);
    } catch (err) {
      console.warn('Supabase deleteProduct failed, deleting locally:', err.message);
    }
  }
  const products = getLocalProducts();
  const updated = products.filter((p) => p.id !== productId);
  saveLocalProducts(updated);
  return true;
}

export async function uploadProductImage(file) {
  if (!file) throw new Error('No file provided');

  // If Supabase is configured, attempt upload to storage bucket 'product-images'
  if (isSupabaseConfigured) {
    try {
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `catalog/${Date.now()}_${cleanFileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (!uploadError && data) {
        const { data: publicUrlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      } else if (uploadError) {
        console.warn('Supabase storage upload failed:', uploadError.message);
      }
    } catch (err) {
      console.warn('uploadProductImage Supabase error, falling back to base64 data URL:', err.message);
    }
  }

  // Fallback: read file as Base64 Data URL so images display even without bucket policies
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// ==========================================
// ADDRESS BOOK OPERATIONS
// ==========================================

export async function fetchSavedAddresses() {
  const map = new Map();

  const addRecord = (item, source) => {
    if (!item) return;
    const rawAddr = (item.address || item.full_address || item.fullAddress || '').trim();
    if (!rawAddr) return;

    // Defensively exclude any legacy dummy test addresses
    if (isDummyEntry(item) || isDummyEntry({ address: rawAddr })) {
      return;
    }

    const key = rawAddr.toLowerCase();
    const lat = item.latitude !== null && item.latitude !== undefined && !isNaN(Number(item.latitude))
      ? Number(item.latitude)
      : null;
    const lng = item.longitude !== null && item.longitude !== undefined && !isNaN(Number(item.longitude))
      ? Number(item.longitude)
      : null;

    if (!map.has(key)) {
      map.set(key, {
        id: item.id || `addr-${map.size + 1}`,
        address: rawAddr,
        landmark: item.landmark?.trim() || '',
        phone: item.customer_phone?.trim() || item.phone?.trim() || '',
        name: item.customer_name?.trim() || item.name?.trim() || '',
        latitude: lat,
        longitude: lng,
        source
      });
    } else {
      const existing = map.get(key);
      if (existing.latitude === null && lat !== null) {
        existing.latitude = lat;
        existing.longitude = lng;
      }
      if (!existing.landmark && item.landmark) existing.landmark = item.landmark.trim();
      if (!existing.phone && (item.customer_phone || item.phone)) {
        existing.phone = (item.customer_phone || item.phone).trim();
      }
      if (!existing.name && (item.customer_name || item.name)) {
        existing.name = (item.customer_name || item.name).trim();
      }
    }
  };

  if (isSupabaseConfigured) {
    // 1. Query past orders from Supabase (as requested)
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('address, landmark, customer_phone, customer_name, latitude, longitude, created_at')
        .not('address', 'is', null)
        .order('created_at', { ascending: false });

      if (!orderError && Array.isArray(orderData)) {
        orderData.forEach((o) => addRecord(o, 'orders'));
      }
    } catch (err) {
      console.warn('Supabase fetchSavedAddresses orders query failed:', err.message);
    }

    // 2. Query addresses table
    try {
      const { data: addrsData, error: addrsError } = await supabase
        .from('addresses')
        .select('*');

      if (!addrsError && Array.isArray(addrsData)) {
        addrsData.forEach((a) => addRecord(a, 'addresses'));
      }
    } catch (err) {
      // ignore
    }

    // 3. Query address_book table
    try {
      const { data: bookData, error: bookError } = await supabase
        .from('address_book')
        .select('*')
        .order('created_at', { ascending: false });

      if (!bookError && Array.isArray(bookData)) {
        bookData.forEach((b) => addRecord(b, 'address_book'));
      }
    } catch (err) {
      // ignore
    }
  }

  // 4. Merge clean local orders & address book records
  const localOrders = getLocalOrders();
  localOrders.forEach((o) => addRecord(o, 'local_orders'));

  const localAddrs = getLocalAddressBook();
  localAddrs.forEach((a) => addRecord(a, 'local_address_book'));

  return Array.from(map.values());
}

export async function saveAddressBookEntry(entry) {
  if (!entry?.address?.trim()) return;
  const addressRecord = {
    id: entry.id || 'addr-' + Date.now(),
    name: entry.name?.trim() || '',
    phone: entry.phone?.trim() || '',
    address: entry.address.trim(),
    landmark: entry.landmark?.trim() || '',
    latitude: entry.latitude !== undefined && entry.latitude !== null ? Number(entry.latitude) : null,
    longitude: entry.longitude !== undefined && entry.longitude !== null ? Number(entry.longitude) : null,
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    try {
      await supabase.from('address_book').insert([addressRecord]);
    } catch (err) {
      // ignore
    }
  }

  try {
    const existing = getLocalAddressBook();
    const filtered = existing.filter(
      (a) => a.address?.trim().toLowerCase() !== addressRecord.address.toLowerCase()
    );
    saveLocalAddressBook([addressRecord, ...filtered]);
  } catch (e) {
    // ignore
  }
}



