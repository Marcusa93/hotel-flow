-- Corregir el medio de pago de un cobro: que no se pueda tocar una caja rendida.
--
-- El huésped pagó en efectivo, recepción tocó QR y el cobro quedó cargado así.
-- Ahora se corrige desde el menú del cobro, igual que la fecha, en vez de la
-- maniobra que recepción venía usando: marcarlo Reembolsado y volver a cargarlo.
--
-- Cambiar el método mueve plata entre renglones del cierre. Si además entra o
-- sale del efectivo, mueve el número que se cuenta a mano al cerrar el turno. Y
-- es más silencioso que mover la fecha: el corte que se guarda al cerrar NO
-- incluye el desglose por método, así que el detector de cambios post-cierre
-- —contrastar el corte guardado contra lo que dan los números hoy— no lo ve ni
-- cuando el cambio es grande. Con la caja cerrada, entonces, no se toca.
--
-- Dos cosas hacen falta, y la segunda es una deuda del trigger que ya existía.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Una sola respuesta a "¿la caja de este instante está cerrada?"
-- ─────────────────────────────────────────────────────────────────────
-- El cliente ya sabe contestarla mirando las dos épocas del mismo libro: los
-- días firmados del sistema viejo (cash_closings) y los turnos cerrados del
-- nuevo (cash_sessions). La base sabía mirar solo la primera, y esa diferencia
-- es un agujero: los turnos son el sistema vigente desde el 06/08, así que el
-- trigger que protege la fecha viene dejando pasar por la API justo los cierres
-- que hoy se usan.
--
-- Vive en una función para que los dos triggers de abajo den exactamente la
-- misma respuesta. Dos copias de esta cuenta se despegan en el primer cambio.

CREATE OR REPLACE FUNCTION public.cash_lock_for(instant TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    dia       DATE;
    cerrado   TEXT;
    turno     RECORD;
BEGIN
    -- El día se lee en el huso del hotel y no en UTC. Un ::date crudo sobre un
    -- cobro de las 21 de Argentina ya devuelve el día siguiente. Va fijo porque
    -- todo el cliente asume lo mismo: el día de un movimiento sale del
    -- calendario local del navegador.
    dia := (instant AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;

    -- reopened_at IS NULL es lo mismo que dice isDayClosed en el cliente: un día
    -- reabierto vuelve a contar como pendiente y sí se puede tocar.
    SELECT to_char(c.closing_date, 'DD/MM/YYYY')
      INTO cerrado
      FROM public.cash_closings c
     WHERE c.reopened_at IS NULL
       AND c.closing_date = dia
     LIMIT 1;

    IF cerrado IS NOT NULL THEN
        RETURN 'la caja del ' || cerrado;
    END IF;

    -- El turno se mira por el INSTANTE y no por el día: el corte es el momento
    -- exacto en que se apretó "Cerrar caja", que es cómo el cliente decide qué
    -- entra en cada turno (belongsToSessionInterval). El intervalo es
    -- [apertura, cierre), y si se solaparan gana el de apertura más reciente,
    -- que es el mismo criterio de sessionAt.
    SELECT s.opened_at, s.closed_at
      INTO turno
      FROM public.cash_sessions s
     WHERE s.opened_at <= instant
       AND (s.closed_at IS NULL OR instant < s.closed_at)
     ORDER BY s.opened_at DESC
     LIMIT 1;

    IF turno.closed_at IS NOT NULL THEN
        RETURN 'el turno cerrado el ' ||
               to_char(turno.closed_at AT TIME ZONE 'America/Argentina/Buenos_Aires',
                       'DD/MM/YYYY HH24:MI');
    END IF;

    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.cash_lock_for(TIMESTAMPTZ) IS
    'Si el instante cae en una caja ya rendida, devuelve cómo nombrarla; si no, NULL. Mira las dos épocas: los días firmados de cash_closings y los turnos cerrados de cash_sessions. Espejo de isDayClosed + sessionAt del cliente.';

-- ─────────────────────────────────────────────────────────────────────
-- 2. El método no se cambia dentro de una caja cerrada
-- ─────────────────────────────────────────────────────────────────────
-- Es a propósito una prohibición y no un aviso, por lo mismo que en la fecha:
-- recepción puede cobrar pero no puede reabrir ni volver a cerrar una caja, así
-- que dejarla descuadrar un cierre firmado es dejarla romper algo que después no
-- puede arreglar. El camino queda siendo el de siempre — administración reabre,
-- se corrige, administración vuelve a cerrar — y la reapertura deja su rastro.
--
-- Bloquea también los cambios que no tocan el efectivo, como QR a transferencia.
-- "Con la caja cerrada no se toca" se explica en una frase en el mostrador; una
-- regla que depende de qué par de métodos son se explica mal y se recuerda peor.

CREATE OR REPLACE FUNCTION public.payments_guard_method_closed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caja TEXT;
BEGIN
    -- Un UPDATE que menciona el método sin cambiarlo no es una recategorización:
    -- así "Marcar Pagado", la corrección de fecha y cualquier otro cambio del
    -- cobro siguen pasando aunque el UPDATE incluya la columna.
    IF NEW.method IS NOT DISTINCT FROM OLD.method THEN
        RETURN NEW;
    END IF;

    -- El cobro se queda donde está: corregir el método no lo saca de su caja, así
    -- que hay una sola que mirar. Se mira por la fecha vieja porque es la que el
    -- cobro tiene mientras esto corre; si el mismo UPDATE cambiara las dos, el
    -- trigger de la fecha ya rechazó por su lado.
    caja := public.cash_lock_for(OLD.date);

    IF caja IS NOT NULL THEN
        RAISE EXCEPTION
            'Ya se rindió % : para cambiar el medio de pago de este cobro hay que reabrirla primero.', caja
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.payments_guard_method_closed() IS
    'Impide cambiarle el medio de pago a un cobro que vive en una caja ya rendida. El desglose por método no queda en el corte guardado, así que este cambio no lo detecta nada más.';

DROP TRIGGER IF EXISTS payments_guard_method_closed ON public.payments;

-- BEFORE UPDATE OF method: no se mete en el camino de ningún otro cambio del cobro.
CREATE TRIGGER payments_guard_method_closed
    BEFORE UPDATE OF method ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.payments_guard_method_closed();

-- ─────────────────────────────────────────────────────────────────────
-- 3. Y la fecha pasa a mirar también los turnos
-- ─────────────────────────────────────────────────────────────────────
-- La guarda de la fecha se escribió cuando la caja se cerraba por día
-- calendario. Desde que existen los turnos (06/08), un cobro puede estar dentro
-- de un turno cerrado sin que haya ningún cash_closings firmado para ese día: el
-- cliente lo bloquea, la base lo dejaba pasar. Es el mismo agujero que la guarda
-- del método ya no tiene, y no tiene sentido dejarlo abierto solo acá.
--
-- Nadie pierde un camino que hoy funcione: la pantalla ya rechaza estas
-- correcciones. Lo que cambia es que ahora tampoco pasan por la API.

CREATE OR REPLACE FUNCTION public.payments_guard_closed_day()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caja_vieja TEXT;
    caja_nueva TEXT;
BEGIN
    -- Un UPDATE que menciona la fecha sin cambiarla no es una reimputación: así
    -- "Marcar Pagado" y cualquier corrección de monto o método siguen pasando.
    IF NEW.date IS NOT DISTINCT FROM OLD.date THEN
        RETURN NEW;
    END IF;

    -- Las dos cajas: la que pierde el cobro y la que lo recibe. Sacarlo de una
    -- rendida cambia lo que se rindió, y meterlo en una rendida también.
    caja_vieja := public.cash_lock_for(OLD.date);
    caja_nueva := public.cash_lock_for(NEW.date);

    IF caja_vieja IS NOT NULL OR caja_nueva IS NOT NULL THEN
        RAISE EXCEPTION
            'Ya se rindió % : para mover este cobro hay que reabrirla primero.',
            COALESCE(caja_vieja, caja_nueva)
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.payments_guard_closed_day() IS
    'Impide reimputar un cobro desde o hacia una caja ya rendida, sea un día firmado de cash_closings o un turno cerrado de cash_sessions. Los días reabiertos sí se pueden tocar.';

NOTIFY pgrst, 'reload schema';
