import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
    ConsumoSinDescontarError, StockNoDescontadoError,
    useCounterSale, useCreateMinibarMovement, useGuestConsumption,
} from '@/hooks/useMinibarMovements';
import type { MinibarItem } from '@/types/hotel';

// Vender de la heladera toca dos cosas a la vez: la plata y el stock. Y no hay
// transacción desde el navegador, así que el orden es una decisión, no un
// detalle: primero la plata —que es lo que no se puede perder— y después el
// descuento. Lo que se prueba acá es ese orden, los signos de cada movimiento, y
// que cuando el descuento falla el cobro no se borre ni en silencio ni por
// error: la pantalla se tiene que enterar.

interface Call { table: string; payload: Record<string, unknown>[] }

let calls: Call[] = [];
let fallaElStock = false;

vi.mock('@/lib/supabase', () => {
    const insert = (table: string) => (payload: unknown) => {
        const rows = (Array.isArray(payload) ? payload : [payload]) as Record<string, unknown>[];
        calls.push({ table, payload: rows });

        if (table === 'minibar_movements' && fallaElStock) {
            const error = { message: 'se cayó la red' };
            const fallo = Promise.resolve({ data: null, error });
            return { select: () => Object.assign(fallo, { single: () => fallo }) };
        }

        const data = rows.map((row, i) => ({
            id: `${table}-${i}`,
            created_at: '2026-08-20T12:00:00Z',
            ...row,
        }));
        const resultado = Promise.resolve({ data, error: null });
        return {
            select: () => Object.assign(resultado, {
                single: () => Promise.resolve({ data: data[0], error: null }),
            }),
        };
    };

    return { supabase: { from: (table: string) => ({ insert: insert(table) }) } };
});

vi.mock('@/hooks/useCreateAuditLog', () => ({ logAuditEvent: vi.fn() }));

const envoltorio = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })}>
        {children}
    </QueryClientProvider>
);

const GASEOSA: MinibarItem = {
    id: 'i-1', name: 'Gaseosa lata', category: 'bebida',
    price: 2000, cost: 900, stock: 10, isActive: true,
};
const ALFAJOR: MinibarItem = {
    id: 'i-2', name: 'Alfajor', category: 'snack',
    price: 1200, cost: 500, stock: 4, isActive: true,
};

const delTabla = (table: string) => calls.filter((c) => c.table === table);

beforeEach(() => {
    calls = [];
    fallaElStock = false;
});

describe('venta de mostrador', () => {
    it('deja un ingreso por el total y saca cada producto de la heladera', async () => {
        const { result } = renderHook(() => useCounterSale(), { wrapper: envoltorio });

        await result.current.mutateAsync({
            lines: [{ item: GASEOSA, quantity: 2 }, { item: ALFAJOR, quantity: 1 }],
            method: 'CASH',
        });

        const [ingreso] = delTabla('other_income');
        expect(ingreso.payload[0].amount).toBe(5200);
        expect(ingreso.payload[0].method).toBe('CASH');
        expect(ingreso.payload[0].description).toBe('Heladera: 2 × Gaseosa lata, 1 × Alfajor');

        const [movimientos] = delTabla('minibar_movements');
        expect(movimientos.payload).toHaveLength(2);
        expect(movimientos.payload[0]).toMatchObject({
            item_id: 'i-1', kind: 'VENTA_MOSTRADOR', quantity: -2, unit_price: 2000, unit_cost: 900,
        });
        // El movimiento apunta al ingreso: así se sabe qué plata lo pagó.
        expect(movimientos.payload[0].other_income_id).toBe('other_income-0');
    });

    // Si el stock se descontara primero y fallara el cobro, quedaría mercadería
    // que salió sin plata que la explique. Al revés, lo peor es un número de
    // stock desactualizado, y eso lo arregla un recuento.
    it('carga la plata antes que el stock', async () => {
        const { result } = renderHook(() => useCounterSale(), { wrapper: envoltorio });
        await result.current.mutateAsync({ lines: [{ item: GASEOSA, quantity: 1 }], method: 'CASH' });

        expect(calls.map((c) => c.table)).toEqual(['other_income', 'minibar_movements']);
    });

    it('si el stock no se puede descontar avisa, pero no borra el cobro', async () => {
        fallaElStock = true;
        const { result } = renderHook(() => useCounterSale(), { wrapper: envoltorio });

        await expect(
            result.current.mutateAsync({ lines: [{ item: GASEOSA, quantity: 1 }], method: 'CASH' }),
        ).rejects.toBeInstanceOf(StockNoDescontadoError);

        // El ingreso quedó, y no se intentó deshacerlo: esa plata está en el cajón.
        expect(delTabla('other_income')).toHaveLength(1);
        await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it('corta la descripción para que entre en un renglón del cierre', async () => {
        const muchos = Array.from({ length: 30 }, (_, i) => ({
            item: { ...GASEOSA, id: `i-${i}`, name: `Producto numero ${i}` },
            quantity: 1,
        }));
        const { result } = renderHook(() => useCounterSale(), { wrapper: envoltorio });
        await result.current.mutateAsync({ lines: muchos, method: 'CASH' });

        const descripcion = delTabla('other_income')[0].payload[0].description as string;
        expect(descripcion.length).toBeLessThanOrEqual(200);
        expect(descripcion.endsWith('...')).toBe(true);
    });
});

describe('consumo del huésped', () => {
    it('carga a la reserva y descuenta, atando cada movimiento a su cargo', async () => {
        const { result } = renderHook(() => useGuestConsumption(), { wrapper: envoltorio });

        await result.current.mutateAsync({
            bookingId: 'b-1',
            lines: [{ item: GASEOSA, quantity: 3 }, { item: ALFAJOR, quantity: 1 }],
        });

        const [cargos] = delTabla('booking_charges');
        expect(cargos.payload[0]).toMatchObject({
            booking_id: 'b-1', category: 'MINIBAR', description: 'Gaseosa lata',
            amount: 2000, quantity: 3,
        });

        const [movimientos] = delTabla('minibar_movements');
        expect(movimientos.payload[0]).toMatchObject({
            kind: 'VENTA_HUESPED', quantity: -3, booking_id: 'b-1',
            booking_charge_id: 'booking_charges-0',
        });
        expect(movimientos.payload[1].booking_charge_id).toBe('booking_charges-1');
    });

    it('el cargo primero: la cuenta del huésped no se puede perder', async () => {
        const { result } = renderHook(() => useGuestConsumption(), { wrapper: envoltorio });
        await result.current.mutateAsync({ bookingId: 'b-1', lines: [{ item: GASEOSA, quantity: 1 }] });

        expect(calls.map((c) => c.table)).toEqual(['booking_charges', 'minibar_movements']);
    });

    it('avisa con su propio error cuando el cargo quedó y el stock no', async () => {
        fallaElStock = true;
        const { result } = renderHook(() => useGuestConsumption(), { wrapper: envoltorio });

        await expect(
            result.current.mutateAsync({ bookingId: 'b-1', lines: [{ item: GASEOSA, quantity: 1 }] }),
        ).rejects.toBeInstanceOf(ConsumoSinDescontarError);

        expect(delTabla('booking_charges')).toHaveLength(1);
    });
});

describe('movimientos sueltos', () => {
    it('el consumo del personal sale de la heladera y guarda a nombre de quién', async () => {
        const { result } = renderHook(() => useCreateMinibarMovement(), { wrapper: envoltorio });

        await result.current.mutateAsync({
            item: GASEOSA, kind: 'CONSUMO_PERSONAL', quantity: -2,
            unitPrice: 800, staffName: '  Martín  ',
        });

        expect(delTabla('minibar_movements')[0].payload[0]).toMatchObject({
            kind: 'CONSUMO_PERSONAL', quantity: -2, unit_price: 800,
            staff_name: 'Martín', unit_cost: 900,
        });
    });

    // Sin precio de empleado el producto es cortesía: cero, no "sin dato".
    it('la cortesía guarda precio cero y el costo del producto igual', async () => {
        const { result } = renderHook(() => useCreateMinibarMovement(), { wrapper: envoltorio });

        await result.current.mutateAsync({
            item: GASEOSA, kind: 'CONSUMO_PERSONAL', quantity: -1, staffName: 'Ana',
        });

        expect(delTabla('minibar_movements')[0].payload[0]).toMatchObject({
            unit_price: 0, unit_cost: 900,
        });
    });

    it('la reposición congela lo que costó esta vez, no lo que dice el producto', async () => {
        const { result } = renderHook(() => useCreateMinibarMovement(), { wrapper: envoltorio });

        await result.current.mutateAsync({
            item: GASEOSA, kind: 'COMPRA', quantity: 24, unitCost: 1050,
        });

        expect(delTabla('minibar_movements')[0].payload[0]).toMatchObject({
            kind: 'COMPRA', quantity: 24, unit_cost: 1050,
        });
    });
});
