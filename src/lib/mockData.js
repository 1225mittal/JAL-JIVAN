const now = Date.now();
const minutesAgo = (m) => new Date(now - m * 60000).toISOString();

export const initialDrivers = [];

export const initialStoreSettings = {
  id: 'main_store',
  store_name: 'Store Central Hub (Ghaziabad)',
  latitude: 28.6692,
  longitude: 77.4538,
  radius_meters: 150,
  updated_at: new Date().toISOString()
};

export const initialDriverLocations = [];

export const initialOrders = [];

export const initialProducts = [
  {
    id: 'prod-001',
    name: '20L RO Purified Water Jar',
    price: 50.0,
    unit: '20L Can',
    image_url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=300&auto=format&fit=crop&q=80',
    in_stock: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-002',
    name: '20L Premium Mineral Water Can',
    price: 90.0,
    unit: '20L Can',
    image_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80',
    in_stock: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-003',
    name: '1L Packaged Water (Box of 12)',
    price: 180.0,
    unit: '12x 1L Pack',
    image_url: 'https://images.unsplash.com/photo-1564419320461-6870880221ad?w=300&auto=format&fit=crop&q=80',
    in_stock: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-004',
    name: '500ml Bottled Water (Box of 24)',
    price: 240.0,
    unit: '24x 500ml Pack',
    image_url: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=300&auto=format&fit=crop&q=80',
    in_stock: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-005',
    name: 'Manual Water Dispenser Hand Pump',
    price: 120.0,
    unit: '1 Piece',
    image_url: 'https://images.unsplash.com/photo-1589365278144-c9e705f843ba?w=300&auto=format&fit=crop&q=80',
    in_stock: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-006',
    name: 'Countertop Water Jar Tap & Stand',
    price: 280.0,
    unit: '1 Set',
    image_url: 'https://images.unsplash.com/photo-1584905066893-7d5c142ba4e1?w=300&auto=format&fit=crop&q=80',
    in_stock: true,
    created_at: new Date().toISOString()
  }
];

export const initialAddressBook = [];

export const initialDamages = [
  {
    id: 'dmg-101',
    item_name: '20L RO Purified Water Jar',
    quantity: 2,
    damage_category: 'Cracked Body',
    driver_name: 'Rahul Sharma',
    driver_id: 'drv-01',
    reason: 'Fell from delivery bike rear rack during transit over speed bump',
    estimated_value: 300,
    photo_url: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=500&auto=format&fit=crop&q=80',
    status: 'Pending',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'dmg-102',
    item_name: 'Countertop Water Jar Tap & Stand',
    quantity: 1,
    damage_category: 'Tap Leakage',
    driver_name: 'Amit Kumar',
    driver_id: 'drv-02',
    reason: 'Valve thread stripped upon customer unboxing, continuous drip',
    estimated_value: 280,
    photo_url: 'https://images.unsplash.com/photo-1584905066893-7d5c142ba4e1?w=500&auto=format&fit=crop&q=80',
    status: 'Replaced',
    created_at: new Date(Date.now() - 3600000 * 18).toISOString()
  },
  {
    id: 'dmg-103',
    item_name: '20L Premium Mineral Water Can',
    quantity: 3,
    damage_category: 'Broken Neck',
    driver_name: 'Sunil Yadav',
    driver_id: 'drv-03',
    reason: 'Crushed under heavy crate stacking in warehouse unloading',
    estimated_value: 450,
    photo_url: '',
    status: 'Written Off',
    created_at: new Date(Date.now() - 3600000 * 36).toISOString()
  }
];

