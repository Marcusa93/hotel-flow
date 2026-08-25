import { describe, it, expect } from 'vitest';
import {
    inventoryValue,
    knownStaffNames,
    needsRestock,
    staffConsumption,
    staffUnitPrice,
    stockStatus,
    summarizeMovements,
    unitMargin,
} from '@/lib/heladera';
import type { MinibarItem, MinibarMovement, MinibarMovementKind } from '@/types/hotel';

// La heladera del hotel: venden lo que hay adentro, se lo consume el personal, y
// cada tanto algo se vence. Lo que se prueba acá es que el stock siempre tenga
// un renglón que lo explique y que el consumo interno se vea aunque sea gratis:
// esa gaseosa igual la pagó el hotel.

const producto = (over: Partial<MinibarItem> = {}): MinibarItem => ({
    id: 'i-1',
    name: 'Gaseosa lata',
    category: 'bebida',
    price: 2000,
    cost: 900,
    stock: 10,
    isActive: true,
    ...over,
});

let seq = 0;
const mov = (kind: MinibarMovementKind, over: Partial<MinibarMovement> = {}): MinibarMovement => ({
    id: `m-${++seq}`,
    itemId: 'i-1',
    kind,
    quantity: kind === 'COMPRA' ? 12 : -1,
    unitPrice: 2000,
    unitCost: 900,
    createdAt: new Date('2026-08-10T12:00:00'),
    ...over,
});

describe('el estado de un producto', () => {
    it('avisa que hay que reponer cuando toca el umbral', () => {
        expect(stockStatus({ stock: 2, lowStockThreshold: 3 })).toBe('bajo');
        expect(stockStatus({ stock: 3, lowStockThreshold: 3 })).toBe('bajo');
        expect(stockStatus({ stock: 4, lowStockThreshold: 3 })).toBe('ok');
    });

    it('sin umbral cargado sólo avisa cuando no queda nada', () => {
        expect(stockStatus({ stock: 1 })).toBe('ok');
        expect(stockStatus({ stock: 0 })).toBe('sin-stock');
    });

    // Pasa cuando nadie cargó la reposición y se vendió igual. Se muestra, no se
    // esconde: es el aviso de que falta cargar una compra.
    it('marca el negativo aparte del cero', () => {
        expect(stockStatus({ stock: -2 })).toBe('negativo');
    });

    it('sin precio de empleado el producto es cortesía', () => {
        expect(staffUnitPrice({ staffPrice: undefined })).toBe(0);
        expect(staffUnitPrice({ staffPrice: 800 })).toBe(800);
    });

    it('sin costo cargado no inventa un margen', () => {
        expect(unitMargin({ price: 2000, cost: 900 })).toBe(1100);
        expect(unitMargin({ price: 2000, cost: undefined })).toBeNull();
    });
});

describe('el resumen del período', () => {
    // Un mes con una sola merma tiene todos los totales de venta en cero. Sin
    // contar los movimientos no hay forma de distinguirlo de un mes en el que
    // no pasó nada, y el resumen del dueño decía "sin movimientos" con la
    // pérdida cargada.
    it('cuenta cuántos movimientos hubo, aunque ninguno sea una venta', () => {
        expect(summarizeMovements([]).movimientos).toBe(0);
        expect(summarizeMovements([mov('MERMA', { quantity: -2 })]).movimientos).toBe(1);
        expect(summarizeMovements([
            mov('AJUSTE', { quantity: -1 }),
            mov('COMPRA', { quantity: 6 }),
        ]).movimientos).toBe(2);
    });

    it('separa lo que se cargó a la habitación de lo que se cobró en el mostrador', () => {
        const s = summarizeMovements([
            mov('VENTA_HUESPED', { quantity: -3 }),
            mov('VENTA_MOSTRADOR', { quantity: -2 }),
        ]);

        expect(s.ventaHuesped).toEqual({ unidades: 3, total: 6000 });
        expect(s.ventaMostrador).toEqual({ unidades: 2, total: 4000 });
        expect(s.ventaTotal).toBe(10000);
        expect(s.costoVendido).toBe(4500);
        expect(s.margen).toBe(5500);
    });

    // El punto de todo esto: la cortesía no genera plata pero sí cuesta plata, y
    // el dueño tiene que poder verla.
    it('el consumo de cortesía no vende nada pero igual tiene costo', () => {
        const s = summarizeMovements([
            mov('CONSUMO_PERSONAL', { quantity: -4, unitPrice: 0, staffName: 'Juan' }),
        ]);

        expect(s.consumoPersonal).toEqual({ unidades: 4, cobrado: 0, costo: 3600 });
        expect(s.ventaTotal).toBe(0);
    });

    it('el consumo con precio de empleado queda registrado a cobrar', () => {
        const s = summarizeMovements([
            mov('CONSUMO_PERSONAL', { quantity: -2, unitPrice: 800, staffName: 'Juan' }),
        ]);

        expect(s.consumoPersonal).toEqual({ unidades: 2, cobrado: 1600, costo: 1800 });
        // No es una venta: no infla la recaudación de la heladera.
        expect(s.ventaTotal).toBe(0);
    });

    it('la merma se cuenta al costo, no al precio de venta', () => {
        const s = summarizeMovements([mov('MERMA', { quantity: -5 })]);
        expect(s.merma).toEqual({ unidades: 5, costo: 4500 });
    });

    it('la reposición se cuenta a lo que costó', () => {
        const s = summarizeMovements([mov('COMPRA', { quantity: 12, unitCost: 850 })]);
        expect(s.compras).toEqual({ unidades: 12, total: 10200 });
    });

    // El ajuste corrige el stock contra lo que hay en la heladera. No se sabe si
    // lo que falta se vendió o se perdió, así que no se le atribuye a nadie.
    it('el ajuste mueve stock pero no entra en ningún total', () => {
        const s = summarizeMovements([
            mov('AJUSTE', { quantity: -3 }),
            mov('AJUSTE', { quantity: 2 }),
        ]);

        expect(s.ventaTotal).toBe(0);
        expect(s.merma.unidades).toBe(0);
        expect(s.compras.unidades).toBe(0);
    });

    it('sin costo cargado el margen es toda la venta, no un negativo', () => {
        const s = summarizeMovements([
            mov('VENTA_HUESPED', { quantity: -2, unitCost: undefined }),
        ]);

        expect(s.costoVendido).toBe(0);
        expect(s.margen).toBe(4000);
    });
});

describe('el consumo del personal', () => {
    // El campo es texto libre porque hay personal sin usuario en la app. Si
    // "Juan" y "juan " fueran dos totales, el número no serviría para nada.
    it('junta a la misma persona aunque la escriban distinto', () => {
        const [juan] = staffConsumption([
            mov('CONSUMO_PERSONAL', { quantity: -1, unitPrice: 800, staffName: 'Juan' }),
            mov('CONSUMO_PERSONAL', { quantity: -2, unitPrice: 800, staffName: ' juan ' }),
            mov('CONSUMO_PERSONAL', { quantity: -1, unitPrice: 800, staffName: 'JUAN' }),
        ]);

        expect(juan.unidades).toBe(4);
        expect(juan.aCobrar).toBe(3200);
    });

    // Tres turnos escribiendo el mismo nombre: uno le pone el acento y otro no.
    it('junta a la misma persona con y sin acento', () => {
        const totales = staffConsumption([
            mov('CONSUMO_PERSONAL', { quantity: -1, staffName: 'Martin' }),
            mov('CONSUMO_PERSONAL', { quantity: -2, staffName: 'Martín' }),
        ]);

        expect(totales).toHaveLength(1);
        expect(totales[0].unidades).toBe(3);
    });

    it('muestra el nombre como se escribió la última vez', () => {
        const [persona] = staffConsumption([
            mov('CONSUMO_PERSONAL', {
                quantity: -1, staffName: 'martin',
                createdAt: new Date('2026-08-01T10:00:00'),
            }),
            mov('CONSUMO_PERSONAL', {
                quantity: -1, staffName: 'Martín',
                createdAt: new Date('2026-08-15T10:00:00'),
            }),
        ]);

        expect(persona.name).toBe('Martín');
        expect(persona.ultimoConsumo).toEqual(new Date('2026-08-15T10:00:00'));
    });

    it('ordena por quién se llevó más', () => {
        const totales = staffConsumption([
            mov('CONSUMO_PERSONAL', { quantity: -1, staffName: 'Ana' }),
            mov('CONSUMO_PERSONAL', { quantity: -5, staffName: 'Pedro' }),
        ]);

        expect(totales.map((t) => t.name)).toEqual(['Pedro', 'Ana']);
    });

    it('ignora todo lo que no sea consumo del personal', () => {
        const totales = staffConsumption([
            mov('VENTA_HUESPED', { quantity: -3 }),
            mov('MERMA', { quantity: -1 }),
        ]);

        expect(totales).toEqual([]);
    });

    it('sugiere los nombres ya usados para no partir a la misma persona', () => {
        expect(knownStaffNames([
            mov('CONSUMO_PERSONAL', { quantity: -3, staffName: 'Pedro' }),
            mov('CONSUMO_PERSONAL', { quantity: -1, staffName: 'Ana' }),
        ])).toEqual(['Pedro', 'Ana']);
    });
});

describe('lo que hay adentro', () => {
    it('valúa el stock al costo y a precio de venta', () => {
        const v = inventoryValue([
            producto({ stock: 10, cost: 900, price: 2000 }),
            producto({ id: 'i-2', stock: 4, cost: 2500, price: 5000 }),
        ]);

        expect(v.unidades).toBe(14);
        expect(v.alCosto).toBe(19000);
        expect(v.aVenta).toBe(40000);
        expect(v.sinCosto).toBe(0);
    });

    // El costo es opcional, así que el total al costo siempre es un piso. Se
    // avisa cuántos productos quedaron afuera en vez de dar un número redondo
    // que miente.
    it('avisa cuántos productos no tienen costo cargado', () => {
        const v = inventoryValue([
            producto({ stock: 10, cost: 900 }),
            producto({ id: 'i-2', stock: 6, cost: undefined, price: 1500 }),
        ]);

        expect(v.alCosto).toBe(9000);
        expect(v.aVenta).toBe(29000);
        expect(v.sinCosto).toBe(1);
    });

    it('el stock negativo no vale plata', () => {
        const v = inventoryValue([producto({ stock: -3, cost: 900, price: 2000 })]);

        expect(v.unidades).toBe(0);
        expect(v.alCosto).toBe(0);
        expect(v.aVenta).toBe(0);
    });

    it('la lista de reposición pone primero lo que peor está', () => {
        const faltantes = needsRestock([
            producto({ id: 'ok', name: 'Agua', stock: 20 }),
            producto({ id: 'bajo', name: 'Cerveza', stock: 2, lowStockThreshold: 4 }),
            producto({ id: 'cero', name: 'Papas', stock: 0 }),
            producto({ id: 'rojo', name: 'Alfajor', stock: -1 }),
        ]);

        expect(faltantes.map((i) => i.name)).toEqual(['Alfajor', 'Papas', 'Cerveza']);
    });

    it('no pide reponer un producto dado de baja', () => {
        expect(needsRestock([producto({ stock: 0, isActive: false })])).toEqual([]);
    });
});
