-- La caja de la empresa pasa a ser el acumulado del hotel.
--
-- Hasta ahora era un fondo que se reponía a mano: alguien cargaba un aporte y
-- los gastos lo iban bajando. No encajaba con cómo el dueño piensa la plata —él
-- no aporta nada, gasta lo que el hotel ya generó— así que en la práctica no se
-- usó: un solo gasto marcado ahí y cero aportes.
--
-- Ahora se llena sola: lo que recepción rinde en cada cierre entra acá, y de acá
-- salen los pagos grandes (luz, internet, supermercado) que hace administración.
-- La caja diaria de recepción no se toca: sus gastos chicos siguen saliendo del
-- cajón como siempre.
--
-- Tres cosas hacen falta para eso, y las tres están abajo.

-- ─────────────────────────────────────────────────────────────────────
-- 1. De qué caja sale un gasto deja de depender de con qué se pagó
-- ─────────────────────────────────────────────────────────────────────
-- `cash_source` nació para repartir los gastos en EFECTIVO entre las dos cajas,
-- así que para todo lo demás valía null. Con eso, la luz pagada por
-- transferencia no podía imputarse a la caja de la empresa: no había dónde
-- decirlo. Y es justamente el caso más común de los pagos del dueño.
--
-- El campo pasa a significar "de qué caja salió", sin mirar el medio de pago.
-- Los gastos ya cargados no se tocan: null se sigue leyendo como RECAUDACION,
-- que es como se venían contando.

COMMENT ON COLUMN public.expenses.cash_source IS
    'De qué caja salió el gasto, sin importar el medio de pago. RECAUDACION = del cajón del día, baja el efectivo a rendir si fue en efectivo. EMPRESA = del acumulado del hotel, no toca el cierre de recepción. NULL = gasto viejo, se lee como RECAUDACION.';

-- ─────────────────────────────────────────────────────────────────────
-- 2. El saldo se calcula en la base y no en el navegador
-- ─────────────────────────────────────────────────────────────────────
-- Es un acumulado histórico: todo lo que entró menos todo lo que se gastó, sin
-- recorte de fecha. El resto de la app trae las tablas enteras y suma en el
-- navegador, y para la pantalla del día alcanza; acá no. PostgREST corta en mil
-- filas, así que en cuanto el hotel acumule historia el saldo empezaría a dar
-- de menos sin avisar — y un saldo silenciosamente equivocado es peor que no
-- tenerlo.
--
-- Las tres fuentes de plata son las mismas que en el cierre y en el resumen del
-- mes: cobros de reservas, ingresos que no salen de una reserva, y lo que los
-- huéspedes traen para bajar su cuenta corriente. La cuenta corriente ANOTADA
-- queda afuera por lo de siempre: la reserva se saldó, pero no entró un peso.
--
-- Y se restan TODOS los gastos, no solo los de la empresa: los que recepción
-- pagó del cajón también son plata que el hotel gastó y que ya no está.

-- Va en SECURITY DEFINER porque tiene que leer los gastos de la empresa, que la
-- política de abajo le esconde a recepción. Eso obliga a poner el control de
-- acceso adentro: el rol 'admin' vive en la tabla profiles y no es un rol de
-- Postgres, así que con GRANT no se puede distinguir. Sin esta guarda,
-- recepción llamaría a la función y deduciría por diferencia justo lo que no
-- puede ver.

CREATE OR REPLACE FUNCTION public.company_cash_balance()
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.current_user_role() <> 'admin' THEN
        RAISE EXCEPTION 'Solo administración puede ver el saldo de la caja de la empresa';
    END IF;

    RETURN
        COALESCE((
            SELECT SUM(amount) FROM public.payments
            WHERE status = 'PAID' AND method <> 'CUENTA_CORRIENTE'
        ), 0)
        + COALESCE((SELECT SUM(amount) FROM public.other_income), 0)
        + COALESCE((SELECT SUM(amount) FROM public.current_account_payments), 0)
        - COALESCE((SELECT SUM(amount) FROM public.expenses), 0);
END;
$$;

COMMENT ON FUNCTION public.company_cash_balance() IS
    'Lo recaudado por el hotel desde siempre, menos todo lo gastado. Es el saldo de la caja de la empresa: de acá salen los pagos grandes que hace administración. Solo administración puede llamarla.';

REVOKE ALL ON FUNCTION public.company_cash_balance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_cash_balance() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Los gastos de la empresa los ve y los carga solo administración
-- ─────────────────────────────────────────────────────────────────────
-- En la base y no solo escondiendo la pantalla: si la regla vive únicamente en
-- el navegador, recepción los ve igual por cualquier otro camino que lea la
-- tabla.
--
-- La política vieja era FOR ALL, que incluye el SELECT. Como las políticas
-- permisivas se combinan con OR, dejarla habría anulado el filtro de lectura de
-- acá abajo: recepción seguiría viendo todo. Por eso se parte en una por
-- operación.

DROP POLICY IF EXISTS "expenses_read"   ON public.expenses;
DROP POLICY IF EXISTS "expenses_write"  ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete" ON public.expenses;

-- Leer: los del cajón los ve todo el mundo —recepción necesita verlos para
-- cuadrar su cierre—; los de la empresa, solo administración.
CREATE POLICY "expenses_read" ON public.expenses
    FOR SELECT TO authenticated
    USING (
        COALESCE(cash_source, 'RECAUDACION') = 'RECAUDACION'
        OR public.current_user_role() = 'admin'
    );

-- Cargar: recepción sigue cargando sus gastos del cajón, como viene haciendo.
-- Imputar a la caja de la empresa es de administración.
CREATE POLICY "expenses_insert" ON public.expenses
    FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_role() = 'admin'
        OR (
            public.current_user_role() = 'reception'
            AND COALESCE(cash_source, 'RECAUDACION') = 'RECAUDACION'
        )
    );

-- Corregir: mismo criterio, en los dos extremos. USING mira el gasto como está
-- —recepción no puede tocar uno de la empresa— y WITH CHECK mira cómo queda
-- —recepción no puede mudar el suyo a la caja de la empresa—. Con una sola de
-- las dos, la regla se esquiva editando.
CREATE POLICY "expenses_update" ON public.expenses
    FOR UPDATE TO authenticated
    USING (
        public.current_user_role() = 'admin'
        OR (
            public.current_user_role() = 'reception'
            AND COALESCE(cash_source, 'RECAUDACION') = 'RECAUDACION'
        )
    )
    WITH CHECK (
        public.current_user_role() = 'admin'
        OR (
            public.current_user_role() = 'reception'
            AND COALESCE(cash_source, 'RECAUDACION') = 'RECAUDACION'
        )
    );

CREATE POLICY "expenses_delete" ON public.expenses
    FOR DELETE TO authenticated
    USING (
        public.current_user_role() = 'admin'
        OR (
            public.current_user_role() = 'reception'
            AND COALESCE(cash_source, 'RECAUDACION') = 'RECAUDACION'
        )
    );

NOTIFY pgrst, 'reload schema';
