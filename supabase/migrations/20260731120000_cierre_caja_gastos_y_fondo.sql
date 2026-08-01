-- Cierre de caja: con qué se pagó cada gasto, y el fondo fijo por día.
--
-- Del hotel, tres cosas:
--   1. "el cierre lo hacemos al día siguiente" — eso es de pantalla, no de base.
--   2. "en gasto no discrimina en qué se gastó, ni las cuentas en las que se gastó"
--   3. "un fondo fijo donde puedan poner el monto de la cuenta caja, y modificar
--      por día si quieren ese monto"

-- ─── 1. Con qué se pagó el gasto ──────────────────────────────────────
-- expenses guardaba fecha, rubro, monto y descripción. Con eso se sabe en qué se
-- gastó pero no de dónde salió la plata, y sin eso la caja no cuadra: un pago al
-- panadero en efectivo sale del cajón y el cierre seguía mandando a rendir todo.
--
-- Va NULL y sin default a propósito. Los gastos ya cargados no dicen con qué se
-- pagaron, y ponerles 'CASH' sería inventarlo: cambiaría el efectivo a rendir de
-- todos los cierres viejos hacia atrás. NULL se lee como "sin especificar" y no
-- descuenta de la caja; de acá en adelante el formulario lo pide siempre.
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS method TEXT;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_method_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_method_check
    CHECK (method IS NULL OR method IN ('CASH', 'CREDIT', 'DEBIT', 'TRANSFER', 'QR', 'OTHER'));

COMMENT ON COLUMN public.expenses.method IS
    'De dónde salió la plata. NULL en los gastos anteriores a esta columna: no descuenta del efectivo a rendir porque no se sabe si salió de la caja.';

-- El cierre pide los gastos de un día.
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);


-- ─── 2. El fondo fijo, por día ────────────────────────────────────────
-- hotel_settings.daily_cash_float ya guardaba un monto, pero uno solo para
-- siempre: cambiarlo movía el efectivo a rendir de todos los cierres pasados.
-- Pasa a ser el predeterminado, y cada día puede tener el suyo.
CREATE TABLE IF NOT EXISTS public.cash_floats (
    -- Un fondo por día. La fecha es la clave: no hay dos cajas el mismo día.
    date         DATE PRIMARY KEY,
    amount       NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
    -- Quién lo dejó en ese monto, por la misma razón que en los comprobantes.
    set_by       UUID,
    set_by_name  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.cash_floats IS
    'Fondo fijo de la caja por día. Sin fila para un día, vale hotel_settings.daily_cash_float.';


-- ─── 3. Permisos, con el mismo criterio que el resto de la plata ──────
ALTER TABLE public.cash_floats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_floats_read"  ON public.cash_floats;
DROP POLICY IF EXISTS "cash_floats_write" ON public.cash_floats;

CREATE POLICY "cash_floats_read" ON public.cash_floats
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "cash_floats_write" ON public.cash_floats
    FOR ALL TO authenticated
    USING (public.current_user_role() IN ('admin', 'reception'))
    WITH CHECK (public.current_user_role() IN ('admin', 'reception'));

-- PostgREST cachea el esquema; sin esto la tabla y la columna nuevas dan 400/404.
NOTIFY pgrst, 'reload schema';
