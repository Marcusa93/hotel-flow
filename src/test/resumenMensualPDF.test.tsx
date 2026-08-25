import { describe, it, expect } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { guestMovement, type MonthIncome, type MonthOccupancy } from '@/lib/monthlySummary';
import { summarizeMovements } from '@/lib/heladera';
import { MonthlySummaryPDF } from '@/lib/pdfTemplates/MonthlySummaryPDF';
import type { ExpenseBreakdown } from '@/lib/cashClosing';
import type { Booking, BookingStatus } from '@/types/hotel';

// El resumen que el dueño le manda a los socios. Dos cosas se prueban acá: que
// las cuentas de gente sean las que son, y que el PDF se genere de verdad —una
// propiedad de estilo mal puesta en @react-pdf explota recién al descargarlo, y
// hasta ahora nada lo agarraba antes que el usuario.

const AGOSTO = { start: new Date(2026, 7, 1), end: new Date(2026, 7, 31) };

let seq = 0;
const reserva = (over: Partial<Booking> = {}): Booking => ({
    id: `b-${++seq}`,
    guestId: 'g-1',
    roomId: 'r-1',
    checkInDate: new Date(2026, 7, 10),
    checkOutDate: new Date(2026, 7, 13),
    adults: 2,
    children: 0,
    status: 'CHECKED_OUT' as BookingStatus,
    totalAmount: 90000,
    createdAt: new Date(2026, 7, 1),
    ...over,
} as Booking);

describe('movimiento de huéspedes', () => {
    it('cuenta las reservas que llegaron y la gente que trajeron', () => {
        const m = guestMovement({
            bookings: [
                reserva({ adults: 2, children: 1 }),
                reserva({ adults: 1, children: 0, infants: 2 }),
            ],
            ...AGOSTO,
        });

        expect(m.arrivals).toBe(2);
        expect(m.people).toBe(6);
    });

    // La ocupación cuenta noches-habitación y ya está en el PDF. Esto es otra
    // pregunta: cuánta gente pasó. Una reserva que empezó en julio durmió acá el
    // 1 de agosto, pero no llegó en agosto.
    it('va por fecha de llegada, no por cruce con el mes', () => {
        const m = guestMovement({
            bookings: [
                reserva({ checkInDate: new Date(2026, 6, 28), checkOutDate: new Date(2026, 7, 3) }),
                reserva({ checkInDate: new Date(2026, 7, 5) }),
            ],
            ...AGOSTO,
        });

        expect(m.arrivals).toBe(1);
    });

    it('promedia las noches de las que llegaron', () => {
        const m = guestMovement({
            bookings: [
                reserva({ checkInDate: new Date(2026, 7, 1), checkOutDate: new Date(2026, 7, 3) }), // 2
                reserva({ checkInDate: new Date(2026, 7, 5), checkOutDate: new Date(2026, 7, 9) }), // 4
            ],
            ...AGOSTO,
        });

        expect(m.avgNights).toBe(3);
    });

    // Entra y sale el mismo día: no durmió, y contarla como una noche subiría el
    // promedio de estadía con algo que no es una estadía.
    it('la media estadía no suma noches pero sí cuenta como llegada', () => {
        const m = guestMovement({
            bookings: [reserva({
                checkInDate: new Date(2026, 7, 4), checkOutDate: new Date(2026, 7, 4),
                isHalfDay: true, adults: 2,
            } as Partial<Booking>)],
            ...AGOSTO,
        });

        expect(m.arrivals).toBe(1);
        expect(m.people).toBe(2);
        expect(m.avgNights).toBe(0);
    });

    it('las que se cayeron van aparte y no cuentan como gente alojada', () => {
        const m = guestMovement({
            bookings: [
                reserva({ status: 'CANCELLED', adults: 4 }),
                reserva({ status: 'NO_SHOW', adults: 3 }),
                reserva({ adults: 2 }),
            ],
            ...AGOSTO,
        });

        expect(m.arrivals).toBe(1);
        expect(m.people).toBe(2);
        expect(m.lost).toBe(2);
    });

    it('un mes sin nadie no divide por cero', () => {
        expect(guestMovement({ bookings: [], ...AGOSTO })).toEqual({
            arrivals: 0, people: 0, lost: 0, avgNights: 0,
        });
    });
});

describe('el PDF del resumen', () => {
    const income: MonthIncome = {
        byMethod: { CASH: 800000, TRANSFER: 400000 },
        total: 1200000, fromBookings: 1100000, fromOther: 100000,
        fromAccounts: 0, toAccounts: 50000,
    };

    const expenses: ExpenseBreakdown = {
        byType: { BEBIDAS: 120000, LIMPIEZA: 60000 },
        byMethod: { CASH: 180000 },
        cash: 180000, cashRecaudacion: 120000, cashEmpresa: 60000,
        empresa: 60000, unspecified: 0, total: 180000,
    };

    const occupancy: MonthOccupancy = {
        nightsSold: 240, nightsAvailable: 744, rate: 32.3, daysCounted: 31,
        byDay: [], busiest: null, quietest: null, halfDays: 3,
    };

    const armar = (extra: Partial<Parameters<typeof MonthlySummaryPDF>[0]> = {}) =>
        MonthlySummaryPDF({
            hotelName: 'Hotel Mediterraneo',
            monthLabel: 'agosto de 2026',
            periodNote: 'Mes completo — 31 días',
            income, expenses, occupancy, byType: [],
            guests: { arrivals: 42, people: 91, lost: 3, avgNights: 2.4 },
            minibar: summarizeMovements([]),
            companyBalance: 17230324,
            result: 1020000,
            isPartial: false,
            ...extra,
        });

    it('se genera', async () => {
        const buffer = await renderToBuffer(armar());
        expect(buffer.length).toBeGreaterThan(2000);
    }, 30000);

    // El mes recién arrancado, donde casi todo es cero o vacío: es cuando más
    // fácil se cuelan divisiones por cero y listas sin elementos.
    it('se genera igual con un mes vacío', async () => {
        const buffer = await renderToBuffer(armar({
            income: { byMethod: {}, total: 0, fromBookings: 0, fromOther: 0, fromAccounts: 0, toAccounts: 0 },
            expenses: { byType: {}, byMethod: {}, cash: 0, cashRecaudacion: 0, cashEmpresa: 0, empresa: 0, unspecified: 0, total: 0 },
            occupancy: { ...occupancy, nightsSold: 0, rate: 0, halfDays: 0 },
            guests: { arrivals: 0, people: 0, lost: 0, avgNights: 0 },
            companyBalance: null,
            result: 0,
        }));
        expect(buffer.length).toBeGreaterThan(2000);
    }, 30000);

    it('se genera con la heladera cargada', async () => {
        const buffer = await renderToBuffer(armar({
            minibar: summarizeMovements([
                {
                    id: 'm-1', itemId: 'i-1', kind: 'VENTA_HUESPED', quantity: -12,
                    unitPrice: 2000, unitCost: 900, createdAt: new Date(2026, 7, 10),
                },
                {
                    id: 'm-2', itemId: 'i-1', kind: 'CONSUMO_PERSONAL', quantity: -5,
                    unitPrice: 0, unitCost: 900, staffName: 'Martín', createdAt: new Date(2026, 7, 12),
                },
            ]),
        }));
        expect(buffer.length).toBeGreaterThan(2000);
    }, 30000);
});
