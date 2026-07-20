-- Fix schema drift surfaced while testing guest creation.
--
-- 1. guestToRow (src/lib/mappers.ts) writes document_type and the vehicle
--    fields, but 20260302120000 only added the vehicle columns to bookings.
--    Creating a guest failed with 400 / PGRST204.
-- 2. Booking charges audit with entity_type 'booking_charge'
--    (src/hooks/useCreateBookingCharge.ts), a value the original CHECK
--    constraint in 20260213120000 never allowed.

ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS document_type TEXT;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS has_vehicle BOOLEAN DEFAULT FALSE;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS vehicle_description TEXT;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS license_plate TEXT;

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_entity_type_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_entity_type_check
    CHECK (entity_type IN (
        'booking', 'guest', 'room', 'payment', 'invoice',
        'housekeeping_task', 'rate', 'expense', 'hotel_settings',
        'booking_charge'
    ));

-- PostgREST caches the schema; without this the new columns keep 400ing.
NOTIFY pgrst, 'reload schema';
