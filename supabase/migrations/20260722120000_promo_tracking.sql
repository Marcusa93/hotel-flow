-- Seguimiento de promociones aplicadas.
--
-- Hasta ahora la única huella de una promo era una línea de texto pegada al
-- final de bookings.notes ("[Promoción: X (CODE)]") y payments.comment. Servía
-- para leerla de a una, no para contar usos ni sumar cuánto descuento se
-- otorgó. Los números ya se calculaban al reservar y se descartaban.
--
-- rate_id queda con ON DELETE SET NULL a propósito: si se borra la promoción,
-- la reserva no se toca — el descuento se dio igual y la plata ya se cobró.
-- Por eso también se guarda promo_code y promo_label como texto plano: son el
-- registro de lo que pasó ese día, no una referencia viva a la tarifa actual.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS rate_id UUID REFERENCES public.rates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promo_code TEXT,
  ADD COLUMN IF NOT EXISTS promo_label TEXT,
  -- Lo que la estadía habría costado a tarifa base, para poder medir el impacto
  ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS rate_id UUID REFERENCES public.rates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promo_code TEXT,
  ADD COLUMN IF NOT EXISTS promo_label TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2);

-- El reporte agrupa por promoción; sin esto es un scan completo de la tabla.
-- Parcial porque la enorme mayoría de las filas no tiene promo.
CREATE INDEX IF NOT EXISTS idx_bookings_rate_id
  ON public.bookings(rate_id) WHERE rate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_rate_id
  ON public.payments(rate_id) WHERE rate_id IS NOT NULL;

COMMENT ON COLUMN public.bookings.base_amount IS
  'Total que habría costado la estadía sin promoción. NULL en reservas anteriores al seguimiento.';
COMMENT ON COLUMN public.bookings.discount_amount IS
  'Ahorro total de la estadía (base_amount - total_amount).';
COMMENT ON COLUMN public.bookings.promo_label IS
  'Nombre de la promoción al momento de aplicarla. Se guarda en texto porque la tarifa puede renombrarse o borrarse después.';
