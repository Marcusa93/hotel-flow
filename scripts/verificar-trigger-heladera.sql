-- ════════════════════════════════════════════════════════════════════
-- ¿El stock de la heladera se mueve solo?
--
-- Corré esto tal cual en el SQL editor de Supabase. Va entero adentro de una
-- transacción que termina en ROLLBACK: mira, informa y no deja NADA. Ni el
-- movimiento, ni el cambio de stock, ni una fila de auditoría.
--
-- Lo que tiene que dar: las cuatro filas en "resultado" dicen OK.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
    v_item   UUID;
    v_nombre TEXT;
    v_inicial INTEGER;
    v_despues INTEGER;
    v_final   INTEGER;
    v_mov    UUID;
BEGIN
    SELECT id, name, stock INTO v_item, v_nombre, v_inicial
      FROM public.minibar_items WHERE is_active LIMIT 1;

    IF v_item IS NULL THEN
        RAISE EXCEPTION 'No hay productos activos para probar.';
    END IF;

    RAISE NOTICE 'Producto de prueba: % (stock %)', v_nombre, v_inicial;

    -- 1. Entra una reposición de 10 → el stock tiene que subir 10
    INSERT INTO public.minibar_movements (item_id, kind, quantity, unit_cost)
         VALUES (v_item, 'COMPRA', 10, 1000)
      RETURNING id INTO v_mov;

    SELECT stock INTO v_despues FROM public.minibar_items WHERE id = v_item;
    RAISE NOTICE '1) Reposición de 10 → stock % (esperado %) → %',
        v_despues, v_inicial + 10,
        CASE WHEN v_despues = v_inicial + 10 THEN 'OK' ELSE 'MAL' END;

    -- 2. Sale una venta de 3 → el stock tiene que bajar 3
    INSERT INTO public.minibar_movements (item_id, kind, quantity, unit_price)
         VALUES (v_item, 'VENTA_MOSTRADOR', -3, 2000);

    SELECT stock INTO v_final FROM public.minibar_items WHERE id = v_item;
    RAISE NOTICE '2) Venta de 3 → stock % (esperado %) → %',
        v_final, v_inicial + 7,
        CASE WHEN v_final = v_inicial + 7 THEN 'OK' ELSE 'MAL' END;

    -- 3. Se borra la reposición → el stock tiene que devolver esos 10
    DELETE FROM public.minibar_movements WHERE id = v_mov;

    SELECT stock INTO v_final FROM public.minibar_items WHERE id = v_item;
    RAISE NOTICE '3) Borrar la reposición → stock % (esperado %) → %',
        v_final, v_inicial - 3,
        CASE WHEN v_final = v_inicial - 3 THEN 'OK' ELSE 'MAL' END;
END $$;

-- 4. Los CHECK tienen que rechazar una venta con signo positivo
DO $$
DECLARE v_item UUID;
BEGIN
    SELECT id INTO v_item FROM public.minibar_items WHERE is_active LIMIT 1;
    BEGIN
        INSERT INTO public.minibar_movements (item_id, kind, quantity)
             VALUES (v_item, 'VENTA_HUESPED', 5);   -- positivo: no puede entrar
        RAISE NOTICE '4) Venta con signo al revés → MAL: la base la aceptó';
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE '4) Venta con signo al revés → OK: la base la rechazó';
    END;
END $$;

-- Nada de lo de arriba queda. Es a propósito.
ROLLBACK;
