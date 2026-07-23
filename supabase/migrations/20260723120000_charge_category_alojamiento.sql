-- Alojamiento como categoría de cargo.
--
-- Cuando un huésped que ya está alojado pide quedarse más noches, esas noches
-- no son un extra cualquiera: son venta de habitación. Sin categoría propia
-- caían en 'OTRO', mezcladas con la lavandería y las roturas, y al facturar no
-- había forma de separar el alojamiento del resto del consumo.
--
-- Por qué la extensión va como cargo y no sumada a bookings.total_amount: el
-- total es lo que se cotizó al reservar y contra eso se tomaron las señas. Si
-- se pisa, el estado de cuenta pierde el rastro de qué se pactó al principio y
-- qué se agregó después. Como cargo, el detalle muestra precio por noche y
-- cantidad de noches, y buildBookingAccount lo suma igual al total a cobrar.

ALTER TABLE public.booking_charges
    DROP CONSTRAINT IF EXISTS booking_charges_category_check;

ALTER TABLE public.booking_charges
    ADD CONSTRAINT booking_charges_category_check CHECK (category IN (
        'MINIBAR', 'LAVANDERIA', 'ESTACIONAMIENTO', 'ROOM_SERVICE',
        'RESTAURANT', 'SPA', 'TELEFONO', 'DANO', 'OTRO', 'ALOJAMIENTO'
    ));

COMMENT ON COLUMN public.booking_charges.category IS
    'Rubro del cargo. ALOJAMIENTO lo emite "Extender estadía" —noches agregadas a una reserva ya iniciada—, no se carga a mano.';
