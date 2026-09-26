-- =========================================================================
-- JAL-JIVAN DELIVERY & DISPATCH SUPABASE SCHEMA
-- Copy and paste this into Supabase SQL Editor to create tables & storage.
-- =========================================================================

-- 1. Create Drivers Table
CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    pin TEXT NOT NULL, -- 4-digit PIN
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

-- 2. Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    order_number TEXT NOT NULL UNIQUE,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    address TEXT NOT NULL,
    landmark TEXT,
    customer_phone TEXT, -- Admin only; strictly hidden from driver portal
    assigned_driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    driver_name TEXT,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Out for Delivery', 'Delivered', 'Cancelled')),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    payment_method TEXT CHECK (payment_method IN ('Cash', 'UPI', 'Credit')),
    payment_proof_url TEXT,
    delivery_proof_url TEXT,
    delivered_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow public read and write access for this dispatch web app
DROP POLICY IF EXISTS "Public access to drivers" ON public.drivers;
CREATE POLICY "Public access to drivers" ON public.drivers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access to orders" ON public.orders;
CREATE POLICY "Public access to orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

-- 4. Create Storage Bucket for 'delivery-proofs'
-- Run this block to ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('delivery-proofs', 'delivery-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policy: Allow public upload and access to delivery proofs
DROP POLICY IF EXISTS "Allow public uploads to delivery-proofs" ON storage.objects;
CREATE POLICY "Allow public uploads to delivery-proofs" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'delivery-proofs');

DROP POLICY IF EXISTS "Allow public select on delivery-proofs" ON storage.objects;
CREATE POLICY "Allow public select on delivery-proofs" ON storage.objects 
FOR SELECT USING (bucket_id = 'delivery-proofs');

-- 5. Create Store Hub Settings Table (Single row for main store geofence)
CREATE TABLE IF NOT EXISTS public.store_settings (
    id TEXT PRIMARY KEY DEFAULT 'main_store',
    store_name TEXT NOT NULL DEFAULT 'Store Central Hub (Ghaziabad)',
    latitude DOUBLE PRECISION NOT NULL DEFAULT 28.6692,
    longitude DOUBLE PRECISION NOT NULL DEFAULT 77.4538,
    radius_meters INTEGER NOT NULL DEFAULT 150,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to store_settings" ON public.store_settings;
CREATE POLICY "Public access to store_settings" ON public.store_settings FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.store_settings (id, store_name, latitude, longitude, radius_meters)
VALUES ('main_store', 'Store Central Hub (Ghaziabad)', 28.6692, 77.4538, 150)
ON CONFLICT (id) DO NOTHING;

-- 6. Create Live Driver Locations Table
CREATE TABLE IF NOT EXISTS public.driver_locations (
    driver_id UUID PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
    driver_name TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to driver_locations" ON public.driver_locations;
CREATE POLICY "Public access to driver_locations" ON public.driver_locations FOR ALL USING (true) WITH CHECK (true);

-- 7. Add items JSONB column to Orders if not already present
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- 8. Create Address Book Table
CREATE TABLE IF NOT EXISTS public.address_book (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT,
    phone TEXT,
    address TEXT NOT NULL,
    landmark TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION
);

ALTER TABLE public.address_book ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to address_book" ON public.address_book;
CREATE POLICY "Public access to address_book" ON public.address_book FOR ALL USING (true) WITH CHECK (true);

-- 9. Create Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    unit TEXT NOT NULL DEFAULT '20L Can',
    image_url TEXT,
    in_stock BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access to products" ON public.products;
CREATE POLICY "Public access to products" ON public.products FOR ALL USING (true) WITH CHECK (true);

-- 10. Create Storage Bucket for 'product-images'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public uploads to product-images" ON storage.objects;
CREATE POLICY "Allow public uploads to product-images" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Allow public select on product-images" ON storage.objects;
CREATE POLICY "Allow public select on product-images" ON storage.objects 
FOR SELECT USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Allow public update on product-images" ON storage.objects;
CREATE POLICY "Allow public update on product-images" ON storage.objects 
FOR UPDATE USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Allow public delete on product-images" ON storage.objects;
CREATE POLICY "Allow public delete on product-images" ON storage.objects 
FOR DELETE USING (bucket_id = 'product-images');

-- 11. Add slip_image_url column to Orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS slip_image_url TEXT;

-- 12. Create Storage Bucket for 'order-slips' (Handwritten paper notes & invoices)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('order-slips', 'order-slips', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public uploads to order-slips" ON storage.objects;
CREATE POLICY "Allow public uploads to order-slips" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'order-slips');

DROP POLICY IF EXISTS "Allow public select on order-slips" ON storage.objects;
CREATE POLICY "Allow public select on order-slips" ON storage.objects 
FOR SELECT USING (bucket_id = 'order-slips');

DROP POLICY IF EXISTS "Allow public update on order-slips" ON storage.objects;
CREATE POLICY "Allow public update on order-slips" ON storage.objects 
FOR UPDATE USING (bucket_id = 'order-slips');

DROP POLICY IF EXISTS "Allow public delete on order-slips" ON storage.objects;
CREATE POLICY "Allow public delete on order-slips" ON storage.objects 
FOR DELETE USING (bucket_id = 'order-slips');

-- 13. Create Damages Tracking Table (with safe Realtime check)
CREATE TABLE IF NOT EXISTS public.product_damages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category TEXT DEFAULT 'Water Jar',
  reported_by TEXT DEFAULT 'Admin',
  reason TEXT,
  estimated_loss NUMERIC(10, 2) DEFAULT 0.00,
  photo_url TEXT,
  status TEXT DEFAULT 'pending'
);

-- Safely add to realtime publication without throwing duplicate error
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'product_damages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.product_damages;
  END IF;
END $$;

-- RLS policies for product_damages
ALTER TABLE public.product_damages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read damages" ON public.product_damages;
DROP POLICY IF EXISTS "Allow public insert damages" ON public.product_damages;
DROP POLICY IF EXISTS "Allow public update damages" ON public.product_damages;
DROP POLICY IF EXISTS "Allow public delete damages" ON public.product_damages;

CREATE POLICY "Allow public read damages" ON public.product_damages FOR SELECT USING (true);
CREATE POLICY "Allow public insert damages" ON public.product_damages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update damages" ON public.product_damages FOR UPDATE USING (true);
CREATE POLICY "Allow public delete damages" ON public.product_damages FOR DELETE USING (true);

-- 14. Distributors & Companies Directory Table
CREATE TABLE IF NOT EXISTS public.distributors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    distributor_name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    salesman_name TEXT DEFAULT '',
    salesman_phone TEXT DEFAULT '',
    visit_day TEXT DEFAULT 'Monday',
    return_window_rule TEXT DEFAULT 'Anytime',
    notes TEXT DEFAULT ''
);

-- 15. Damage & Expiry Tracking Items Table
CREATE TABLE IF NOT EXISTS public.damage_expiry_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    product_name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    distributor_id UUID REFERENCES public.distributors(id) ON DELETE SET NULL,
    distributor_name TEXT NOT NULL,
    mrp NUMERIC(10, 2) DEFAULT 0.00,
    net_weight_volume TEXT DEFAULT '',
    batch_no TEXT DEFAULT '',
    mfg_date TEXT DEFAULT '',
    expiry_date TEXT DEFAULT '',
    quantity_pcs INTEGER NOT NULL DEFAULT 1,
    rack_number TEXT NOT NULL,
    damage_type TEXT DEFAULT 'Damage',
    front_photo_url TEXT DEFAULT '',
    back_photo_url TEXT DEFAULT '',
    return_slip_photo_url TEXT DEFAULT '',
    
    is_slip_made BOOLEAN DEFAULT FALSE,
    slip_made_at TIMESTAMP WITH TIME ZONE,
    
    is_pickup_done BOOLEAN DEFAULT FALSE,
    pickup_done_at TIMESTAMP WITH TIME ZONE,
    
    is_credit_received BOOLEAN DEFAULT FALSE,
    credit_received_at TIMESTAMP WITH TIME ZONE,
    
    current_status TEXT DEFAULT 'in_godown'
);

-- 16. RLS Permissions for directory and damage items
ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damage_expiry_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access distributors" ON public.distributors;
CREATE POLICY "Public access distributors" ON public.distributors FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access damage_expiry_items" ON public.damage_expiry_items;
CREATE POLICY "Public access damage_expiry_items" ON public.damage_expiry_items FOR ALL USING (true) WITH CHECK (true);

-- 17. Multi-Division & FMCG Monthly Claim Cycle Schema Migration
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS divisions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS claim_window_preset TEXT DEFAULT '1st - 10th';
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS claim_window_start INTEGER DEFAULT 1;
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS claim_window_end INTEGER DEFAULT 10;
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS return_eligibility JSONB DEFAULT '["Expired Stock", "Damage / Breakage / Leakage", "Consumer Complaint"]'::jsonb;
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS settlement_mode TEXT DEFAULT 'Credit Note (CN)';

-- 18. Driver / Staff Attendance (Geofencing Store Hub)
CREATE TABLE IF NOT EXISTS public.driver_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
    check_in_lat DOUBLE PRECISION,
    check_in_lng DOUBLE PRECISION,
    check_out_lat DOUBLE PRECISION,
    check_out_lng DOUBLE PRECISION,
    punched_out_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'present'
);

-- Ensure columns exist if table was already created
ALTER TABLE public.driver_attendance ADD COLUMN IF NOT EXISTS check_out_lat DOUBLE PRECISION;
ALTER TABLE public.driver_attendance ADD COLUMN IF NOT EXISTS check_out_lng DOUBLE PRECISION;
ALTER TABLE public.driver_attendance ADD COLUMN IF NOT EXISTS punched_out_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.driver_attendance ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'present';

ALTER TABLE public.driver_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access driver_attendance" ON public.driver_attendance;
CREATE POLICY "Public access driver_attendance" ON public.driver_attendance FOR ALL USING (true) WITH CHECK (true);

-- 19. Purchase Invoices & Items (Inward Stock Management)
CREATE TABLE IF NOT EXISTS public.purchase_invoices (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    invoice_number TEXT,
    invoice_date DATE,
    seller_name TEXT NOT NULL,
    seller_gst TEXT,
    seller_fssai TEXT,
    seller_contact TEXT,
    seller_address TEXT,
    salesman_name TEXT,
    salesman_number TEXT,
    bank_name TEXT,
    account_no TEXT,
    ifsc TEXT,
    taxable_amount NUMERIC(12, 2) DEFAULT 0.00,
    total_tax NUMERIC(12, 2) DEFAULT 0.00,
    grand_total NUMERIC(12, 2) DEFAULT 0.00,
    bill_image_url TEXT,
    status TEXT DEFAULT 'verified',
    raw_ocr_data JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    barcode TEXT,
    item_name TEXT NOT NULL,
    hsn_code TEXT,
    quantity NUMERIC(10, 2) DEFAULT 1,
    mrp NUMERIC(10, 2) DEFAULT 0.00,
    purchase_price NUMERIC(10, 2) DEFAULT 0.00,
    price_before_gst NUMERIC(10, 2) DEFAULT 0.00,
    gst_rate NUMERIC(5, 2) DEFAULT 0.00,
    cess NUMERIC(10, 2) DEFAULT 0.00,
    discount NUMERIC(10, 2) DEFAULT 0.00,
    price_after_gst NUMERIC(10, 2) DEFAULT 0.00
);

ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access purchase_invoices" ON public.purchase_invoices;
CREATE POLICY "Public access purchase_invoices" ON public.purchase_invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access purchase_items" ON public.purchase_items;
CREATE POLICY "Public access purchase_items" ON public.purchase_items FOR ALL USING (true) WITH CHECK (true);
