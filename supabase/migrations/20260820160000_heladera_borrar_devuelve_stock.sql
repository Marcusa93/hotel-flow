-- ════════════════════════════════════════════════════════════════════
-- Borrar la venta devuelve el producto a la heladera
--
-- Las dos ventas de la heladera dejan su plata en otra tabla: la de mostrador
-- en other_income, la del huésped en booking_charges. Las dos se pueden borrar
-- desde la pantalla donde viven —el tachito de "Ingresos externos" en el cierre
-- de caja, y el de los cargos en la cuenta de la reserva—.
--
-- Con ON DELETE SET NULL, borrar la plata desataba el movimiento pero lo dejaba
-- en pie: la venta se deshacía y el stock seguía descontado. La heladera decía
-- que había menos de lo que había, y nadie se enteraba hasta el recuento.
--
-- Con CASCADE, el movimiento se va con la plata y el trigger devuelve el stock
-- solo. Es lo que corresponde: si la venta no fue, el producto está en la
-- heladera. Y funciona aunque el borrado venga de afuera de la app.
--
-- Vale para las dos claves, pero no para item_id: ese ya era CASCADE y significa
-- otra cosa —borrar el producto se lleva su historia entera—.
--
-- La tabla está vacía todavía, así que esto no toca un solo dato.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.minibar_movements
    DROP CONSTRAINT IF EXISTS minibar_movements_other_income_id_fkey;
ALTER TABLE public.minibar_movements
    ADD CONSTRAINT minibar_movements_other_income_id_fkey
    FOREIGN KEY (other_income_id) REFERENCES public.other_income(id) ON DELETE CASCADE;

ALTER TABLE public.minibar_movements
    DROP CONSTRAINT IF EXISTS minibar_movements_booking_charge_id_fkey;
ALTER TABLE public.minibar_movements
    ADD CONSTRAINT minibar_movements_booking_charge_id_fkey
    FOREIGN KEY (booking_charge_id) REFERENCES public.booking_charges(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.minibar_movements.other_income_id IS
  'El ingreso de caja que generó esta venta. Si se borra, la venta se deshace y '
  'el producto vuelve a la heladera.';
COMMENT ON COLUMN public.minibar_movements.booking_charge_id IS
  'El cargo en la cuenta de la reserva. Si se borra, el producto vuelve a la heladera.';

NOTIFY pgrst, 'reload schema';
