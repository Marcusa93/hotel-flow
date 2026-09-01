-- Ajustes de caja: mover plata entre métodos y retiros manuales, con motivo.
--
-- El cierre mostraba lo que los cobros decían, no lo que había en el cajón.
-- Cuando un huésped termina pagando por transferencia lo que estaba cargado
-- como efectivo —y nadie sabe qué cobro fue—, o cuando administración saca
-- plata del cajón para pagar un sueldo, la única salida era dejar la
-- diferencia anotada en las observaciones del cierre, donde no suma ni resta.
--
-- Un ajuste es un renglón con signo: positivo entra plata a ese método,
-- negativo sale. Un cambio de método son dos renglones atados por
-- transfer_group (-X en el método de origen, +X en el destino), que netean
-- cero: mueven plata de caja sin inventar ingresos. El motivo es obligatorio
-- porque el renglón ES el rastro: un ajuste sin explicación en un cierre es
-- exactamente lo que este sistema vino a evitar.
--
-- A qué turno pertenece lo decide created_at contra el intervalo del turno,
-- igual que los gastos y los ingresos externos: no hay columna de sesión.

CREATE TABLE IF NOT EXISTS public.cash_adjustments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       UUID,
    created_by_name  TEXT,

    -- Los métodos de cobro reales. CUENTA_CORRIENTE queda afuera: no es una
    -- caja, es plata que no entró.
    method           TEXT NOT NULL CHECK (method IN (
        'CASH', 'CREDIT', 'DEBIT', 'TRANSFER', 'QR', 'CHEQUE', 'OTHER'
    )),

    -- Con signo. Cero no es un ajuste.
    amount           NUMERIC NOT NULL CHECK (amount <> 0),

    reason           TEXT NOT NULL CHECK (length(btrim(reason)) > 0),

    -- Las dos patas de un cambio de método comparten este id. NULL en un
    -- retiro o ajuste suelto.
    transfer_group   UUID
);

CREATE INDEX IF NOT EXISTS idx_cash_adjustments_created_at
    ON public.cash_adjustments(created_at DESC);

COMMENT ON TABLE public.cash_adjustments IS
    'Ajustes manuales de la caja diaria: renglones con signo por método. transfer_group ata las dos patas de un cambio de método.';

-- ─── Permisos ─────────────────────────────────────────────────────────
ALTER TABLE public.cash_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_adjustments_read"   ON public.cash_adjustments;
DROP POLICY IF EXISTS "cash_adjustments_insert" ON public.cash_adjustments;
DROP POLICY IF EXISTS "cash_adjustments_delete" ON public.cash_adjustments;

-- Todos lo ven: el ajuste es parte del cierre que recepción también mira.
CREATE POLICY "cash_adjustments_read" ON public.cash_adjustments
    FOR SELECT TO authenticated USING (true);

-- Solo administración mueve plata de caja a mano. Recepción corrige cobros
-- puntuales desde Cobros, que es su herramienta.
CREATE POLICY "cash_adjustments_insert" ON public.cash_adjustments
    FOR INSERT TO authenticated
    WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "cash_adjustments_delete" ON public.cash_adjustments
    FOR DELETE TO authenticated
    USING (public.current_user_role() = 'admin');

-- Sin UPDATE: un ajuste mal cargado se borra y se carga de nuevo, y las dos
-- cosas quedan en auditoría.

-- ─── Auditoría ────────────────────────────────────────────────────────
-- El check de entity_type es una lista cerrada: sin esto, el rastro del
-- ajuste rebota contra la base y el helper lo traga en silencio.
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_entity_type_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_entity_type_check
    CHECK (entity_type IN (
        'booking', 'guest', 'room', 'payment', 'invoice',
        'housekeeping_task', 'rate', 'expense', 'hotel_settings',
        'booking_charge', 'logbook_entry', 'cash_closing',
        'minibar_item', 'minibar_movement', 'cash_adjustment'
    ));

NOTIFY pgrst, 'reload schema';
