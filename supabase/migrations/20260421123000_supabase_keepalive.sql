CREATE SCHEMA IF NOT EXISTS api;

CREATE TABLE IF NOT EXISTS api.supabase_keepalive (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  last_seen_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE api.supabase_keepalive ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE api.supabase_keepalive FROM PUBLIC;

CREATE OR REPLACE FUNCTION api.keepalive()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  heartbeat_at TIMESTAMPTZ := clock_timestamp();
BEGIN
  INSERT INTO api.supabase_keepalive (id, last_seen_at)
  VALUES (1, heartbeat_at)
  ON CONFLICT (id) DO UPDATE
  SET last_seen_at = EXCLUDED.last_seen_at;

  RETURN jsonb_build_object(
    'ok', true,
    'timestamp', heartbeat_at
  );
END;
$$;

REVOKE ALL ON FUNCTION api.keepalive() FROM PUBLIC;
GRANT USAGE ON SCHEMA api TO anon;
GRANT EXECUTE ON FUNCTION api.keepalive() TO anon;
