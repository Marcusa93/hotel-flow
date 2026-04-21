-- ════════════════════════════════════════════════════════════════════
-- Role-based RLS hardening
--
-- Replaces all "USING (true)" / "FOR ALL TO authenticated" policies
-- with policies based on public.profiles.role.
--
-- Matrix:
--   SELECT: any authenticated user (UI filters what each role sees)
--   INSERT/UPDATE/DELETE depends on table:
--     - payments, expenses, invoices, invoice_items      → admin + reception
--     - guests, bookings, booking_charges, rates,
--       room_types, minibar_items                        → admin + reception
--     - rooms (UPDATE)                                   → admin + reception + housekeeping
--     - rooms (INSERT/DELETE)                            → admin + reception
--     - housekeeping_tasks                               → admin + housekeeping
--     - audit_logs                                       → append-only (INSERT any auth),
--                                                          SELECT only admin + auditor
--   profiles.role cannot be changed via client UPDATE.
-- ════════════════════════════════════════════════════════════════════

-- ─── 0. Helper function: current user's role ────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- ─── 1. Drop every legacy open policy ───────────────────────────────

-- room_types
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.room_types;
DROP POLICY IF EXISTS "Allow read access to anon" ON public.room_types;
DROP POLICY IF EXISTS "Anon full access room_types" ON public.room_types;

-- rooms
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.rooms;
DROP POLICY IF EXISTS "Allow read access to anon" ON public.rooms;
DROP POLICY IF EXISTS "Anon full access rooms" ON public.rooms;

-- guests
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.guests;
DROP POLICY IF EXISTS "Anon full access guests" ON public.guests;

-- bookings
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.bookings;
DROP POLICY IF EXISTS "Allow anon all access" ON public.bookings;
DROP POLICY IF EXISTS "Anon full access bookings" ON public.bookings;

-- payments
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.payments;
DROP POLICY IF EXISTS "Anon full access payments" ON public.payments;

-- housekeeping_tasks
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.housekeeping_tasks;
DROP POLICY IF EXISTS "Allow all access to anon" ON public.housekeeping_tasks;
DROP POLICY IF EXISTS "Anon full access housekeeping_tasks" ON public.housekeeping_tasks;

-- rates
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.rates;
DROP POLICY IF EXISTS "Anon full access rates" ON public.rates;

-- expenses
DROP POLICY IF EXISTS "Auth full access expenses" ON public.expenses;
DROP POLICY IF EXISTS "Anon full access expenses" ON public.expenses;

-- invoices
DROP POLICY IF EXISTS "Auth full access invoices" ON public.invoices;
DROP POLICY IF EXISTS "Anon full access invoices" ON public.invoices;

-- invoice_items
DROP POLICY IF EXISTS "Auth full access invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Anon full access invoice_items" ON public.invoice_items;

-- booking_charges
DROP POLICY IF EXISTS "Auth full access booking_charges" ON public.booking_charges;
DROP POLICY IF EXISTS "Anon full access booking_charges" ON public.booking_charges;

-- minibar_items
DROP POLICY IF EXISTS "Auth full access minibar_items" ON public.minibar_items;
DROP POLICY IF EXISTS "Anon full access minibar_items" ON public.minibar_items;

-- audit_logs
DROP POLICY IF EXISTS "Auth can read audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Auth can insert audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Anon can read audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Anon can insert audit_logs" ON public.audit_logs;


-- ─── 2. Room types — read any auth, write admin+reception ──────────
CREATE POLICY "room_types_read" ON public.room_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "room_types_write" ON public.room_types
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'reception'))
  WITH CHECK (public.current_user_role() IN ('admin', 'reception'));


-- ─── 3. Rooms — read any auth, UPDATE admin+reception+housekeeping,
--      INSERT/DELETE admin+reception ──────────────────────────────
CREATE POLICY "rooms_read" ON public.rooms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "rooms_insert" ON public.rooms
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('admin', 'reception'));

CREATE POLICY "rooms_update" ON public.rooms
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('admin', 'reception', 'housekeeping'))
  WITH CHECK (public.current_user_role() IN ('admin', 'reception', 'housekeeping'));

CREATE POLICY "rooms_delete" ON public.rooms
  FOR DELETE TO authenticated
  USING (public.current_user_role() IN ('admin', 'reception'));


-- ─── 4. Guests, bookings, booking_charges, rates ────────────────────
CREATE POLICY "guests_read" ON public.guests
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "guests_write" ON public.guests
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'reception'))
  WITH CHECK (public.current_user_role() IN ('admin', 'reception'));

CREATE POLICY "bookings_read" ON public.bookings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "bookings_write" ON public.bookings
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'reception'))
  WITH CHECK (public.current_user_role() IN ('admin', 'reception'));

CREATE POLICY "booking_charges_read" ON public.booking_charges
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "booking_charges_write" ON public.booking_charges
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'reception'))
  WITH CHECK (public.current_user_role() IN ('admin', 'reception'));

CREATE POLICY "rates_read" ON public.rates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rates_write" ON public.rates
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'reception'))
  WITH CHECK (public.current_user_role() IN ('admin', 'reception'));

CREATE POLICY "minibar_items_read" ON public.minibar_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "minibar_items_write" ON public.minibar_items
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'reception'))
  WITH CHECK (public.current_user_role() IN ('admin', 'reception'));


-- ─── 5. Payments, expenses, invoices, invoice_items ─────────────────
-- Auditor can SELECT but NOT mutate.
CREATE POLICY "payments_read" ON public.payments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "payments_write" ON public.payments
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'reception'))
  WITH CHECK (public.current_user_role() IN ('admin', 'reception'));

CREATE POLICY "expenses_read" ON public.expenses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "expenses_write" ON public.expenses
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'reception'))
  WITH CHECK (public.current_user_role() IN ('admin', 'reception'));

CREATE POLICY "invoices_read" ON public.invoices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoices_write" ON public.invoices
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'reception'))
  WITH CHECK (public.current_user_role() IN ('admin', 'reception'));

CREATE POLICY "invoice_items_read" ON public.invoice_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoice_items_write" ON public.invoice_items
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'reception'))
  WITH CHECK (public.current_user_role() IN ('admin', 'reception'));


-- ─── 6. Housekeeping tasks — admin + housekeeping ───────────────────
CREATE POLICY "housekeeping_tasks_read" ON public.housekeeping_tasks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "housekeeping_tasks_write" ON public.housekeeping_tasks
  FOR ALL TO authenticated
  USING (public.current_user_role() IN ('admin', 'housekeeping'))
  WITH CHECK (public.current_user_role() IN ('admin', 'housekeeping'));


-- ─── 7. Audit logs — read only admin + auditor, INSERT any auth ─────
CREATE POLICY "audit_logs_read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin', 'auditor'));

CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- No UPDATE, no DELETE (append-only).


-- ─── 8. Profiles — prevent users from escalating their own role ─────
-- Drop the overly-permissive update policy (from security_hardening),
-- replace with one that blocks role changes.
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users update own profile (no role change)" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- Admins can update any profile (including role).
CREATE POLICY "Admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
