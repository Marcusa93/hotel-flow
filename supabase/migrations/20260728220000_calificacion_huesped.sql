-- Calificación interna del huésped.
--
-- El que rompió algo, el que se fue debiendo, el que hizo lío a las tres de la
-- mañana: eso hoy vive en la memoria del que estaba esa noche. El turno
-- siguiente le vuelve a dar la mejor habitación sin enterarse.
--
-- Las notas ya existen y no alcanzan: son texto libre, hay que leerlas enteras
-- y no se pueden mirar de un vistazo en la lista. La calificación es un dato
-- aparte justamente para poder verla sin abrir la ficha.
--
-- Es interna. No se imprime en la ficha del huésped ni sale en ninguna
-- exportación que pueda terminar en manos del huésped.

ALTER TABLE public.guests
    ADD COLUMN IF NOT EXISTS rating TEXT
        CHECK (rating IS NULL OR rating IN ('BUENO', 'ATENCION', 'NO_DESEADO'));

-- NULL es "sin calificar", que es lo que son todos hasta que alguien opine.
-- Sin default: un huésped nuevo no es bueno ni malo, es desconocido.
COMMENT ON COLUMN public.guests.rating IS
    'Calificación interna: BUENO, ATENCION (con reparos) o NO_DESEADO. NULL = sin calificar.';

-- El motivo. Sin esto la calificación es una etiqueta que nadie puede discutir
-- ni levantar, porque no dice qué pasó.
ALTER TABLE public.guests
    ADD COLUMN IF NOT EXISTS rating_notes TEXT;

-- Quién opinó y cuándo. El nombre y no el id de usuario, por la misma razón que
-- en los comprobantes: el perfil se puede renombrar o dar de baja y esto tiene
-- que seguir diciendo quién fue. Además evita el join en una lista que se
-- muestra entera.
ALTER TABLE public.guests
    ADD COLUMN IF NOT EXISTS rating_by TEXT;

ALTER TABLE public.guests
    ADD COLUMN IF NOT EXISTS rating_at TIMESTAMPTZ;

-- Los permisos ya están: guests se escribe desde admin y recepción, que son
-- los que atienden al huésped y tienen algo que decir sobre cómo se portó.
