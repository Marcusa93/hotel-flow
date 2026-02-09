
-- Function to get daily revenue for a specific date range
CREATE OR REPLACE FUNCTION get_daily_revenue(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  date DATE,
  revenue DECIMAL(10, 2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.date::DATE as date,
    SUM(p.amount) as revenue
  FROM
    public.payments p
  WHERE
    p.date::DATE >= start_date
    AND p.date::DATE <= end_date
    AND p.status = 'PAID' -- Only count PAID transactions
  GROUP BY
    p.date::DATE
  ORDER BY
    p.date::DATE ASC;
END;
$$;
