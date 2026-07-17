-- "FIJO DEL DÍA": the fixed cash float kept in the register, subtracted from
-- cash on the daily close (Planilla de CIERRE). Configurable, defaults to 0.
ALTER TABLE public.hotel_settings
  ADD COLUMN IF NOT EXISTS daily_cash_float NUMERIC NOT NULL DEFAULT 0;
