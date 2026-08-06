-- Turnos de caja: apertura y cierre manual.
--
-- Hasta ahora el cierre usaba el día calendario como unidad: el hotel elige un
-- día, ve los movimientos de ese día y cierra. El problema: el turno de noche
-- arranca el lunes y termina el martes a las 10am, así que los cobros del
-- martes a la mañana quedan en el día equivocado.
--
-- Con turnos, recepción abre la caja con cuánta plata hay en el cajón, trabaja,
-- y cierra cuando termina —aunque sea al día siguiente—. El cierre captura todos
-- los movimientos desde la apertura hasta el cierre, sin importar el día.

CREATE TABLE IF NOT EXISTS public.cash_sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    opened_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    opened_by        UUID,
    opened_by_name   TEXT,
    opening_amount   NUMERIC NOT NULL DEFAULT 0,

    closed_at        TIMESTAMPTZ,
    closed_by        UUID,
    closed_by_name   TEXT,
    notes            TEXT,

    -- Corte guardado al cerrar: los mismos números que se rindieron.
    -- Si algo se toca después, se puede contrastar.
    snap_cash_income    NUMERIC,
    snap_cash_expenses  NUMERIC,
    snap_cash_to_deposit NUMERIC,
    snap_total_income   NUMERIC,
    snap_total_expenses NUMERIC,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_at
    ON public.cash_sessions(opened_at DESC);

COMMENT ON TABLE public.cash_sessions IS
    'Un renglón por turno de caja. opened_at..closed_at define el rango de movimientos del turno. closed_at NULL = turno abierto.';

-- ─── Permisos ─────────────────────────────────────────────────────────
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_sessions_read"   ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_insert" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_update" ON public.cash_sessions;

CREATE POLICY "cash_sessions_read" ON public.cash_sessions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "cash_sessions_insert" ON public.cash_sessions
    FOR INSERT TO authenticated
    WITH CHECK (public.current_user_role() IN ('admin', 'reception'));

-- Solo admin puede reabrir (update closed_at a NULL).
-- Reception puede cerrar (update cuando closed_at es NULL).
CREATE POLICY "cash_sessions_update" ON public.cash_sessions
    FOR UPDATE TO authenticated
    USING (
        -- Cerrar un turno abierto: recepción y admin
        (closed_at IS NULL AND public.current_user_role() IN ('admin', 'reception'))
        OR
        -- Reabrir un turno cerrado: solo admin
        (closed_at IS NOT NULL AND public.current_user_role() = 'admin')
    );

-- Sin DELETE: los turnos son registros contables, no se borran.

NOTIFY pgrst, 'reload schema';
