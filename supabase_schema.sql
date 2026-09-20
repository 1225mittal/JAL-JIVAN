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

