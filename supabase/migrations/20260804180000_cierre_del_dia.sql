-- Cerrar el día: que quede constancia de qué días ya se cerraron.
--
-- Del hotel: "a la hora de hacer cierre eligen el día que cerrarán y listo,
-- después que aparezca como que ya se hizo de ese día".
--
-- Hasta ahora el cierre era una pantalla que calculaba: mirabas un día y te daba
-- los números. No quedaba registro de haberlo cerrado, así que no había forma de
-- saber si el 30 ya se había rendido o si alguien todavía lo tenía pendiente.
--
-- Los números se guardan además de calcularse. Un cierre que se recalcula cada
-- vez que se abre no es un cierre: si mañana alguien corrige un gasto viejo, el
-- día "cerrado" cambia solo y lo que se rindió deja de coincidir con lo que la
-- pantalla muestra. Guardando el corte, el papel que firmaron sigue diciendo lo
-- mismo, y la pantalla puede avisar cuando lo de hoy ya no coincide.

CREATE TABLE IF NOT EXISTS public.cash_closings (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Un cierre por día. UNIQUE para que dos personas cerrando a la vez no dejen
    -- dos cortes distintos del mismo día.
    closing_date      DATE NOT NULL UNIQUE,

    -- ─── El corte, tal como se cerró ──────────────────────────────────
    cash_income       NUMERIC NOT NULL DEFAULT 0,
    cash_float        NUMERIC NOT NULL DEFAULT 0,
    cash_expenses     NUMERIC NOT NULL DEFAULT 0,
    cash_to_deposit   NUMERIC NOT NULL DEFAULT 0,
    total_income      NUMERIC NOT NULL DEFAULT 0,
    total_expenses    NUMERIC NOT NULL DEFAULT 0,

    notes             TEXT,

    closed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_by         UUID,
    -- El nombre además del id, por la misma razón que en los comprobantes: el
    -- perfil se renombra y el cierre tiene que seguir diciendo quién lo hizo.
    closed_by_name    TEXT,

    -- Reabierto = vuelve a estar pendiente. Se guarda en vez de borrar la fila
    -- para que quede el rastro de que alguien lo abrió y cuándo.
    reopened_at       TIMESTAMPTZ,
    reopened_by       UUID,
    reopened_by_name  TEXT,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ
);

-- La pantalla pregunta por un día y la lista de días cerrados va por fecha.
CREATE INDEX IF NOT EXISTS idx_cash_closings_date
    ON public.cash_closings(closing_date DESC);

COMMENT ON TABLE public.cash_closings IS
    'Un renglón por día cerrado, con los números tal como estaban al cerrarlo. reopened_at con valor significa que volvió a estar pendiente.';
COMMENT ON COLUMN public.cash_closings.cash_to_deposit IS
    'El efectivo a rendir que se calculó al cerrar. Se guarda para poder contrastarlo contra lo que da hoy: si no coinciden, algo se tocó después.';


-- ─── Permisos ─────────────────────────────────────────────────────────
ALTER TABLE public.cash_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_closings_read"   ON public.cash_closings;
DROP POLICY IF EXISTS "cash_closings_insert" ON public.cash_closings;
DROP POLICY IF EXISTS "cash_closings_update" ON public.cash_closings;

CREATE POLICY "cash_closings_read" ON public.cash_closings
    FOR SELECT TO authenticated USING (true);

-- Cerrar lo hace quien está en el mostrador.
CREATE POLICY "cash_closings_insert" ON public.cash_closings
    FOR INSERT TO authenticated
    WITH CHECK (public.current_user_role() IN ('admin', 'reception'));

-- Reabrir y volver a cerrar, solo administración. Un cierre que cualquiera
-- puede volver a abrir no sirve como respaldo de nada.
CREATE POLICY "cash_closings_update" ON public.cash_closings
    FOR UPDATE TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- Sin DELETE a propósito: un cierre no se borra, se reabre.


-- ─── Que cerrar y reabrir dejen rastro ────────────────────────────────
-- Reabrir un cierre es el movimiento sensible de todo esto: alguien vuelve a
-- tocar una caja ya rendida. Sin esto no quedaría registrado quién lo hizo.
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_entity_type_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_entity_type_check
    CHECK (entity_type IN (
        'booking', 'guest', 'room', 'payment', 'invoice',
        'housekeeping_task', 'rate', 'expense', 'hotel_settings',
        'booking_charge', 'logbook_entry', 'cash_closing'
    ));

-- PostgREST cachea el esquema; sin esto la tabla nueva da 404.
NOTIFY pgrst, 'reload schema';
