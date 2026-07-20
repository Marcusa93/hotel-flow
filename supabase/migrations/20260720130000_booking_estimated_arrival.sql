-- Estimated arrival time per booking.
--
-- hotel_settings.check_in_time holds the hotel-wide policy ("desde las 14:00"),
-- but there was nowhere to record that a given guest announced they arrive at
-- 22:30. check_in_date is a DATE column, so it carries no time at all.
--
-- Stored as TEXT 'HH:MM' to match hotel_settings.check_in_time and to avoid
-- timezone coercion — this is a wall-clock time at the hotel, not an instant.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS estimated_arrival_time TEXT;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_estimated_arrival_time_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_estimated_arrival_time_check
  CHECK (estimated_arrival_time IS NULL OR estimated_arrival_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

NOTIFY pgrst, 'reload schema';
