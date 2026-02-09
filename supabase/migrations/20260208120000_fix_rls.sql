-- Enable RLS for bookings if not already enabled
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 1. Permissive policy for authenticated users (covers most app usage)
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON public.bookings;
CREATE POLICY "Allow all access to authenticated users"
ON public.bookings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 2. Permissive policy for anonymous users (for testing/dev without auth)
-- WARNING: In production, this should be removed or severely restricted
DROP POLICY IF EXISTS "Allow anon all access" ON public.bookings;
CREATE POLICY "Allow anon all access"
ON public.bookings
FOR ALL
TO anon
USING (true)
WITH CHECK (true);
