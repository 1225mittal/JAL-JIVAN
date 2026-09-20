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

