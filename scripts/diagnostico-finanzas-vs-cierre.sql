-- ═══════════════════════════════════════════════════════════════════════════
-- FINANZAS vs CIERRE DE CAJA — por qué no dan igual, al peso
-- ═══════════════════════════════════════════════════════════════════════════
-- Del hotel: "sumo todas las transacciones de Finanzas del 05 hasta ahora y me
-- da $740.500; el Cierre de Caja dice $752.700".
--
-- Las dos pantallas suman cosas distintas A PROPÓSITO:
--
--   LA TABLA DE FINANZAS  = los cobros de reservas, tal como se cargaron.
--                           Incluye lo anotado a cuenta corriente (que no es
--                           plata) y los que no están en estado Pagado.
--                           No muestra ingresos externos ni cobros de cta. cte.
--
--   CIERRE DE CAJA        = lo que de verdad entró al cajón en ESTE TURNO:
--                           cobros PAID sin cuenta corriente
--                           + ingresos externos            ← la tabla no los ve
--                           + cobros de cuenta corriente   ← la tabla no los ve
--
-- Y hay una segunda diferencia, la que más confunde: el CORTE. Sumar "del 05
-- hasta ahora" es por día calendario. El cierre corta por el INSTANTE de
-- apertura y cierre del turno. Si el turno abrió el 5 a las 11:30, los cobros
-- del 5 antes de esa hora son del turno anterior, no de este.
--
-- Una diferencia entonces no es en sí un error — pero tiene que ser explicable
-- renglón por renglón, y eso es lo que hace este script.
--
-- Read-only: no toca nada. Pegalo entero en el SQL Editor de Supabase y corré
-- las secciones de a una.
-- ═══════════════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 0. ¿QUÉ TURNO ESTOY MIRANDO?                                            │
-- │ La pantalla muestra el turno abierto. Anotate su id: las secciones que   │
-- │ siguen usan ese mismo (el más reciente) automáticamente.                │
-- └─────────────────────────────────────────────────────────────────────────┘
SELECT
  s.id,
  to_char(s.opened_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') AS abrio,
  CASE WHEN s.closed_at IS NULL THEN 'EN CURSO'
       ELSE to_char(s.closed_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI')
  END AS cerro,
  s.opening_amount   AS saldo_inicial,
  s.snap_total_income AS total_ingresos_guardado_al_cerrar,
  s.snap_cash_to_deposit AS se_rindio
FROM public.cash_sessions s
ORDER BY s.opened_at DESC
LIMIT 10;


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 1. LOS NÚMEROS DE LA PANTALLA, RECALCULADOS                             │
-- │ "cierre_total_ingresos" tiene que dar EXACTO lo que muestra la pantalla  │
-- │ (752.700). Si no da, avisá: ahí sí hay algo mal.                        │
-- └─────────────────────────────────────────────────────────────────────────┘
WITH turno AS (
  SELECT id, opened_at, COALESCE(closed_at, NOW()) AS hasta, opening_amount
  FROM public.cash_sessions ORDER BY opened_at DESC LIMIT 1
),
cobros AS (   -- cobros de reservas que SÍ son plata
  SELECT p.amount, p.method FROM public.payments p, turno t
  WHERE p.status = 'PAID' AND p.method <> 'CUENTA_CORRIENTE'
    AND p.date >= t.opened_at AND p.date < t.hasta
),
varios AS (   -- ingresos externos. Van por created_at: su columna date no tiene hora
  SELECT o.amount, o.method FROM public.other_income o, turno t
  WHERE o.created_at >= t.opened_at AND o.created_at < t.hasta
),
cta_cte AS (  -- huéspedes pagando su cuenta corriente
  SELECT c.amount, c.method FROM public.current_account_payments c, turno t
  WHERE c.created_at >= t.opened_at AND c.created_at < t.hasta
),
gastos_cajon AS (  -- solo los de la recaudación bajan lo que hay que rendir
  SELECT e.amount FROM public.expenses e, turno t
  WHERE e.created_at >= t.opened_at AND e.created_at < t.hasta
    AND e.method = 'CASH' AND COALESCE(e.cash_source, 'RECAUDACION') = 'RECAUDACION'
)
SELECT
  (SELECT COALESCE(SUM(amount),0) FROM cobros)
  + (SELECT COALESCE(SUM(amount),0) FROM varios)
  + (SELECT COALESCE(SUM(amount),0) FROM cta_cte)          AS cierre_total_ingresos,

  (SELECT COALESCE(SUM(amount),0) FROM cobros WHERE method='CASH')
  + (SELECT COALESCE(SUM(amount),0) FROM varios WHERE method='CASH')
  + (SELECT COALESCE(SUM(amount),0) FROM cta_cte WHERE method='CASH') AS efectivo_cobrado,

  (SELECT opening_amount FROM turno)                       AS menos_saldo_inicial,
  (SELECT COALESCE(SUM(amount),0) FROM gastos_cajon)       AS menos_gastos_del_cajon,

  (SELECT COALESCE(SUM(amount),0) FROM cobros WHERE method='CASH')
  + (SELECT COALESCE(SUM(amount),0) FROM varios WHERE method='CASH')
  + (SELECT COALESCE(SUM(amount),0) FROM cta_cte WHERE method='CASH')
  - (SELECT opening_amount FROM turno)
  - (SELECT COALESCE(SUM(amount),0) FROM gastos_cajon)     AS efectivo_a_rendir;


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 2. EL PUENTE ENTRE TU SUMA Y LA DEL SISTEMA                             │
-- │ Arrancá de lo que sumaste a mano y seguí los renglones hacia abajo:     │
-- │ tienen que terminar en el número del cierre. Cada fila es una razón.    │
-- └─────────────────────────────────────────────────────────────────────────┘
WITH turno AS (
  SELECT opened_at, COALESCE(closed_at, NOW()) AS hasta
  FROM public.cash_sessions ORDER BY opened_at DESC LIMIT 1
),
params AS (SELECT DATE '2026-08-05' AS desde, 'America/Argentina/Buenos_Aires' AS tz)
SELECT * FROM (
  SELECT 1 AS orden,
         'A) Todos los cobros del 05 en adelante (lo que sumás a mano)' AS concepto,
         COALESCE(SUM(p.amount),0) AS monto
  FROM public.payments p, params
  WHERE (p.date AT TIME ZONE params.tz)::date >= params.desde

  UNION ALL
  SELECT 2, 'B) − los que no están Pagados (el cierre no los cuenta)',
         -COALESCE(SUM(p.amount),0)
  FROM public.payments p, params
  WHERE p.status <> 'PAID' AND (p.date AT TIME ZONE params.tz)::date >= params.desde

  UNION ALL
  SELECT 3, 'C) − lo anotado A cuenta corriente (no entró un peso)',
         -COALESCE(SUM(p.amount),0)
  FROM public.payments p, params
  WHERE p.status = 'PAID' AND p.method = 'CUENTA_CORRIENTE'
    AND (p.date AT TIME ZONE params.tz)::date >= params.desde

  UNION ALL
  SELECT 4, 'D) ± cobros que caen fuera del turno (corte por hora, no por día)',
         COALESCE((
           SELECT SUM(p.amount) FROM public.payments p, turno t
           WHERE p.status='PAID' AND p.method<>'CUENTA_CORRIENTE'
             AND p.date >= t.opened_at AND p.date < t.hasta
         ),0)
         - COALESCE((
           SELECT SUM(p.amount) FROM public.payments p, params
           WHERE p.status='PAID' AND p.method<>'CUENTA_CORRIENTE'
             AND (p.date AT TIME ZONE params.tz)::date >= params.desde
         ),0)

  UNION ALL
  SELECT 5, 'E) + ingresos externos (la tabla de Finanzas no los muestra)',
         COALESCE(SUM(o.amount),0)
  FROM public.other_income o, turno t
  WHERE o.created_at >= t.opened_at AND o.created_at < t.hasta

  UNION ALL
  SELECT 6, 'F) + cobros de cuenta corriente (la tabla tampoco los muestra)',
         COALESCE(SUM(c.amount),0)
  FROM public.current_account_payments c, turno t
  WHERE c.created_at >= t.opened_at AND c.created_at < t.hasta
) x
ORDER BY orden;


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 3. LOS RENGLONES, UNO POR UNO                                           │
-- │ Cada movimiento que una pantalla ve y la otra no, con nombre y monto.    │
-- └─────────────────────────────────────────────────────────────────────────┘
WITH turno AS (
  SELECT opened_at, COALESCE(closed_at, NOW()) AS hasta
  FROM public.cash_sessions ORDER BY opened_at DESC LIMIT 1
),
params AS (SELECT DATE '2026-08-05' AS desde, 'America/Argentina/Buenos_Aires' AS tz)
SELECT 'Ingreso externo (Cierre SÍ / Finanzas NO)' AS que_es,
       to_char(o.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires','DD/MM HH24:MI') AS momento,
       o.description AS detalle, o.method AS metodo, o.amount AS monto
FROM public.other_income o, turno t
WHERE o.created_at >= t.opened_at AND o.created_at < t.hasta

UNION ALL
SELECT 'Cobro de cta. cte. (Cierre SÍ / Finanzas NO)',
       to_char(c.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires','DD/MM HH24:MI'),
       COALESCE(c.notes,'—'), c.method, c.amount
FROM public.current_account_payments c, turno t
WHERE c.created_at >= t.opened_at AND c.created_at < t.hasta

UNION ALL
SELECT 'Anotado A cta. cte. (Finanzas SÍ / Cierre NO — no es plata)',
       to_char(p.date AT TIME ZONE params.tz,'DD/MM HH24:MI'),
       COALESCE(p.comment,'—'), p.method, p.amount
FROM public.payments p, params
WHERE p.status = 'PAID' AND p.method = 'CUENTA_CORRIENTE'
  AND (p.date AT TIME ZONE params.tz)::date >= params.desde

UNION ALL
SELECT 'No está Pagado (Finanzas SÍ / Cierre NO) — ' || p.status,
       to_char(p.date AT TIME ZONE params.tz,'DD/MM HH24:MI'),
       COALESCE(p.comment,'—'), p.method, p.amount
FROM public.payments p, params
WHERE p.status <> 'PAID' AND (p.date AT TIME ZONE params.tz)::date >= params.desde
ORDER BY 1, 2;


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4. PLATA QUE NO CAE EN NINGÚN TURNO   ← el que hay que mirar en serio   │
-- │ Cobros que quedaron en el hueco entre un cierre y la apertura siguiente, │
-- │ o antes del primer turno. No los rinde nadie. Lo esperable es vacío.     │
-- └─────────────────────────────────────────────────────────────────────────┘
SELECT to_char(p.date AT TIME ZONE 'America/Argentina/Buenos_Aires','DD/MM HH24:MI') AS momento,
       p.method AS metodo, p.amount AS monto, COALESCE(p.comment,'—') AS detalle
FROM public.payments p
WHERE p.status = 'PAID' AND p.method <> 'CUENTA_CORRIENTE'
  AND p.date >= (SELECT MIN(opened_at) FROM public.cash_sessions)
  AND NOT EXISTS (
    SELECT 1 FROM public.cash_sessions s
    WHERE p.date >= s.opened_at
      AND (s.closed_at IS NULL OR p.date < s.closed_at)
  )
ORDER BY p.date;


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 5. TURNOS QUE SE PISAN                                                  │
-- │ Dos turnos abiertos a la vez cuentan la misma plata dos veces. Vacío    │
-- │ es lo correcto.                                                          │
-- └─────────────────────────────────────────────────────────────────────────┘
SELECT to_char(a.opened_at AT TIME ZONE 'America/Argentina/Buenos_Aires','DD/MM HH24:MI') AS turno_a_abrio,
       to_char(b.opened_at AT TIME ZONE 'America/Argentina/Buenos_Aires','DD/MM HH24:MI') AS turno_b_abrio,
       a.id AS id_a, b.id AS id_b
FROM public.cash_sessions a
JOIN public.cash_sessions b ON a.id < b.id
WHERE a.opened_at < COALESCE(b.closed_at, 'infinity'::timestamptz)
  AND b.opened_at < COALESCE(a.closed_at, 'infinity'::timestamptz)
ORDER BY a.opened_at;


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 6. COBROS FECHADOS A MEDIANOCHE                                         │
-- │ Cargados tocando el calendario, que antes los dejaba a las 00:00. Con    │
-- │ el corte por hora eso los manda al turno anterior. Ya está arreglado     │
-- │ para los nuevos; estos son los que quedaron de antes.                    │
-- └─────────────────────────────────────────────────────────────────────────┘
SELECT to_char(p.date AT TIME ZONE 'America/Argentina/Buenos_Aires','DD/MM HH24:MI') AS momento,
       p.status AS estado, p.method AS metodo, p.amount AS monto,
       to_char(p.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires','DD/MM HH24:MI') AS se_cargo
FROM public.payments p
WHERE (p.date AT TIME ZONE 'America/Argentina/Buenos_Aires')::time = '00:00:00'
  AND p.date >= NOW() - INTERVAL '30 days'
ORDER BY p.date DESC;
