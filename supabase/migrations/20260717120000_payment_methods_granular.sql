-- Granular payment methods to match the owner's Excel workflow:
-- Efectivo, Tarjeta de Crédito, Tarjeta de Débito, Transferencia, QR, Otro.
-- Previously only CASH/CARD/TRANSFER/OTHER existed.

DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid = 'public.payments'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%method%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.payments DROP CONSTRAINT %I', c);
  END IF;
END $$;

-- Map any legacy 'CARD' rows to 'CREDIT' (none expected on the new project, but safe)
UPDATE public.payments SET method = 'CREDIT' WHERE method = 'CARD';

ALTER TABLE public.payments ADD CONSTRAINT payments_method_check
  CHECK (method IN ('CASH', 'CREDIT', 'DEBIT', 'TRANSFER', 'QR', 'OTHER'));
