import { describe, it, expect } from 'vitest';
import { buildBoard, isCurrentDeparture } from '@/lib/reservationBoard';
import type { Booking } from '@/types/hotel';

const HOY = new Date('2026-07-29T00:00:00');
const dia = (d: string) => new Date(`2026-07-${d}T00:00:00`);

const reserva = (over: Partial<Booking> & { id: string }): Booking => ({
    guestId: 'g',
    roomId: 'r',
    checkInDate: dia('24'),
    checkOutDate: dia('29'),
    adults: 1,
    children: 0,
    status: 'CHECKED_OUT',
    totalAmount: 0,
    createdAt: dia('20'),
    ...over,
});

describe('isCurrentDeparture', () => {
    it('la salida de hoy sigue en el tablero', () => {
        expect(isCurrentDeparture(reserva({ id: 'a', checkOutDate: dia('29') }), HOY)).toBe(true);
    });

    it('la de ayer ya no', () => {
        expect(isCurrentDeparture(reserva({ id: 'a', checkOutDate: dia('28') }), HOY)).toBe(false);
    });

    it('la que se fue antes de tiempo se queda hasta su fecha', () => {
        // Marcada como salida hoy pero con la reserva hasta el 30: no es una
        // salida vieja, y sacarla antes sería esconder algo que todavía pasa.
        expect(isCurrentDeparture(reserva({ id: 'a', checkOutDate: dia('30') }), HOY)).toBe(true);
    });
});

describe('buildBoard', () => {
    it('la columna de salidas se queda con las del día y cuenta las que saca', () => {
        // El reporte del hotel: la columna acumulaba todo lo que alguna vez salió.
        const board = buildBoard({
            bookings: [
                reserva({ id: 'vieja', checkOutDate: dia('27') }),
                reserva({ id: 'anteayer', checkOutDate: dia('26') }),
                reserva({ id: 'hoy', checkOutDate: dia('29') }),
            ],
            today: HOY,
            order: 'asc',
        });

        expect(board.columns.CHECKED_OUT.map(b => b.id)).toEqual(['hoy']);
        expect(board.hiddenDepartures).toBe(2);
    });

    it('con la pestaña Salidas elegida se muestran todas', () => {
        const board = buildBoard({
            bookings: [
                reserva({ id: 'vieja', checkOutDate: dia('27') }),
                reserva({ id: 'hoy', checkOutDate: dia('29') }),
            ],
            today: HOY,
            order: 'asc',
            allDepartures: true,
        });

        expect(board.columns.CHECKED_OUT).toHaveLength(2);
        expect(board.hiddenDepartures).toBe(0);
    });

    it('las salidas se ordenan por la fecha de salida', () => {
        const bookings = [
            reserva({ id: 'sale-31', checkOutDate: dia('31'), checkInDate: dia('20') }),
            reserva({ id: 'sale-29', checkOutDate: dia('29'), checkInDate: dia('28') }),
            reserva({ id: 'sale-30', checkOutDate: dia('30'), checkInDate: dia('25') }),
        ];

        const asc = buildBoard({ bookings, today: HOY, order: 'asc' });
        const desc = buildBoard({ bookings, today: HOY, order: 'desc' });

        expect(asc.columns.CHECKED_OUT.map(b => b.id)).toEqual(['sale-29', 'sale-30', 'sale-31']);
        expect(desc.columns.CHECKED_OUT.map(b => b.id)).toEqual(['sale-31', 'sale-30', 'sale-29']);
    });

    it('las hospedadas se ordenan por la fecha de entrada', () => {
        // La de salida no dice nada acá: todavía no se fueron.
        const bookings = [
            reserva({ id: 'entro-27', status: 'CHECKED_IN', checkInDate: dia('27'), checkOutDate: dia('31') }),
            reserva({ id: 'entro-25', status: 'CHECKED_IN', checkInDate: dia('25'), checkOutDate: dia('30') }),
        ];

        const asc = buildBoard({ bookings, today: HOY, order: 'asc' });

        expect(asc.columns.CHECKED_IN.map(b => b.id)).toEqual(['entro-25', 'entro-27']);
    });

    it('las canceladas no van a ninguna columna', () => {
        const board = buildBoard({
            bookings: [reserva({ id: 'cancelada', status: 'CANCELLED' })],
            today: HOY,
            order: 'asc',
        });

        expect(board.columns.PENDING).toHaveLength(0);
        expect(board.columns.CONFIRMED).toHaveLength(0);
        expect(board.columns.CHECKED_IN).toHaveLength(0);
        expect(board.columns.CHECKED_OUT).toHaveLength(0);
        expect(board.hiddenDepartures).toBe(0);
    });

    it('el filtro de salidas no toca las otras columnas', () => {
        // Una reserva vieja sin salir sigue estando: el corte es para las que ya
        // salieron, no para todo lo que tenga fecha pasada.
        const board = buildBoard({
            bookings: [
                reserva({ id: 'colgada', status: 'CHECKED_IN', checkInDate: dia('20'), checkOutDate: dia('22') }),
            ],
            today: HOY,
            order: 'asc',
        });

        expect(board.columns.CHECKED_IN.map(b => b.id)).toEqual(['colgada']);
    });
});
