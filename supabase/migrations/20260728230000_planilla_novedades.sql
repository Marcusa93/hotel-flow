-- Planilla de novedades: el cuaderno del mostrador, adentro del sistema.
--
-- Lo que hoy se dice de palabra o se anota en un papel que se pierde: se sacó
-- una toalla de la 305, la bebida de la 202 pasó a la 210, falta una almohada
-- en la 108. El turno que entra no se entera, y a fin de mes no hay forma de
-- reconstruir por qué falta algo.
--
-- Es un registro cronológico y no un inventario: no descuenta stock ni cobra
-- nada. Si un consumo tiene que ir a la cuenta del huésped, eso ya existe y es
-- booking_charges; esto es para lo interno, lo que el hotel se cuenta a sí mismo.
--
-- El nombre de la tabla va en inglés como todas las demás (bookings, guests,
-- payments) aunque el hotel le diga "novedades" y así se lea en la pantalla.

-- ─── 1. Las anotaciones ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logbook_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Cuándo pasó, no cuándo se cargó: la novedad de las 23:00 se anota a la
    -- mañana siguiente bastante seguido. created_at guarda lo otro.
    date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category        TEXT NOT NULL DEFAULT 'OTRO'
                    CHECK (category IN (
                        'ROPA_BLANCA',      -- toallas, sábanas, almohadas
                        'MINIBAR',          -- bebidas y consumibles
                        'MANTENIMIENTO',    -- algo roto o que falta arreglar
                        'OBJETOS_OLVIDADOS',
                        'HUESPED',          -- algo que pasó con alguien alojado
                        'OTRO'
                    )),
    note            TEXT NOT NULL CHECK (length(trim(note)) > 0),

    -- De dónde salió y a dónde fue. Las dos opcionales: "falta una almohada en
    -- la 108" tiene origen y no destino, y "llegó el pedido de toallas" no tiene
    -- ninguna de las dos.
    room_from_id    UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
    room_to_id      UUID REFERENCES public.rooms(id) ON DELETE SET NULL,

    -- INFO es la anotación que no espera nada de nadie —la mayoría—. PENDING es
    -- la que deja algo por hacer, y RESOLVED esa misma ya resuelta. Una INFO
    -- nunca pasa a RESOLVED: no había nada que resolver.
    status          TEXT NOT NULL DEFAULT 'INFO'
                    CHECK (status IN ('INFO', 'PENDING', 'RESOLVED')),
    resolved_at     TIMESTAMPTZ,
    resolved_by     UUID,
    resolved_by_name TEXT,

    created_by      UUID,
    -- El nombre además del id, por la misma razón que en los comprobantes: el
    -- perfil se renombra o se da de baja y la novedad tiene que seguir diciendo
    -- quién la anotó.
    created_by_name TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,

    -- Resuelta es resuelta: sin fecha, la planilla dice que algo se solucionó y
    -- no cuándo, que es la mitad del dato.
    CONSTRAINT logbook_resolved_needs_date
        CHECK (status <> 'RESOLVED' OR resolved_at IS NOT NULL)
);

-- La pantalla abre en orden cronológico inverso, y el filtro por habitación
-- pregunta por las dos puntas.
CREATE INDEX IF NOT EXISTS idx_logbook_entries_date
    ON public.logbook_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_logbook_entries_room_from
    ON public.logbook_entries(room_from_id);
CREATE INDEX IF NOT EXISTS idx_logbook_entries_room_to
    ON public.logbook_entries(room_to_id);
-- Lo pendiente se mira aparte y es lo primero que abre la pantalla.
CREATE INDEX IF NOT EXISTS idx_logbook_entries_pending
    ON public.logbook_entries(date DESC) WHERE status = 'PENDING';

COMMENT ON TABLE public.logbook_entries IS
    'Planilla de novedades: registro interno de lo que pasa en el hotel. No mueve stock ni cobra nada.';


-- ─── 2. Permisos ──────────────────────────────────────────────────────
ALTER TABLE public.logbook_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logbook_entries_read"   ON public.logbook_entries;
DROP POLICY IF EXISTS "logbook_entries_insert" ON public.logbook_entries;
DROP POLICY IF EXISTS "logbook_entries_update" ON public.logbook_entries;
DROP POLICY IF EXISTS "logbook_entries_delete" ON public.logbook_entries;

-- Que se entere el otro turno es el punto: lee cualquiera que entre.
CREATE POLICY "logbook_entries_read" ON public.logbook_entries
    FOR SELECT TO authenticated USING (true);

-- Limpieza anota igual que recepción: es la que mueve las toallas.
CREATE POLICY "logbook_entries_insert" ON public.logbook_entries
    FOR INSERT TO authenticated
    WITH CHECK (public.current_user_role() IN ('admin', 'reception', 'housekeeping'));

-- Editar y resolver, el mismo grupo. Resolver una novedad ajena es lo normal
-- —la deja el turno noche y la levanta el de la mañana— y quién tocó qué queda
-- en la auditoría.
CREATE POLICY "logbook_entries_update" ON public.logbook_entries
    FOR UPDATE TO authenticated
    USING (public.current_user_role() IN ('admin', 'reception', 'housekeeping'))
    WITH CHECK (public.current_user_role() IN ('admin', 'reception', 'housekeeping'));

-- Borrar solo admin: una planilla de la que cualquiera saca renglones no sirve
-- para lo que se hizo.
CREATE POLICY "logbook_entries_delete" ON public.logbook_entries
    FOR DELETE TO authenticated
    USING (public.current_user_role() = 'admin');


-- ─── 3. Que el borrado deje rastro ────────────────────────────────────
-- La novedad guarda quién la anotó y quién la resolvió, pero una borrada no
-- guarda nada: sin esto, el único movimiento destructivo de la planilla es el
-- único que no queda registrado. Se reemplaza el CHECK entero porque dos sobre
-- la misma columna se cumplen los dos y el viejo rechazaría el valor nuevo.
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_entity_type_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_entity_type_check
    CHECK (entity_type IN (
        'booking', 'guest', 'room', 'payment', 'invoice',
        'housekeeping_task', 'rate', 'expense', 'hotel_settings',
        'booking_charge', 'logbook_entry'
    ));

-- PostgREST cachea el esquema; sin esto la tabla nueva sigue dando 404.
NOTIFY pgrst, 'reload schema';
