import { describe, it, expect } from 'vitest';
import { buildBoard, groupByProximity, isCurrentDeparture } from '@/lib/reservationBoard';
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


// La columna de Pendientes tiene 81 reservas repartidas en tres meses, y en
// pantalla entran una y media. Sin puntos de referencia, scrollearla es a
// ciegas: no sabés si lo que estás mirando llega el martes o en noviembre.

describe('groupByProximity', () => {
    const AGOSTO = (d: number) => new Date(2026, 7, d, 0, 0, 0);
    const HOY_AGOSTO = AGOSTO(25);

    /** n reservas que entran el día d. */
    const llegan = (d: number, n = 1): Booking[] =>
        Array.from({ length: n }, (_, i) => reserva({
            id: `b-${d}-${i}`, status: 'PENDING',
            checkInDate: AGOSTO(d), checkOutDate: AGOSTO(d + 2),
        }));

    const agrupar = (bookings: Booking[], status: 'PENDING' | 'CHECKED_OUT' = 'PENDING') =>
        groupByProximity({ bookings, status, today: HOY_AGOSTO });

    it('parte la columna en tramos por cercanía a hoy', () => {
        const grupos = agrupar([
            ...llegan(25, 2),   // hoy
            ...llegan(28, 3),   // esta semana
            ...llegan(40, 4),   // dentro de 30 días — septiembre
            ...llegan(120, 3),  // más adelante
        ]);

        expect(grupos.map(g => g.key)).toEqual(['hoy', 'semana', 'mes', 'despues']);
        expect(grupos.map(g => g.bookings.length)).toEqual([2, 3, 4, 3]);
        expect(grupos[0].label).toBe('Llegan hoy');
        expect(grupos[3].label).toBe('Más adelante');
    });

    // Podría ahorrarse el título cuando hay uno solo, pero entonces unas
    // columnas arrancarían con separador y otras con una tarjeta, y las cuatro
    // quedarían corridas entre sí. Con un tramo por columna, las tarjetas
    // empiezan todas a la misma altura.
    it('devuelve un tramo aunque caigan todas en el mismo', () => {
        // Día 45 de agosto = 14 de septiembre: +20 días de hoy, todas en 'mes'.
        const grupos = agrupar(llegan(45, 20));
        expect(grupos).toHaveLength(1);
        expect(grupos[0].key).toBe('mes');
    });

    it('agrupa igual una columna corta', () => {
        const grupos = agrupar([...llegan(25, 2), ...llegan(90, 2)]);
        expect(grupos.map(g => g.key)).toEqual(['hoy', 'despues']);
    });

    it('una columna vacía no devuelve tramos', () => {
        expect(agrupar([])).toEqual([]);
    });

    it('el borde de la semana son 7 días, y el del mes 30', () => {
        const grupos = agrupar([
            ...llegan(26, 3),   // mañana
            ...llegan(32, 3),   // +7 → última de "esta semana"
            ...llegan(33, 3),   // +8 → ya es "próximos 30 días"
            ...llegan(55, 2),   // +30 → última de "próximos 30 días"
            ...llegan(56, 2),   // +31 → más adelante
        ]);

        expect(grupos.map(g => [g.key, g.bookings.length])).toEqual([
            ['semana', 6], ['mes', 5], ['despues', 2],
        ]);
    });

    it('lo que quedó atrasado va primero y se nombra como tal', () => {
        const grupos = agrupar([
            ...llegan(20, 3),   // ya pasó y sigue pendiente
            ...llegan(26, 8),
        ]);

        expect(grupos[0].key).toBe('atrasadas');
        expect(grupos[0].label).toBe('Ya deberían haber llegado');
    });

    // El botón "Últimos arriba" invierte el orden del tablero. Los tramos salen
    // en el orden en que aparecen, así que se dan vuelta solos.
    it('sigue el orden en que vienen las reservas', () => {
        const alReves = [...llegan(120, 3), ...llegan(40, 4), ...llegan(25, 4)];
        expect(agrupar(alReves).map(g => g.key)).toEqual(['despues', 'mes', 'hoy']);
    });

    it('la columna de salidas agrupa por la fecha de salida, no la de entrada', () => {
        const salidas = Array.from({ length: 12 }, (_, i) => reserva({
            id: `s-${i}`, status: 'CHECKED_OUT',
            // Todas entraron el mismo día; se van en fechas distintas.
            checkInDate: AGOSTO(20),
            checkOutDate: i < 5 ? AGOSTO(25) : AGOSTO(29),
        }));

        const grupos = groupByProximity({ bookings: salidas, status: 'CHECKED_OUT', today: HOY_AGOSTO });
        expect(grupos.map(g => [g.label, g.bookings.length])).toEqual([
            ['Salieron hoy', 5], ['Salen esta semana', 7],
        ]);
    });

    it('no pierde ni duplica ninguna reserva', () => {
        const todas = [...llegan(25, 4), ...llegan(30, 5), ...llegan(90, 6)];
        const grupos = agrupar(todas);
        const ids = grupos.flatMap(g => g.bookings.map(b => b.id));

        expect(ids).toHaveLength(todas.length);
        expect(new Set(ids).size).toBe(todas.length);
    });
});
