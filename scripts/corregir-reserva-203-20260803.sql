-- ═══════════════════════════════════════════════════════════════════
-- Corrección puntual — reserva Hab. 203, entrada 03/08/2026
-- ═══════════════════════════════════════════════════════════════════
--
-- Qué pasó:
--   1. Reserva original 03/08 → 04/08, 1 noche, $80.000.
--   2. El 04/08 12:51 se extendió +2 noches a $80.000 (cargo de $160.000) y la
--      salida pasó al 06/08.
--   3. Se hizo el check-out con "Se va antes de lo previsto" eligiendo el 04/08.
--      Ahí pegó el bug de la salida anticipada: el cálculo repartió el total de
--      la reserva original entre las 3 noches ($80.000 ÷ 3 = $26.667) y dejó el
--      cargo de la extensión entero, con las 2 noches sin usar.
--
-- Cómo queda: la huésped se va el 05/08, o sea 2 noches. La del 03 la cubre la
-- reserva original ($80.000) y la del 04 la primera noche de la extensión
-- ($80.000). Total a cobrar: $160.000.
--
-- Se corre entero de una vez, en el SQL Editor de Supabase. Va en una
-- transacción: si algo falla, no queda nada a medias.
--
-- OJO: esto NO reemplaza desplegar el arreglo del código. Corrige esta reserva;
-- el bug sigue vivo en producción hasta que se suba la rama.

BEGIN;

-- ─── 1. La reserva ─────────────────────────────────────────────────
-- Vuelve a estar alojada —la huésped sigue en la habitación—, sale el 5, y el
-- total vuelve a ser lo que costaba la noche original.
UPDATE public.bookings
SET status         = 'CHECKED_IN',
    check_out_date = DATE '2026-08-05',
    total_amount   = 80000
WHERE id = 'd9d80611-4cc0-4d30-a8c8-90fc17ecf90c';

-- ─── 2. El cargo de la extensión ───────────────────────────────────
-- Se le baja la cantidad, no el precio: la línea tiene que seguir diciendo a
-- cuánto se pactó cada noche. Usó 1 de las 2 agregadas.
UPDATE public.booking_charges
SET quantity    = 1,
    description = '1 noche adicional (4 ago → 5 ago)'
WHERE id = 'ac8b7da0-c604-4fd1-9e2f-02f9600b0289';

-- ─── 3. La habitación ──────────────────────────────────────────────
-- El check-out la había dejado Sucia con la huésped adentro.
UPDATE public.rooms
SET status = 'OCCUPIED'
WHERE id = (
    SELECT room_id FROM public.bookings
    WHERE id = 'd9d80611-4cc0-4d30-a8c8-90fc17ecf90c'
);

-- ─── 4. La tarea de limpieza que generó el check-out ───────────────
-- Sin esto, limpieza entra a una habitación ocupada. Si devuelve 0 filas está
-- bien: alguien ya la resolvió a mano.
DELETE FROM public.housekeeping_tasks
WHERE room_id = (
        SELECT room_id FROM public.bookings
        WHERE id = 'd9d80611-4cc0-4d30-a8c8-90fc17ecf90c'
    )
  AND checkout_triggered = TRUE
  AND status = 'TODO'
  AND date >= DATE '2026-08-04';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- Verificación — correr DESPUÉS, aparte. Tiene que dar 2 filas:
--   RESERVA  2026-08-03 → 2026-08-05  CHECKED_IN   80000   2 noches
--   CARGO    ALOJAMIENTO · 1 noche…                80000   80000.00 x 1
-- ═══════════════════════════════════════════════════════════════════
--
-- SELECT '1 · RESERVA' AS seccion,
--        b.check_in_date::text || ' → ' || b.check_out_date::text AS fecha,
--        b.status AS detalle, b.total_amount AS monto,
--        (b.check_out_date - b.check_in_date)::text || ' noches' AS observacion
-- FROM public.bookings b
-- WHERE b.id = 'd9d80611-4cc0-4d30-a8c8-90fc17ecf90c'
-- UNION ALL
-- SELECT '2 · CARGO', bc.created_at::text,
--        bc.category || ' · ' || bc.description, (bc.amount * bc.quantity),
--        bc.amount::text || ' x ' || bc.quantity::text
-- FROM public.booking_charges bc
-- WHERE bc.booking_id = 'd9d80611-4cc0-4d30-a8c8-90fc17ecf90c';
