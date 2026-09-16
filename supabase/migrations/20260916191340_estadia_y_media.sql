-- Estadía y media: una o más noches con un medio día adicional al final.
-- El precio es noches × tarifa + 50% de la tarifa (mismo ratio que media estadía).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS half_day_add BOOLEAN NOT NULL DEFAULT FALSE;
