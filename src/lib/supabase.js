import { createClient } from '@supabase/supabase-js';
import {
  initialDrivers,
  initialOrders,
  initialStoreSettings,
  initialDriverLocations,
  initialProducts,
  initialAddressBook,
  initialDamages
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
const STORAGE_DAMAGES = 'jal_jivan_damages';
const STORAGE_DISTRIBUTORS = 'jal_jivan_distributors';
const STORAGE_DAMAGE_EXPIRY_ITEMS = 'jal_jivan_damage_expiry_items';

const getLocalDamages = () => {
  try {
    const saved = localStorage.getItem(STORAGE_DAMAGES);
    if (!saved) {
      localStorage.setItem(STORAGE_DAMAGES, JSON.stringify(initialDamages));
      return initialDamages;
    }
    return JSON.parse(saved);
  } catch (e) {
    return initialDamages;
  }
};

const saveLocalDamages = (damages) => {
  try {
    localStorage.setItem(STORAGE_DAMAGES, JSON.stringify(damages));
  } catch (e) {
    console.error('Failed saving damages locally', e);
  }
};

const getLocalDistributors = () => {
  try {
    const saved = localStorage.getItem(STORAGE_DISTRIBUTORS);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
};

const saveLocalDistributors = (items) => {
  try {
    localStorage.setItem(STORAGE_DISTRIBUTORS, JSON.stringify(items));
  } catch (e) {
    console.error('Failed saving distributors locally', e);
  }
};

const getLocalDamageExpiryItems = () => {
  try {
    const saved = localStorage.getItem(STORAGE_DAMAGE_EXPIRY_ITEMS);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
};

const saveLocalDamageExpiryItems = (items) => {
  try {
    localStorage.setItem(STORAGE_DAMAGE_EXPIRY_ITEMS, JSON.stringify(items));
  } catch (e) {
    console.error('Failed saving damage expiry items locally', e);
  }
};

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
  const str = `${item.name || ''} ${item.customer_name || ''} ${item.address || ''} ${item.address_line || ''} ${item.fullAddress || ''} ${item.landmark || ''}`.toLowerCase();
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
        .select('*')
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
        .select('*')
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

export async function addDriver({ name, phone, pin, vehicle_number, status = 'active' }) {
  const cleanName = (name || '').trim();
  const cleanPhone = (phone || '').trim().replace(/\D/g, '');
  const cleanPin = pin ? pin.trim() : '1234';

  const newDriver = {
    name: cleanName,
    phone: cleanPhone,
    pin: cleanPin,
    active: true,
    is_online: false,
    created_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    try {
      const insertPayload = {
        name: cleanName,
        phone: cleanPhone,
        pin: cleanPin,
        active: true,
        is_online: false,
        last_seen_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('delivery_boys')
        .insert([insertPayload])
        .select();

      if (error) {
        console.error('Supabase Add Delivery Boy Error:', error);
        alert(`Failed to add delivery boy: ${error.message}`);
        return null;
      }

      if (data && data[0]) {
        const created = data[0];
        // Also sync into drivers table so both tables stay unified
        try {
          await supabase.from('drivers').upsert([{
            id: created.id,
            name: cleanName,
            phone: cleanPhone,
            pin: cleanPin,
            status: 'active'
          }]);
        } catch (_) {}
        return created;
      }
    } catch (err) {
      console.error('Supabase Add Delivery Boy Error:', err);
      alert(`Failed to add delivery boy: ${err.message}`);
      return null;
    }
  }

  const drivers = getLocalDrivers();
  const localDriver = { id: 'drv-' + Date.now(), ...newDriver };
  const updated = [localDriver, ...drivers];
  saveLocalDrivers(updated);
  return localDriver;
}

export async function updateDeliveryBoy(id, updates = {}) {
  const payload = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.phone !== undefined) payload.phone = updates.phone.trim();
  if (updates.pin !== undefined) payload.pin = updates.pin.trim();
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.is_online !== undefined) payload.is_online = Boolean(updates.is_online);
  if (updates.current_lat !== undefined) payload.current_lat = updates.current_lat !== null && updates.current_lat !== '' ? Number(updates.current_lat) : null;
  if (updates.current_lng !== undefined) payload.current_lng = updates.current_lng !== null && updates.current_lng !== '' ? Number(updates.current_lng) : null;
  if (updates.base_lat !== undefined) payload.base_lat = updates.base_lat !== null && updates.base_lat !== '' ? Number(updates.base_lat) : null;
  if (updates.base_lng !== undefined) payload.base_lng = updates.base_lng !== null && updates.base_lng !== '' ? Number(updates.base_lng) : null;
  if (updates.geofence_radius !== undefined) payload.geofence_radius = Number(updates.geofence_radius) || 150;

  if (isSupabaseConfigured) {
    try {
      await supabase.from('delivery_boys').update(payload).eq('id', id);
    } catch (err) {
      console.warn('Supabase updateDeliveryBoy on delivery_boys warning:', err.message);
    }
    try {
      const driverPayload = {};
      if (payload.name) driverPayload.name = payload.name;
      if (payload.phone) driverPayload.phone = payload.phone;
      if (payload.pin) driverPayload.pin = payload.pin;
      if (payload.status) driverPayload.status = payload.status;
      if (Object.keys(driverPayload).length > 0) {
        await supabase.from('drivers').update(driverPayload).eq('id', id);
      }
    } catch (err) {
      // ignore
    }
  }

  const drivers = getLocalDrivers();
  const updated = drivers.map((d) => (d.id === id ? { ...d, ...payload } : d));
  saveLocalDrivers(updated);
  return { id, ...payload };
}

export async function deleteDeliveryBoy(id) {
  if (isSupabaseConfigured) {
    // 1. Reset any pending / out for delivery orders assigned to this driver
    try {
      await supabase
        .from('orders')
        .update({
          assigned_driver_id: null,
          driver_name: 'Unassigned',
          status: 'Pending'
        })
        .eq('assigned_driver_id', id);
    } catch (err) {
      console.warn('Reset orders on deleteDeliveryBoy error:', err.message);
    }

    // 2. Delete from delivery_boys
    try {
      await supabase.from('delivery_boys').delete().eq('id', id);
    } catch (err) {
      console.warn('Delete from delivery_boys error:', err.message);
    }

    // 3. Delete from drivers
    try {
      await supabase.from('drivers').delete().eq('id', id);
    } catch (err) {
      console.warn('Delete from drivers error:', err.message);
    }

    // 4. Delete from driver_locations
    try {
      await supabase.from('driver_locations').delete().eq('driver_id', id);
    } catch (err) {
      // ignore
    }
  }

  const drivers = getLocalDrivers();
  saveLocalDrivers(drivers.filter((d) => d.id !== id));

  const orders = getLocalOrders();
  saveLocalOrders(
    orders.map((o) =>
      o.assigned_driver_id === id
        ? { ...o, assigned_driver_id: null, driver_name: 'Unassigned', status: o.status === 'Delivered' ? 'Delivered' : 'Pending' }
        : o
    )
  );

  return true;
}

export async function driverLogin(phone, pin) {
  const cleanPhone = (phone || '').trim().replace(/\D/g, '');
  const cleanPin = (pin || '').trim();

  if (isSupabaseConfigured) {
    // 1. Try delivery_boys table (primary fleet table)
    try {
      const { data, error } = await supabase
        .from('delivery_boys')
        .select('*')
        .eq('phone', cleanPhone)
        .eq('pin', cleanPin)
        .maybeSingle();

      if (!error && data) {
        // Mark online in Supabase immediately upon successful login
        const nowIso = new Date().toISOString();
        await supabase
          .from('delivery_boys')
          .update({
            status: 'online',
            is_online: true,
            last_seen: nowIso,
            last_seen_at: nowIso
          })
          .eq('id', data.id)
          .then(() => {})
          .catch(() => {});

        return { ...data, status: 'online', is_online: true, last_seen: nowIso, last_seen_at: nowIso };
      }
    } catch (err) {
      console.warn('Supabase driverLogin delivery_boys query notice:', err.message);
    }

    // 2. Fallback to drivers table
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('phone', cleanPhone)
        .eq('pin', cleanPin)
        .maybeSingle();

      if (!error && data) {
        return { ...data, is_online: true };
      }
    } catch (err) {
      console.warn('Supabase driverLogin drivers query notice:', err.message);
    }
  }

  const drivers = getLocalDrivers();
  const found = drivers.find(
    (d) => d.phone.replace(/\D/g, '') === cleanPhone && d.pin === cleanPin
  );
  return found || null;
}

// ==========================================
// ORDER OPERATIONS
// ==========================================

export function normalizeOrder(order) {
  if (!order) return order;
  let items = order.items;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }
  if ((!items || !Array.isArray(items) || items.length === 0) && order.notes) {
    const match = String(order.notes).match(/\[Items:\s*([^\]]+)\]/);
    if (match && match[1]) {
      items = match[1].split(',').map((it, idx) => {
        const trimmed = it.trim();
        const qMatch = trimmed.match(/^(\d+)x\s*(.*)$/);
        if (qMatch) {
          return { id: `item-${idx}`, quantity: parseInt(qMatch[1], 10), name: qMatch[2] };
        }
        return { id: `item-${idx}`, quantity: 1, name: trimmed };
      });
    }
  }

  const isPrepaid = order.payment_status === 'Prepaid' ||
    order.payment_method === 'Prepaid' ||
    order.is_prepaid === true ||
    (typeof order.notes === 'string' && order.notes.includes('[PREPAID'));

  return {
    ...order,
    items: Array.isArray(items) ? items : [],
    is_prepaid: isPrepaid,
    isPrepaid: isPrepaid
  };
}

export async function fetchOrders() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(normalizeOrder);
    } catch (err) {
      console.warn('Supabase fetchOrders failed, falling back to local store:', err.message);
    }
  }
  return (getLocalOrders() || []).map(normalizeOrder);
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
  items = [],
  notes = '',
  audioUrl,
  audio_url,
  slipImageUrl,
  slip_image_url,
  isPrepaid = false,
  paymentStatus = 'Pending',
  paymentMethod = null
}) {
  const finalSlipUrl = slipImageUrl || slip_image_url || null;
  const finalAudioUrl = audio_url || audioUrl || null;
  const isOrderPrepaid = isPrepaid || paymentStatus === 'Prepaid' || paymentMethod === 'Prepaid';

  // Construct notes including items summary and prepaid tag as safe backup across all databases
  const notesParts = [];
  if (isOrderPrepaid) {
    notesParts.push('[PREPAID - DO NOT COLLECT CASH]');
  }
  if (Array.isArray(items) && items.length > 0) {
    const itemsText = items.map((i) => `${i.quantity || 1}x ${i.name}`).join(', ');
    notesParts.push(`[Items: ${itemsText}]`);
  }
  if (notes && notes.trim()) {
    notesParts.push(notes.trim());
  }
  const finalNotes = notesParts.join(' ');

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
    slip_image_url: finalSlipUrl,
    audio_url: finalAudioUrl,
    payment_method: isOrderPrepaid ? 'Prepaid' : null,
    payment_status: isOrderPrepaid ? 'Prepaid' : 'Pending',
    is_prepaid: isOrderPrepaid,
    isPrepaid: isOrderPrepaid,
    payment_proof_url: null,
    delivery_proof_url: null,
    delivered_at: null,
    notes: finalNotes,
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
        items: newOrder.items,
        notes: newOrder.notes,
        audio_url: newOrder.audio_url,
        slip_image_url: newOrder.slip_image_url,
        payment_method: newOrder.payment_method
      };

      let { data, error } = await supabase
        .from('orders')
        .insert([insertPayload])
        .select()
        .single();

      // Graceful retry without items/customer_name/slip_image_url/audio_url if columns are not yet in remote schema
      if (error && (error.message?.includes('items') || error.message?.includes('customer_name') || error.message?.includes('slip_image_url') || error.message?.includes('audio_url') || error.message?.includes('payment_method') || error.code === 'PGRST204')) {
        delete insertPayload.items;
        delete insertPayload.customer_name;
        delete insertPayload.slip_image_url;
        delete insertPayload.audio_url;
        delete insertPayload.payment_method;
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
        return normalizeOrder({ ...newOrder, ...data });
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

  return normalizeOrder(newOrder);
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

export async function updateOrder(orderId, updates = {}) {
  const payload = {};
  if (updates.order_number !== undefined) payload.order_number = updates.order_number.trim();
  if (updates.amount !== undefined) payload.amount = parseFloat(updates.amount) || 0;
  if (updates.address !== undefined) payload.address = updates.address.trim();
  if (updates.landmark !== undefined) payload.landmark = updates.landmark ? updates.landmark.trim() : '';
  if (updates.customer_phone !== undefined) payload.customer_phone = updates.customer_phone ? updates.customer_phone.trim() : '';
  if (updates.customer_name !== undefined) payload.customer_name = updates.customer_name ? updates.customer_name.trim() : '';
  if (updates.assigned_driver_id !== undefined) payload.assigned_driver_id = updates.assigned_driver_id || null;
  if (updates.driver_name !== undefined) payload.driver_name = updates.driver_name || null;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.latitude !== undefined) payload.latitude = updates.latitude !== null && updates.latitude !== undefined && updates.latitude !== '' ? Number(updates.latitude) : null;
  if (updates.longitude !== undefined) payload.longitude = updates.longitude !== null && updates.longitude !== undefined && updates.longitude !== '' ? Number(updates.longitude) : null;
  if (updates.items !== undefined) payload.items = Array.isArray(updates.items) ? updates.items : [];
  if (updates.slip_image_url !== undefined) payload.slip_image_url = updates.slip_image_url || null;
  if (updates.slipImageUrl !== undefined) payload.slip_image_url = updates.slipImageUrl || null;

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', orderId)
        .select()
        .single();
      if (!error && data) {
        const local = getLocalOrders();
        saveLocalOrders(local.map((o) => (o.id === orderId ? { ...o, ...data } : o)));
        return data;
      }
      if (error) console.warn('Supabase updateOrder error:', error.message);
    } catch (err) {
      console.warn('Supabase updateOrder failed, updating locally:', err.message);
    }
  }

  const local = getLocalOrders();
  const updated = local.map((o) => (o.id === orderId ? { ...o, ...payload } : o));
  saveLocalOrders(updated);
  return { id: orderId, ...payload };
}

export async function deleteOrder(orderId) {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);
      if (error) console.warn('Supabase deleteOrder error:', error.message);
    } catch (err) {
      console.warn('Supabase deleteOrder failed, deleting locally:', err.message);
    }
  }

  const orders = getLocalOrders();
  const updated = orders.filter((o) => o.id !== orderId);
  saveLocalOrders(updated);
  return true;
}

export async function completeDelivery(orderId, {
  paymentMethod,
  paymentProofUrl,
  deliveryProofUrl,
  notes,
  actualAmount,
  deliveryComment,
  deliveryNotes
}) {
  const commentText = deliveryComment || deliveryNotes || '';
  const noteParts = [];
  if (notes && notes.trim()) noteParts.push(notes.trim());
  if (commentText && commentText.trim()) noteParts.push(`[Delivery Note: ${commentText.trim()}]`);
  if (actualAmount !== undefined && actualAmount !== null && String(actualAmount).trim() !== '') {
    noteParts.push(`[Collected: ₹${actualAmount}]`);
  }
  const combinedNotes = noteParts.join(' • ');

  const updates = {
    status: 'Delivered',
    payment_method: paymentMethod,
    payment_proof_url: paymentProofUrl || null,
    delivery_proof_url: deliveryProofUrl || null,
    delivered_at: new Date().toISOString(),
    notes: combinedNotes || null
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
      return normalizeOrder(data);
    } catch (err) {
      console.warn('Supabase completeDelivery failed, updating locally:', err.message);
    }
  }

  const orders = getLocalOrders();
  const updated = orders.map((o) =>
    o.id === orderId ? { ...o, ...updates } : o
  );
  saveLocalOrders(updated);
  return normalizeOrder(updated.find((o) => o.id === orderId));
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

// STORAGE UPLOAD FOR ORDER SLIPS (Supabase 'order-slips' bucket)
export async function uploadOrderSlip(file) {
  if (!file) return null;

  if (isSupabaseConfigured) {
    try {
      const sanitizedName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'slip.jpg';
      const filePath = `slips/${Date.now()}_${sanitizedName}`;

      const { data, error } = await supabase.storage
        .from('order-slips')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from('order-slips')
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      } else if (error) {
        console.warn('Supabase storage upload to order-slips failed:', error.message);
      }
    } catch (err) {
      console.warn('uploadOrderSlip error, falling back to data URL:', err.message);
    }
  }

  // Fallback to Data URL for instant local demo persistence
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
    driver_name: driverName,
    accepted_at: new Date().toISOString(),
    estimated_minutes: estimatedMinutes
  };

  if (isSupabaseConfigured) {
    try {
      let { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

      // Graceful fallback if accepted_at or estimated_minutes don't exist
      if (error && (error.code === 'PGRST204' || error.message?.includes('schema cache'))) {
        const coreUpdates = {
          status: 'Out for Delivery',
          assigned_driver_id: driverId,
          driver_name: driverName
        };
        const retry = await supabase
          .from('orders')
          .update(coreUpdates)
          .eq('id', orderId)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Supabase acceptOrderDelivery failed, updating locally:', err.message);
    }
  }

  const orders = getLocalOrders();
  const updated = orders.map((o) =>
    o.id === orderId ? { ...o, ...updates, driver_id: driverId } : o
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
  const todayStr = new Date().toISOString().split('T')[0];
  const attendanceRecord = {
    id: 'att-' + Date.now(),
    driver_id: driverId,
    check_in_lat: checkInLat,
    check_in_lng: checkInLng,
    check_out_lat: null,
    check_out_lng: null,
    punched_out_at: null,
    status: 'present',
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('driver_attendance')
        .insert([{
          driver_id: driverId,
          check_in_lat: checkInLat,
          check_in_lng: checkInLng,
          punched_out_at: null,
          status: 'present'
        }])
        .select()
        .single();
      if (error) throw error;
      if (data) {
        attendanceRecord.id = data.id;
      }
    } catch (err) {
      console.warn('Supabase recordDriverAttendance failed, saving locally:', err.message);
    }
  }

  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_ATTENDANCE) || '[]');
    const updated = [attendanceRecord, ...existing];
    localStorage.setItem(STORAGE_ATTENDANCE, JSON.stringify(updated));
    localStorage.setItem(`jal_jivan_punched_in_${driverId}_${todayStr}`, 'true');
    localStorage.removeItem(`jal_jivan_punched_out_${driverId}_${todayStr}`);
  } catch (e) {
    console.error('Failed to save attendance locally', e);
  }
  return attendanceRecord;
}

export async function recordDriverPunchOut({ driverId, checkOutLat = null, checkOutLng = null }) {
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split('T')[0];

  if (isSupabaseConfigured) {
    try {
      // Find open record today (punched_out_at IS NULL)
      const { data: openRecords } = await supabase
        .from('driver_attendance')
        .select('id')
        .eq('driver_id', driverId)
        .gte('created_at', `${todayStr}T00:00:00.000Z`)
        .is('punched_out_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (openRecords && openRecords.length > 0) {
        await supabase
          .from('driver_attendance')
          .update({
            punched_out_at: nowIso,
            check_out_lat: checkOutLat,
            check_out_lng: checkOutLng,
            status: 'checked_out'
          })
          .eq('id', openRecords[0].id);
      } else {
        // Fallback: update most recent record today
        const { data: recentRecords } = await supabase
          .from('driver_attendance')
          .select('id')
          .eq('driver_id', driverId)
          .gte('created_at', `${todayStr}T00:00:00.000Z`)
          .order('created_at', { ascending: false })
          .limit(1);

        if (recentRecords && recentRecords.length > 0) {
          await supabase
            .from('driver_attendance')
            .update({
              punched_out_at: nowIso,
              check_out_lat: checkOutLat,
              check_out_lng: checkOutLng,
              status: 'checked_out'
            })
            .eq('id', recentRecords[0].id);
        }
      }

      // Mark driver offline in delivery_boys
      await supabase
        .from('delivery_boys')
        .update({
          is_online: false,
          last_seen_at: nowIso
        })
        .eq('id', driverId);
    } catch (err) {
      console.warn('Supabase recordDriverPunchOut failed, updating locally:', err.message);
    }
  }

  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_ATTENDANCE) || '[]');
    let updatedRecord = false;
    const updated = existing.map((rec) => {
      if (!updatedRecord && rec.driver_id === driverId && (!rec.punched_out_at || rec.created_at?.startsWith(todayStr))) {
        updatedRecord = true;
        return {
          ...rec,
          punched_out_at: nowIso,
          check_out_lat: checkOutLat,
          check_out_lng: checkOutLng,
          status: 'checked_out'
        };
      }
      return rec;
    });

    localStorage.setItem(STORAGE_ATTENDANCE, JSON.stringify(updated));
    localStorage.removeItem(`jal_jivan_punched_in_${driverId}_${todayStr}`);
    localStorage.setItem(`jal_jivan_punched_out_${driverId}_${todayStr}`, 'true');
  } catch (e) {
    console.error('Failed to update punch-out locally', e);
  }

  return { success: true, punched_out_at: nowIso };
}

export async function checkDriverAttendanceToday(driverId) {
  const today = new Date().toISOString().split('T')[0];

  // 1. Check explicit local punch-out marker first
  try {
    const isPunchedOutLocally = localStorage.getItem(`jal_jivan_punched_out_${driverId}_${today}`);
    if (isPunchedOutLocally === 'true') {
      const isPunchedInLocally = localStorage.getItem(`jal_jivan_punched_in_${driverId}_${today}`);
      if (isPunchedInLocally !== 'true') {
        return false;
      }
    }
  } catch {
    // ignore
  }

  // 2. Query Supabase for latest attendance today
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('driver_attendance')
        .select('*')
        .eq('driver_id', driverId)
        .gte('created_at', `${today}T00:00:00.000Z`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const latest = data[0];
        // If latest record has punch out time or status 'checked_out', driver is currently NOT punched in
        if (latest.punched_out_at || latest.status === 'checked_out') {
          return false;
        }
        return true;
      }
    } catch (err) {
      console.warn('Supabase checkDriverAttendanceToday failed, checking locally:', err.message);
    }
  }

  // 3. Fallback to local storage records
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_ATTENDANCE) || '[]');
    const todayRecords = existing.filter(
      (a) => a.driver_id === driverId && a.created_at && a.created_at.startsWith(today)
    );
    if (todayRecords.length > 0) {
      const latest = todayRecords[0];
      if (latest.punched_out_at || latest.status === 'checked_out') {
        return false;
      }
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

export async function fetchDriverAttendance(driverId) {
  if (!driverId) return [];

  let records = [];
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('driver_attendance')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false })
        .limit(60);
      if (!error && data) {
        records = data;
      }
    } catch (err) {
      console.warn('Supabase fetchDriverAttendance failed, using local storage fallback:', err.message);
    }
  }

  try {
    const local = JSON.parse(localStorage.getItem(STORAGE_ATTENDANCE) || '[]');
    const driverLocal = local.filter((a) => a.driver_id === driverId);
    
    // Merge remote and local records by id / created_at timestamp
    const combined = [...records];
    driverLocal.forEach((item) => {
      const exists = combined.some((r) => 
        (r.id && r.id === item.id) || 
        (r.created_at && item.created_at && r.created_at.slice(0, 16) === item.created_at.slice(0, 16))
      );
      if (!exists) {
        combined.push(item);
      }
    });

    return combined.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  } catch {
    return records;
  }
}

export async function fetchAllStaffAttendance() {
  let records = [];
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('driver_attendance')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) {
        records = data;
      }
    } catch (err) {
      console.warn('Supabase fetchAllStaffAttendance failed, using local fallback:', err.message);
    }
  }

  try {
    const local = JSON.parse(localStorage.getItem(STORAGE_ATTENDANCE) || '[]');
    const combined = [...records];
    local.forEach((item) => {
      const exists = combined.some((r) => 
        (r.id && r.id === item.id) || 
        (r.created_at && item.created_at && r.created_at.slice(0, 16) === item.created_at.slice(0, 16))
      );
      if (!exists) combined.push(item);
    });
    return combined.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  } catch {
    return records;
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

export async function updateDriverLocation({ driverId, driverName, latitude, longitude, isOnline = true }) {
  if (!driverId || latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return null;
  }

  const now = new Date().toISOString();
  const latNum = Number(latitude);
  const lngNum = Number(longitude);
  const onlineBool = Boolean(isOnline);

  const locationRecord = {
    driver_id: driverId,
    driver_name: driverName || '',
    latitude: latNum,
    longitude: lngNum,
    is_online: onlineBool,
    updated_at: now,
    last_seen_at: now
  };

  console.log('Location heartbeat sent:', latNum, lngNum, 'online:', onlineBool);

  if (isSupabaseConfigured) {
    // 1. Upsert into driver_locations
    try {
      await supabase
        .from('driver_locations')
        .upsert([locationRecord]);
    } catch (err) {
      console.warn('Supabase update driver_locations failed:', err.message);
    }

    // 2. Also update delivery_boys table with current online status
    try {
      await supabase
        .from('delivery_boys')
        .update({
          is_online: onlineBool,
          current_lat: latNum,
          current_lng: lngNum,
          last_seen_at: now
        })
        .eq('id', driverId);
    } catch (err) {
      console.warn('Supabase update delivery_boys location notice:', err.message);
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

export async function updateProduct({ id, name, price, unit = '20L Can', imageUrl, inStock }) {
  const updates = {
    name: name.trim(),
    price: parseFloat(price) || 0,
    unit: (unit || '20L Can').trim(),
    in_stock: Boolean(inStock)
  };
  if (imageUrl !== undefined && imageUrl !== null) {
    updates.image_url = imageUrl;
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) {
        const local = getLocalProducts();
        saveLocalProducts(local.map((p) => (p.id === id ? data : p)));
        return data;
      }
      if (error) console.warn('Supabase updateProduct warning:', error.message);
    } catch (err) {
      console.warn('Supabase updateProduct failed, updating locally:', err.message);
    }
  }

  const local = getLocalProducts();
  const updated = local.map((p) => (p.id === id ? { ...p, ...updates } : p));
  saveLocalProducts(updated);
  return { id, ...updates };
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
    const rawAddr = (item.address_line || item.address || item.full_address || item.fullAddress || '').trim();
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
    // 1. Query past orders from Supabase (address, landmark, customer_phone, latitude, longitude)
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

    // 2. Query addresses table (select id, address_line, landmark, latitude, longitude)
    // Note: Do NOT order by created_at as it does not exist on addresses table
    try {
      const { data: addrsData, error: addrsError } = await supabase
        .from('addresses')
        .select('id, address_line, landmark, latitude, longitude');

      if (!addrsError && Array.isArray(addrsData)) {
        addrsData.forEach((a) => addRecord(a, 'addresses'));
      }
    } catch (err) {
      console.warn('Supabase fetchSavedAddresses addresses query failed:', err.message);
    }
  }

  // 3. Merge clean local orders & address book records
  const localOrders = getLocalOrders();
  localOrders.forEach((o) => addRecord(o, 'local_orders'));

  const localAddrs = getLocalAddressBook();
  localAddrs.forEach((a) => addRecord(a, 'local_address_book'));

  return Array.from(map.values());
}

export async function saveAddressBookEntry(entry) {
  const addr = (entry?.address_line || entry?.address || '').trim();
  if (!addr) return;
  const addressRecord = {
    address_line: addr,
    landmark: entry.landmark?.trim() || '',
    latitude: entry.latitude !== undefined && entry.latitude !== null ? Number(entry.latitude) : null,
    longitude: entry.longitude !== undefined && entry.longitude !== null ? Number(entry.longitude) : null
  };

  if (isSupabaseConfigured) {
    try {
      await supabase.from('addresses').insert([addressRecord]);
    } catch (err) {
      console.warn('Supabase save address to addresses failed:', err.message);
    }
  }

  try {
    const existing = getLocalAddressBook();
    const filtered = existing.filter(
      (a) => (a.address_line || a.address || '').trim().toLowerCase() !== addressRecord.address_line.toLowerCase()
    );
    saveLocalAddressBook([{ ...addressRecord, id: entry.id || 'addr-' + Date.now(), address: addressRecord.address_line }, ...filtered]);
  } catch (e) {
    // ignore
  }
}

export async function updateSavedAddress(oldAddress, newAddressData = {}) {
  const cleanOld = (oldAddress || '').trim();
  const cleanNew = (newAddressData.address || newAddressData.address_line || cleanOld).trim();
  if (!cleanNew) return;

  const addressPayload = {
    address_line: cleanNew,
    landmark: newAddressData.landmark ? newAddressData.landmark.trim() : '',
    latitude: newAddressData.latitude !== undefined && newAddressData.latitude !== null && newAddressData.latitude !== '' ? Number(newAddressData.latitude) : null,
    longitude: newAddressData.longitude !== undefined && newAddressData.longitude !== null && newAddressData.longitude !== '' ? Number(newAddressData.longitude) : null
  };

  if (isSupabaseConfigured) {
    // 1. Update in addresses table
    try {
      if (newAddressData.id && !String(newAddressData.id).startsWith('addr-')) {
        await supabase.from('addresses').update(addressPayload).eq('id', newAddressData.id);
      } else {
        const { error } = await supabase
          .from('addresses')
          .update(addressPayload)
          .ilike('address_line', cleanOld);
        if (error) {
          await supabase.from('addresses').insert([addressPayload]);
        }
      }
    } catch (err) {
      console.warn('Supabase updateSavedAddress on addresses warning:', err.message);
    }

    // 2. Modify related past entries in orders
    try {
      await supabase
        .from('orders')
        .update({
          address: cleanNew,
          landmark: addressPayload.landmark,
          latitude: addressPayload.latitude,
          longitude: addressPayload.longitude
        })
        .ilike('address', cleanOld);
    } catch (err) {
      console.warn('Supabase updateSavedAddress on orders warning:', err.message);
    }
  }

  // Update local address book cache
  try {
    const local = getLocalAddressBook();
    const updatedLocal = local.map((a) => {
      const current = (a.address_line || a.address || '').trim().toLowerCase();
      if (current === cleanOld.toLowerCase()) {
        return { ...a, ...addressPayload, address: cleanNew };
      }
      return a;
    });
    saveLocalAddressBook(updatedLocal);
  } catch (e) {}

  // Update local orders cache
  try {
    const orders = getLocalOrders();
    const updatedOrders = orders.map((o) => {
      if ((o.address || '').trim().toLowerCase() === cleanOld.toLowerCase()) {
        return {
          ...o,
          address: cleanNew,
          landmark: addressPayload.landmark,
          latitude: addressPayload.latitude,
          longitude: addressPayload.longitude
        };
      }
      return o;
    });
    saveLocalOrders(updatedOrders);
  } catch (e) {}

  return addressPayload;
}

export async function deleteSavedAddress(addressStr, { alsoRemoveFromOrders = false } = {}) {
  const cleanAddr = (addressStr || '').trim();
  if (!cleanAddr) return;

  if (isSupabaseConfigured) {
    // 1. Remove from addresses table
    try {
      await supabase.from('addresses').delete().ilike('address_line', cleanAddr);
    } catch (err) {
      console.warn('Supabase deleteSavedAddress on addresses error:', err.message);
    }

    // 2. If requested, also remove / nullify from past orders
    if (alsoRemoveFromOrders) {
      try {
        await supabase
          .from('orders')
          .update({
            address: 'Archived / Removed Address',
            landmark: ''
          })
          .ilike('address', cleanAddr);
      } catch (err) {
        console.warn('Supabase deleteSavedAddress on orders error:', err.message);
      }
    }
  }

  // Clean local address book
  try {
    const local = getLocalAddressBook();
    const filtered = local.filter(
      (a) => (a.address_line || a.address || '').trim().toLowerCase() !== cleanAddr.toLowerCase()
    );
    saveLocalAddressBook(filtered);
  } catch (e) {}

  // Clean local orders if requested
  if (alsoRemoveFromOrders) {
    try {
      const orders = getLocalOrders();
      const updated = orders.map((o) =>
        (o.address || '').trim().toLowerCase() === cleanAddr.toLowerCase()
          ? { ...o, address: 'Archived / Removed Address', landmark: '' }
          : o
      );
      saveLocalOrders(updated);
    } catch (e) {}
  }

  return true;
}

// ==========================================
// DAMAGE & RETURNS OPERATIONS
// ==========================================

export async function uploadDamagePhoto(file) {
  if (!file) return null;
  if (isSupabaseConfigured) {
    try {
      const sanitizedName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'damage.jpg';
      const filePath = `damages/${Date.now()}_${sanitizedName}`;

      const { data, error } = await supabase.storage
        .from('delivery-proofs')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from('delivery-proofs')
          .getPublicUrl(filePath);
        if (publicUrlData?.publicUrl) return publicUrlData.publicUrl;
      }
    } catch (err) {
      console.warn('Storage upload error, falling back to base64 data url:', err.message);
    }
  }

  // Fallback to Data URL for instant rendering and persistence
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export async function fetchProductDamages() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('product_damages')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        // Normalize fields for frontend compatibility
        const normalized = data.map((d) => ({
          ...d,
          category: d.category || d.damage_category || 'Water Jar',
          damage_category: d.category || d.damage_category || 'Water Jar',
          reported_by: d.reported_by || d.driver_name || 'Admin',
          driver_name: d.reported_by || d.driver_name || 'Admin',
          estimated_loss: Number(d.estimated_loss ?? d.estimated_value ?? 0),
          estimated_value: Number(d.estimated_loss ?? d.estimated_value ?? 0)
        }));
        saveLocalDamages(normalized);
        return normalized;
      }
      if (error) {
        console.warn('Supabase fetchProductDamages query notice:', error.message);
      }
    } catch (err) {
      console.warn('Supabase fetchProductDamages exception:', err.message);
    }
  }
  return getLocalDamages();
}

export async function createProductDamage(damagePayload) {
  const item_name = damagePayload.item_name || damagePayload.itemName || '20L RO Purified Water Jar';
  const quantity = Number(damagePayload.quantity) || 1;
  const category = damagePayload.category || damagePayload.damage_category || damagePayload.damageCategory || 'Water Jar';
  const reported_by = damagePayload.reported_by || damagePayload.driver_name || damagePayload.driverName || 'Admin';
  const reason = damagePayload.reason || damagePayload.notes || '';
  const estimated_loss = Number(damagePayload.estimated_loss ?? damagePayload.estimated_value ?? damagePayload.estimatedValue ?? 0);
  const photo_url = damagePayload.photo_url || damagePayload.photoUrl || null;
  const status = (damagePayload.status || 'pending').toLowerCase();

  const insertPayload = {
    item_name,
    quantity,
    category,
    reported_by,
    reason,
    estimated_loss,
    photo_url,
    status
  };

  const newDamage = {
    id: 'dmg-' + Date.now(),
    ...insertPayload,
    damage_category: category,
    driver_name: reported_by,
    estimated_value: estimated_loss,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('product_damages')
        .insert([insertPayload])
        .select()
        .single();

      if (!error && data) {
        const fullItem = {
          ...data,
          damage_category: data.category || category,
          driver_name: data.reported_by || reported_by,
          estimated_value: Number(data.estimated_loss ?? estimated_loss)
        };
        const local = getLocalDamages();
        saveLocalDamages([fullItem, ...local.filter((d) => d.id !== data.id)]);
        return fullItem;
      }
      if (error) {
        console.warn('Supabase createProductDamage error, persisting locally:', error.message);
      }
    } catch (err) {
      console.warn('Supabase createProductDamage exception:', err.message);
    }
  }

  // Local persistence fallback
  const current = getLocalDamages();
  const updated = [newDamage, ...current];
  saveLocalDamages(updated);
  return newDamage;
}

export async function updateProductDamageStatus(id, newStatus) {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('product_damages')
        .update({ status: newStatus.toLowerCase() })
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        const local = getLocalDamages();
        saveLocalDamages(local.map((d) => (d.id === id ? { ...d, ...data, status: newStatus } : d)));
        return data;
      }
    } catch (err) {
      console.warn('Supabase updateProductDamageStatus error:', err.message);
    }
  }

  const local = getLocalDamages();
  const updated = local.map((d) => (d.id === id ? { ...d, status: newStatus } : d));
  saveLocalDamages(updated);
  return updated.find((d) => d.id === id) || { id, status: newStatus };
}

export async function deleteProductDamage(id) {
  if (isSupabaseConfigured) {
    try {
      await supabase.from('product_damages').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase deleteProductDamage error:', err.message);
    }
  }
  const local = getLocalDamages();
  saveLocalDamages(local.filter((d) => d.id !== id));
  return true;
}

// ==========================================
// DISTRIBUTORS DIRECTORY
// ==========================================

export async function fetchDistributors() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('distributors')
        .select('*')
        .order('distributor_name', { ascending: true });

      if (!error && Array.isArray(data)) {
        saveLocalDistributors(data);
        return data;
      }
    } catch (err) {
      console.warn('Supabase fetchDistributors notice:', err.message);
    }
  }
  return getLocalDistributors();
}

export async function createDistributor(distributorData) {
  const divisions = Array.isArray(distributorData.divisions) && distributorData.divisions.length > 0
    ? distributorData.divisions
    : [{
        id: 'div-' + Date.now(),
        company_name: distributorData.company_name?.trim() || '',
        product_categories: distributorData.product_categories?.trim() || '',
        salesman_name: distributorData.salesman_name?.trim() || '',
        salesman_phone: distributorData.salesman_phone?.trim() || '',
        visit_day: distributorData.visit_day || 'Monday',
        claim_window_preset: distributorData.claim_window_preset || '1st - 10th',
        claim_window_start: Number(distributorData.claim_window_start) || 1,
        claim_window_end: Number(distributorData.claim_window_end) || 10
      }];

  const primaryDiv = divisions[0] || {};
  const allCompanies = Array.from(new Set(divisions.map((d) => d.company_name?.trim()).filter(Boolean)));
  const companySummary = allCompanies.length > 0 ? allCompanies.join(', ') : (distributorData.company_name?.trim() || '');

  const newDistributor = {
    id: distributorData.id || ('dist-' + Date.now()),
    distributor_name: distributorData.distributor_name?.trim() || '',
    company_name: companySummary,
    salesman_name: primaryDiv.salesman_name?.trim() || distributorData.salesman_name?.trim() || '',
    salesman_phone: primaryDiv.salesman_phone?.trim() || distributorData.salesman_phone?.trim() || '',
    visit_day: primaryDiv.visit_day || distributorData.visit_day || 'Monday',
    return_window_rule: distributorData.return_window_rule || `${distributorData.claim_window_start || 1}th–${distributorData.claim_window_end || 10}th of Month`,
    notes: distributorData.notes?.trim() || '',
    divisions: divisions,
    claim_window_preset: distributorData.claim_window_preset || primaryDiv.claim_window_preset || '1st - 10th',
    claim_window_start: Number(distributorData.claim_window_start || primaryDiv.claim_window_start) || 1,
    claim_window_end: Number(distributorData.claim_window_end || primaryDiv.claim_window_end) || 10,
    return_eligibility: distributorData.return_eligibility || ['Expired Stock', 'Damage / Breakage / Leakage', 'Consumer Complaint'],
    settlement_mode: distributorData.settlement_mode || 'Credit Note (CN)',
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    try {
      const fullPayload = {
        distributor_name: newDistributor.distributor_name,
        company_name: newDistributor.company_name,
        salesman_name: newDistributor.salesman_name,
        salesman_phone: newDistributor.salesman_phone,
        visit_day: newDistributor.visit_day,
        return_window_rule: newDistributor.return_window_rule,
        notes: newDistributor.notes,
        divisions: newDistributor.divisions,
        claim_window_preset: newDistributor.claim_window_preset,
        claim_window_start: newDistributor.claim_window_start,
        claim_window_end: newDistributor.claim_window_end,
        return_eligibility: newDistributor.return_eligibility,
        settlement_mode: newDistributor.settlement_mode
      };

      let { data, error } = await supabase
        .from('distributors')
        .insert([fullPayload])
        .select()
        .single();

      // Graceful fallback if table doesn't have new JSONB/columns yet
      if (error && (error.message?.includes('column') || error.code === '42703')) {
        console.warn('Distributor schema column pending, falling back to base columns:', error.message);
        const basePayload = {
          distributor_name: newDistributor.distributor_name,
          company_name: newDistributor.company_name,
          salesman_name: newDistributor.salesman_name,
          salesman_phone: newDistributor.salesman_phone,
          visit_day: newDistributor.visit_day,
          return_window_rule: newDistributor.return_window_rule,
          notes: newDistributor.notes
        };
        const fallbackRes = await supabase
          .from('distributors')
          .insert([basePayload])
          .select()
          .single();
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (!error && data) {
        const merged = { ...newDistributor, ...data, divisions: newDistributor.divisions };
        const local = getLocalDistributors();
        saveLocalDistributors([merged, ...local.filter((d) => d.id !== merged.id)]);
        return merged;
      }
    } catch (err) {
      console.warn('Supabase createDistributor error:', err.message);
    }
  }

  const local = getLocalDistributors();
  saveLocalDistributors([newDistributor, ...local]);
  return newDistributor;
}

export async function updateDistributor(id, updates) {
  const localList = getLocalDistributors();
  const existing = localList.find((d) => d.id === id) || {};

  // Normalize divisions if provided
  let divisions = updates.divisions;
  if (divisions && divisions.length > 0) {
    const primaryDiv = divisions[0];
    const allCompanies = Array.from(new Set(divisions.map((d) => d.company_name?.trim()).filter(Boolean)));
    updates.company_name = allCompanies.length > 0 ? allCompanies.join(', ') : (updates.company_name || existing.company_name || '');
    if (!updates.salesman_name && primaryDiv.salesman_name) updates.salesman_name = primaryDiv.salesman_name;
    if (!updates.salesman_phone && primaryDiv.salesman_phone) updates.salesman_phone = primaryDiv.salesman_phone;
    if (!updates.visit_day && primaryDiv.visit_day) updates.visit_day = primaryDiv.visit_day;
  }

  if (isSupabaseConfigured) {
    try {
      let { data, error } = await supabase
        .from('distributors')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error && (error.message?.includes('column') || error.code === '42703')) {
        const {
          divisions: _div,
          claim_window_preset: _cwp,
          claim_window_start: _cws,
          claim_window_end: _cwe,
          return_eligibility: _re,
          settlement_mode: _sm,
          ...baseUpdates
        } = updates;
        const fallbackRes = await supabase
          .from('distributors')
          .update(baseUpdates)
          .eq('id', id)
          .select()
          .single();
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (!error && data) {
        const merged = { ...existing, ...updates, ...data };
        const local = getLocalDistributors();
        saveLocalDistributors(local.map((d) => (d.id === id ? merged : d)));
        return merged;
      }
    } catch (err) {
      console.warn('Supabase updateDistributor error:', err.message);
    }
  }

  const local = getLocalDistributors();
  const updated = local.map((d) => (d.id === id ? { ...d, ...updates } : d));
  saveLocalDistributors(updated);
  return updated.find((d) => d.id === id);
}

export async function deleteDistributor(id) {
  if (isSupabaseConfigured) {
    try {
      await supabase.from('distributors').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase deleteDistributor error:', err.message);
    }
  }
  const local = getLocalDistributors();
  saveLocalDistributors(local.filter((d) => d.id !== id));
  return true;
}

// ==========================================
// DAMAGE & EXPIRY TRACKING ITEMS
// ==========================================

export async function fetchDamageExpiryItems() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('damage_expiry_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        saveLocalDamageExpiryItems(data);
        return data;
      }
    } catch (err) {
      console.warn('Supabase fetchDamageExpiryItems notice:', err.message);
    }
  }
  return getLocalDamageExpiryItems();
}

export async function createDamageExpiryItem(itemData) {
  const newItem = {
    id: 'dmgexp-' + Date.now(),
    product_name: itemData.product_name?.trim() || '',
    company_name: itemData.company_name?.trim() || '',
    distributor_id: itemData.distributor_id || null,
    distributor_name: itemData.distributor_name?.trim() || '',
    mrp: Number(itemData.mrp) || 0.0,
    net_weight_volume: itemData.net_weight_volume?.trim() || '',
    batch_no: itemData.batch_no?.trim() || '',
    mfg_date: itemData.mfg_date || '',
    expiry_date: itemData.expiry_date || '',
    quantity_pcs: Number(itemData.quantity_pcs) || 1,
    rack_number: itemData.rack_number?.trim() || '',
    damage_type: itemData.damage_type || 'Damage',
    front_photo_url: itemData.front_photo_url || '',
    back_photo_url: itemData.back_photo_url || '',
    return_slip_photo_url: itemData.return_slip_photo_url || '',
    is_slip_made: Boolean(itemData.is_slip_made),
    slip_made_at: itemData.slip_made_at || null,
    is_pickup_done: Boolean(itemData.is_pickup_done),
    pickup_done_at: itemData.pickup_done_at || null,
    is_credit_received: Boolean(itemData.is_credit_received),
    credit_received_at: itemData.credit_received_at || null,
    current_status: itemData.current_status || 'in_godown',
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    try {
      const insertPayload = {
        product_name: newItem.product_name,
        company_name: newItem.company_name,
        distributor_id: newItem.distributor_id,
        distributor_name: newItem.distributor_name,
        mrp: newItem.mrp,
        net_weight_volume: newItem.net_weight_volume,
        batch_no: newItem.batch_no,
        mfg_date: newItem.mfg_date,
        expiry_date: newItem.expiry_date,
        quantity_pcs: newItem.quantity_pcs,
        rack_number: newItem.rack_number,
        damage_type: newItem.damage_type,
        front_photo_url: newItem.front_photo_url,
        back_photo_url: newItem.back_photo_url,
        return_slip_photo_url: newItem.return_slip_photo_url,
        is_slip_made: newItem.is_slip_made,
        slip_made_at: newItem.slip_made_at,
        is_pickup_done: newItem.is_pickup_done,
        pickup_done_at: newItem.pickup_done_at,
        is_credit_received: newItem.is_credit_received,
        credit_received_at: newItem.credit_received_at,
        current_status: newItem.current_status
      };

      const { data, error } = await supabase
        .from('damage_expiry_items')
        .insert([insertPayload])
        .select()
        .single();

      if (!error && data) {
        const local = getLocalDamageExpiryItems();
        saveLocalDamageExpiryItems([data, ...local.filter((d) => d.id !== data.id)]);
        return data;
      }
    } catch (err) {
      console.warn('Supabase createDamageExpiryItem error:', err.message);
    }
  }

  const local = getLocalDamageExpiryItems();
  saveLocalDamageExpiryItems([newItem, ...local]);
  return newItem;
}

export async function updateDamageExpiryItem(id, updates) {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('damage_expiry_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        const local = getLocalDamageExpiryItems();
        saveLocalDamageExpiryItems(local.map((d) => (d.id === id ? { ...d, ...data } : d)));
        return data;
      }
    } catch (err) {
      console.warn('Supabase updateDamageExpiryItem error:', err.message);
    }
  }

  const local = getLocalDamageExpiryItems();
  const updated = local.map((d) => (d.id === id ? { ...d, ...updates } : d));
  saveLocalDamageExpiryItems(updated);
  return updated.find((d) => d.id === id);
}

export async function deleteDamageExpiryItem(id) {
  if (isSupabaseConfigured) {
    try {
      await supabase.from('damage_expiry_items').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase deleteDamageExpiryItem error:', err.message);
    }
  }
  const local = getLocalDamageExpiryItems();
  saveLocalDamageExpiryItems(local.filter((d) => d.id !== id));
  return true;
}

export async function updateDriverHeartbeat(driverId, isOnline = true, coords = null) {
  if (!driverId) return;
  const nowIso = new Date().toISOString();

  if (isSupabaseConfigured) {
    try {
      const updateData = {
        is_online: Boolean(isOnline),
        status: isOnline ? 'online' : 'offline',
        last_seen: nowIso,
        last_seen_at: nowIso
      };
      if (coords && coords.latitude !== undefined && coords.latitude !== null) {
        updateData.current_lat = Number(coords.latitude);
      }
      if (coords && coords.longitude !== undefined && coords.longitude !== null) {
        updateData.current_lng = Number(coords.longitude);
      }

      // 1. Primary update on delivery_boys
      const { error: dbErr } = await supabase
        .from('delivery_boys')
        .update(updateData)
        .eq('id', driverId);

      if (dbErr) {
        // Fallback for schema variations
        await supabase
          .from('delivery_boys')
          .update({
            status: isOnline ? 'online' : 'offline',
            last_seen: nowIso,
            ...(coords && coords.latitude ? { current_lat: Number(coords.latitude), current_lng: Number(coords.longitude) } : {})
          })
          .eq('id', driverId)
          .catch(() => {});
      }

      // 2. Also keep driver_locations synced
      const locData = {
        is_online: Boolean(isOnline),
        last_seen_at: nowIso,
        last_seen: nowIso
      };
      if (coords && coords.latitude !== undefined && coords.latitude !== null) {
        locData.latitude = Number(coords.latitude);
      }
      if (coords && coords.longitude !== undefined && coords.longitude !== null) {
        locData.longitude = Number(coords.longitude);
      }
      await supabase
        .from('driver_locations')
        .update(locData)
        .eq('driver_id', driverId)
        .then(() => {})
        .catch(() => {});
    } catch (err) {
      console.warn('Driver heartbeat remote update notice:', err.message);
    }
  }

  // Update local storage for demo/offline resilience
  try {
    const drivers = getLocalDrivers();
    const updated = drivers.map((d) =>
      d.id === driverId
        ? {
            ...d,
            is_online: isOnline,
            status: isOnline ? 'online' : 'offline',
            last_active_at: nowIso,
            last_seen: nowIso,
            last_seen_at: nowIso,
            ...(coords && coords.latitude ? { current_lat: Number(coords.latitude), current_lng: Number(coords.longitude) } : {})
          }
        : d
    );
    saveLocalDrivers(updated);

    const savedCurrent = localStorage.getItem('jal_jivan_current_driver');
    if (savedCurrent) {
      const parsed = JSON.parse(savedCurrent);
      if (parsed.id === driverId) {
        parsed.is_online = isOnline;
        parsed.status = isOnline ? 'online' : 'offline';
        parsed.last_active_at = nowIso;
        parsed.last_seen = nowIso;
        parsed.last_seen_at = nowIso;
        if (coords && coords.latitude) {
          parsed.current_lat = Number(coords.latitude);
          parsed.current_lng = Number(coords.longitude);
        }
        localStorage.setItem('jal_jivan_current_driver', JSON.stringify(parsed));
      }
    }
  } catch (e) {}
}





// ==========================================
// PURCHASE INVOICES & INWARD OPERATIONS
// ==========================================
export const STORAGE_PURCHASE_INVOICES = 'jal_jivan_purchase_invoices';

export function getLocalPurchaseInvoices() {
  try {
    const saved = localStorage.getItem(STORAGE_PURCHASE_INVOICES);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveLocalPurchaseInvoices(invoices) {
  try {
    localStorage.setItem(STORAGE_PURCHASE_INVOICES, JSON.stringify(invoices));
  } catch (e) {}
}

export async function fetchPurchaseInvoices() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('purchase_invoices')
        .select('*, purchase_items(*)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase fetchPurchaseInvoices error:', error);
        throw error;
      }

      if (Array.isArray(data)) {
        // Normalize purchase_items and items so both access patterns work smoothly
        const normalized = data.map((inv) => {
          const itemsList = inv.purchase_items || inv.items || [];
          return {
            ...inv,
            purchase_items: itemsList,
            items: itemsList
          };
        });
        saveLocalPurchaseInvoices(normalized);
        return normalized;
      }
    } catch (err) {
      console.warn('Supabase fetchPurchaseInvoices notice:', err.message);
    }
  }

  return getLocalPurchaseInvoices();
}

export async function savePurchaseInvoice(invoiceData, itemsData = []) {
  const nowIso = new Date().toISOString();

  // Safely map bank account fields according to known Supabase columns:
  // Supports both account_no/ifsc and bank_account_no/bank_ifsc
  const accountNo = (
    invoiceData.account_no ||
    invoiceData.bank_account_no ||
    ''
  ).toString().trim();

  const ifscCode = (
    invoiceData.ifsc ||
    invoiceData.bank_ifsc ||
    ''
  ).toString().trim();

  // 1. Build clean invoice payload containing known columns matching purchase_invoices:
  // invoice_number, invoice_date, seller_name, seller_gst, seller_fssai, seller_contact, seller_address,
  // total_taxable_amount, total_tax_amount, grand_total, bill_image_url, raw_ocr_data, account_no, ifsc
  const invoicePayload = {
    invoice_number: invoiceData.invoice_number || `INV-${Date.now()}`,
    invoice_date: invoiceData.invoice_date || nowIso.split('T')[0],
    seller_name: invoiceData.seller_name || '',
    seller_gst: invoiceData.seller_gst || '',
    seller_fssai: invoiceData.seller_fssai || '',
    seller_contact: invoiceData.seller_contact || '',
    seller_address: invoiceData.seller_address || '',
    salesman_name: invoiceData.salesman_name || '',
    salesman_number: invoiceData.salesman_number || '',
    bank_name: (invoiceData.bank_name || '').toString().trim() || null,
    account_no: accountNo || null,
    ifsc: ifscCode || null,
    bank_account_no: accountNo || null,
    bank_ifsc: ifscCode || null,
    total_taxable_amount: Number(invoiceData.total_taxable_amount ?? invoiceData.taxable_amount) || 0,
    total_tax_amount: Number(invoiceData.total_tax_amount ?? invoiceData.total_tax) || 0,
    grand_total: Number(invoiceData.grand_total) || 0,
    bill_image_url: invoiceData.bill_image_url || (Array.isArray(invoiceData.bill_image_urls) ? invoiceData.bill_image_urls[0] : '') || '',
    bill_image_urls: Array.isArray(invoiceData.bill_image_urls) ? invoiceData.bill_image_urls : (invoiceData.bill_image_url ? [invoiceData.bill_image_url] : []),
    status: invoiceData.status || 'verified'
  };

  // Attach extracted_json, vendor_details, tax_summary if present
  if (invoiceData.extracted_json && typeof invoiceData.extracted_json === 'object') {
    invoicePayload.extracted_json = invoiceData.extracted_json;
  }
  if (invoiceData.vendor_details && typeof invoiceData.vendor_details === 'object') {
    invoicePayload.vendor_details = invoiceData.vendor_details;
  }
  if (invoiceData.tax_summary && typeof invoiceData.tax_summary === 'object') {
    invoicePayload.tax_summary = invoiceData.tax_summary;
  }

  // 2. Ensure raw_ocr_data is saved as valid JSON (or stringified JSON), or if null/undefined, omit it from the payload
  let validOcr = null;
  if (invoiceData.raw_ocr_data !== null && invoiceData.raw_ocr_data !== undefined) {
    if (typeof invoiceData.raw_ocr_data === 'string') {
      try {
        const parsed = JSON.parse(invoiceData.raw_ocr_data);
        if (parsed && typeof parsed === 'object') {
          validOcr = parsed;
        }
      } catch {
        if (invoiceData.raw_ocr_data.trim()) {
          validOcr = invoiceData.raw_ocr_data.trim();
        }
      }
    } else if (typeof invoiceData.raw_ocr_data === 'object') {
      if (Object.keys(invoiceData.raw_ocr_data).length > 0) {
        validOcr = invoiceData.raw_ocr_data;
      }
    }
  }

  // Only include raw_ocr_data if valid JSON exists; omit if null, undefined, or empty
  if (validOcr !== null && validOcr !== undefined) {
    invoicePayload.raw_ocr_data = validOcr;
    if (!invoicePayload.extracted_json) {
      invoicePayload.extracted_json = validOcr;
    }
  }

  // Only pass id if it is an existing valid UUID (e.g. for update). Otherwise omit to let DB generate UUID / primary key
  const isUuid =
    typeof invoiceData.id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceData.id);
  if (isUuid) {
    invoicePayload.id = invoiceData.id;
  }

  let savedInvoiceId = invoiceData.id || `inv_${Date.now()}`;
  let savedRecord = null;
  let savedItems = [];

  // Format line items with detailed GST breakdown
  const formattedItems = (itemsData || []).map((item) => {
    const qty = Number(item.quantity) || 1;
    const purchasePrice = Number(item.purchase_price ?? item.price_before_gst) || 0;
    const taxable = Number(item.taxable_amount ?? (qty * purchasePrice - (Number(item.discount) || 0))) || 0;
    const gstRate = Number(item.gst_pct ?? item.gst_rate) || 0;
    const cgstPct = Number(item.cgst_pct ?? (gstRate / 2)) || 0;
    const sgstPct = Number(item.sgst_pct ?? (gstRate / 2)) || 0;
    const cgstAmt = Number(item.cgst_amount ?? ((taxable * cgstPct) / 100)) || 0;
    const sgstAmt = Number(item.sgst_amount ?? ((taxable * sgstPct) / 100)) || 0;
    const cessAmt = Number(item.cess_amount ?? item.cess) || 0;
    const cessPct = Number(item.cess_pct) || 0;
    const total = Number(item.total_amount ?? item.price_after_gst ?? (taxable + cgstAmt + sgstAmt + cessAmt)) || 0;

    return {
      purchase_invoice_id: savedInvoiceId,
      barcode: (item.barcode || '').toString().trim() || null,
      item_name: (item.item_name || 'Item').toString().trim(),
      hsn_code: (item.hsn_code || '').toString().trim() || null,
      quantity: qty,
      purchase_price: purchasePrice,
      price_before_gst: purchasePrice,
      taxable_amount: Number(taxable.toFixed(2)),
      gst_pct: gstRate,
      gst_rate: gstRate,
      cgst_pct: cgstPct,
      cgst_amount: Number(cgstAmt.toFixed(2)),
      sgst_pct: sgstPct,
      sgst_amount: Number(sgstAmt.toFixed(2)),
      cess_pct: cessPct,
      cess_amount: Number(cessAmt.toFixed(2)),
      cess: Number(cessAmt.toFixed(2)),
      discount: Number(item.discount) || 0,
      price_after_gst: Number(total.toFixed(2)),
      total_amount: Number(total.toFixed(2)),
      mrp: Number(item.mrp) || 0
    };
  });

  // Write to Supabase if configured
  if (isSupabaseConfigured) {
    // Step 2.1: Write to purchase_invoices first, obtain generated invoice id
    let { data: invRow, error: invErr } = await supabase
      .from('purchase_invoices')
      .insert(invoicePayload)
      .select()
      .single();

    // If PostgREST schema cache complains about extra columns, retry cleanly without them
    if (invErr) {
      console.warn('Initial insert note, trying fallback payload:', invErr.message);
      const fallbackPayload = { ...invoicePayload };
      delete fallbackPayload.bill_image_urls;
      delete fallbackPayload.extracted_json;
      delete fallbackPayload.vendor_details;
      delete fallbackPayload.tax_summary;
      delete fallbackPayload.raw_ocr_data;

      const retryResult = await supabase
        .from('purchase_invoices')
        .insert(fallbackPayload)
        .select()
        .single();
      invRow = retryResult.data;
      invErr = retryResult.error;
    }

    if (invErr) {
      console.error('Supabase purchase_invoices insert error:', invErr);
      throw new Error(`Database error on purchase_invoices: ${invErr.message || invErr.details || 'Insert failed'}`);
    }

    if (!invRow || !invRow.id) {
      throw new Error('Database inserted purchase invoice but returned no ID');
    }

    savedInvoiceId = invRow.id;
    savedRecord = invRow;

    // Step 2.2: Insert line items into purchase_items with purchase_invoice_id: id
    if (formattedItems.length > 0) {
      // Set the real database invoice id
      const dbItems = formattedItems.map((it) => ({
        ...it,
        purchase_invoice_id: savedInvoiceId
      }));

      let { data: itemsRows, error: itemsErr } = await supabase
        .from('purchase_items')
        .insert(dbItems)
        .select();

      // If schema cache complains about detailed GST columns, retry with base columns
      if (itemsErr) {
        console.warn('Items detailed insert notice, retrying with core columns:', itemsErr.message);
        const baseItems = dbItems.map((item) => ({
          purchase_invoice_id: savedInvoiceId,
          barcode: item.barcode,
          item_name: item.item_name,
          hsn_code: item.hsn_code,
          quantity: item.quantity,
          purchase_price: item.purchase_price,
          mrp: item.mrp
        }));
        const retryItems = await supabase
          .from('purchase_items')
          .insert(baseItems)
          .select();
        itemsRows = retryItems.data;
        itemsErr = retryItems.error;
      }

      if (itemsErr) {
        console.error('Supabase purchase_items insert error:', itemsErr);
        throw new Error(`Database error on purchase_items: ${itemsErr.message || itemsErr.details || 'Items insert failed'}`);
      }

      savedItems = itemsRows || formattedItems;
    }
  }

  // Step 2.3: Automatic Inventory Stock Syncing (Requirements 5 & 6)
  try {
    await syncInventoryFromPurchaseItems(formattedItems);
  } catch (syncErr) {
    console.warn('Inventory auto-sync notice on invoice commit:', syncErr);
  }

  // 3. Local Storage Sync (Fallback or Cache)
  const fullInvoice = {
    ...(savedRecord || invoicePayload),
    id: savedInvoiceId,
    purchase_items: savedItems.length > 0 ? savedItems : itemsData,
    items: savedItems.length > 0 ? savedItems : itemsData
  };

  const existing = getLocalPurchaseInvoices();
  const filtered = existing.filter((inv) => inv.id !== savedInvoiceId);
  saveLocalPurchaseInvoices([fullInvoice, ...filtered]);

  return fullInvoice;
}

export async function deletePurchaseInvoice(invoiceId) {
  if (isSupabaseConfigured) {
    try {
      // Delete child line items referencing purchase_invoice_id first
      const { error: itemsDelErr } = await supabase
        .from('purchase_items')
        .delete()
        .eq('purchase_invoice_id', invoiceId);

      if (itemsDelErr) {
        console.warn('Supabase purchase_items delete notice:', itemsDelErr.message);
      }

      // Delete parent purchase invoice
      const { error: invDelErr } = await supabase
        .from('purchase_invoices')
        .delete()
        .eq('id', invoiceId);

      if (invDelErr) {
        console.error('Supabase purchase_invoices delete error:', invDelErr);
        throw new Error(invDelErr.message || 'Failed to delete purchase invoice from database');
      }
    } catch (err) {
      console.error('deletePurchaseInvoice error:', err);
      throw err;
    }
  }

  const existing = getLocalPurchaseInvoices();
  saveLocalPurchaseInvoices(existing.filter((inv) => inv.id !== invoiceId));
  return true;
}

// ==========================================
// PURCHASE VENDORS DIRECTORY & AUTO-SYNC
// ==========================================
export const STORAGE_PURCHASE_VENDORS = 'jal_jivan_purchase_vendors';
export const STORAGE_DELETED_PURCHASE_VENDORS = 'jal_jivan_deleted_purchase_vendors';

export function getDeletedPurchaseVendors() {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_PURCHASE_VENDORS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveDeletedPurchaseVendors(list) {
  try {
    localStorage.setItem(STORAGE_DELETED_PURCHASE_VENDORS, JSON.stringify(list || []));
  } catch (e) {}
}

export function getLocalPurchaseVendors() {
  try {
    const raw = localStorage.getItem(STORAGE_PURCHASE_VENDORS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read local purchase vendors:', e);
    return [];
  }
}

export function saveLocalPurchaseVendors(vendors) {
  try {
    localStorage.setItem(STORAGE_PURCHASE_VENDORS, JSON.stringify(vendors));
  } catch (e) {
    console.error('Failed to save local purchase vendors:', e);
  }
}

export async function fetchPurchaseVendors() {
  const deletedVendors = getDeletedPurchaseVendors();

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('purchase_vendors')
        .select('*')
        .order('last_billed_date', { ascending: false });

      if (!error && Array.isArray(data)) {
        const filtered = data.filter((v) => {
          const vName = (v.vendor_name || '').toLowerCase().trim();
          const vGst = (v.gstin || '').toLowerCase().trim();
          const vId = (v.id || '').toString();
          return (
            !deletedVendors.includes(vId) &&
            (!vName || !deletedVendors.includes(vName)) &&
            (!vGst || !deletedVendors.includes(vGst))
          );
        });
        saveLocalPurchaseVendors(filtered);
        return filtered;
      }
      if (error) {
        console.warn('Supabase purchase_vendors query note:', error.message);
      }
    } catch (err) {
      console.warn('fetchPurchaseVendors error, falling back to local/inferred cache:', err);
    }
  }

  // Fallback to local storage (filtered by deleted blacklist)
  const local = getLocalPurchaseVendors();
  const filteredLocal = (local || []).filter((v) => {
    const vName = (v.vendor_name || '').toLowerCase().trim();
    const vGst = (v.gstin || '').toLowerCase().trim();
    const vId = (v.id || '').toString();
    return (
      !deletedVendors.includes(vId) &&
      (!vName || !deletedVendors.includes(vName)) &&
      (!vGst || !deletedVendors.includes(vGst))
    );
  });
  if (filteredLocal.length > 0) return filteredLocal;

  // Auto-aggregate from purchase invoices history ONLY if not explicitly deleted
  const invoices = getLocalPurchaseInvoices();
  if (Array.isArray(invoices) && invoices.length > 0) {
    const map = new Map();
    for (const inv of invoices) {
      const vName = (inv.seller_name || '').trim();
      if (!vName) continue;
      const vGst = (inv.seller_gst || '').toLowerCase().trim();
      const key = (vGst || vName).toLowerCase();

      // Check if vendor has been deleted
      if (
        deletedVendors.includes(vName.toLowerCase()) ||
        (vGst && deletedVendors.includes(vGst)) ||
        deletedVendors.includes(key)
      ) {
        continue;
      }

      if (!map.has(key)) {
        map.set(key, {
          id: `ven_agg_${Math.random().toString(36).substr(2, 7)}`,
          vendor_name: vName,
          gstin: inv.seller_gst || null,
          phone: inv.seller_contact || null,
          address: inv.seller_address || null,
          last_billed_date: inv.invoice_date || new Date().toISOString().split('T')[0],
          total_bills_count: 1,
          total_purchased_amount: Number(inv.grand_total) || 0
        });
      } else {
        const item = map.get(key);
        item.total_bills_count += 1;
        item.total_purchased_amount += Number(inv.grand_total) || 0;
        if (inv.invoice_date && inv.invoice_date > item.last_billed_date) {
          item.last_billed_date = inv.invoice_date;
        }
      }
    }
    const result = Array.from(map.values());
    saveLocalPurchaseVendors(result);
    return result;
  }

  return [];
}

export async function syncPurchaseVendorFromOcr(extractedVendor, billAmount = 0) {
  if (!extractedVendor) return null;
  const vendorName = (extractedVendor.name || extractedVendor.vendor_name || '').toString().trim();
  if (!vendorName) return null;

  const gstin = (extractedVendor.gst || extractedVendor.gstin || '').toString().trim() || null;
  const phone = (extractedVendor.contact || extractedVendor.phone || '').toString().trim() || null;
  const address = (extractedVendor.address || '').toString().trim() || null;
  const billDate = extractedVendor.bill_date || extractedVendor.invoice_date || new Date().toISOString().split('T')[0];
  const amount = Number(billAmount) || 0;

  let syncedVendor = null;

  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Check if vendor exists by GSTIN or vendor_name
      let existingVendor = null;
      if (gstin) {
        const { data: byGst } = await supabase
          .from('purchase_vendors')
          .select('*')
          .eq('gstin', gstin)
          .maybeSingle();
        if (byGst) existingVendor = byGst;
      }

      if (!existingVendor && vendorName) {
        const { data: byName } = await supabase
          .from('purchase_vendors')
          .select('*')
          .ilike('vendor_name', vendorName)
          .maybeSingle();
        if (byName) existingVendor = byName;
      }

      if (existingVendor) {
        const updatedCount = (Number(existingVendor.total_bills_count) || 1) + 1;
        const updatedAmount = Number(((Number(existingVendor.total_purchased_amount) || 0) + amount).toFixed(2));

        const updatePayload = {
          vendor_name: vendorName || existingVendor.vendor_name,
          gstin: gstin || existingVendor.gstin || null,
          phone: phone || existingVendor.phone || null,
          address: address || existingVendor.address || null,
          last_billed_date: billDate,
          total_bills_count: updatedCount,
          total_purchased_amount: updatedAmount
        };

        const { data: updated, error: updErr } = await supabase
          .from('purchase_vendors')
          .update(updatePayload)
          .eq('id', existingVendor.id)
          .select()
          .maybeSingle();

        if (!updErr && updated) {
          syncedVendor = updated;
        } else {
          syncedVendor = { ...existingVendor, ...updatePayload };
        }
      } else {
        const insertPayload = {
          vendor_name: vendorName,
          gstin: gstin || null,
          phone: phone || null,
          address: address || null,
          last_billed_date: billDate,
          total_bills_count: 1,
          total_purchased_amount: Number(amount.toFixed(2))
        };

        const { data: inserted, error: insErr } = await supabase
          .from('purchase_vendors')
          .upsert(insertPayload, { onConflict: gstin ? 'gstin' : undefined })
          .select()
          .maybeSingle();

        if (!insErr && inserted) {
          syncedVendor = inserted;
        } else {
          syncedVendor = { ...insertPayload, id: `ven_${Date.now()}` };
        }
      }
    } catch (err) {
      console.warn('Supabase syncPurchaseVendorFromOcr note:', err?.message);
    }
  }

  // Always keep local storage updated
  try {
    const localVendors = getLocalPurchaseVendors();
    let idx = -1;
    if (gstin) {
      idx = localVendors.findIndex((v) => v.gstin && v.gstin.toLowerCase() === gstin.toLowerCase());
    }
    if (idx === -1) {
      idx = localVendors.findIndex((v) => (v.vendor_name || '').toLowerCase() === vendorName.toLowerCase());
    }

    if (idx >= 0) {
      const existing = localVendors[idx];
      const updated = {
        ...existing,
        vendor_name: vendorName,
        gstin: gstin || existing.gstin || null,
        phone: phone || existing.phone || null,
        address: address || existing.address || null,
        last_billed_date: billDate,
        total_bills_count: (Number(existing.total_bills_count) || 1) + 1,
        total_purchased_amount: Number(((Number(existing.total_purchased_amount) || 0) + amount).toFixed(2))
      };
      localVendors[idx] = updated;
      if (!syncedVendor) syncedVendor = updated;
    } else {
      const newEntry = syncedVendor || {
        id: `ven_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        vendor_name: vendorName,
        gstin: gstin || null,
        phone: phone || null,
        address: address || null,
        last_billed_date: billDate,
        total_bills_count: 1,
        total_purchased_amount: Number(amount.toFixed(2))
      };
      localVendors.unshift(newEntry);
      if (!syncedVendor) syncedVendor = newEntry;
    }
    saveLocalPurchaseVendors(localVendors);
  } catch (localErr) {
    console.warn('Local storage vendor sync note:', localErr);
  }

  return syncedVendor;
}

export async function deletePurchaseVendor(vendorId, vendorGstin = null, vendorName = null, deleteInvoices = false) {
  if (isSupabaseConfigured && supabase) {
    try {
      if (vendorId && !vendorId.toString().startsWith('ven_agg_')) {
        await supabase.from('purchase_vendors').delete().eq('id', vendorId);
      }
      if (vendorGstin) {
        await supabase.from('purchase_vendors').delete().eq('gstin', vendorGstin);
      }
      if (vendorName) {
        await supabase.from('purchase_vendors').delete().ilike('vendor_name', vendorName);
      }

      // If requested to delete associated invoices
      if (deleteInvoices) {
        let invQuery = supabase.from('purchase_invoices').select('id');
        if (vendorGstin && vendorName) {
          invQuery = invQuery.or(`seller_gst.eq.${vendorGstin},seller_name.ilike.${vendorName}`);
        } else if (vendorGstin) {
          invQuery = invQuery.eq('seller_gst', vendorGstin);
        } else if (vendorName) {
          invQuery = invQuery.ilike('seller_name', vendorName);
        }
        const { data: invRows } = await invQuery;
        if (Array.isArray(invRows) && invRows.length > 0) {
          const invIds = invRows.map((r) => r.id);
          await supabase.from('purchase_items').delete().in('purchase_invoice_id', invIds);
          await supabase.from('purchase_invoices').delete().in('id', invIds);
        }
      }
    } catch (e) {
      console.warn('deletePurchaseVendor supabase warning:', e);
    }
  }

  // Blacklist vendor identifier so auto-aggregation never resurrects it
  try {
    const deletedList = getDeletedPurchaseVendors();
    const toAdd = [vendorId, vendorName, vendorGstin].filter(Boolean).map((s) => s.toString().toLowerCase().trim());
    const merged = Array.from(new Set([...deletedList, ...toAdd]));
    saveDeletedPurchaseVendors(merged);
  } catch (e) {}

  // Update local purchase vendors
  const local = getLocalPurchaseVendors().filter((v) => {
    if (vendorId && v.id === vendorId) return false;
    if (vendorGstin && v.gstin && v.gstin.toLowerCase() === vendorGstin.toLowerCase()) return false;
    if (vendorName && (v.vendor_name || '').toLowerCase() === vendorName.toLowerCase()) return false;
    return true;
  });
  saveLocalPurchaseVendors(local);

  // If deleteInvoices requested, remove invoices from local storage
  if (deleteInvoices) {
    const localInvoices = getLocalPurchaseInvoices().filter((inv) => {
      if (vendorGstin && inv.seller_gst && inv.seller_gst.toLowerCase() === vendorGstin.toLowerCase()) return false;
      if (vendorName && (inv.seller_name || '').toLowerCase() === vendorName.toLowerCase()) return false;
      return true;
    });
    saveLocalPurchaseInvoices(localInvoices);
  }

  return true;
}

// ==========================================
// PURCHASE BILL QUEUE (MOBILE LIVE OCR INWARD)
// ==========================================
const STORAGE_PURCHASE_BILL_QUEUE = 'jal_jivan_purchase_bill_queue';

export function getLocalBillQueue() {
  try {
    const saved = localStorage.getItem(STORAGE_PURCHASE_BILL_QUEUE);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

export function saveLocalBillQueue(items) {
  try {
    localStorage.setItem(STORAGE_PURCHASE_BILL_QUEUE, JSON.stringify(items || []));
  } catch (e) {
    console.warn('saveLocalBillQueue error:', e);
  }
}

export async function fetchPurchaseBillQueue() {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('purchase_bill_queue')
        .select('*')
        .eq('status', 'pending_ocr')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        saveLocalBillQueue(data);
        return data;
      } else if (error) {
        console.warn('fetchPurchaseBillQueue supabase error:', error.message);
      }
    } catch (e) {
      console.warn('fetchPurchaseBillQueue exception:', e.message);
    }
  }
  return getLocalBillQueue().filter((b) => b.status === 'pending_ocr');
}

export async function insertPurchaseBillQueue(item) {
  const imageUrl = item.image_url || item.imageUrl || item.dataUrl;
  let savedRecord = null;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('purchase_bill_queue')
        .insert([{ image_url: imageUrl, status: 'pending_ocr' }])
        .select()
        .single();

      if (!error && data) {
        savedRecord = data;
      } else if (error) {
        console.warn('insertPurchaseBillQueue supabase error:', error.message);
      }
    } catch (e) {
      console.warn('insertPurchaseBillQueue exception:', e.message);
    }
  }

  if (!savedRecord) {
    savedRecord = {
      id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      image_url: imageUrl,
      status: 'pending_ocr',
      created_at: new Date().toISOString()
    };
  }

  const existing = getLocalBillQueue();
  saveLocalBillQueue([savedRecord, ...existing.filter((b) => b.id !== savedRecord.id)]);
  return savedRecord;
}

export async function updatePurchaseBillStatus(id, status) {
  if (isSupabaseConfigured && supabase && id && !id.toString().startsWith('local_')) {
    try {
      const { error } = await supabase
        .from('purchase_bill_queue')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.warn('updatePurchaseBillStatus supabase notice:', error.message);
      }
    } catch (e) {
      console.warn('updatePurchaseBillStatus exception:', e.message);
    }
  }

  const local = getLocalBillQueue();
  const updated = local.map((b) => (b.id === id ? { ...b, status } : b));
  saveLocalBillQueue(updated.filter((b) => b.status === 'pending_ocr'));
  return true;
}

export async function deletePurchaseBillQueueItem(id) {
  if (isSupabaseConfigured && supabase && id && !id.toString().startsWith('local_')) {
    try {
      const { error } = await supabase
        .from('purchase_bill_queue')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('deletePurchaseBillQueueItem notice (falling back to status discarded):', error.message);
        await supabase
          .from('purchase_bill_queue')
          .update({ status: 'discarded', updated_at: new Date().toISOString() })
          .eq('id', id);
      }
    } catch (e) {
      console.warn('deletePurchaseBillQueueItem exception:', e.message);
    }
  }

  const local = getLocalBillQueue().filter((b) => b.id !== id);
  saveLocalBillQueue(local);
  return true;
}



// ==========================================
// STAFF DIRECTORY, PAYROLL ADVANCES & ATTENDANCE
// ==========================================
export const STORAGE_STAFF_DIRECTORY = 'jal_jivan_staff_directory';
export const STORAGE_STAFF_ADVANCES = 'jal_jivan_staff_advances';
export const STORAGE_STAFF_ATTENDANCE = 'jal_jivan_staff_attendance';

export const INITIAL_STAFF_DIRECTORY = [
  {
    id: 'staff-1',
    name: 'Rahul Kumar',
    phone: '9876543210',
    role: 'Rider',
    age: 24,
    monthly_salary: 16000,
    photo_url: '',
    id_proof_url: '',
    id_proof_type: 'Aadhaar Card',
    status: 'active',
    joining_date: '2025-01-15',
    created_at: new Date(Date.now() - 60 * 86400000).toISOString()
  },
  {
    id: 'staff-2',
    name: 'Vikram Singh',
    phone: '9812345678',
    role: 'Rider',
    age: 27,
    monthly_salary: 18000,
    photo_url: '',
    id_proof_url: '',
    id_proof_type: 'Driving License',
    status: 'active',
    joining_date: '2024-11-01',
    created_at: new Date(Date.now() - 120 * 86400000).toISOString()
  },
  {
    id: 'staff-3',
    name: 'Mohan Lal',
    phone: '9823456789',
    role: 'Godown Staff',
    age: 33,
    monthly_salary: 15000,
    photo_url: '',
    id_proof_url: '',
    id_proof_type: 'Aadhaar Card',
    status: 'active',
    joining_date: '2024-08-10',
    created_at: new Date(Date.now() - 200 * 86400000).toISOString()
  },
  {
    id: 'staff-4',
    name: 'Sunita Sharma',
    phone: '9834567890',
    role: 'Store Manager',
    age: 30,
    monthly_salary: 24000,
    photo_url: '',
    id_proof_url: '',
    id_proof_type: 'PAN Card',
    status: 'active',
    joining_date: '2024-05-01',
    created_at: new Date(Date.now() - 300 * 86400000).toISOString()
  },
  {
    id: 'staff-5',
    name: 'Amit Patel',
    phone: '9845678901',
    role: 'Rider',
    age: 22,
    monthly_salary: 15000,
    photo_url: '',
    id_proof_url: '',
    id_proof_type: 'Aadhaar Card',
    status: 'active',
    joining_date: '2025-02-01',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString()
  }
];

export function getLocalStaffDirectory() {
  try {
    const raw = localStorage.getItem(STORAGE_STAFF_DIRECTORY);
    if (!raw) {
      localStorage.setItem(STORAGE_STAFF_DIRECTORY, JSON.stringify(INITIAL_STAFF_DIRECTORY));
      return INITIAL_STAFF_DIRECTORY;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_STAFF_DIRECTORY;
  } catch (e) {
    return INITIAL_STAFF_DIRECTORY;
  }
}

export function saveLocalStaffDirectory(list) {
  try {
    localStorage.setItem(STORAGE_STAFF_DIRECTORY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed saving staff directory locally', e);
  }
}

export async function fetchStaffDirectory() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('staff_directory')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && Array.isArray(data) && data.length > 0) {
        saveLocalStaffDirectory(data);
        return data;
      }
    } catch (err) {
      console.warn('Supabase fetchStaffDirectory notice:', err.message);
    }
  }
  return getLocalStaffDirectory();
}

export async function saveStaffMember(member) {
  const memberId = member.id || `staff-${Date.now()}`;
  const nowIso = new Date().toISOString();
  const record = {
    ...member,
    id: memberId,
    name: (member.name || '').trim(),
    phone: (member.phone || '').trim().replace(/\D/g, ''),
    role: (member.role || 'Rider').trim(),
    age: Number(member.age) || 25,
    monthly_salary: Number(member.monthly_salary) || 15000,
    photo_url: member.photo_url || '',
    id_proof_url: member.id_proof_url || '',
    id_proof_type: member.id_proof_type || 'Aadhaar Card',
    status: member.status || 'active',
    joining_date: member.joining_date || new Date().toISOString().split('T')[0],
    updated_at: nowIso
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('staff_directory')
        .upsert([record])
        .select()
        .single();
      if (!error && data) {
        const local = getLocalStaffDirectory();
        const exists = local.some((m) => m.id === data.id);
        const updated = exists ? local.map((m) => (m.id === data.id ? data : m)) : [data, ...local];
        saveLocalStaffDirectory(updated);
        return data;
      }
    } catch (err) {
      console.warn('Supabase saveStaffMember fallback:', err.message);
    }
  }

  const local = getLocalStaffDirectory();
  const exists = local.some((m) => m.id === record.id);
  const updated = exists ? local.map((m) => (m.id === record.id ? record : m)) : [record, ...local];
  saveLocalStaffDirectory(updated);
  return record;
}

export async function deleteStaffDirectoryMember(id) {
  if (isSupabaseConfigured) {
    try {
      await supabase.from('staff_directory').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase deleteStaffDirectoryMember notice:', err.message);
    }
  }
  const local = getLocalStaffDirectory();
  const updated = local.filter((m) => m.id !== id);
  saveLocalStaffDirectory(updated);
  return true;
}

// ------------------------------------------
// Staff Advances
// ------------------------------------------
export function getLocalStaffAdvances() {
  try {
    const raw = localStorage.getItem(STORAGE_STAFF_ADVANCES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveLocalStaffAdvances(advances) {
  try {
    localStorage.setItem(STORAGE_STAFF_ADVANCES, JSON.stringify(advances));
  } catch (e) {
    console.error('Failed saving staff advances', e);
  }
}

export async function fetchStaffAdvances(staffId, monthStr) {
  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('staff_advances').select('*').order('date', { ascending: false });
      if (staffId) {
        query = query.eq('staff_id', staffId);
      }
      if (monthStr) {
        // monthStr is 'YYYY-MM'
        const start = `${monthStr}-01`;
        const end = `${monthStr}-31T23:59:59`;
        query = query.gte('date', start).lte('date', end);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        return data;
      }
    } catch (err) {
      console.warn('Supabase fetchStaffAdvances notice:', err.message);
    }
  }

  const all = getLocalStaffAdvances();
  return all.filter((adv) => {
    if (staffId && adv.staff_id !== staffId) return false;
    if (monthStr && !adv.date.startsWith(monthStr)) return false;
    return true;
  });
}

export async function createStaffAdvance(advanceData) {
  const newAdvance = {
    id: advanceData.id || `adv-${Date.now()}`,
    staff_id: advanceData.staff_id,
    amount: Number(advanceData.amount) || 0,
    payment_mode: advanceData.payment_mode || 'Cash',
    remarks: (advanceData.remarks || '').trim(),
    date: advanceData.date || new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('staff_advances')
        .insert([newAdvance])
        .select()
        .single();
      if (!error && data) {
        const local = getLocalStaffAdvances();
        saveLocalStaffAdvances([data, ...local]);
        return data;
      }
    } catch (err) {
      console.warn('Supabase createStaffAdvance fallback:', err.message);
    }
  }

  const local = getLocalStaffAdvances();
  const updated = [newAdvance, ...local];
  saveLocalStaffAdvances(updated);
  return newAdvance;
}

export async function deleteStaffAdvance(id) {
  if (isSupabaseConfigured) {
    try {
      await supabase.from('staff_advances').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase deleteStaffAdvance notice:', err.message);
    }
  }
  const local = getLocalStaffAdvances();
  const updated = local.filter((a) => a.id !== id);
  saveLocalStaffAdvances(updated);
  return true;
}

// ------------------------------------------
// Staff Attendance
// ------------------------------------------
export function getLocalStaffAttendance() {
  try {
    const raw = localStorage.getItem(STORAGE_STAFF_ATTENDANCE);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveLocalStaffAttendance(map) {
  try {
    localStorage.setItem(STORAGE_STAFF_ATTENDANCE, JSON.stringify(map));
  } catch (e) {
    console.error('Failed saving staff attendance locally', e);
  }
}

export async function fetchStaffAttendanceMonth(staffId, year, month) {
  // month is 1-indexed (1 to 12)
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('staff_id', staffId)
        .gte('date', `${monthStr}-01`)
        .lte('date', `${monthStr}-31`);
      if (!error && Array.isArray(data) && data.length > 0) {
        // Return as key-value map of date -> status
        const map = {};
        data.forEach((rec) => {
          map[rec.date] = rec.status;
        });
        return map;
      }
    } catch (err) {
      console.warn('Supabase fetchStaffAttendanceMonth notice:', err.message);
    }
  }

  const localMap = getLocalStaffAttendance();
  const staffRecords = localMap[staffId] || {};
  const result = {};
  Object.keys(staffRecords).forEach((d) => {
    if (d.startsWith(monthStr)) {
      result[d] = staffRecords[d];
    }
  });

  // If completely empty for current month, populate reasonable mock attendance so calendar looks rich and realistic
  if (Object.keys(result).length === 0) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = (year === currentYear && month === currentMonth) ? now.getDate() : 28;

    for (let d = 1; d <= currentDay; d++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, d).getDay();
      if (dayOfWeek === 0) {
        // Sunday
        result[dateKey] = 'present'; // Water distribution often operates or gets paid
      } else if (d % 9 === 0) {
        result[dateKey] = 'absent';
      } else if (d % 6 === 0) {
        result[dateKey] = 'half_day';
      } else {
        result[dateKey] = 'present';
      }
    }
    // Save to localMap
    localMap[staffId] = { ...(localMap[staffId] || {}), ...result };
    saveLocalStaffAttendance(localMap);
  }

  return result;
}

export async function recordStaffAttendanceDay(staffId, dateStr, status, notes = '') {
  if (isSupabaseConfigured) {
    try {
      await supabase.from('staff_attendance').upsert([{
        staff_id: staffId,
        date: dateStr,
        status,
        notes,
        updated_at: new Date().toISOString()
      }], { onConflict: 'staff_id,date' });
    } catch (err) {
      console.warn('Supabase recordStaffAttendanceDay notice:', err.message);
    }
  }

  const localMap = getLocalStaffAttendance();
  if (!localMap[staffId]) {
    localMap[staffId] = {};
  }
  localMap[staffId][dateStr] = status;
  saveLocalStaffAttendance(localMap);
  return { staffId, dateStr, status };
}

// ==========================================
// INVENTORY & STOCK MASTER (inventory_items)
// ==========================================
export const STORAGE_INVENTORY_ITEMS = 'jal_jivan_inventory_items';

export const INITIAL_INVENTORY_ITEMS = [
  {
    id: 'inv_item_1',
    barcode: '8901234001015',
    item_name: 'Bisleri 20L Polycarbonate Water Can (Refill)',
    category: 'Packaged Water',
    mrp: 90,
    cost_price: 45,
    selling_price: 80,
    stock_qty: 150,
    min_stock_level: 25,
    hsn_code: '2201',
    gst_pct: 18,
    unit: '20L Can'
  },
  {
    id: 'inv_item_2',
    barcode: '8901234002029',
    item_name: 'Aquafina 1L Mineral Water Bottle (Pack of 12)',
    category: 'Packaged Water',
    mrp: 240,
    cost_price: 130,
    selling_price: 210,
    stock_qty: 40,
    min_stock_level: 15,
    hsn_code: '2201',
    gst_pct: 18,
    unit: 'Box'
  },
  {
    id: 'inv_item_3',
    barcode: '8901234003033',
    item_name: 'Dispenser Manual Hand Pump Tap',
    category: 'Accessories',
    mrp: 120,
    cost_price: 65,
    selling_price: 100,
    stock_qty: 8,
    min_stock_level: 10,
    hsn_code: '3926',
    gst_pct: 18,
    unit: 'Piece'
  },
  {
    id: 'inv_item_4',
    barcode: '8901234004047',
    item_name: 'Kinley 500ml Soda (Pack of 24)',
    category: 'Beverages',
    mrp: 360,
    cost_price: 220,
    selling_price: 320,
    stock_qty: 0,
    min_stock_level: 12,
    hsn_code: '2202',
    gst_pct: 28,
    unit: 'Crate'
  }
];

export function getLocalInventoryItems() {
  try {
    const saved = localStorage.getItem(STORAGE_INVENTORY_ITEMS);
    if (!saved) {
      localStorage.setItem(STORAGE_INVENTORY_ITEMS, JSON.stringify(INITIAL_INVENTORY_ITEMS));
      return INITIAL_INVENTORY_ITEMS;
    }
    return JSON.parse(saved);
  } catch (e) {
    return INITIAL_INVENTORY_ITEMS;
  }
}

export function saveLocalInventoryItems(items) {
  try {
    localStorage.setItem(STORAGE_INVENTORY_ITEMS, JSON.stringify(items || []));
  } catch (e) {
    console.error('Failed to save inventory items locally:', e);
  }
}

export async function fetchInventoryItems() {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('item_name', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        saveLocalInventoryItems(data);
        return data;
      }
      if (error) {
        console.warn('Supabase fetchInventoryItems notice:', error.message);
      }
    } catch (err) {
      console.warn('fetchInventoryItems exception:', err.message);
    }
  }
  return getLocalInventoryItems();
}

export async function saveInventoryItem(item) {
  const isUuid = item.id && /^[0-9a-f-]{36}$/i.test(item.id);
  const payload = {
    barcode: (item.barcode || '').toString().trim() || null,
    item_name: (item.item_name || 'New Item').toString().trim(),
    category: (item.category || 'General FMCG').toString().trim(),
    mrp: Number(item.mrp) || 0,
    cost_price: Number(item.cost_price ?? item.purchase_price) || 0,
    selling_price: Number(item.selling_price) || 0,
    stock_qty: Number(item.stock_qty) || 0,
    min_stock_level: Number(item.min_stock_level) || 10,
    hsn_code: (item.hsn_code || '').toString().trim() || null,
    gst_pct: Number(item.gst_pct) || 18,
    unit: item.unit || 'Unit',
    updated_at: new Date().toISOString()
  };

  let savedRecord = null;
  if (isSupabaseConfigured && supabase) {
    try {
      if (isUuid) {
        const { data, error } = await supabase
          .from('inventory_items')
          .update(payload)
          .eq('id', item.id)
          .select()
          .maybeSingle();
        if (!error && data) savedRecord = data;
      } else {
        const { data, error } = await supabase
          .from('inventory_items')
          .insert(payload)
          .select()
          .single();
        if (!error && data) savedRecord = data;
      }
    } catch (e) {
      console.warn('saveInventoryItem supabase exception:', e.message);
    }
  }

  if (!savedRecord) {
    savedRecord = {
      ...payload,
      id: item.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      created_at: new Date().toISOString()
    };
  }

  const existing = getLocalInventoryItems();
  const filtered = existing.filter((it) => it.id !== savedRecord.id);
  saveLocalInventoryItems([savedRecord, ...filtered]);
  return savedRecord;
}

export async function deleteInventoryItem(id) {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('inventory_items').delete().eq('id', id);
    } catch (e) {
      console.warn('deleteInventoryItem supabase warning:', e);
    }
  }
  const existing = getLocalInventoryItems();
  saveLocalInventoryItems(existing.filter((it) => it.id !== id));
  return true;
}

// Automatic stock sync on purchase invoice commit (Requirements 5 & 6)
export async function syncInventoryFromPurchaseItems(itemsData = []) {
  if (!Array.isArray(itemsData) || itemsData.length === 0) return [];
  const currentInventory = await fetchInventoryItems();
  const updatedList = [...currentInventory];

  for (const inwardItem of itemsData) {
    const rawBarcode = (inwardItem.barcode || '').toString().trim();
    const rawName = (inwardItem.item_name || '').toString().trim();
    const inwardQty = Number(inwardItem.quantity) || 0;
    const purchaseRate = Number(inwardItem.purchase_price ?? inwardItem.price_before_gst) || 0;
    const mrp = Number(inwardItem.mrp) || 0;
    const gstPct = Number(inwardItem.gst_pct ?? inwardItem.gst_rate) || 18;
    const hsn = (inwardItem.hsn_code || '').toString().trim();

    // Match by barcode, or fallback to exact/fuzzy name match
    let matchIndex = -1;
    if (rawBarcode) {
      matchIndex = updatedList.findIndex((it) => it.barcode && it.barcode.trim() === rawBarcode);
    }
    if (matchIndex === -1 && rawName) {
      matchIndex = updatedList.findIndex(
        (it) => it.item_name.toLowerCase().trim() === rawName.toLowerCase()
      );
    }

    if (matchIndex >= 0) {
      // Increment stock, update latest purchase rate & mrp
      const existing = updatedList[matchIndex];
      const newStock = Number((Number(existing.stock_qty || 0) + inwardQty).toFixed(2));
      const updatedItem = {
        ...existing,
        stock_qty: newStock,
        cost_price: purchaseRate > 0 ? purchaseRate : existing.cost_price,
        mrp: mrp > 0 ? mrp : existing.mrp,
        barcode: existing.barcode || rawBarcode || null,
        hsn_code: existing.hsn_code || hsn || null,
        gst_pct: gstPct || existing.gst_pct,
        updated_at: new Date().toISOString()
      };
      updatedList[matchIndex] = updatedItem;

      // Update in Supabase
      if (isSupabaseConfigured && supabase && existing.id && !existing.id.startsWith('item_')) {
        try {
          await supabase
            .from('inventory_items')
            .update({
              stock_qty: updatedItem.stock_qty,
              cost_price: updatedItem.cost_price,
              mrp: updatedItem.mrp,
              barcode: updatedItem.barcode,
              updated_at: updatedItem.updated_at
            })
            .eq('id', existing.id);
        } catch (e) {}
      }
    } else {
      // Create new inventory item
      const newItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        barcode: rawBarcode || null,
        item_name: rawName || 'Inward Item',
        category: 'General FMCG',
        mrp: mrp || Number((purchaseRate * 1.25).toFixed(2)),
        cost_price: purchaseRate,
        selling_price: mrp || Number((purchaseRate * 1.2).toFixed(2)),
        stock_qty: inwardQty,
        min_stock_level: 10,
        hsn_code: hsn || null,
        gst_pct: gstPct,
        unit: 'Unit',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase
            .from('inventory_items')
            .insert({
              barcode: newItem.barcode,
              item_name: newItem.item_name,
              category: newItem.category,
              mrp: newItem.mrp,
              cost_price: newItem.cost_price,
              selling_price: newItem.selling_price,
              stock_qty: newItem.stock_qty,
              min_stock_level: newItem.min_stock_level,
              hsn_code: newItem.hsn_code,
              gst_pct: newItem.gst_pct,
              unit: newItem.unit
            })
            .select()
            .single();
          if (data) newItem.id = data.id;
        } catch (e) {}
      }

      updatedList.push(newItem);
    }
  }

  saveLocalInventoryItems(updatedList);
  return updatedList;
}

// Decrement inventory stock on checkout/billing
export async function decrementInventoryStock(soldItems = []) {
  if (!Array.isArray(soldItems) || soldItems.length === 0) return;
  const currentInventory = await fetchInventoryItems();
  const updatedList = [...currentInventory];

  for (const sold of soldItems) {
    const rawBarcode = (sold.barcode || '').toString().trim();
    const rawName = (sold.item_name || sold.name || '').toString().trim();
    const qtySold = Number(sold.quantity ?? sold.qty) || 1;

    let matchIndex = -1;
    if (rawBarcode) {
      matchIndex = updatedList.findIndex((it) => it.barcode && it.barcode.trim() === rawBarcode);
    }
    if (matchIndex === -1 && rawName) {
      matchIndex = updatedList.findIndex((it) => it.item_name.toLowerCase().trim() === rawName.toLowerCase());
    }

    if (matchIndex >= 0) {
      const existing = updatedList[matchIndex];
      const newStock = Math.max(0, Number((Number(existing.stock_qty || 0) - qtySold).toFixed(2)));
      existing.stock_qty = newStock;
      existing.updated_at = new Date().toISOString();

      if (isSupabaseConfigured && supabase && existing.id && !existing.id.startsWith('item_')) {
        try {
          await supabase.from('inventory_items').update({ stock_qty: newStock }).eq('id', existing.id);
        } catch (e) {}
      }
    }
  }

  saveLocalInventoryItems(updatedList);
}

// Universal Barcode Assignment & Quick Commit (Requirement 4)
export async function assignItemBarcode(barcode, purchaseItemId = null, inventoryItemId = null) {
  const cleanBarcode = (barcode || '').toString().trim();
  if (!cleanBarcode) return false;

  // 1. Update purchase_items table if purchaseItemId provided
  if (purchaseItemId && isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('purchase_items')
        .update({ barcode: cleanBarcode })
        .eq('id', purchaseItemId);
    } catch (e) {
      console.warn('Failed to update purchase_item barcode in Supabase:', e);
    }
  }

  // 2. Update inventory_items if inventoryItemId provided
  if (inventoryItemId) {
    await saveInventoryItem({ id: inventoryItemId, barcode: cleanBarcode });
  }

  // Update local purchase history cache if matched
  try {
    const invoices = getLocalPurchaseInvoices();
    let changed = false;
    for (const inv of invoices) {
      if (Array.isArray(inv.purchase_items)) {
        for (const it of inv.purchase_items) {
          if (it.id === purchaseItemId) {
            it.barcode = cleanBarcode;
            changed = true;
          }
        }
      }
    }
    if (changed) saveLocalPurchaseInvoices(invoices);
  } catch (e) {}

  return true;
}

// ==========================================
// DEBIT NOTES / SALE RETURN (debit_notes)
// ==========================================
const STORAGE_DEBIT_NOTES = 'jal_jivan_debit_notes';

export function getLocalDebitNotes() {
  try {
    const saved = localStorage.getItem(STORAGE_DEBIT_NOTES);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

export function saveLocalDebitNotes(notes) {
  try {
    localStorage.setItem(STORAGE_DEBIT_NOTES, JSON.stringify(notes || []));
  } catch (e) {
    console.error('Failed to save debit notes locally:', e);
  }
}

export async function fetchDebitNotes() {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('debit_notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        saveLocalDebitNotes(data);
        return data;
      }
    } catch (e) {}
  }
  return getLocalDebitNotes();
}

export async function saveDebitNote(debitNote) {
  const noteId = debitNote.id || `DN-${Date.now().toString().slice(-6)}`;
  const payload = {
    id: noteId,
    vendor_id: debitNote.vendor_id || null,
    vendor_name: debitNote.vendor_name || 'Vendor',
    original_invoice_no: debitNote.original_invoice_no || '',
    return_reason: debitNote.return_reason || 'Expiry Return',
    items: debitNote.items || [],
    total_taxable: Number(debitNote.total_taxable) || 0,
    total_tax: Number(debitNote.total_tax) || 0,
    grand_total: Number(debitNote.grand_total) || 0,
    status: debitNote.status || 'issued',
    notes: debitNote.notes || ''
  };

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('debit_notes').insert(payload);
    } catch (e) {
      console.warn('saveDebitNote supabase exception:', e);
    }
  }

  const existing = getLocalDebitNotes();
  const updated = [payload, ...existing.filter((n) => n.id !== noteId)];
  saveLocalDebitNotes(updated);
  return payload;
}
