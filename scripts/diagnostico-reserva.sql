-- ═══════════════════════════════════════════════════════════════════
-- Diagnóstico de una reserva — SOLO LECTURA
-- ═══════════════════════════════════════════════════════════════════
--
-- No modifica nada. Es UNA sola consulta: se pega entera en el SQL Editor de
-- Supabase, se aprieta Run, y devuelve la reserva, sus cargos y sus pagos juntos
-- en una tabla. (Varios SELECT sueltos no sirven: el editor corre todos pero solo
-- muestra el resultado del último.)
--
-- Hace falta para corregir a mano una reserva que quedó con la plata mal
-- repartida. El alojamiento vive en dos lugares —`bookings.total_amount` guarda
-- lo que se cotizó al reservar, y las noches que agregó "Extender estadía" van
-- como cargo de categoría ALOJAMIENTO— así que sin ver los dos no se puede saber
-- cuánto corresponde cobrar.
--
-- Reemplazar APELLIDO por el del huésped a revisar. Va en un solo lugar.

WITH reserva AS (
    SELECT
        b.id,
        b.check_in_date,
        b.check_out_date,
        b.status,
        b.total_amount,
        b.is_half_day,
        g.full_name,
        r.room_number
    FROM public.bookings b
    JOIN public.guests g ON g.id = b.guest_id
    LEFT JOIN public.rooms r ON r.id = b.room_id
    WHERE g.full_name ILIKE '%APELLIDO%'
)

-- La reserva: las fechas y el total con el que está cargada.
SELECT
    '1 · RESERVA'                                            AS seccion,
    reserva.id::text                                         AS id,
    reserva.check_in_date::text || ' → ' || reserva.check_out_date::text AS fecha,
    reserva.full_name || '  ·  Hab. ' || COALESCE(reserva.room_number, '?')
        || '  ·  ' || reserva.status                         AS detalle,
    reserva.total_amount                                     AS monto,
    (reserva.check_out_date - reserva.check_in_date)::text || ' noches'
        || CASE WHEN reserva.is_half_day THEN ' (media estadía)' ELSE '' END AS observacion
FROM reserva

UNION ALL

-- Los cargos. En los de rubro ALOJAMIENTO, la observación dice el precio de UNA
-- noche por cuántas noches: eso es lo que hay que ajustar, no el subtotal.
SELECT
    '2 · CARGO',
    bc.id::text,
    bc.created_at::text,
    bc.category || '  ·  ' || COALESCE(bc.description, '(sin detalle)'),
    (bc.amount * bc.quantity),
    bc.amount::text || ' x ' || bc.quantity::text
FROM public.booking_charges bc
JOIN reserva ON reserva.id = bc.booking_id

UNION ALL

-- Los pagos, para saber si además hay que devolverle algo.
SELECT
    '3 · PAGO',
    p.id::text,
    p.date::text,
    p.method || '  ·  ' || p.status,
    p.amount,
    ''
FROM public.payments p
JOIN reserva ON reserva.id = p.booking_id

ORDER BY seccion, fecha;
