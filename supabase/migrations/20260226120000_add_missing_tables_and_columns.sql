-- ============================================================
-- Migration: Add missing tables, columns, RPC, RLS, and indexes
-- Fixes: invoices, invoice_items, expenses tables (missing)
--        rates, housekeeping_tasks, guests columns (missing)
--        generate_invoice_number() RPC (missing)
--        Consistent anon RLS policies
-- ============================================================

-- 1. Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    expense_type TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED', 'OVERDUE')),
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 21,
    tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    signature_data TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create invoice_items table
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    item_type TEXT NOT NULL DEFAULT 'OTHER' CHECK (item_type IN ('ACCOMMODATION', 'SERVICE', 'EXTRA', 'OTHER')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Add missing columns to rates
ALTER TABLE public.rates ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'PERCENTAGE';
ALTER TABLE public.rates ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5, 2);
ALTER TABLE public.rates ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2);
ALTER TABLE public.rates ADD COLUMN IF NOT EXISTS min_nights INTEGER;
ALTER TABLE public.rates ADD COLUMN IF NOT EXISTS promo_code TEXT;

-- 5. Add missing columns to housekeeping_tasks
ALTER TABLE public.housekeeping_tasks ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE public.housekeeping_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE public.housekeeping_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.housekeeping_tasks ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE public.housekeeping_tasks ADD COLUMN IF NOT EXISTS checkout_triggered BOOLEAN DEFAULT FALSE;

-- 6. Add missing column to guests
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS country TEXT;

-- 7. Create generate_invoice_number() RPC function
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    current_year TEXT;
    next_seq INTEGER;
    invoice_num TEXT;
BEGIN
    current_year := TO_CHAR(NOW(), 'YYYY');

    SELECT COALESCE(MAX(
        CAST(SUBSTRING(invoice_number FROM '\d+$') AS INTEGER)
    ), 0) + 1
    INTO next_seq
    FROM public.invoices
    WHERE invoice_number LIKE 'FAC-' || current_year || '-%';

    invoice_num := 'FAC-' || current_year || '-' || LPAD(next_seq::TEXT, 5, '0');
    RETURN invoice_num;
END;
$$;

-- 8. Enable RLS for new tables
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Expenses policies
CREATE POLICY "Auth full access expenses" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access expenses" ON public.expenses FOR ALL TO anon USING (true) WITH CHECK (true);

-- Invoices policies
CREATE POLICY "Auth full access invoices" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access invoices" ON public.invoices FOR ALL TO anon USING (true) WITH CHECK (true);

-- Invoice items policies
CREATE POLICY "Auth full access invoice_items" ON public.invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon full access invoice_items" ON public.invoice_items FOR ALL TO anon USING (true) WITH CHECK (true);

-- 9. Add missing anon policies for guests, payments, rates (consistent with other tables)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'guests' AND policyname = 'Anon full access guests'
  ) THEN
    CREATE POLICY "Anon full access guests" ON public.guests FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Anon full access payments'
  ) THEN
    CREATE POLICY "Anon full access payments" ON public.payments FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rates' AND policyname = 'Anon full access rates'
  ) THEN
    CREATE POLICY "Anon full access rates" ON public.rates FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 10. Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses (date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON public.expenses (expense_type);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_booking ON public.invoices (booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_guest ON public.invoices (guest_id);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON public.invoices (issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items (invoice_id);
