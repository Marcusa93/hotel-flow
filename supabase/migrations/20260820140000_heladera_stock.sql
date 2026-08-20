-- ════════════════════════════════════════════════════════════════════
-- La heladera: stock, costo y consumo del personal
--
-- Los productos ya existían desde abril (minibar_items) y ya se cargaban a la
-- cuenta del huésped desde la reserva. Lo que nunca existió fue la heladera
-- como tal: cuánto queda, qué costó reponerla, y qué se llevó el personal.
-- Tampoco había pantalla para cargar un producto, así que lo único que había
-- adentro eran los trece ejemplos sembrados en aquella migración.
--
-- Las tablas siguen llamándose minibar_* porque están en producción y los
-- cargos de reserva las referencian. En pantalla es "Heladera", que es como le
-- dicen en el hotel.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. El producto: costo, precio de empleado y stock ──────────────

ALTER TABLE public.minibar_items
  ADD COLUMN IF NOT EXISTS detail              TEXT,
  ADD COLUMN IF NOT EXISTS cost                NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS staff_price         NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS stock               INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER;

COMMENT ON COLUMN public.minibar_items.detail IS
  'Detalle libre: la marca, el tamaño, dónde se compra. Opcional.';
COMMENT ON COLUMN public.minibar_items.cost IS
  'Lo que cuesta reponer una unidad. Opcional, pero sin esto no hay margen ni '
  'costo del consumo interno.';
COMMENT ON COLUMN public.minibar_items.staff_price IS
  'Lo que paga el personal por una unidad. NULL = para el personal es cortesía.';
COMMENT ON COLUMN public.minibar_items.stock IS
  'Unidades en la heladera. No se edita a mano: lo mantiene el trigger sobre '
  'minibar_movements, así el número siempre tiene un renglón que lo explica.';
COMMENT ON COLUMN public.minibar_items.low_stock_threshold IS
  'Debajo de esto la pantalla avisa que hay que reponer. Opcional.';

-- ─── 2. Los movimientos: por qué el stock es el que es ──────────────
--
-- Guardar sólo el número que sube y baja no alcanza. Cuando falte una gaseosa
-- hay que poder decir si se vendió, si se la tomó alguien del personal o si se
-- perdió — y en un hotel con cierre de caja firmado y auditoría, un stock sin
-- historia dura hasta la primera diferencia que nadie sabe explicar.

CREATE TABLE IF NOT EXISTS public.minibar_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.minibar_items(id) ON DELETE CASCADE,

    kind TEXT NOT NULL CHECK (kind IN (
        'COMPRA',            -- entró mercadería
        'VENTA_HUESPED',     -- salió a la cuenta de una reserva
        'VENTA_MOSTRADOR',   -- salió cobrada en el momento
        'CONSUMO_PERSONAL',  -- se lo llevó alguien del hotel
        'MERMA',             -- se rompió, se venció, se perdió
        'AJUSTE'             -- recuento físico: la heladera manda
    )),

    -- Con signo: positivo entra, negativo sale. El signo no lo elige el
    -- cliente, lo impone el tipo — menos el ajuste, que es justamente para
    -- corregir en cualquier dirección.
    quantity INTEGER NOT NULL CHECK (quantity <> 0),
    CONSTRAINT minibar_movements_signo_segun_tipo CHECK (
        (kind = 'COMPRA' AND quantity > 0)
        OR (kind IN ('VENTA_HUESPED', 'VENTA_MOSTRADOR', 'CONSUMO_PERSONAL', 'MERMA')
            AND quantity < 0)
        OR kind = 'AJUSTE'
    ),

    -- Congelados al momento del movimiento: el precio de la lista cambia y el
    -- historial tiene que seguir diciendo a cuánto salió ese día.
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    unit_cost  NUMERIC(10, 2),

    -- De dónde vino o adónde fue, según el tipo.
    booking_id        UUID REFERENCES public.bookings(id)        ON DELETE SET NULL,
    booking_charge_id UUID REFERENCES public.booking_charges(id) ON DELETE SET NULL,
    other_income_id   UUID REFERENCES public.other_income(id)    ON DELETE SET NULL,

    -- Quién consumió, en CONSUMO_PERSONAL. Texto libre igual que "Asignar a" en
    -- limpieza: hay personal sin usuario en la app. El id se completa cuando el
    -- nombre coincide con un perfil, y el nombre queda igual para que el
    -- historial sobreviva si el perfil se borra.
    staff_name       TEXT,
    staff_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT minibar_movements_consumo_con_nombre CHECK (
        kind <> 'CONSUMO_PERSONAL' OR COALESCE(TRIM(staff_name), '') <> ''
    ),

    notes      TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.minibar_movements IS
  'Cada entrada y cada salida de la heladera. El stock del producto sale de acá.';

CREATE INDEX IF NOT EXISTS idx_minibar_movements_item
    ON public.minibar_movements (item_id, created_at DESC);
-- El resumen del mes y el cierre recorren por fecha, no por producto.
CREATE INDEX IF NOT EXISTS idx_minibar_movements_created_at
    ON public.minibar_movements (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_minibar_movements_booking
    ON public.minibar_movements (booking_id) WHERE booking_id IS NOT NULL;

-- ─── 3. El stock lo mantiene la base, no el cliente ─────────────────
--
-- Sumar del lado del navegador se rompe con dos recepcionistas cargando a la
-- vez. Acá el UPDATE es atómico y no hay forma de insertar un movimiento sin
-- que el stock lo acompañe.
--
-- Se permite stock negativo a propósito: si nadie cargó la compra, la venta
-- igual se tiene que poder registrar. Que quede en -2 y en rojo es mejor que
-- perder la venta.

CREATE OR REPLACE FUNCTION public.minibar_aplicar_movimiento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.minibar_items
           SET stock = stock + NEW.quantity
         WHERE id = NEW.item_id;

    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.minibar_items
           SET stock = stock - OLD.quantity
         WHERE id = OLD.item_id;

    ELSE -- UPDATE: puede haber cambiado la cantidad y también el producto
        IF OLD.item_id = NEW.item_id THEN
            UPDATE public.minibar_items
               SET stock = stock - OLD.quantity + NEW.quantity
             WHERE id = NEW.item_id;
        ELSE
            UPDATE public.minibar_items SET stock = stock - OLD.quantity WHERE id = OLD.item_id;
            UPDATE public.minibar_items SET stock = stock + NEW.quantity WHERE id = NEW.item_id;
        END IF;
    END IF;

    RETURN NULL; -- AFTER trigger
END;
$$;

DROP TRIGGER IF EXISTS trg_minibar_aplicar_movimiento ON public.minibar_movements;
CREATE TRIGGER trg_minibar_aplicar_movimiento
    AFTER INSERT OR UPDATE OR DELETE ON public.minibar_movements
    FOR EACH ROW EXECUTE FUNCTION public.minibar_aplicar_movimiento();

-- Red de seguridad: recalcula el stock de todos los productos desde los
-- movimientos. No la usa la app; está para correrla a mano si algún día el
-- número guardado y el historial no coinciden.
CREATE OR REPLACE FUNCTION public.minibar_recalcular_stock()
RETURNS void
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.minibar_items i
       SET stock = COALESCE((
           SELECT SUM(m.quantity) FROM public.minibar_movements m WHERE m.item_id = i.id
       ), 0);
$$;

-- ─── 4. Permisos ────────────────────────────────────────────────────
-- Mismo criterio que minibar_items: lee cualquiera autenticado (la pantalla
-- filtra), escriben administración y recepción. El auditor mira y no toca.

ALTER TABLE public.minibar_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "minibar_movements_read" ON public.minibar_movements;
CREATE POLICY "minibar_movements_read" ON public.minibar_movements
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "minibar_movements_write" ON public.minibar_movements;
CREATE POLICY "minibar_movements_write" ON public.minibar_movements
    FOR ALL TO authenticated
    USING (public.current_user_role() IN ('admin', 'reception'))
    WITH CHECK (public.current_user_role() IN ('admin', 'reception'));

REVOKE ALL ON FUNCTION public.minibar_recalcular_stock() FROM PUBLIC;

-- ─── 5. La auditoría tiene que aceptar los tipos nuevos ─────────────
-- El CHECK es cerrado: sin esto, cada movimiento auditado rebota contra la
-- restricción y se pierde el registro. Se reemplaza entero, porque dos CHECK
-- sobre la misma columna se cumplen los dos y el viejo rechazaría lo nuevo.

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_entity_type_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_entity_type_check
    CHECK (entity_type IN (
        'booking', 'guest', 'room', 'payment', 'invoice',
        'housekeeping_task', 'rate', 'expense', 'hotel_settings',
        'booking_charge', 'logbook_entry', 'cash_closing',
        'minibar_item', 'minibar_movement'
    ));

NOTIFY pgrst, 'reload schema';
