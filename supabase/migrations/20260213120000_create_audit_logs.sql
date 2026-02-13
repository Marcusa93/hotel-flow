-- Audit Logs table for tracking all CRUD operations
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL CHECK (entity_type IN (
        'booking', 'guest', 'room', 'payment', 'invoice',
        'housekeeping_task', 'rate', 'expense', 'hotel_settings'
    )),
    entity_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE')),
    user_id UUID,
    user_email TEXT,
    user_role TEXT CHECK (user_role IN ('admin', 'reception', 'housekeeping', 'auditor')),
    description TEXT NOT NULL,
    old_values JSONB DEFAULT '{}'::jsonb,
    new_values JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address TEXT
);

-- Indexes for common query patterns
CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs (entity_type);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_entity_id ON public.audit_logs (entity_id);
CREATE INDEX idx_audit_logs_entity_type_created ON public.audit_logs (entity_type, created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies: append-only (no UPDATE/DELETE)
CREATE POLICY "Auth can read audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anon can read audit_logs" ON public.audit_logs FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert audit_logs" ON public.audit_logs FOR INSERT TO anon WITH CHECK (true);
