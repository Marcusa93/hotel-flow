-- El cheque como forma de pago.
--
-- El hotel recibe cheques y no había dónde anotarlos: quedaban como "Otro", que
-- no dice nada, o forzados a Transferencia, que dice algo falso.
--
-- Mecánicamente es un método más, como QR o transferencia: entra a los ingresos
-- del día y no al efectivo a rendir, porque no sale plata del cajón.
--
-- Pero tiene algo que ningún otro método tiene: es un papel que queda físicamente
-- en el mostrador. Una transferencia se va sola al banco; un cheque hay que
-- llevárselo. Por eso el cierre lo muestra en un renglón aparte —lo que hay que
-- entregar además del efectivo— y no simplemente sumado al total.
--
-- Se cuenta como plata que entró el día que se recibe, igual que los demás. Los
-- diferidos y los que rebotan no se modelan: eso es un sistema de valores a
-- cobrar, y no es lo que el hotel necesita hoy.

-- ─────────────────────────────────────────────────────────────────────
-- 1. CHEQUE entra en la lista de métodos, en las cuatro tablas que la usan
-- ─────────────────────────────────────────────────────────────────────
-- Las cuatro y no solo `payments`: si mañana pagan un gasto con cheque o un
-- huésped salda su cuenta corriente con uno, la lista tiene que ser la misma en
-- todos lados. Que un método exista en una tabla y no en la de al lado es la
-- clase de diferencia que aparece recién cuando alguien la necesita.

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_method_check
    CHECK (method IN ('CASH', 'CREDIT', 'DEBIT', 'TRANSFER', 'QR', 'CHEQUE', 'OTHER', 'CUENTA_CORRIENTE'));

ALTER TABLE public.other_income DROP CONSTRAINT IF EXISTS other_income_method_check;
ALTER TABLE public.other_income ADD CONSTRAINT other_income_method_check
    CHECK (method IN ('CASH', 'CREDIT', 'DEBIT', 'TRANSFER', 'QR', 'CHEQUE', 'OTHER'));

ALTER TABLE public.current_account_payments DROP CONSTRAINT IF EXISTS current_account_payments_method_check;
ALTER TABLE public.current_account_payments ADD CONSTRAINT current_account_payments_method_check
    CHECK (method IN ('CASH', 'CREDIT', 'DEBIT', 'TRANSFER', 'QR', 'CHEQUE', 'OTHER'));

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_method_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_method_check
    CHECK (method IS NULL OR method IN ('CASH', 'CREDIT', 'DEBIT', 'TRANSFER', 'QR', 'CHEQUE', 'OTHER'));

-- ─────────────────────────────────────────────────────────────────────
-- 2. De quién es el cheque
-- ─────────────────────────────────────────────────────────────────────
-- El número va en `reference`, que ya existe y es justamente eso: el
-- identificador externo del cobro. Así aparece solo en la tabla de Finanzas y en
-- el recibo, sin tocar nada. Lo único que faltaba era el librador.
--
-- Opcional a propósito: si el recepcionista tiene el papel en la mano y lo
-- guarda, el cobro no puede quedar sin registrar porque falte un dato que se
-- puede completar después mirando el cheque.

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS cheque_holder TEXT;

COMMENT ON COLUMN public.payments.cheque_holder IS
    'A nombre de quién viene el cheque. Opcional. El número va en reference.';

NOTIFY pgrst, 'reload schema';
