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
