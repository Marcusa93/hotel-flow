-- INGRESOS ADICIONALES O EXTERNOS (non-room income) from the owner's Excel,
-- plus RECEPCIONISTA A CARGO on bookings.

CREATE TABLE IF NOT EXISTS public.other_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'CASH'
    CHECK (method IN ('CASH', 'CREDIT', 'DEBIT', 'TRANSFER', 'QR', 'OTHER')),
  amount NUMERIC(10, 2) NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.other_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY other_income_read ON public.other_income
  FOR SELECT USING (true);

CREATE POLICY other_income_write ON public.other_income
  FOR ALL
  USING (current_user_role() = ANY (ARRAY['admin', 'reception']))
  WITH CHECK (current_user_role() = ANY (ARRAY['admin', 'reception']));

-- Receptionist in charge of the reservation (free text — matches the Excel names)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS receptionist TEXT;
