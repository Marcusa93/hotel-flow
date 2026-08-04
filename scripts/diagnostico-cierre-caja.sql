-- Por qué el número del Cierre de Caja no coincide con el de Finanzas.
--
-- Del hotel: "en el sistema aparece un monto y cuando hacen el cierre hay otro".
--
-- No es un problema de fechas. Las dos pantallas suman cosas distintas:
--
--   Cierre de Caja  = cobros PAID SIN cuenta corriente
--                     + ingresos varios
--                     + cobros de cuenta corriente
--   Finanzas        = cobros PAID CON cuenta corriente
--                     (y sin ingresos varios ni cobros de cuenta corriente)
--
-- Un cobro con método CUENTA_CORRIENTE es una estadía que se le anotó al huésped
-- en la cuenta: no entró un peso. El Cierre lo excluye bien; Finanzas lo suma
-- como si fuera plata. Por eso Finanzas da más alto y parece que en el cierre
-- falta.
--
-- Cómo correrlo: pegalo en el SQL Editor de Supabase y cambiá el día de abajo.

\set dia '2026-08-03'

-- El huso importa: payments.date es TIMESTAMPTZ y la pantalla filtra por el día
-- calendario local, no por UTC.
WITH params AS (
  SELECT :'dia'::date AS dia, 'America/Argentina/Buenos_Aires' AS tz
),

-- ─── Lo que el Cierre de Caja cuenta como plata que entró ──────────────
cobros AS (
  SELECT p.method, p.amount
  FROM public.payments p, params
  WHERE p.status = 'PAID'
    AND p.method <> 'CUENTA_CORRIENTE'
    AND (p.date AT TIME ZONE params.tz)::date = params.dia
),
varios AS (
  SELECT o.method, o.amount
  FROM public.other_income o, params
  WHERE o.date = params.dia
),
cuenta_corriente_cobrada AS (
  SELECT c.method, c.amount
  FROM public.current_account_payments c, params
  WHERE c.date = params.dia
),

-- ─── Lo que el Cierre EXCLUYE a propósito ─────────────────────────────
-- Estadías anotadas en la cuenta del huésped. No es plata: es deuda.
a_cuenta AS (
  SELECT p.amount
  FROM public.payments p, params
  WHERE p.status = 'PAID'
    AND p.method = 'CUENTA_CORRIENTE'
    AND (p.date AT TIME ZONE params.tz)::date = params.dia
)

SELECT
  'Cobros de reservas (sin cta. cte.)' AS concepto,
  COALESCE(SUM(amount), 0)            AS monto,
  'Cierre: SÍ    Finanzas: SÍ'        AS aparece_en
FROM cobros
UNION ALL
SELECT
  'Ingresos varios',
  COALESCE(SUM(amount), 0),
  'Cierre: SÍ    Finanzas: NO'
FROM varios
UNION ALL
SELECT
  'Cobros de cuenta corriente',
  COALESCE(SUM(amount), 0),
  'Cierre: SÍ    Finanzas: NO'
FROM cuenta_corriente_cobrada
UNION ALL
SELECT
  '>>> Anotado a cuenta corriente (NO es plata)',
  COALESCE(SUM(amount), 0),
  'Cierre: NO    Finanzas: SÍ  <-- LA DIFERENCIA'
FROM a_cuenta;


-- ─── Los dos totales, uno al lado del otro ────────────────────────────
WITH params AS (
  SELECT :'dia'::date AS dia, 'America/Argentina/Buenos_Aires' AS tz
),
del_dia AS (
  SELECT
    COALESCE((
      SELECT SUM(p.amount) FROM public.payments p, params
      WHERE p.status = 'PAID' AND p.method <> 'CUENTA_CORRIENTE'
        AND (p.date AT TIME ZONE params.tz)::date = params.dia
    ), 0) AS cobros,
    COALESCE((
      SELECT SUM(o.amount) FROM public.other_income o, params
      WHERE o.date = params.dia
    ), 0) AS varios,
    COALESCE((
      SELECT SUM(c.amount) FROM public.current_account_payments c, params
      WHERE c.date = params.dia
    ), 0) AS cta_cte_cobrada,
    COALESCE((
      SELECT SUM(p.amount) FROM public.payments p, params
      WHERE p.status = 'PAID' AND p.method = 'CUENTA_CORRIENTE'
        AND (p.date AT TIME ZONE params.tz)::date = params.dia
    ), 0) AS anotado_a_cuenta
)
SELECT
  cobros + varios + cta_cte_cobrada AS total_que_muestra_el_cierre,
  cobros + anotado_a_cuenta         AS total_que_muestra_finanzas,
  (cobros + varios + cta_cte_cobrada) - (cobros + anotado_a_cuenta) AS diferencia
FROM del_dia;


-- ─── Desglose por método, como lo muestra el Cierre ───────────────────
-- Contrastá esto contra la captura de "Ingresos por método".
WITH params AS (
  SELECT :'dia'::date AS dia, 'America/Argentina/Buenos_Aires' AS tz
),
todo AS (
  SELECT p.method, p.amount FROM public.payments p, params
  WHERE p.status = 'PAID' AND p.method <> 'CUENTA_CORRIENTE'
    AND (p.date AT TIME ZONE params.tz)::date = params.dia
  UNION ALL
  SELECT o.method, o.amount FROM public.other_income o, params WHERE o.date = params.dia
  UNION ALL
  SELECT c.method, c.amount FROM public.current_account_payments c, params WHERE c.date = params.dia
)
SELECT method, SUM(amount) AS total, COUNT(*) AS movimientos
FROM todo
GROUP BY method
ORDER BY total DESC;
