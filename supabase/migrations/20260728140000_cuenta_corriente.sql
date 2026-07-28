-- Cuenta corriente para huéspedes frecuentes.
--
-- El que viene todos los meses no paga cada estadía en el mostrador: se le carga
-- a la cuenta y salda cuando pasa. Hasta ahora eso no existía: o se cobraba, o
-- la reserva quedaba figurando con deuda para siempre.
--
-- Cómo funciona, en tres piezas:
--
--   1. guests.has_current_account habilita al huésped. Sin el permiso, el método
--      de pago "Cuenta corriente" ni aparece en el diálogo de cobro.
--
--   2. Cobrar una reserva con method = 'CUENTA_CORRIENTE' no es plata que entró:
--      salda la reserva y pasa la deuda al huésped. Por eso el cierre de caja lo
--      muestra en su propia línea y NO lo suma al ingreso del día.
--
--   3. current_account_payments guarda lo que el huésped paga de su cuenta, con
--      el método real (efectivo, transferencia). Ese día sí entra plata, y ahí
--      es donde el cierre de caja la cuenta.
--
--   Saldo del huésped = lo cargado a la cuenta − lo que pagó de la cuenta.
--
-- El saldo se deriva, no se guarda: un total materializado se desincroniza en
-- cuanto alguien corrige un cobro viejo, y acá la fuente de verdad son los
-- movimientos.

-- ─── 1. El permiso en el huésped ──────────────────────────────────────
ALTER TABLE public.guests
    ADD COLUMN IF NOT EXISTS has_current_account BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.guests.has_current_account IS
    'Huésped habilitado a cargar sus estadías a cuenta corriente en vez de pagarlas en el momento.';


-- ─── 2. El método de pago ─────────────────────────────────────────────
-- Se reemplaza el CHECK en vez de agregar uno: dos constraints sobre la misma
-- columna se cumplen los dos a la vez y el viejo rechazaría el valor nuevo.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;

ALTER TABLE public.payments ADD CONSTRAINT payments_method_check
    CHECK (method IN ('CASH', 'CREDIT', 'DEBIT', 'TRANSFER', 'QR', 'OTHER', 'CUENTA_CORRIENTE'));

-- other_income queda como está a propósito: un ingreso suelto del hotel no se
-- cobra a la cuenta corriente de nadie.


-- ─── 3. Lo que el huésped paga de su cuenta ───────────────────────────
CREATE TABLE IF NOT EXISTS public.current_account_payments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id    UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    amount      DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    -- El método real con el que entró la plata. Sin 'CUENTA_CORRIENTE': pagar
    -- la cuenta corriente con la cuenta corriente no significa nada.
    method      TEXT NOT NULL DEFAULT 'CASH'
                CHECK (method IN ('CASH', 'CREDIT', 'DEBIT', 'TRANSFER', 'QR', 'OTHER')),
    notes       TEXT,
    created_by  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- El saldo se arma juntando los movimientos de un huésped, y el cierre de caja
-- pide los de un día.
CREATE INDEX IF NOT EXISTS idx_current_account_payments_guest
    ON public.current_account_payments(guest_id);
CREATE INDEX IF NOT EXISTS idx_current_account_payments_date
    ON public.current_account_payments(date);

COMMENT ON TABLE public.current_account_payments IS
    'Pagos que el huésped hace para bajar su cuenta corriente. Los cargos no viven acá: son los payments con method = CUENTA_CORRIENTE de sus reservas.';


-- ─── 4. Permisos, con el mismo criterio que el resto de la plata ──────
ALTER TABLE public.current_account_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "current_account_payments_read" ON public.current_account_payments;
    DROP POLICY IF EXISTS "current_account_payments_write" ON public.current_account_payments;
END $$;

CREATE POLICY "current_account_payments_read" ON public.current_account_payments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "current_account_payments_write" ON public.current_account_payments
    FOR ALL TO authenticated
    USING (public.current_user_role() IN ('admin', 'reception'))
    WITH CHECK (public.current_user_role() IN ('admin', 'reception'));
