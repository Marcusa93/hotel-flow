-- El keepalive nunca llegó a ejecutarse.
--
-- La función quedó en el esquema api y PostgREST solo atiende los esquemas que
-- estén en "Exposed schemas" del dashboard, que por defecto son public y
-- graphql_public. Cada corrida del cron desde el 21 de abril respondió
-- PGRST106 "Invalid schema: api". La base no se pausó porque el hotel usa la
-- app todos los días, no porque el latido funcionara: el día que el hotel pare
-- una semana —temporada baja, refacción, lo que sea— es justo cuando el
-- keepalive tenía que salvarla y no iba a estar.
--
-- Se podía arreglar exponiendo api desde el panel, pero eso es un paso manual
-- que vive fuera del repositorio: si el proyecto se recrea, vuelve a romperse
-- en silencio. La función se muda a public, que ya está expuesto, y así el
-- arreglo viaja con el código.
--
-- La tabla se queda en api a propósito. No hace falta que sea alcanzable desde
-- la API para que la función escriba en ella: SECURITY DEFINER hace que corra
-- con los permisos del dueño. Exponer el latido no es lo mismo que exponer
-- dónde se guarda.

CREATE OR REPLACE FUNCTION public.keepalive()
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

-- Cualquiera con la clave anónima puede llamarla, y la clave anónima viaja en
-- el bundle del navegador: es pública por diseño. Lo único que se consigue
-- llamándola es pisar una fecha en una fila única. No lee nada, no borra nada
-- y no crece.
REVOKE ALL ON FUNCTION public.keepalive() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.keepalive() TO anon;

-- Una sola puerta de entrada: si quedaran las dos, mañana alguien arregla la
-- que no se usa y el latido sigue muerto.
DROP FUNCTION IF EXISTS api.keepalive();

-- El permiso sobre el esquema api existía para poder llamar a api.keepalive().
-- Ya no hay nada ahí que anon deba alcanzar.
REVOKE USAGE ON SCHEMA api FROM anon;

COMMENT ON FUNCTION public.keepalive() IS
  'Latido para que Supabase no pause el proyecto por inactividad. La llama .github/workflows/supabase-keepalive.yml dos veces por día. Vive en public porque es el único esquema expuesto sin tocar el dashboard.';
