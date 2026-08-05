-- Corregir la fecha de un cobro: que no se pueda tocar una caja ya rendida.
--
-- El cobro que se cargó con la fecha equivocada ahora se corrige desde el menú
-- del cobro. Es lo que recepción venía resolviendo a mano de la peor manera:
-- marcarlo Reembolsado y volver a cargarlo con la fecha buena.
--
-- El problema de mover una fecha es que un cobro pertenece a la caja del día que
-- dice su fecha. Sacarlo de un día ya cerrado cambia lo que se rindió, y meterlo
-- en uno ya cerrado también. El cliente ya lo bloquea, pero la guarda de pantalla
-- se cae sola en cuanto la lista de cierres viene vieja del caché, y no existe
-- para nadie que le pegue directo a la API. Esta es la que no se puede esquivar.
--
-- Es a propósito una prohibición y no un aviso. El detector que ya existe
-- —contrastar el corte guardado contra lo que dan los números hoy— compara cinco
-- totales: dos correcciones opuestas del mismo monto se cancelan y no levanta
-- nada, y lo cargado a cuenta corriente no está en ninguno de los cinco. Además
-- recepción puede cobrar pero no puede reabrir ni volver a cerrar una caja: si la
-- descuadra, no tiene con qué arreglarla. El camino queda siendo el mismo de
-- siempre — administración reabre, se corrige, administración vuelve a cerrar —
-- y la reapertura ya deja su propio rastro.

CREATE OR REPLACE FUNCTION public.payments_guard_closed_day()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    dia_viejo DATE;
    dia_nuevo DATE;
    cerrados  TEXT;
BEGIN
    -- Un UPDATE que menciona la fecha sin cambiarla no es una reimputación:
    -- así "Marcar Pagado" y cualquier corrección de monto o método siguen pasando.
    IF NEW.date IS NOT DISTINCT FROM OLD.date THEN
        RETURN NEW;
    END IF;

    -- El día se lee en el huso del hotel y no en UTC. Un ::date crudo sobre un
    -- cobro de las 21 de Argentina ya devuelve el día siguiente, que es
    -- exactamente el corrimiento que esta función tiene que evitar. Va fijo
    -- porque todo el cliente asume lo mismo: el día de un movimiento sale del
    -- calendario local del navegador.
    dia_viejo := (OLD.date AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
    dia_nuevo := (NEW.date AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;

    -- reopened_at IS NULL es lo mismo que dice isDayClosed en el cliente: un día
    -- reabierto vuelve a contar como pendiente y sí se puede tocar.
    SELECT string_agg(to_char(c.closing_date, 'DD/MM/YYYY'), ' y ' ORDER BY c.closing_date)
      INTO cerrados
      FROM public.cash_closings c
     WHERE c.reopened_at IS NULL
       AND c.closing_date IN (dia_viejo, dia_nuevo);

    IF cerrados IS NOT NULL THEN
        RAISE EXCEPTION
            'La caja del % ya está cerrada: para mover este cobro hay que reabrirla primero.', cerrados
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.payments_guard_closed_day() IS
    'Impide reimputar un cobro desde o hacia un día con cierre firmado. Los días reabiertos sí se pueden tocar.';

DROP TRIGGER IF EXISTS payments_guard_closed_day ON public.payments;

-- BEFORE UPDATE OF date: no se mete en el camino de ningún otro cambio del cobro.
CREATE TRIGGER payments_guard_closed_day
    BEFORE UPDATE OF date ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.payments_guard_closed_day();
