-- Notifications table for in-app notification system
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
    category TEXT NOT NULL CHECK (category IN (
        'booking', 'payment', 'housekeeping', 'checkin', 'checkout', 'promotion', 'system'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON public.notifications (category);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread_recent ON public.notifications (is_read, created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any, then recreate
DO $$ BEGIN
  DROP POLICY IF EXISTS "Auth can read notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Auth can insert notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Auth can update notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Auth can delete notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Anon can read notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Anon can insert notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Anon can update notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Anon can delete notifications" ON public.notifications;
END $$;

CREATE POLICY "Auth can read notifications" ON public.notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update notifications" ON public.notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth can delete notifications" ON public.notifications FOR DELETE TO authenticated USING (true);
CREATE POLICY "Anon can read notifications" ON public.notifications FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert notifications" ON public.notifications FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update notifications" ON public.notifications FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete notifications" ON public.notifications FOR DELETE TO anon USING (true);

-- Enable realtime for live notification updates (safe to call multiple times)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
