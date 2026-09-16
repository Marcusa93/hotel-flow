-- Estadía y media: una o más noches con un medio día adicional al final.
-- El precio es noches × tarifa + 50% de la tarifa (mismo ratio que media estadía).
--
-- Del hotel: el huésped que se queda hasta el mediodía del día de salida, y el
-- que se va antes de lo pactado y usó la habitación hasta el mediodía. Los dos
-- terminan en lo mismo: noches enteras más medio día al final.
--
-- Todo acá es idempotente: se puede correr de nuevo sin romper nada.

-- ─── 1. La marca en la reserva ────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS half_day_add BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.bookings.half_day_add IS
    'Estadía y media: noches enteras más un medio día al final. Se retira a las 18:00 del día de check_out_date, no a la mañana. Exclusivo con is_half_day, que no tiene noches.';


-- ─── 2. El anti-overbooking, con la estadía y media adentro ───────────
-- El caso 4 mira el intervalo [check_in, check_out) y deja el día de salida
-- libre, porque la salida normal es a la mañana. La estadía y media se va a las
-- 18:00: ese día la habitación sigue ocupada en la franja de la media estadía.
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

  -- Caso 3.b: la estadía y media contra la media estadía del día de salida.
  --
  -- La estadía y media se va a las 18:00 del día de check-out, no a la mañana.
  -- Ese día la habitación está tomada de 10 a 18, que es exactamente la franja
  -- de una media estadía. Para el caso 4 ese día no existe —su intervalo llega
  -- hasta check_out_date sin incluirlo— y para el caso 3 la estadía y media es
  -- invisible, porque tiene is_half_day en false. Sin esto las dos entran y el
  -- mostrador tiene dos huéspedes para la misma habitación al mediodía.
  --
  -- Contra las reservas normales no hace falta nada: la que llega esa noche
  -- entra después de las 18:00, que es el mismo criterio con el que la media
  -- estadía convive con la llegada del día. Ver el caso 3.
  IF NEW.is_half_day THEN
    SELECT COUNT(*) INTO conflict_count
    FROM public.bookings
    WHERE room_id = NEW.room_id
      AND half_day_add
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND status NOT IN ('CANCELLED', 'NO_SHOW', 'CHECKED_OUT')
      AND check_out_date = NEW.check_in_date;

    IF conflict_count > 0 THEN
      RAISE EXCEPTION 'La habitación tiene una estadía y media que se retira el % a las 18:00. No entra una media estadía ese día.',
        NEW.check_in_date
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- El mismo choque, visto desde la estadía y media que se está cargando.
  IF NEW.half_day_add THEN
    SELECT COUNT(*) INTO conflict_count
    FROM public.bookings
    WHERE room_id = NEW.room_id
      AND is_half_day
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND status NOT IN ('CANCELLED', 'NO_SHOW', 'CHECKED_OUT')
      AND check_in_date = NEW.check_out_date;

    IF conflict_count > 0 THEN
      RAISE EXCEPTION 'La habitación ya tiene una media estadía el % (10:00 a 18:00), y esta reserva se retira ese día al mediodía.',
        NEW.check_out_date
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

-- PostgREST cachea el esquema; sin esto la columna nueva sigue dando 400.
NOTIFY pgrst, 'reload schema';
