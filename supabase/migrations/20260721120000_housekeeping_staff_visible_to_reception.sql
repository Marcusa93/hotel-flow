-- ════════════════════════════════════════════════════════════════════
-- Housekeeping staff visible to reception
--
-- On check-out the front desk needs to pick WHO cleans the room, so the
-- notification reaches that person instead of the whole team. Listing
-- them requires reading public.profiles, but the only broad SELECT
-- policy is "Admins read all profiles" — a receptionist saw an empty
-- list and could not assign anyone.
--
-- This adds a narrow policy: admin/reception can read the profiles of
-- housekeeping staff (and nothing else). Permissive policies OR
-- together, so existing access is unchanged.
-- ════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Staff read housekeeping profiles" ON public.profiles;
CREATE POLICY "Staff read housekeeping profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    role = 'housekeeping'
    AND public.current_user_role() IN ('admin', 'reception')
  );

NOTIFY pgrst, 'reload schema';
