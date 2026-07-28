-- "TARIFA ESPECIAL": el precio por noche que el hotel le hace a quien quiere.
--
-- Amigos, conocidos, el cliente de siempre: se les da cualquier habitación a un
-- precio fijo por noche, sin importar el tramo de ocupación ni la categoría.
-- Hasta ahora eso se hacía a mano —cargar la reserva y corregir el total—, y el
-- número no quedaba registrado como tal en ningún lado.
--
-- Son dos columnas y no una a propósito:
--
--   hotel_settings.special_rate_amount es el monto vigente, el que se edita en
--   Configuración. Cambia cuando el hotel decide cambiarlo.
--
--   bookings.special_rate_amount es el monto que se le aplicó a ESA reserva.
--   Se guarda por la misma razón que promo_label: el monto configurado va a
--   cambiar, y la reserva tiene que seguir diciendo a qué precio se tomó.
--   NULL significa reserva normal, que es la enorme mayoría.
--
-- Además, con la tarifa especial el precio deja de depender de cuánta gente
-- entra: son $X la noche, entren dos o entren cinco. Por eso la corrección de
-- ocupación del check-in no la toca.
--
-- En 0 (el default) la opción no aparece al reservar, igual que las cocheras.

ALTER TABLE public.hotel_settings
    ADD COLUMN IF NOT EXISTS special_rate_amount DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS special_rate_amount DECIMAL(10, 2)
        CHECK (special_rate_amount IS NULL OR special_rate_amount >= 0);

COMMENT ON COLUMN public.hotel_settings.special_rate_amount IS
    'Precio por noche de la tarifa especial. En 0 la opción no se ofrece al reservar.';

COMMENT ON COLUMN public.bookings.special_rate_amount IS
    'Precio por noche con el que se tomó esta reserva bajo tarifa especial. NULL = reserva normal. Fijo: no depende de la ocupación.';

NOTIFY pgrst, 'reload schema';
