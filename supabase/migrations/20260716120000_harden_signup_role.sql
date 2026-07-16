-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  HARDEN SIGNUP — never trust client-provided role metadata      ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- Previously handle_new_user() inserted COALESCE(raw_user_meta_data->>'role',
-- 'reception'), so any anonymous visitor could self-signup as reception —
-- or even 'admin' by passing role in the signUp metadata.
-- New users now ALWAYS start as 'pending' (no access) until an admin
-- assigns them a real role.

-- Allow 'pending' in the role check and make it the column default
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'reception', 'housekeeping', 'auditor', 'pending'));

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'pending';

-- Recreate the signup trigger function ignoring client metadata for the role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, email)
  VALUES (
    NEW.id,
    'pending', -- never derived from raw_user_meta_data
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTE: existing profiles are intentionally left untouched (no backfill).
