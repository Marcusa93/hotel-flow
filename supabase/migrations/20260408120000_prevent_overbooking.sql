-- ============================================================================
-- OVERBOOKING PREVENTION
-- 1. RPC function to check room availability (called from frontend)
-- 2. Database trigger to enforce no overlapping active bookings on INSERT/UPDATE
-- ============================================================================

-- ─── 1. RPC: check_room_availability ─────────────────────────────────────────
-- Returns TRUE if the room is available for the given date range.
-- Excludes cancelled, no-show, and checked-out bookings.
-- Optionally excludes a specific booking (for edit scenarios).

CREATE OR REPLACE FUNCTION public.check_room_availability(
  p_room_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conflict_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO conflict_count
  FROM public.bookings
  WHERE room_id = p_room_id
    AND status NOT IN ('CANCELLED', 'NO_SHOW', 'CHECKED_OUT')
    AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
    AND check_in_date < p_check_out
    AND check_out_date > p_check_in;

  RETURN conflict_count = 0;
END;
$$;

-- ─── 2. Trigger function: prevent overlapping bookings ───────────────────────
-- Runs BEFORE INSERT or UPDATE on bookings.
-- Raises an exception if the new/updated booking overlaps with an existing one.

CREATE OR REPLACE FUNCTION public.prevent_booking_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  conflict_count INTEGER;
BEGIN
  -- Skip validation for non-active statuses
  IF NEW.status IN ('CANCELLED', 'NO_SHOW', 'CHECKED_OUT') THEN
    RETURN NEW;
  END IF;

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

-- ─── 3. Attach trigger ──────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_prevent_booking_overlap ON public.bookings;

CREATE TRIGGER trg_prevent_booking_overlap
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_booking_overlap();
