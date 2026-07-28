-- Alquiler del hotel completo.
--
-- Viene un contingente —un equipo de fútbol, una empresa, una familia grande— y
-- se lleva el hotel entero por unos días, a un monto acordado. Use o no todas
-- las habitaciones, el hotel queda cerrado para el resto.
--
-- Es una reserva, no una entidad aparte: así hereda pagos, señas, consumos,
-- facturación, cuenta corriente y check-in/check-out sin duplicar nada de eso.
-- Lo único que la distingue es que no tiene habitación —room_id queda NULL, que
-- la columna ya permitía— y que bloquea todo el período.
--
-- El bloqueo se hace acá abajo y no en la app: la app puede tener una versión
-- vieja abierta en otra pantalla, o dos recepcionistas cargando a la vez. Es la
-- misma razón por la que el anti-overbooking por habitación vive en un trigger.

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS is_full_hotel BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.bookings.is_full_hotel IS
    'Alquiler del hotel completo: sin habitación asignada, bloquea todas las fechas del período.';

-- El trigger consulta los alquileres por fecha en cada alta. Parcial porque son
-- un puñado contra todas las reservas.
CREATE INDEX IF NOT EXISTS idx_bookings_full_hotel
    ON public.bookings(check_in_date, check_out_date) WHERE is_full_hotel;


-- ─── El anti-overbooking, ahora con tres casos ───────────────────────────────
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

  -- Caso 3: el de siempre — la misma habitación, dos veces.
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

NOTIFY pgrst, 'reload schema';
