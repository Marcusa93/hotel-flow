-- ═══════════════════════════════════════════════════════════════════
-- Diagnóstico de los pagos de un huésped — SOLO LECTURA
-- ═══════════════════════════════════════════════════════════════════
--
-- No modifica nada. Es UNA sola consulta: se pega entera en el SQL Editor de
-- Supabase, se aprieta Run, y devuelve todo junto en una tabla. (Varios SELECT
-- sueltos no sirven: el editor corre todos pero solo muestra el último.)
--
-- Para qué: cuando la reserva dice que debe plata que recepción ya cobró. Eso
-- pasa por una de cuatro razones, y las cuatro se ven acá:
--
--   a) Un pago quedó en un estado que no es PAID. La cuenta de la reserva
--      —bookingAccount.ts— y la caja —CierreCaja.tsx— suman SOLO los PAID.
--      Un pago en PENDING, FAILED o REFUNDED no salda nada y no entra a la caja.
--   b) El pago se cargó a OTRA reserva. Si el huésped tiene dos reservas —o el
--      mismo apellido está cargado dos veces— la lista de pagos las muestra
--      idénticas, porque cada fila dice habitación y fechas, no cuál reserva es.
--   c) Lo que se debe no es solo el alojamiento: hay cargos —minibar, noches
--      agregadas por "Extender estadía"— que el total de la reserva no incluye.
--   d) El pago se cargó con método "Cuenta corriente". Salda la reserva pero
--      NO entra a la caja: no entró un peso, se le anotó al huésped.
--
-- Reemplazar APELLIDO por el del huésped. Va en un solo lugar, en el CTE
-- `reserva`. La fecha del bloque 5 —el día a mirar en la caja— va en otro.

WITH reserva AS (
    SELECT
        b.id,
        b.check_in_date,
        b.check_out_date,
        b.status,
        b.total_amount,
        g.full_name,
        r.room_number
    FROM public.bookings b
    JOIN public.guests g ON g.id = b.guest_id
    LEFT JOIN public.rooms r ON r.id = b.room_id
    WHERE g.full_name ILIKE '%SLOBODZIUK%'          -- ← APELLIDO acá
),

cargos AS (
    SELECT bc.booking_id, COALESCE(SUM(bc.amount * bc.quantity), 0) AS total
    FROM public.booking_charges bc
    WHERE bc.booking_id IN (SELECT id FROM reserva)
    GROUP BY bc.booking_id
),

cobros AS (
    SELECT
        p.booking_id,
        COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'PAID'), 0)  AS pagado,
        COALESCE(SUM(p.amount) FILTER (WHERE p.status <> 'PAID'), 0) AS no_pagado,
        COUNT(*) FILTER (WHERE p.status = 'PAID')                    AS n_pagados,
        COUNT(*)                                                     AS n_total
    FROM public.payments p
    WHERE p.booking_id IN (SELECT id FROM reserva)
    GROUP BY p.booking_id
)

-- ─── 0 · VEREDICTO ─────────────────────────────────────────────────
-- La cuenta que hace el sistema, reserva por reserva. `monto` es el saldo: si
-- da 0 la reserva está saldada, y si da distinto de 0 la observación dice de
-- dónde sale la diferencia. Si acá aparece MÁS DE UNA FILA, la reserva está
-- duplicada y ese es el problema: los pagos se repartieron entre las dos.
SELECT
    '0 · VEREDICTO'                                          AS seccion,
    rv.id::text                                              AS id,
    rv.check_in_date::text || ' → ' || rv.check_out_date::text AS fecha,
    'debe ' || (rv.total_amount + COALESCE(c.total, 0))::text
        || '  ·  cobrado ' || COALESCE(co.pagado, 0)::text   AS detalle,
    (rv.total_amount + COALESCE(c.total, 0) - COALESCE(co.pagado, 0)) AS monto,
    'alojamiento ' || rv.total_amount::text
        || ' + cargos ' || COALESCE(c.total, 0)::text
        || '  ·  pagos en PAID: ' || COALESCE(co.n_pagados, 0)::text
        || ' de ' || COALESCE(co.n_total, 0)::text
        || '  ·  en otro estado: $' || COALESCE(co.no_pagado, 0)::text AS observacion
FROM reserva rv
LEFT JOIN cargos c  ON c.booking_id  = rv.id
LEFT JOIN cobros co ON co.booking_id = rv.id

UNION ALL

-- ─── 1 · RESERVA ───────────────────────────────────────────────────
-- Las fechas y el total con el que está cargada. Una fila por reserva.
SELECT
    '1 · RESERVA',
    rv.id::text,
    rv.check_in_date::text || ' → ' || rv.check_out_date::text,
    rv.full_name || '  ·  Hab. ' || COALESCE(rv.room_number, '?')
        || '  ·  ' || rv.status,
    rv.total_amount,
    (rv.check_out_date - rv.check_in_date)::text || ' noches'
FROM reserva rv

UNION ALL

-- ─── 2 · CARGO ─────────────────────────────────────────────────────
-- Lo que se debe además del alojamiento. En los de rubro ALOJAMIENTO la
-- observación dice el precio de UNA noche por cuántas noches.
SELECT
    '2 · CARGO',
    bc.id::text,
    bc.created_at::text,
    COALESCE(bc.category, '?') || '  ·  ' || COALESCE(bc.description, '(sin detalle)'),
    (bc.amount * bc.quantity),
    bc.amount::text || ' x ' || bc.quantity::text
FROM public.booking_charges bc
WHERE bc.booking_id IN (SELECT id FROM reserva)

UNION ALL

-- ─── 3 · PAGO ──────────────────────────────────────────────────────
-- Cada pago con su estado y a qué reserva quedó pegado. El detalle abre el id
-- de la reserva: si dos pagos de la misma habitación muestran ids distintos,
-- se repartieron entre reservas duplicadas.
--
-- `fecha` es la que decide en qué día lo cuenta la caja. `cargado` es cuándo se
-- tipeó. Si difieren, el cobro está contado en un día distinto al que se hizo.
SELECT
    '3 · PAGO',
    p.id::text,
    p.date::text,
    p.method || '  ·  ' || p.status
        || '  ·  reserva ' || COALESCE(LEFT(p.booking_id::text, 8), 'SIN RESERVA'),
    p.amount,
    'cargado ' || p.created_at::text || COALESCE('  ·  ' || p.comment, '')
FROM public.payments p
WHERE p.booking_id IN (SELECT id FROM reserva)

UNION ALL

-- ─── 4 · AUDITORÍA ─────────────────────────────────────────────────
-- Quién tocó cada pago y cuándo: el alta y cada cambio de estado. Es lo que
-- reconstruye la historia —qué se cargó primero, qué se reembolsó después—.
-- Busca también por la reserva adentro de new_values, así aparecen los pagos
-- que se borraron y ya no están en la tabla.
SELECT
    '4 · AUDITORÍA',
    al.entity_id::text,
    al.created_at::text,
    COALESCE(al.user_email, '?') || '  ·  ' || al.action || '  ·  ' || al.description,
    NULL::numeric,
    COALESCE(al.new_values::text, '')
FROM public.audit_logs al
WHERE al.entity_type = 'payment'
  AND (
        al.entity_id IN (
            SELECT p.id::text FROM public.payments p
            WHERE p.booking_id IN (SELECT id FROM reserva)
        )
        OR al.new_values->>'bookingId' IN (SELECT id::text FROM reserva)
      )

UNION ALL

-- ─── 5 · LA CAJA DE ESE DÍA ────────────────────────────────────────
-- Todos los cobros del día, de todos los huéspedes, tal como los suma el cierre
-- de caja. Sirve para dos cosas: ver si un pago de esta huésped quedó pegado a
-- la reserva de otra, y contar contra lo que se rindió.
-- Los que no dicen PAID no entran al cierre. Los de método CUENTA_CORRIENTE
-- tampoco: saldan la reserva pero no son plata que entró.
--
-- El día va en las dos fechas de abajo, en hora de Argentina (-03).
SELECT
    '5 · CAJA DEL DÍA',
    p.id::text,
    p.date::text,
    COALESCE(g.full_name, '(sin huésped)') || '  ·  Hab. ' || COALESCE(r.room_number, '?')
        || '  ·  ' || p.method || '  ·  ' || p.status,
    p.amount,
    'reserva ' || COALESCE(LEFT(p.booking_id::text, 8), '—')
FROM public.payments p
LEFT JOIN public.bookings b ON b.id = p.booking_id
LEFT JOIN public.guests   g ON g.id = b.guest_id
LEFT JOIN public.rooms    r ON r.id = b.room_id
WHERE p.date >= TIMESTAMPTZ '2026-08-04 00:00:00-03'    -- ← el día a mirar
  AND p.date <  TIMESTAMPTZ '2026-08-05 00:00:00-03'

ORDER BY seccion, fecha;
