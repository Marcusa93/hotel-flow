-- Dos cajas: la recaudación y la que pone la empresa para gastar.
--
-- Del hotel: "estaría bueno poner efectivo ingresado por la empresa y que cuando
-- hagan gasto puedan seleccionar que se pagó con eso, que es el efectivo interno
-- para ese tipo de gastos".
--
-- Son dos pozos distintos y hasta ahora eran uno solo:
--
--   RECAUDACION — lo cobrado a huéspedes en efectivo. Es lo que se rinde.
--   EMPRESA     — plata que pone el hotel para las compras del día (panadería,
--                 verdulería). No es un ingreso: no se ganó, se puso.
--
-- Mezclarlas tiene dos consecuencias feas y las dos se arreglan acá: la compra
-- del panadero bajaba el efectivo a rendir aunque se pagara con plata de la
-- empresa, y no había forma de saber cuánto de ese fondo quedaba.

-- ─── 1. Los aportes de la empresa ─────────────────────────────────────
-- Tabla propia y no other_income: un aporte NO es un ingreso del día. Cargarlo
-- ahí sumaría al resultado y el hotel figuraría ganando la plata que puso.
CREATE TABLE IF NOT EXISTS public.cash_contributions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    amount          NUMERIC NOT NULL CHECK (amount > 0),
    notes           TEXT,
    created_by      UUID,
    -- El nombre además del id, por la misma razón que en los comprobantes.
    created_by_name TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- El cierre pide los del día; el saldo, todos.
CREATE INDEX IF NOT EXISTS idx_cash_contributions_date
    ON public.cash_contributions(date);

COMMENT ON TABLE public.cash_contributions IS
    'Efectivo que la empresa pone en la caja para gastos. No es ingreso: no suma al resultado del día, solo al efectivo disponible para comprar.';


-- ─── 2. De qué caja salió el gasto ────────────────────────────────────
-- Solo tiene sentido cuando method = 'CASH': una transferencia no sale de
-- ninguna de las dos cajas.
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS cash_source TEXT;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_cash_source_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_cash_source_check
    CHECK (cash_source IS NULL OR cash_source IN ('RECAUDACION', 'EMPRESA'));

COMMENT ON COLUMN public.expenses.cash_source IS
    'De qué caja salió un gasto en efectivo. NULL en los no-efectivo y en los cargados antes de esta columna, que se leen como RECAUDACION porque así se venían contando.';


-- ─── 3. Permisos, con el mismo criterio que el resto de la plata ──────
ALTER TABLE public.cash_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_contributions_read"  ON public.cash_contributions;
DROP POLICY IF EXISTS "cash_contributions_write" ON public.cash_contributions;

CREATE POLICY "cash_contributions_read" ON public.cash_contributions
    FOR SELECT TO authenticated USING (true);

-- Recepción también: es la que recibe el sobre y lo carga en el momento, sin
-- depender de que esté administración.
CREATE POLICY "cash_contributions_write" ON public.cash_contributions
    FOR ALL TO authenticated
    USING (public.current_user_role() IN ('admin', 'reception'))
    WITH CHECK (public.current_user_role() IN ('admin', 'reception'));

-- PostgREST cachea el esquema; sin esto la tabla y la columna nuevas dan 400/404.
NOTIFY pgrst, 'reload schema';
