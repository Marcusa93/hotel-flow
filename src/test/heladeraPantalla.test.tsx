import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { MinibarItem, MinibarMovement } from '@/types/hotel';
import { MonthlyMinibarCard } from '@/components/heladera/MonthlyMinibarCard';

// Que la pantalla arme bien los números con datos adentro: el valor de la
// heladera, lo vendido, lo que se llevó el personal y qué hay que reponer. Sin
// base local para abrirla, esto es lo que confirma que se ve lo que tiene que
// verse.

const AHORA = new Date('2026-08-20T12:00:00');

const producto = (over: Partial<MinibarItem> & { id: string; name: string }): MinibarItem => ({
    category: 'bebida', price: 2000, cost: 900, stock: 10, isActive: true, ...over,
});

const ITEMS: MinibarItem[] = [
    producto({ id: 'i-1', name: 'Gaseosa lata', stock: 10, cost: 900, price: 2000, staffPrice: 800 }),
    producto({ id: 'i-2', name: 'Alfajor', category: 'snack', stock: 0, cost: 500, price: 1200 }),
    producto({ id: 'i-3', name: 'Cerveza', category: 'alcohol', stock: 2, lowStockThreshold: 4, cost: 1500, price: 3500 }),
];

let seq = 0;
const movimiento = (over: Partial<MinibarMovement>): MinibarMovement => ({
    id: `m-${++seq}`, itemId: 'i-1', kind: 'VENTA_HUESPED', quantity: -1,
    unitPrice: 2000, unitCost: 900, createdAt: AHORA, ...over,
});

const MOVIMIENTOS: MinibarMovement[] = [
    movimiento({ kind: 'VENTA_HUESPED', quantity: -3 }),
    movimiento({ kind: 'VENTA_MOSTRADOR', quantity: -2 }),
    movimiento({ kind: 'CONSUMO_PERSONAL', quantity: -4, unitPrice: 800, staffName: 'Martín' }),
    movimiento({ kind: 'CONSUMO_PERSONAL', quantity: -1, unitPrice: 0, staffName: 'Ana' }),
    movimiento({ kind: 'COMPRA', quantity: 24, unitPrice: 0, unitCost: 1000 }),
];

let rol = 'admin';

vi.mock('@/context/AppRoleContext', () => ({ useAppRole: () => ({ currentRole: rol }) }));
vi.mock('@/hooks/useMinibarItems', () => ({
    useMinibarItems: () => ({ data: ITEMS, isLoading: false }),
    useUpdateMinibarItem: () => ({ mutateAsync: vi.fn() }),
    useCreateMinibarItem: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/hooks/useMinibarMovements', () => ({
    useMinibarMovements: () => ({ data: MOVIMIENTOS, isLoading: false }),
    useKnownStaffNames: () => ({ data: ['Martín', 'Ana'] }),
    useDeleteMinibarMovement: () => ({ mutateAsync: vi.fn() }),
    useCreateMinibarMovement: () => ({ mutateAsync: vi.fn() }),
    useCounterSale: () => ({ mutateAsync: vi.fn() }),
    useGuestConsumption: () => ({ mutateAsync: vi.fn() }),
}));

const { default: Heladera } = await import('@/pages/Heladera');

const pintar = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><Heladera /></MemoryRouter>
    </QueryClientProvider>,
);

beforeEach(() => { rol = 'admin'; });

describe('la pantalla de la heladera', () => {
    it('muestra qué hay adentro valuado al costo', () => {
        pintar();
        // 10×900 + 0×500 + 2×1500 = 12.000
        const tarjeta = screen.getByText('Valor en heladera').closest('div')!.parentElement!;
        expect(within(tarjeta).getByText('$12.000')).toBeInTheDocument();
        expect(screen.getByText(/12 unidades al costo/)).toBeInTheDocument();
    });

    it('separa lo vendido a huéspedes de lo vendido en el mostrador', () => {
        pintar();
        // 3×2000 + 2×2000 = 10.000
        expect(screen.getByText('$10.000')).toBeInTheDocument();
        expect(screen.getByText(/3 a huéspedes · 2 en mostrador/)).toBeInTheDocument();
    });

    // El número que justifica todo el módulo: lo que el personal se llevó igual
    // costó plata, se cobre o no.
    it('muestra el consumo del personal a cobrar y al costo', () => {
        pintar();
        // 4×800 a cobrar; (4+1)×900 = 4.500 al costo
        expect(screen.getByText(/\$3\.200 a cobrar · \$4\.500 al costo/)).toBeInTheDocument();
    });

    it('avisa cuáles hay que reponer, el peor primero', () => {
        pintar();
        expect(screen.getByText('Hay que reponer')).toBeInTheDocument();
        expect(screen.getByText('Alfajor, Cerveza')).toBeInTheDocument();
    });

    it('lista los productos con su stock y su margen', () => {
        pintar();
        const fila = screen.getByText('Gaseosa lata').closest('tr')!;
        expect(within(fila).getByText('10')).toBeInTheDocument();
        expect(within(fila).getByText('$2.000')).toBeInTheDocument();
        expect(within(fila).getByText('$900')).toBeInTheDocument();
        expect(within(fila).getByText('$1.100')).toBeInTheDocument();  // margen
        expect(within(fila).getByText('$800')).toBeInTheDocument();    // precio empleado
    });

    it('dice "cortesía" cuando el producto no tiene precio de empleado', () => {
        pintar();
        const fila = screen.getByText('Alfajor').closest('tr')!;
        expect(within(fila).getByText('cortesía')).toBeInTheDocument();
    });

    it('recepción puede cargar, el auditor sólo mira', () => {
        const { unmount } = pintar();
        expect(screen.getByRole('button', { name: /vender/i })).toBeInTheDocument();
        unmount();

        rol = 'auditor';
        pintar();
        expect(screen.queryByRole('button', { name: /vender/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /nuevo producto/i })).not.toBeInTheDocument();
    });
});

// ─── La tarjeta del Resumen del Mes ──────────────────────────────────
//
// El riesgo acá es contar la misma plata dos veces: lo que se vendió de la
// heladera YA está en los cobros y en los ingresos externos de arriba. Esta
// tarjeta contesta otra pregunta —si la heladera deja algo— y tiene que decirlo.

describe('la heladera en el resumen del mes', () => {
    const pintarTarjeta = (movs: MinibarMovement[]) =>
        render(<MonthlyMinibarCard movements={movs} />);

    it('avisa que esa plata ya está contada arriba', () => {
        pintarTarjeta(MOVIMIENTOS);
        expect(screen.getByText(/ya está contada arriba/i)).toBeInTheDocument();
    });

    it('muestra la ganancia como venta menos costo de reposición', () => {
        pintarTarjeta(MOVIMIENTOS);
        // Vendido 5 u. × $2.000 = $10.000; costo 5 × $900 = $4.500
        expect(screen.getByText('$10.000')).toBeInTheDocument();
        expect(screen.getByText('− $4.500')).toBeInTheDocument();
        expect(screen.getByText('Ganancia de la heladera')).toBeInTheDocument();
        expect(screen.getByText('$5.500')).toBeInTheDocument();
    });

    // Lo que el dueño no ve en ninguna otra pantalla.
    it('separa lo que salió sin dejar plata', () => {
        pintarTarjeta(MOVIMIENTOS);
        // Personal: 5 u. × $900 = $4.500 al costo. Sin mermas.
        expect(screen.getByText(/Se llevó el personal \(5 u\.\)/)).toBeInTheDocument();
        expect(screen.getByText('Salió sin dejar plata')).toBeInTheDocument();
    });

    it('sin costos cargados no inventa una ganancia', () => {
        pintarTarjeta([
            movimiento({ kind: 'VENTA_MOSTRADOR', quantity: -2, unitCost: undefined }),
        ]);
        expect(screen.queryByText('Ganancia de la heladera')).not.toBeInTheDocument();
    });

    it('un mes sin movimientos lo dice y no muestra ceros', () => {
        pintarTarjeta([]);
        expect(screen.getByText('Sin movimientos este mes.')).toBeInTheDocument();
        expect(screen.queryByText('Vendido')).not.toBeInTheDocument();
    });

    it('aclara que la reposición no está en los gastos de arriba', () => {
        pintarTarjeta(MOVIMIENTOS);
        expect(screen.getByText(/no está incluida en los gastos de arriba/i)).toBeInTheDocument();
    });
});
