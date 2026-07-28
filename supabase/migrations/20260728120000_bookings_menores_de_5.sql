-- Los menores de 5 años, aparte del resto de los menores.
--
-- El hotel cobra por cantidad de personas: los tipos de habitación son tramos
-- de capacidad ("Hab. 4 personas") y cada uno tiene su precio base. Faltaba que
-- el precio siguiera a la gente: una quíntuple con cuatro adentro se cobraba
-- quíntuple igual.
--
-- Para eso hay que saber a cuántos se les cobra, y ahí no alcanzaba con las dos
-- columnas que había. adults y children guardan cantidades, no edades, así que
-- un bebé y un chico de doce eran el mismo número. Como el hotel no cobra a los
-- menores de 5, se separan en su propia columna: se cobran adults + children, y
-- infants queda afuera del precio.
--
-- Ocupan lugar aunque no se cobren: la capacidad de la habitación los cuenta.
--
-- Default 0 y sin backfill a propósito. Las reservas ya cargadas quedan con
-- infants = 0, o sea que sus menores se siguen contando como hasta ahora y
-- ninguna cambia de precio: total_amount ya está escrito y esto no lo recalcula.

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS infants INTEGER NOT NULL DEFAULT 0
        CHECK (infants >= 0);

COMMENT ON COLUMN public.bookings.infants IS
    'Menores de 5 años. Ocupan lugar en la habitación pero no cuentan para el precio: el tramo se calcula con adults + children.';
