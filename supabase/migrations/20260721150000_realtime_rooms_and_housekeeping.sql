-- ════════════════════════════════════════════════════════════════════
-- Realtime en habitaciones y tareas de limpieza
--
-- Recepción y limpieza trabajan sobre las mismas habitaciones al mismo
-- tiempo, pero solo `notifications` estaba publicada para realtime: los
-- cambios del otro recién aparecían al cambiar de sección o volver a la
-- pestaña. Con esto el tablero de habitaciones y el de limpieza se
-- actualizan solos (useRealtimeSync escucha y refresca).
--
-- Publicar una tabla no cambia permisos: realtime respeta las policies
-- de RLS, cada usuario recibe solo lo que ya podía leer.
-- ════════════════════════════════════════════════════════════════════

-- REPLICA IDENTITY FULL para que los eventos de UPDATE/DELETE viajen con
-- la fila completa y no solo con la primary key.
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.housekeeping_tasks REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.housekeeping_tasks;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
