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

