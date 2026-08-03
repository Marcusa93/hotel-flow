-- ═══════════════════════════════════════════════════════════════════════════
-- GASTOS CON LA FECHA CORRIDA UN DÍA — diagnóstico y corrección
-- ═══════════════════════════════════════════════════════════════════════════
-- Qué pasó: desde el commit e63fa24 (17/07/2026), el alta de gastos armaba la
-- fecha en UTC y la escribía leyendo el calendario local. En Argentina (UTC-3)
-- la medianoche del 3 en Greenwich son las 21 del día 2, así que un gasto
-- cargado el 03/08 se guardó como 02/08 y no figuraba en el cierre de caja
-- del día en que se cargó.
--
-- El código ya está arreglado: los gastos nuevos se guardan bien. Esto es sólo
-- para los que quedaron mal guardados entre el 17/07/2026 y el deploy del fix.
--
-- Pensado para el SQL Editor de Supabase. Corré los pasos DE A UNO y mirá el
-- resultado de cada uno antes de seguir.
-- ═══════════════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ PASO 1 — DIAGNÓSTICO (read-only, no toca nada)                          │
-- │ Lista los gastos sospechosos: los creados desde el 17/07/2026.          │
-- │                                                                         │
-- │ Mirá la columna `pinta`:                                                │
-- │   "cargado el mismo día"  → el caso típico, la fecha quedó un día antes │
-- │                             de cuando se cargó. Son los que corrige el  │
-- │                             PASO 3 sin dudas.                           │
-- │   "revisar a mano"        → el gasto se cargó con fecha retroactiva.    │
-- │                             También está corrido un día, pero fijate    │
-- │                             uno por uno si ya lo corregiste vos.        │
-- └─────────────────────────────────────────────────────────────────────────┘
SELECT
    e.id,
    e.date                                                        AS fecha_guardada,
    e.date + 1                                                    AS fecha_que_deberia_tener,
    (e.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS dia_en_que_se_cargo,
    e.expense_type                                                AS tipo,
    e.amount                                                      AS monto,
    e.description                                                 AS detalle,
    CASE
        WHEN e.date = (e.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - 1
            THEN 'cargado el mismo día'
        WHEN e.date = (e.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
            THEN 'ya está bien (corregido a mano)'
        ELSE 'revisar a mano'
    END AS pinta
FROM public.expenses e
WHERE e.created_at >= '2026-07-17'::date
ORDER BY e.created_at;


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ PASO 2 — RESPALDO (te deja el "deshacer" dentro de la misma base)       │
-- │ Copia los gastos del período afectado a una tabla aparte.               │
-- └─────────────────────────────────────────────────────────────────────────┘
CREATE SCHEMA IF NOT EXISTS fix_backup;

DROP TABLE IF EXISTS fix_backup.expenses_fechas;

CREATE TABLE fix_backup.expenses_fechas AS
SELECT * FROM public.expenses
WHERE created_at >= '2026-07-17'::date;

-- Cuántas filas quedaron respaldadas
SELECT count(*) AS filas_respaldadas FROM fix_backup.expenses_fechas;


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ PASO 3 — CORRECCIÓN                                                     │
-- │ Le suma un día SÓLO a los gastos que se cargaron el mismo día que la    │
-- │ fecha que tienen puesta, que es el patrón inequívoco del error.         │
-- │                                                                         │
-- │ Los que en el PASO 1 salieron como "revisar a mano" NO se tocan acá:    │
-- │ miralos en esa lista y corregilos de a uno si hace falta.               │
-- └─────────────────────────────────────────────────────────────────────────┘
UPDATE public.expenses e
SET date = e.date + 1
WHERE e.created_at >= '2026-07-17'::date
  AND e.date = (e.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - 1
RETURNING e.id, e.date AS fecha_nueva, e.expense_type, e.amount;


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ PASO 4 — VERIFICACIÓN                                                   │
-- │ Después del PASO 3 no debería quedar ninguno "cargado el mismo día".    │
-- │ Volvé a correr el PASO 1 y mirá la columna `pinta`.                     │
-- └─────────────────────────────────────────────────────────────────────────┘


-- ═══════════════════════════════════════════════════════════════════════════
-- SI ALGO SALIÓ MAL — restaurar las fechas desde el respaldo del PASO 2
-- ═══════════════════════════════════════════════════════════════════════════
-- UPDATE public.expenses e
-- SET date = b.date
-- FROM fix_backup.expenses_fechas b
-- WHERE e.id = b.id;

-- Cuando ya verificaste que quedó todo bien, podés soltar el respaldo:
-- DROP SCHEMA fix_backup CASCADE;
