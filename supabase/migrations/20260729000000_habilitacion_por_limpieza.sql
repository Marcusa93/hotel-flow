-- Limpieza habilita la habitación, o no.
--
-- Hasta ahora terminar la tarea de limpieza mandaba la habitación a AVAILABLE
-- sola, sin preguntar. Pero la que estuvo adentro es la única que sabe si quedó
-- en condiciones: falta una almohada, la ducha pierde, el control remoto no
-- está. Eso se decía de palabra o no se decía.
--
-- Van dos cosas separadas a propósito:
--
--   housekeeping_hold  — "no la habilito". La habitación está limpia pero no
--                        para recibir a alguien.
--   housekeeping_note  — la advertencia. Puede existir sin el bloqueo: "falta
--                        una almohada" no impide alojar a nadie, pero recepción
--                        tiene que saberlo antes de prometer algo.
--
-- No se usa el status para esto. MAINTENANCE y OUT_OF_ORDER los pone recepción o
-- administración por sus propios motivos; meter acá la decisión de limpieza
-- haría imposible saber cuál de los dos trabó la habitación y quién puede
-- destrabarla.

ALTER TABLE public.rooms
    ADD COLUMN IF NOT EXISTS housekeeping_hold    BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS housekeeping_note    TEXT,
    ADD COLUMN IF NOT EXISTS housekeeping_note_by TEXT,
    ADD COLUMN IF NOT EXISTS housekeeping_note_at TIMESTAMPTZ;

COMMENT ON COLUMN public.rooms.housekeeping_hold IS
    'Limpieza no habilitó la habitación. No bloquea el check-in —recepción sigue pudiendo forzarlo— pero avisa fuerte.';
COMMENT ON COLUMN public.rooms.housekeeping_note IS
    'Qué le pasa a la habitación según limpieza. Independiente del bloqueo: una advertencia sola también sirve.';


-- ─── Quién puede tocar esto ───────────────────────────────────────────
-- El pedido es que limpieza sea la que habilita. RLS no alcanza: la política de
-- UPDATE sobre rooms es por fila y recepción la necesita para mover el status.
-- Así que el límite va por columna, en un trigger.
CREATE OR REPLACE FUNCTION public.enforce_housekeeping_hold_author()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.housekeeping_hold IS DISTINCT FROM OLD.housekeeping_hold
       OR NEW.housekeeping_note IS DISTINCT FROM OLD.housekeeping_note
    THEN
        -- current_user_role() devuelve NULL fuera de una sesión de usuario (el
        -- editor SQL, la service key, un job). Ahí no se corta: esto limita a
        -- recepción, no a quien administra la base.
        IF public.current_user_role() IS NOT NULL
           AND public.current_user_role() NOT IN ('admin', 'housekeeping')
        THEN
            RAISE EXCEPTION 'Solo limpieza o administración pueden habilitar o bloquear una habitación';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_housekeeping_hold_author ON public.rooms;
CREATE TRIGGER trg_enforce_housekeeping_hold_author
    BEFORE UPDATE ON public.rooms
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_housekeeping_hold_author();

-- PostgREST cachea el esquema; sin esto las columnas nuevas siguen dando 400.
NOTIFY pgrst, 'reload schema';
