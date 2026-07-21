-- "COCHERAS": cuántos espacios de estacionamiento tiene el hotel.
-- Con 0 (el default) el control queda apagado y no se muestra en ningún lado,
-- así se puede configurar cuando se sepa el número real.
ALTER TABLE public.hotel_settings
  ADD COLUMN IF NOT EXISTS parking_spots INTEGER NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
