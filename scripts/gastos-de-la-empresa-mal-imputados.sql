-- ═══════════════════════════════════════════════════════════════════════════
-- GASTOS DE LA EMPRESA QUE CAYERON EN EL CAJÓN DEL DÍA — diagnóstico y corrección
-- ═══════════════════════════════════════════════════════════════════════════
-- Qué pasó: el commit 12a70a4 (07/08/2026) desacopló "de qué caja salió" de
-- "con qué se pagó". La base quedó bien (el COMMENT y las políticas de
-- cash_source) y la lectura también (expenseSource en cashClosing.ts), pero los
-- dos hooks de escritura quedaron atrás:
--
--     cash_source: input.method === 'CASH' ? input.cashSource || 'RECAUDACION' : null
--
-- Con el método distinto de efectivo tiraban el EMPRESA que administración
-- había elegido y guardaban NULL. Y NULL se lee RECAUDACION en todos lados: el
-- gasto aparecía en el cierre de caja de recepción de ese día.
--
-- Golpea justo el caso más común de administración: la luz, internet, el súper
-- pagados por transferencia. El gasto en EFECTIVO imputado a la empresa se
-- guardó bien y no hay que tocarlo.
--
-- El código ya está arreglado: los gastos nuevos se guardan con la caja que se
-- eligió. Esto es sólo para los que quedaron mal entre el 07/08/2026 y el
-- deploy del fix.
--
-- Pensado para el SQL Editor de Supabase. Corré los pasos DE A UNO y mirá el
-- resultado de cada uno antes de seguir.
-- ═══════════════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ PASO 1 — DIAGNÓSTICO (read-only, no toca nada)                          │
-- │                                                                         │
-- │ Los candidatos: cash_source NULL con un método que no es efectivo,      │
-- │ desde que existe el bug.                                                │
-- │                                                                         │
-- │ Mirá la columna `quien_lo_cargo`, que sale del audit log:               │
-- │   admin      → es el caso del reporte. El desplegable arranca en        │
-- │                EMPRESA para administración, así que casi seguro eligió  │
-- │                esa caja y el hook la descartó. Son los del PASO 3.      │
-- │   reception  → NO tocar. Recepción no ve el desplegable y sus gastos    │
-- │                salen del cajón siempre: el NULL es correcto para ellos. │
-- │   (sin dato) → mirá el monto y la descripción. La luz de $300.000 no es │
-- │                un gasto de recepción; un flete de $8.000 sí puede ser.  │
-- └─────────────────────────────────────────────────────────────────────────┘

SELECT
    e.id,
    e.date            AS dia_del_gasto,
    e.created_at      AS cargado_el,
    e.expense_type,
    e.amount,
    e.description,
    e.method,
    e.cash_source,
    a.user_role       AS quien_lo_cargo,
    a.user_email
FROM public.expenses e
LEFT JOIN LATERAL (
    -- El alta del gasto. `expenses` no guarda quién lo cargó, así que el rol
    -- sale del audit log. ORDER BY + LIMIT 1 por si hay más de un renglón.
    SELECT al.user_role, al.user_email
    FROM public.audit_logs al
    WHERE al.entity_type = 'expense'
      AND al.entity_id = e.id
      AND al.action = 'CREATE'
    ORDER BY al.created_at
    LIMIT 1
) a ON TRUE
WHERE e.cash_source IS NULL
  AND e.method IS NOT NULL
  AND e.method <> 'CASH'
  AND e.created_at >= '2026-08-07'::date
ORDER BY e.created_at DESC;


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ PASO 2 — CUÁNTO MUEVE (read-only)                                       │
-- │                                                                         │
-- │ Cuánta plata está contada de más en los cierres de recepción, por día.  │
-- │ Es lo que el dueño ve inflado en el cierre.                             │
-- │                                                                         │
-- │ Ojo: NO cambia el "efectivo a rendir" de ningún día —eso sólo lo mueve  │
-- │ el efectivo— así que las cajas cerradas siguen cuadrando. Lo que está   │
-- │ mal es el total de gastos del turno y que el gasto aparezca en la lista │
-- │ de recepción.                                                           │
-- └─────────────────────────────────────────────────────────────────────────┘

SELECT
    e.date        AS dia,
    COUNT(*)      AS gastos,
    SUM(e.amount) AS total_mal_imputado
FROM public.expenses e
LEFT JOIN LATERAL (
    SELECT al.user_role
    FROM public.audit_logs al
    WHERE al.entity_type = 'expense' AND al.entity_id = e.id AND al.action = 'CREATE'
    ORDER BY al.created_at
    LIMIT 1
) a ON TRUE
WHERE e.cash_source IS NULL
  AND e.method IS NOT NULL
  AND e.method <> 'CASH'
  AND e.created_at >= '2026-08-07'::date
  AND a.user_role = 'admin'
GROUP BY e.date
ORDER BY e.date DESC;


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ PASO 3 — CORRECCIÓN                                                     │
-- │                                                                         │
-- │ Va comentado a propósito: primero revisá la lista del PASO 1 y          │
-- │ confirmá con el dueño que esos gastos son de la caja de la empresa.     │
-- │ Por los datos solos no se distingue un EMPRESA descartado por el bug de │
-- │ un RECAUDACION elegido a mano por administración.                       │
-- │                                                                         │
-- │ Descomentá el UPDATE cuando la lista esté confirmada. La transacción    │
-- │ te deja ver cuántas filas tocó antes del COMMIT.                        │
-- └─────────────────────────────────────────────────────────────────────────┘

-- BEGIN;
--
-- UPDATE public.expenses e
-- SET cash_source = 'EMPRESA'
-- WHERE e.cash_source IS NULL
--   AND e.method IS NOT NULL
--   AND e.method <> 'CASH'
--   AND e.created_at >= '2026-08-07'::date
--   AND EXISTS (
--       SELECT 1 FROM public.audit_logs al
--       WHERE al.entity_type = 'expense'
--         AND al.entity_id = e.id
--         AND al.action = 'CREATE'
--         AND al.user_role = 'admin'
--   )
-- RETURNING e.id, e.date, e.expense_type, e.amount, e.description, e.method;
--
-- -- Si la lista es la esperada:  COMMIT;
-- -- Si no:                       ROLLBACK;


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ PASO 4 — VERIFICAR (read-only, después del COMMIT)                      │
-- │ Tiene que dar cero filas.                                               │
-- └─────────────────────────────────────────────────────────────────────────┘

-- SELECT COUNT(*) AS quedan_sin_imputar
-- FROM public.expenses e
-- WHERE e.cash_source IS NULL
--   AND e.method IS NOT NULL
--   AND e.method <> 'CASH'
--   AND e.created_at >= '2026-08-07'::date
--   AND EXISTS (
--       SELECT 1 FROM public.audit_logs al
--       WHERE al.entity_type = 'expense' AND al.entity_id = e.id
--         AND al.action = 'CREATE' AND al.user_role = 'admin'
--   );
