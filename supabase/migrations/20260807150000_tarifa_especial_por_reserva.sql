-- La tarifa especial pasa a decidirse en cada reserva, y puede ser cero.
--
-- Existía desde el 28/07 pero como UN monto para todo el hotel, cargado en
-- Configuración. Dos cosas la hacían inservible para lo que el hotel necesita:
--
--   Un solo número. Si a un amigo se le hace $30.000 y a otro $50.000, había que
--   ir a Configuración y cambiar el monto entre una reserva y la otra.
--
--   En cero desaparecía. `special_rate_amount > 0` era la condición para que la
--   opción se ofreciera al reservar, así que el caso de los dueños —que se
--   alojan y no pagan— era justamente el único que no se podía cargar.
--
-- Ahora el monto se escribe en la reserva. El de Configuración queda como
-- sugerido: precarga el campo y se pisa cuando hace falta.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Por qué se le hizo el precio
-- ─────────────────────────────────────────────────────────────────────
-- Una reserva en cero sin explicación es imposible de auditar después. Cuando en
-- el resumen del mes aparezcan habitaciones ocupadas que no generaron un peso,
-- este campo es lo que evita tener que acordarse.

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS special_rate_reason TEXT;

COMMENT ON COLUMN public.bookings.special_rate_reason IS
    'Por qué se le hizo tarifa especial: "dueño", "cortesía", "amigo de X".';

-- ─────────────────────────────────────────────────────────────────────
-- 1b. Marcada pero todavía sin precio
-- ─────────────────────────────────────────────────────────────────────
-- Recepción no pone el precio, pero sí tiene que poder marcar la reserva: si
-- llega un amigo del dueño un domingo a la noche, no puede quedar trabada
-- esperando a administración. La marca y queda "a tarifar", igual que la reserva
-- masiva.
--
-- Es una columna aparte y no un monto en cero, porque cero es un precio válido
-- —el dueño se aloja y no paga— y hay que poder distinguir "ya se decidió que no
-- paga" de "todavía nadie decidió cuánto".
--
-- Los tres estados que existen:
--   pending = false, amount = NULL    → reserva normal
--   pending = true,  amount = NULL    → marcada, falta el precio
--   pending = false, amount = número  → tarifada (el número puede ser 0)

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS special_rate_pending BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.bookings.special_rate_pending IS
    'La reserva va con tarifa especial y todavía no tiene precio. La marca recepción; administración la tarifa y esto vuelve a FALSE.';

CREATE INDEX IF NOT EXISTS idx_bookings_tarifa_pendiente
    ON public.bookings(check_in_date) WHERE special_rate_pending;

COMMENT ON COLUMN public.hotel_settings.special_rate_amount IS
    'Precio por noche SUGERIDO para la tarifa especial: precarga el campo al reservar. El monto que vale es el de cada reserva. En 0 el campo arranca vacío, pero la opción se ofrece igual.';

-- ─────────────────────────────────────────────────────────────────────
-- 2. El PRECIO lo pone administración; la marca la pone cualquiera
-- ─────────────────────────────────────────────────────────────────────
-- Es el mismo criterio que en la reserva masiva y en los gastos: el precio lo
-- decide administración. Y acá pesa más que en ningún lado — una reserva en cero
-- no genera deuda ni alerta, así que quien pueda ponerle el monto puede regalar
-- una habitación sin que quede nada que mirar.
--
-- Marcarla, en cambio, no mueve plata: es decir "a esta hay que hacerle un
-- precio". Eso lo hace recepción, y por eso el trigger de abajo mira el monto y
-- no la marca.
--
-- El control NO puede vivir en la política de UPDATE, y esto es lo que casi se
-- rompe: una política que le prohíba a recepción tocar las reservas con tarifa
-- especial le prohíbe también hacerles el CHECK-IN, que es un update como
-- cualquier otro. El dueño se aloja gratis y recepción no lo puede registrar.
--
-- Lo que hay que impedir no es tocar la reserva: es cambiar el precio. Y eso
-- necesita comparar el valor viejo contra el nuevo, que una política RLS no
-- puede hacer —solo ve una fila por vez—. Por eso va en un trigger.

-- Cargar una reserva ya con el monto puesto sí se ataja en la política: en un
-- INSERT no hay valor viejo con qué comparar. Marcarla como pendiente pasa.
DROP POLICY IF EXISTS "bookings_write"  ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update" ON public.bookings;
DROP POLICY IF EXISTS "bookings_delete" ON public.bookings;

CREATE POLICY "bookings_insert" ON public.bookings
    FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_role() = 'admin'
        OR (
            public.current_user_role() = 'reception'
            AND special_rate_amount IS NULL
        )
    );

-- Recepción sigue trabajando con normalidad: check-in, check-out, cambios de
-- habitación, cancelaciones. Lo único que no puede es mover el precio especial,
-- y de eso se ocupa el trigger de abajo.
CREATE POLICY "bookings_update" ON public.bookings
    FOR UPDATE TO authenticated
    USING (public.current_user_role() IN ('admin', 'reception'))
    WITH CHECK (public.current_user_role() IN ('admin', 'reception'));

CREATE POLICY "bookings_delete" ON public.bookings
    FOR DELETE TO authenticated
    USING (public.current_user_role() IN ('admin', 'reception'));

CREATE OR REPLACE FUNCTION public.guard_special_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Solo cuando el precio especial CAMBIA. Un check-in no lo toca, así que
    -- pasa de largo. IS DISTINCT FROM y no <>: con NULL de un lado, <> da NULL
    -- y la guarda no se dispararía nunca.
    IF NEW.special_rate_amount IS DISTINCT FROM OLD.special_rate_amount
       AND public.current_user_role() <> 'admin' THEN
        RAISE EXCEPTION 'Solo administración puede poner o cambiar la tarifa especial';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_special_rate ON public.bookings;
CREATE TRIGGER trg_guard_special_rate
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_special_rate();

NOTIFY pgrst, 'reload schema';
