-- ════════════════════════════════════════════════════════════════════
-- Notifications scoping
--
-- Adds `user_id` (optional — for personal notifications) and
-- `target_roles` (default ['admin','reception'] — for broadcast
-- notifications targeted to a set of roles). RLS is tightened so a
-- user only sees:
--   - their own personal notifications (user_id = auth.uid()), OR
--   - broadcast notifications whose target_roles includes their role.
--
-- NOTE: marking a broadcast notification as read flips is_read for
-- everyone in the target group. If per-user read state is needed later,
-- split into a notification_reads table.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Schema changes ─────────────────────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target_roles TEXT[] NOT NULL DEFAULT ARRAY['admin', 'reception'];

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target_roles ON public.notifications USING GIN (target_roles);

-- ─── 2. Drop every legacy open policy ──────────────────────────────
DROP POLICY IF EXISTS "Auth can read notifications" ON public.notifications;
DROP POLICY IF EXISTS "Auth can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Auth can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Auth can delete notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anon can read notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anon can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anon can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anon can delete notifications" ON public.notifications;

-- ─── 3. New scoped policies ─────────────────────────────────────────
-- User sees a notification if:
--   (a) it's addressed to them personally, OR
--   (b) it's a broadcast (user_id IS NULL) and their role is in target_roles
CREATE POLICY "notifications_read" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND public.current_user_role() = ANY(target_roles))
  );

-- Any authenticated user can create notifications (they're created by
-- edge functions, triggers, and app code — the app defines policy).
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Users can only update/delete notifications they can already see.
CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND public.current_user_role() = ANY(target_roles))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (user_id IS NULL AND public.current_user_role() = ANY(target_roles))
  );

CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND public.current_user_role() = ANY(target_roles))
  );
