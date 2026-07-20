-- Admin-managed user creation.
--
-- Until now new accounts landed on role 'pending' and the only way to activate
-- them was editing public.profiles by hand in the Supabase dashboard. This adds
-- what the app needs to do it from Configuración → Usuarios.

-- Set when an admin creates the account. The app forces a password change on
-- the first login and clears it, so the admin-chosen password is never permanent.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- Admins need to list every user. The existing "Users read own profile" policy
-- only exposes auth.uid()'s own row, which is why no user list was possible.
-- current_user_role() is SECURITY DEFINER, so it does not recurse through RLS.
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'admin');

NOTIFY pgrst, 'reload schema';
