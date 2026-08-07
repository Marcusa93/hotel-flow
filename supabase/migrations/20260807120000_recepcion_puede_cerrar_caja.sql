-- Recepción no podía cerrar la caja.
--
-- La política de UPDATE traía USING y no WITH CHECK. Cuando WITH CHECK se omite,
-- Postgres usa la expresión de USING para las dos cosas: para decidir qué filas
-- se pueden tocar Y para validar cómo quedan después.
--
-- Cerrar mueve la fila de closed_at NULL a closed_at con fecha, así que la
-- validación de la fila resultante caía en la rama de "turno cerrado", que pide
-- admin. Recepción pasaba el primer control y rebotaba en el segundo: podía
-- abrir la caja y no cerrarla, con un "No se pudo cerrar" que no decía por qué.
--
-- El arreglo es separar las dos preguntas, que no son la misma:
--
--   USING      → sobre qué turno se puede actuar. Acá vive el privilegio: un
--                turno ya cerrado solo lo toca administración, que es lo que
--                hace que reabrir siga siendo de admin.
--   WITH CHECK → quién puede dejar una fila escrita. Recepción y admin, sin
--                mirar el estado, porque el estado al que se llega es
--                justamente lo que se está por decidir.

DROP POLICY IF EXISTS "cash_sessions_update" ON public.cash_sessions;

CREATE POLICY "cash_sessions_update" ON public.cash_sessions
    FOR UPDATE TO authenticated
    USING (
        -- Un turno abierto lo cierra recepción o admin
        (closed_at IS NULL AND public.current_user_role() IN ('admin', 'reception'))
        OR
        -- Un turno ya cerrado solo lo reabre admin
        (closed_at IS NOT NULL AND public.current_user_role() = 'admin')
    )
    WITH CHECK (public.current_user_role() IN ('admin', 'reception'));

NOTIFY pgrst, 'reload schema';
