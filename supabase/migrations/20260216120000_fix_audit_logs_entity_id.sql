-- Fix entity_id to TEXT to support non-UUID IDs
ALTER TABLE public.audit_logs ALTER COLUMN entity_id TYPE TEXT;
