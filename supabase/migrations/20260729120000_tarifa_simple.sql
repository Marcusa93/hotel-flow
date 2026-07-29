-- "TARIFA SIMPLE": el tramo de una sola persona, que faltaba.
--
-- Los tramos de tarifa son los tipos de habitación —Tarifas los muestra como
-- "Hab. N personas"— y el más chico que tenía cargado el hotel era el de 2. Como
-- el precio sigue a la gente, el que venía solo caía en ese piso: una doble
-- cobrada como doble, aunque el hotel la cobra como simple. No era un recargo ni
-- un precio duplicado, era que abajo de 2 no había nada.
--
-- El precio se copia del tramo más chico que exista hoy, y eso es a propósito:
-- así la migración no mueve un peso al aplicarse. El motor ignora un tramo menor
-- que no sea más barato que la habitación (getOccupancyPricing), de modo que
-- mientras la simple valga lo mismo que la doble todo se cobra igual que ayer.
-- La simple empieza a aplicar recién cuando el hotel le pone su precio desde
-- Tarifas, que es donde lo van a manejar de acá en más.
--
-- No lleva habitaciones asignadas: es un tramo de precio, no una categoría
-- física. Igual puede asignarse a una habitación real desde Habitaciones si el
-- día de mañana el hotel tiene una individual.

INSERT INTO public.room_types (name, base_price, max_guests, description)
SELECT
    'Simple',
    rt.base_price,
    1,
    'Tarifa de una persona sola, en la habitación que sea. El precio se ajusta desde Tarifas.'
FROM public.room_types rt
WHERE NOT EXISTS (
    SELECT 1 FROM public.room_types WHERE max_guests <= 1
)
ORDER BY rt.max_guests, rt.base_price
LIMIT 1;

NOTIFY pgrst, 'reload schema';
