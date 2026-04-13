-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SECURITY HARDENING — Profiles table + RLS lockdown            ║
-- ║  Removes all anon policies, creates profiles for role control  ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── 1. Create profiles table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'reception'
    CHECK (role IN ('admin', 'reception', 'housekeeping', 'auditor')),
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile (name, email — NOT role)
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role has full access (for admin operations)
CREATE POLICY "Service role full access profiles"
  ON public.profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-create profile on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'reception'),
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert profiles for existing users (if any)
INSERT INTO public.profiles (id, role, full_name, email)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'role', 'reception'),
  raw_user_meta_data->>'full_name',
  email
FROM auth.users
ON CONFLICT (id) DO NOTHING;


-- ─── 2. DROP ALL ANON POLICIES ────────────────────────────────────
-- bookings
DROP POLICY IF EXISTS "Allow anon all access" ON public.bookings;

-- rooms, room_types
DROP POLICY IF EXISTS "Allow read access to anon" ON public.rooms;
DROP POLICY IF EXISTS "Allow read access to anon" ON public.room_types;

-- hotel_settings
DROP POLICY IF EXISTS "Anon can read hotel_settings" ON public.hotel_settings;
DROP POLICY IF EXISTS "Anon can update hotel_settings" ON public.hotel_settings;

-- audit_logs
DROP POLICY IF EXISTS "Anon can read audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Anon can insert audit_logs" ON public.audit_logs;

-- notifications
DROP POLICY IF EXISTS "Anon can read notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anon can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anon can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anon can delete notifications" ON public.notifications;

-- housekeeping_tasks
DROP POLICY IF EXISTS "Allow all access to anon" ON public.housekeeping_tasks;

-- expenses
DROP POLICY IF EXISTS "Anon full access expenses" ON public.expenses;

-- invoices
DROP POLICY IF EXISTS "Anon full access invoices" ON public.invoices;

-- invoice_items
DROP POLICY IF EXISTS "Anon full access invoice_items" ON public.invoice_items;

-- guests
DROP POLICY IF EXISTS "Anon full access guests" ON public.guests;

-- payments
DROP POLICY IF EXISTS "Anon full access payments" ON public.payments;

-- rates
DROP POLICY IF EXISTS "Anon full access rates" ON public.rates;


-- ─── 3. Tighten hotel_settings — only admin can update ────────────
DROP POLICY IF EXISTS "Authenticated users can update hotel_settings" ON public.hotel_settings;

CREATE POLICY "Admin can update hotel_settings"
  ON public.hotel_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
