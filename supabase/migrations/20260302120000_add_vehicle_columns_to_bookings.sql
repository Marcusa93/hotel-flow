-- Add vehicle tracking columns to bookings table
-- For hotel parking/garage management
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS has_vehicle BOOLEAN DEFAULT FALSE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS vehicle_description TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS license_plate TEXT;
