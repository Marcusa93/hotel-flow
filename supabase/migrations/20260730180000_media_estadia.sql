-- Media estadía: la habitación por el día, sin pasar la noche.
--
-- Del hotel: "contamos con lo que es la estadía por medio día. Check-in 10:00,
-- check-out 18:00. Tiene un costo del 50% de lo que corresponde a cada
-- habitación".
--
-- Es una reserva, no una entidad nueva: entra y sale el mismo día. Así hereda
-- pagos, señas, consumos, comprobantes y cuenta corriente sin duplicar una línea
-- de nada de eso.
--
-- La noche sigue a la venta. Una media estadía del 30 no impide alojar a alguien
-- la noche del 30: sale a las 18:00 y el que llega esa noche entra después. Lo
-- que sí choca es el huésped que ya está adentro durmiendo.

-- ─── 1. La marca en la reserva ────────────────────────────────────────
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.bookings.is_half_day IS
    'Media estadía: entra y sale el mismo día. check_out_date es igual a check_in_date y el precio es el 50% del tramo.';

-- Entrada y salida el mismo día es lo que la define. Al revés, una reserva
-- normal sin noches no significa nada y hasta ahora nadie lo impedía.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_half_day_same_day;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_half_day_same_day
    CHECK (
        (is_half_day AND check_out_date = check_in_date)
        OR (NOT is_half_day AND check_out_date > check_in_date)
    );


-- ─── 2. Los horarios, al lado de los que ya existen ───────────────────
ALTER TABLE public.hotel_settings
    ADD COLUMN IF NOT EXISTS half_day_check_in_time  TEXT NOT NULL DEFAULT '10:00',
    ADD COLUMN IF NOT EXISTS half_day_check_out_time TEXT NOT NULL DEFAULT '18:00';

COMMENT ON COLUMN public.hotel_settings.half_day_check_in_time IS
    'Desde qué hora se entrega la habitación en una media estadía. Va aparte de check_in_time, que es la política de la estadía normal.';


-- ─── 3. El anti-overbooking, con la media estadía adentro ─────────────
-- Sin esto la media estadía es invisible para el trigger. Los tres chequeos
-- comparan `check_in_date < NEW.check_out_date AND check_out_date > NEW.check_in_date`,
-- y con entrada y salida el mismo día ese intervalo es vacío: las tres
-- comparaciones dan falso y se podrían cargar dos medias estadías en la misma
-- habitación el mismo día sin que nada las frene.
--
-- Contra las reservas normales la fórmula de siempre ya dice lo correcto, y por
-- eso no se toca: una media estadía del 30 solo choca con la reserva que tiene
-- el 30 como noche del medio —alguien que durmió el 29 y se queda el 30—, que es
-- justo el caso en que la habitación está ocupada todo el día. La que se va el
-- 30 a la mañana y la que llega el 30 a la noche conviven con ella, que es para
-- lo que se pidió la media estadía.
--
-- Lo único que falta es media contra media: dos por el mismo día quieren la
-- misma habitación de 10:00 a 18:00.
CREATE OR REPLACE FUNCTION public.prevent_booking_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  conflict_count INTEGER;
  blocker_dates TEXT;
BEGIN
  -- Skip validation for non-active statuses
  IF NEW.status IN ('CANCELLED', 'NO_SHOW', 'CHECKED_OUT') THEN
    RETURN NEW;
  END IF;

  -- Caso 1: alquilar el hotel entero. Choca contra CUALQUIER reserva activa del
  -- período, sea de la habitación que sea, y contra otro alquiler.
  IF NEW.is_full_hotel THEN
    SELECT COUNT(*) INTO conflict_count
    FROM public.bookings
    WHERE id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND status NOT IN ('CANCELLED', 'NO_SHOW', 'CHECKED_OUT')
      AND check_in_date < NEW.check_out_date
      AND check_out_date > NEW.check_in_date;

    IF conflict_count > 0 THEN
      RAISE EXCEPTION 'No se puede alquilar el hotel completo: hay % reserva(s) activa(s) entre el % y el %. Cancelalas o moveelas primero.',
        conflict_count, NEW.check_in_date, NEW.check_out_date
        USING ERRCODE = 'unique_violation';
    END IF;

    RETURN NEW;
  END IF;

  -- Caso 2: reserva normal contra un hotel ya alquilado. Va antes que el chequeo
  -- por habitación porque el mensaje correcto es "el hotel está cerrado", no
  -- "esa habitación está ocupada" — la habitación puede estar libre y no importa.
  SELECT COUNT(*) INTO conflict_count
  FROM public.bookings
  WHERE is_full_hotel
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND status NOT IN ('CANCELLED', 'NO_SHOW', 'CHECKED_OUT')
    AND check_in_date < NEW.check_out_date
    AND check_out_date > NEW.check_in_date;

  IF conflict_count > 0 THEN
    SELECT string_agg(TO_CHAR(check_in_date, 'DD/MM') || ' al ' || TO_CHAR(check_out_date, 'DD/MM'), ', ')
      INTO blocker_dates
    FROM public.bookings
    WHERE is_full_hotel
      AND status NOT IN ('CANCELLED', 'NO_SHOW', 'CHECKED_OUT')
      AND check_in_date < NEW.check_out_date
      AND check_out_date > NEW.check_in_date;

    RAISE EXCEPTION 'El hotel está alquilado completo (%). No se pueden tomar reservas en esas fechas.',
      blocker_dates
      USING ERRCODE = 'unique_violation';
  END IF;

  -- Caso 3: dos medias estadías el mismo día en la misma habitación. Va antes
  -- que el caso 4 porque el caso 4 no las ve: su intervalo es vacío.
  IF NEW.is_half_day THEN
    SELECT COUNT(*) INTO conflict_count
    FROM public.bookings
    WHERE room_id = NEW.room_id
      AND is_half_day
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND status NOT IN ('CANCELLED', 'NO_SHOW', 'CHECKED_OUT')
      AND check_in_date = NEW.check_in_date;

    IF conflict_count > 0 THEN
      RAISE EXCEPTION 'La habitación ya tiene una media estadía el % (10:00 a 18:00).',
        NEW.check_in_date
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- Caso 4: el de siempre — la misma habitación, dos veces. Para una media
  -- estadía esto queda en "la reserva que la tiene ocupada toda la noche".
  SELECT COUNT(*) INTO conflict_count
  FROM public.bookings
  WHERE room_id = NEW.room_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND status NOT IN ('CANCELLED', 'NO_SHOW', 'CHECKED_OUT')
    AND check_in_date < NEW.check_out_date
    AND check_out_date > NEW.check_in_date;

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'La habitación ya tiene una reserva activa en las fechas seleccionadas (% - %)',
      NEW.check_in_date, NEW.check_out_date
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- PostgREST cachea el esquema; sin esto las columnas nuevas siguen dando 400.
NOTIFY pgrst, 'reload schema';
