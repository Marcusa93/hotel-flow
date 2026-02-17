-- Change assigned_to from UUID to TEXT to store staff names
ALTER TABLE public.housekeeping_tasks
  ALTER COLUMN assigned_to TYPE TEXT USING assigned_to::TEXT;

-- Add anon RLS policy for housekeeping_tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'housekeeping_tasks'
    AND policyname = 'Allow all access to anon'
  ) THEN
    CREATE POLICY "Allow all access to anon" ON public.housekeeping_tasks FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
