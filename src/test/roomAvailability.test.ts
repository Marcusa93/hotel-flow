import { describe, it, expect } from 'vitest';
import { findRoomConflicts } from '@/lib/roomAvailability';
import type { Booking } from '@/types/hotel';

const d = (iso: string) => new Date(`${iso}T00:00:00`);

const reserva = (o: Partial<Booking>): Booking => ({
    id: 'b1',
    guestId: 'g1',
    roomId: 'hab-1',
    checkInDate: d('2026-10-10'),
    checkOutDate: d('2026-10-12'),
    status: 'CONFIRMED',
    totalAmount: 100_000,
    adults: 2,
    children: 0,
    ...o,
} as Booking);

const libre = (bookings: Booking[], q: Parameters<typeof findRoomConflicts>[1]) =>
    findRoomConflicts(bookings, q).available;

describe('findRoomConflicts', () => {
    const base = { roomId: 'hab-1', checkIn: d('2026-10-10'), checkOut: d('2026-10-12') };

    it('la habitación ocupada esas noches no está libre', () => {
        expect(libre([reserva({})], base)).toBe(false);
    });

    it('otra habitación no molesta', () => {
        expect(libre([reserva({ roomId: 'hab-2' })], base)).toBe(true);
    });

    it('el día de salida se puede volver a vender', () => {
        // El que se va el 12 a la mañana y el que llega el 12 a la tarde conviven.
        expect(libre([reserva({})], { ...base, checkIn: d('2026-10-12'), checkOut: d('2026-10-14') })).toBe(true);
    });

    it('la noche anterior a una entrada queda libre', () => {
        expect(libre([reserva({})], { ...base, checkIn: d('2026-10-08'), checkOut: d('2026-10-10') })).toBe(true);
    });

    it('una cancelada o un no-show no ocupan nada', () => {
        expect(libre([reserva({ status: 'CANCELLED' })], base)).toBe(true);
        expect(libre([reserva({ status: 'NO_SHOW' })], base)).toBe(true);
    });

    it('el que ya se fue libera la habitación aunque su salida sea futura', () => {
        // Check-out anticipado: esas noches se pueden vender.
        expect(libre([reserva({ status: 'CHECKED_OUT' })], base)).toBe(true);
    });

    it('la reserva que se está editando no choca consigo misma', () => {
        expect(libre([reserva({ id: 'editando' })], { ...base, excludeBookingId: 'editando' })).toBe(true);
    });

    it('el hotel alquilado completo tapa cualquier habitación', () => {
        const completo = reserva({ id: 'full', isFullHotel: true, roomId: 'otra' });
        expect(libre([completo], { ...base, roomId: 'hab-9' })).toBe(false);
    });

    describe('medias estadías', () => {
        const media = (dia: string, o: Partial<Booking> = {}) =>
            reserva({ isHalfDay: true, checkInDate: d(dia), checkOutDate: d(dia), ...o });

        it('dos medias estadías el mismo día chocan', () => {
            expect(libre([media('2026-10-10')], {
                roomId: 'hab-1', checkIn: d('2026-10-10'), checkOut: d('2026-10-10'), isHalfDay: true,
            })).toBe(false);
        });

        it('dos medias estadías en días distintos conviven', () => {
            expect(libre([media('2026-10-10')], {
                roomId: 'hab-1', checkIn: d('2026-10-11'), checkOut: d('2026-10-11'), isHalfDay: true,
            })).toBe(true);
        });

        it('una media estadía convive con quien llega esa noche', () => {
            // Sale a las 18:00, el otro entra después. Es para lo que se pidió.
            expect(libre([media('2026-10-10')], {
                roomId: 'hab-1', checkIn: d('2026-10-10'), checkOut: d('2026-10-12'),
            })).toBe(true);
        });

        it('la estadía y media bloquea una media estadía el día que se retira', () => {
            // Se va a las 18:00 del 12: ese día la habitación está tomada de 10 a 18.
            const estadiaYMedia = reserva({ halfDayAdd: true });
            expect(libre([estadiaYMedia], {
                roomId: 'hab-1', checkIn: d('2026-10-12'), checkOut: d('2026-10-12'), isHalfDay: true,
            })).toBe(false);
        });

        it('y al revés: la media estadía bloquea una estadía y media que termina ese día', () => {
            expect(libre([media('2026-10-12')], {
                roomId: 'hab-1', checkIn: d('2026-10-10'), checkOut: d('2026-10-12'), halfDayAdd: true,
            })).toBe(false);
        });

        it('una estadía y media no molesta a la media estadía de otro día', () => {
            const estadiaYMedia = reserva({ halfDayAdd: true });
            expect(libre([estadiaYMedia], {
                roomId: 'hab-1', checkIn: d('2026-10-13'), checkOut: d('2026-10-13'), isHalfDay: true,
            })).toBe(true);
        });
    });

    it('devuelve qué reserva ocupa, para poder decirlo en pantalla', () => {
        const { conflicts } = findRoomConflicts([reserva({ id: 'la-que-ocupa' })], base);
        expect(conflicts.map(c => c.id)).toEqual(['la-que-ocupa']);
    });
});
