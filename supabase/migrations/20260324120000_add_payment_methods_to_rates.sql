-- Add payment_methods column to rates table
-- Stores which payment methods a promotion accepts (NULL = all methods)
ALTER TABLE public.rates ADD COLUMN IF NOT EXISTS payment_methods TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.rates.payment_methods IS 'Accepted payment methods for this rate/promotion. NULL means all methods accepted. Values: CASH, CARD, TRANSFER, OTHER';
