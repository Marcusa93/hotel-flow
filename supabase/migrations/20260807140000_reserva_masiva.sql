-- Reserva masiva: varias habitaciones para un mismo grupo.
--
-- El alquiler del hotel completo se lleva TODO y lo cierra para el resto. Lo que
-- falta es el caso de al lado: un contingente que toma seis habitaciones y deja
-- las otras a la venta.
--
-- Y una diferencia de flujo: recepción arma la reserva SIN precio, porque el
-- precio de un grupo se negocia y lo cierra administración. Recién ahí se tarifa.
--
-- ─── Por qué un grupo de reservas y no una reserva con muchas habitaciones ───
--
-- Una reserva tiene UNA habitación en todo el sistema: el check-in, la limpieza,
-- la ocupación y el tablero están construidos sobre eso. Meterle varias
-- habitaciones a una reserva obligaría a rehacer los cuatro, en un sistema que
-- está en uso.
--
-- Así, cada habitación es una reserva normal y el grupo las une. El contingente
-- puede llegar de a poco y hacer check-in cuarto por cuarto, limpieza ve lo de
-- siempre, y el grupo solo agrega lo que no existía: un precio para el conjunto.

CREATE TABLE IF NOT EXISTS public.booking_groups (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- A nombre de quién: la empresa, el equipo, quien contrata.
    guest_id      UUID REFERENCES public.guests(id) ON DELETE SET NULL,
    notes         TEXT,

    -- NULL es "a tarifar", y es un estado real, no un dato faltante: la reserva
    -- nace así y alguien tiene que ir a ponerle precio. Por eso NULL y no 0 —en
    -- cero el grupo figuraría sin deuda y podría irse sin que nadie note nada.
    total_amount  NUMERIC CHECK (total_amount IS NULL OR total_amount >= 0),
    priced_at     TIMESTAMPTZ,
    priced_by     UUID,
    priced_by_name TEXT,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    UUID,
    created_by_name TEXT
);

COMMENT ON TABLE public.booking_groups IS
    'Un contingente que toma varias habitaciones. Las reservas siguen siendo una por habitación; esto les pone un precio en común. total_amount NULL = falta tarifarla.';

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.booking_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_group_id
    ON public.bookings(group_id) WHERE group_id IS NOT NULL;

-- Los pendientes de tarifar se buscan seguido: es la lista que mira
-- administración.
CREATE INDEX IF NOT EXISTS idx_booking_groups_sin_tarifar
    ON public.booking_groups(created_at DESC) WHERE total_amount IS NULL;

-- ─────────────────────────────────────────────────────────────────────
-- Tarifar el grupo: un solo movimiento, o ninguno
-- ─────────────────────────────────────────────────────────────────────
-- Poner el precio toca el grupo y todas sus reservas. Hecho desde el navegador
-- serían N+1 llamadas sueltas, y si se corta en el medio queda un grupo tarifado
-- con la mitad de las habitaciones en cero — que es peor que no haberlo tarifado,
-- porque ya no aparece en la lista de pendientes.
--
-- El reparto es en centavos enteros y el sobrante se distribuye de a uno entre
-- las primeras habitaciones. Dividir $100.000 entre 3 y redondear cada parte da
-- $99.999,99: la suma tiene que dar el total acordado, exacto.

CREATE OR REPLACE FUNCTION public.price_booking_group(
    p_group_id UUID,
    p_total    NUMERIC,
    p_by_name  TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count   INT;
    v_cents   BIGINT;
    v_base    BIGINT;
    v_extra   BIGINT;
BEGIN
    IF public.current_user_role() <> 'admin' THEN
        RAISE EXCEPTION 'Solo administración puede ponerle precio a una reserva masiva';
    END IF;

    IF p_total IS NULL OR p_total < 0 THEN
        RAISE EXCEPTION 'El monto tiene que ser cero o más';
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.bookings WHERE group_id = p_group_id;
    IF v_count = 0 THEN
        RAISE EXCEPTION 'La reserva masiva no tiene habitaciones';
    END IF;

    v_cents := ROUND(p_total * 100);
    v_base  := v_cents / v_count;
    v_extra := v_cents - (v_base * v_count);

    -- El orden del reparto es estable —por habitación y fecha— para que tarifar
    -- dos veces el mismo monto dé exactamente lo mismo.
    WITH ordenadas AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY room_id, check_in_date, id) AS n
        FROM public.bookings WHERE group_id = p_group_id
    )
    UPDATE public.bookings b
    SET total_amount = (v_base + CASE WHEN o.n <= v_extra THEN 1 ELSE 0 END) / 100.0
    FROM ordenadas o
    WHERE b.id = o.id;

    UPDATE public.booking_groups
    SET total_amount   = p_total,
        priced_at      = NOW(),
        priced_by      = auth.uid(),
        priced_by_name = p_by_name
    WHERE id = p_group_id;
END;
$$;

COMMENT ON FUNCTION public.price_booking_group(UUID, NUMERIC, TEXT) IS
    'Le pone precio a una reserva masiva y lo reparte entre sus habitaciones, todo en la misma transacción. Solo administración.';

REVOKE ALL ON FUNCTION public.price_booking_group(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.price_booking_group(UUID, NUMERIC, TEXT) TO authenticated;

-- ─── Permisos ─────────────────────────────────────────────────────────
ALTER TABLE public.booking_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_groups_read"   ON public.booking_groups;
DROP POLICY IF EXISTS "booking_groups_insert" ON public.booking_groups;
DROP POLICY IF EXISTS "booking_groups_update" ON public.booking_groups;

-- Recepción tiene que ver el grupo: es quien atiende al contingente.
CREATE POLICY "booking_groups_read" ON public.booking_groups
    FOR SELECT TO authenticated USING (true);

-- Y tiene que poder armarlo. El precio no lo pone acá: nace en NULL.
CREATE POLICY "booking_groups_insert" ON public.booking_groups
    FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_role() IN ('admin', 'reception')
        AND total_amount IS NULL
    );

-- Tarifar va por price_booking_group, que es transaccional y ya chequea el rol.
-- Esta política deja el resto —corregir el nombre del grupo, las notas— en manos
-- de administración.
CREATE POLICY "booking_groups_update" ON public.booking_groups
    FOR UPDATE TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- Sin DELETE: un grupo con reservas colgando no se borra, se cancelan sus
-- reservas.

NOTIFY pgrst, 'reload schema';
