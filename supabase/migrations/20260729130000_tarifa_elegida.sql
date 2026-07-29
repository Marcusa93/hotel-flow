-- "TARIFA ELEGIDA": qué tramo se cobra cuando lo decide el mostrador.
--
-- Hasta hoy el precio lo decidía sola la ocupación: entran cuatro en una
-- quíntuple y se cobra el tramo de cuatro. Acierta casi siempre, pero no
-- siempre —hay noches en que el hotel le cobra igual la habitación entera al
-- que viene solo— y recepción no tenía dónde decirlo: cargaba la gente, el
-- sistema bajaba el tramo y ahí terminaba la discusión.
--
-- Acá queda el tramo que eligió recepción. NULL, que va a ser la enorme
-- mayoría, significa "el que corresponda por la gente que entra": exactamente
-- como venía funcionando.
--
-- Se guarda en la reserva y no se recalcula nunca. El sentido de elegir la
-- tarifa a mano es que no te la muevan después, así que ni la edición ni el
-- check-in la tocan. Mismo criterio que special_rate_amount.
--
-- ON DELETE SET NULL: si el tramo se borra de Tarifas la reserva vuelve al
-- cálculo automático. La plata ya cobrada no se mueve, porque el total vive en
-- total_amount y no se rearma desde acá.

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS pricing_room_type_id UUID
        REFERENCES public.room_types(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.bookings.pricing_room_type_id IS
    'Tramo de tarifa elegido a mano para esta reserva. NULL = el que corresponde por ocupación.';

NOTIFY pgrst, 'reload schema';
