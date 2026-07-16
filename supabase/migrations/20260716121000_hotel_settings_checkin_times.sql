-- Persist check-in/check-out times configured in Settings.
-- These fields existed in the frontend (HotelSettings.checkInTime/checkOutTime)
-- but had no DB column, so saves silently no-oped.
-- Defaults match the app's form defaults (Settings.tsx: 14:00 / 11:00).
ALTER TABLE public.hotel_settings
  ADD COLUMN IF NOT EXISTS check_in_time TEXT NOT NULL DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS check_out_time TEXT NOT NULL DEFAULT '11:00';
