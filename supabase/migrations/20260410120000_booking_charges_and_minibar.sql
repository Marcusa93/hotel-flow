-- ═══════════════════════════════════════════════════════════════
-- 1. booking_charges — cargos extras por reserva
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.booking_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN (
        'MINIBAR', 'LAVANDERIA', 'ESTACIONAMIENTO', 'ROOM_SERVICE',
        'RESTAURANT', 'SPA', 'TELEFONO', 'DANO', 'OTRO'
    )),
    description TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.booking_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth full access booking_charges"
    ON public.booking_charges FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

CREATE INDEX idx_booking_charges_booking_id
    ON public.booking_charges (booking_id);

-- ═══════════════════════════════════════════════════════════════
-- 2. minibar_items — catálogo de productos del minibar
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.minibar_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'bebida' CHECK (category IN (
        'bebida', 'snack', 'alcohol', 'otro'
    )),
    price DECIMAL(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.minibar_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth full access minibar_items"
    ON public.minibar_items FOR ALL TO authenticated
    USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- 3. Productos iniciales del minibar (precios de ejemplo)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO public.minibar_items (name, category, price) VALUES
    ('Agua mineral 500ml', 'bebida', 1500),
    ('Gaseosa lata', 'bebida', 2000),
    ('Jugo de naranja', 'bebida', 2500),
    ('Cerveza lata', 'alcohol', 3000),
    ('Vino tinto Malbec 375ml', 'alcohol', 8000),
    ('Espumante 187ml', 'alcohol', 6000),
    ('Fernet con Coca 275ml', 'alcohol', 5000),
    ('Chocolate', 'snack', 2000),
    ('Papas fritas', 'snack', 2500),
    ('Maní salado', 'snack', 1800),
    ('Galletitas', 'snack', 1500),
    ('Alfajor', 'snack', 1200),
    ('Barra de cereal', 'snack', 1500);
