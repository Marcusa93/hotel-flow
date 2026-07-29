-- Comprobantes de pago.
--
-- El del turno siguiente abre la reserva, ve "Transferencia $80.000" y no tiene
-- con qué saber si la plata entró: eso es lo que alguien tipeó, no una prueba.
-- Ahora al pago se le cuelga la captura o el PDF del comprobante.
--
-- El archivo va a Storage y no a una columna de payments. Una captura de
-- teléfono pesa más que todas las filas de la reserva juntas, y la lista de
-- pagos se trae entera en cada pantalla: un bytea ahí adentro se arrastraría en
-- todas.
--
-- El bucket es privado. Un comprobante muestra CBU, nombre y a veces el DNI del
-- que transfirió; con bucket público la URL queda adivinable y no vence nunca.
-- Se sirve con URLs firmadas de vida corta.

-- ─── 1. El bucket ─────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'comprobantes',
    'comprobantes',
    FALSE,
    10485760, -- 10 MB. Una foto de teléfono sin comprimir ronda los 4.
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        -- Lo que sale de un iPhone sin convertir.
        'image/heic',
        'image/heif',
        'application/pdf'
    ]
)
ON CONFLICT (id) DO UPDATE
    SET public            = EXCLUDED.public,
        file_size_limit   = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ─── 2. Qué archivo es de qué pago ────────────────────────────────────
-- Tabla aparte y no una columna en payments: un pago puede tener el
-- comprobante de la transferencia y además la foto del ticket del posnet, y así
-- adjuntar no reescribe la fila del pago —que es plata registrada y no se toca.
CREATE TABLE IF NOT EXISTS public.payment_attachments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id       UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    -- La ruta dentro del bucket. UNIQUE para que un reintento no deje dos filas
    -- apuntando al mismo objeto.
    storage_path     TEXT NOT NULL UNIQUE,
    -- El nombre con el que el archivo llegó, para mostrarlo y descargarlo.
    file_name        TEXT NOT NULL,
    mime_type        TEXT,
    size_bytes       BIGINT,
    uploaded_by      UUID,
    -- El nombre además del id, por la misma razón que promo_label: el perfil se
    -- puede renombrar o dar de baja y el comprobante tiene que seguir diciendo
    -- quién lo subió.
    uploaded_by_name TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Siempre se piden los de un pago.
CREATE INDEX IF NOT EXISTS idx_payment_attachments_payment
    ON public.payment_attachments(payment_id);

COMMENT ON TABLE public.payment_attachments IS
    'Comprobantes adjuntos a un pago. El archivo vive en el bucket privado "comprobantes"; acá va la ruta y quién lo subió.';


-- ─── 3. Permisos, con el mismo criterio que el resto de la plata ──────
ALTER TABLE public.payment_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_attachments_read"   ON public.payment_attachments;
DROP POLICY IF EXISTS "payment_attachments_insert" ON public.payment_attachments;
DROP POLICY IF EXISTS "payment_attachments_delete" ON public.payment_attachments;

-- Ver el comprobante lo puede hacer cualquiera que entre: es justamente el
-- punto, que el del otro turno lo mire.
CREATE POLICY "payment_attachments_read" ON public.payment_attachments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "payment_attachments_insert" ON public.payment_attachments
    FOR INSERT TO authenticated
    WITH CHECK (public.current_user_role() IN ('admin', 'reception'));

-- Sin UPDATE a propósito: un comprobante no se corrige, se agrega otro.

-- Borrar solo admin. Un comprobante es el respaldo de un pago; que lo saque
-- quien lo subió sería dejar el respaldo a merced del que quiera taparlo.
CREATE POLICY "payment_attachments_delete" ON public.payment_attachments
    FOR DELETE TO authenticated
    USING (public.current_user_role() = 'admin');


-- ─── 4. Los mismos permisos sobre el archivo ──────────────────────────
-- La fila y el objeto son dos cosas distintas: sin esto, alguien sin permiso de
-- insertar la fila podría igual dejar basura en el bucket.
DROP POLICY IF EXISTS "comprobantes_read"   ON storage.objects;
DROP POLICY IF EXISTS "comprobantes_insert" ON storage.objects;
DROP POLICY IF EXISTS "comprobantes_delete" ON storage.objects;

CREATE POLICY "comprobantes_read" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'comprobantes');

CREATE POLICY "comprobantes_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'comprobantes'
        AND public.current_user_role() IN ('admin', 'reception')
    );

CREATE POLICY "comprobantes_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'comprobantes'
        AND public.current_user_role() = 'admin'
    );
