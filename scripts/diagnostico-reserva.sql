-- ═══════════════════════════════════════════════════════════════════
-- Diagnóstico de una reserva — SOLO LECTURA
-- ═══════════════════════════════════════════════════════════════════
--
-- No modifica nada: son cuatro SELECT. Se corre desde el SQL Editor de Supabase.
--
-- Hace falta para corregir a mano una reserva que quedó con la plata mal
-- repartida. El alojamiento vive en dos lugares —`bookings.total_amount` guarda
-- lo que se cotizó al reservar, y las noches que agregó "Extender estadía" van
-- como cargo de categoría ALOJAMIENTO— así que sin ver los dos no se puede saber
-- cuánto corresponde cobrar.
--
-- Reemplazar APELLIDO por el del huésped a revisar. Va en las cuatro consultas.

-- ─── 1. La reserva ─────────────────────────────────────────────────
SELECT
    b.id                                 AS reserva_id,
    g.full_name                          AS huesped,
    r.room_number                        AS habitacion,
    b.check_in_date                      AS entrada,
    b.check_out_date                     AS salida,
    (b.check_out_date - b.check_in_date) AS noches_segun_fechas,
    b.status                             AS estado,
    b.total_amount                       AS total_reserva,
    b.is_half_day                        AS es_media_estadia,
    b.created_at                         AS cargada_el
FROM public.bookings b
JOIN public.guests g ON g.id = b.guest_id
LEFT JOIN public.rooms r ON r.id = b.room_id
WHERE g.full_name ILIKE '%APELLIDO%'
ORDER BY b.check_in_date DESC;

-- ─── 2. Los cargos ─────────────────────────────────────────────────
-- En los de categoría ALOJAMIENTO, `precio_unitario` es lo que sale UNA noche y
-- `cantidad` cuántas noches se agregaron.
SELECT
    bc.id                     AS cargo_id,
    bc.booking_id             AS reserva_id,
    bc.category               AS rubro,
    bc.description            AS detalle,
    bc.amount                 AS precio_unitario,
    bc.quantity               AS cantidad,
    (bc.amount * bc.quantity) AS subtotal,
    bc.created_at             AS cargado_el
FROM public.booking_charges bc
JOIN public.bookings b ON b.id = bc.booking_id
JOIN public.guests g ON g.id = b.guest_id
WHERE g.full_name ILIKE '%APELLIDO%'
ORDER BY bc.created_at;

-- ─── 3. Los pagos ──────────────────────────────────────────────────
-- Para saber si además hay que devolverle algo.
SELECT
    p.id         AS pago_id,
    p.booking_id AS reserva_id,
    p.amount     AS monto,
    p.method     AS metodo,
    p.status     AS estado,
    p.date       AS fecha
FROM public.payments p
JOIN public.bookings b ON b.id = p.booking_id
JOIN public.guests g ON g.id = b.guest_id
WHERE g.full_name ILIKE '%APELLIDO%'
ORDER BY p.date;

-- ─── 4. Qué se le hizo a la reserva ────────────────────────────────
-- El rastro, para reconstruir cómo quedó así. `entity_id` es TEXT desde que se
-- permitieron ids que no son UUID, por eso el cast.
SELECT
    a.created_at  AS cuando,
    a.action      AS accion,
    a.description AS que_paso,
    a.new_values  AS valores_nuevos,
    a.user_email  AS quien
FROM public.audit_logs a
WHERE a.entity_id IN (
    SELECT b.id::text
    FROM public.bookings b
    JOIN public.guests g ON g.id = b.guest_id
    WHERE g.full_name ILIKE '%APELLIDO%'
)
ORDER BY a.created_at DESC
LIMIT 30;
