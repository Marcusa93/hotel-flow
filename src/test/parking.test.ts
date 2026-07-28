import { describe, it, expect } from 'vitest';
import { getParkingAvailability } from '@/lib/parking';
import type { Booking } from '@/types/hotel';

// Fechas armadas con (año, mes, día) y no con string ISO: '2026-08-10' se parsea
// como medianoche UTC y en Argentina cae el día anterior a las 21.
const agosto = (day: number) => new Date(2026, 7, day);

let seq = 0;
const conAuto = (checkIn: number, checkOut: number, over: Partial<Booking> = {}): Booking =>
    ({
        id: `b-${++seq}`,
        checkInDate: agosto(checkIn),
        checkOutDate: agosto(checkOut),
        status: 'CONFIRMED',
        hasVehicle: true,
        ...over,
    }) as Booking;

describe('getParkingAvailability', () => {
    it('sin cupo configurado no controla nada', () => {
        // parkingSpots en 0 significa que el hotel no lleva cocheras.
        expect(
            getParkingAvailability({
                bookings: [conAuto(10, 12)],
                spots: 0,
                from: agosto(10),
                to: agosto(12),
            })
        ).toBeNull();
    });

    it('sin fechas todavía no hay nada que decir', () => {
        expect(
            getParkingAvailability({ bookings: [], spots: 2, from: null, to: agosto(12) })
        ).toBeNull();
    });

    it('avisa cuando las cocheras están tomadas toda la estadía', () => {
        const parking = getParkingAvailability({
            bookings: [conAuto(10, 13), conAuto(10, 13)],
            spots: 2,
            from: agosto(10),
            to: agosto(12),
        });

        expect(parking?.isFull).toBe(true);
        expect(parking?.peakCars).toBe(2);
        expect(parking?.fullNights).toBe(2);
    });

    it('no avisa cuando sobra lugar', () => {
        const parking = getParkingAvailability({
            bookings: [conAuto(10, 13)],
            spots: 2,
            from: agosto(10),
            to: agosto(12),
        });

        expect(parking?.isFull).toBe(false);
        expect(parking?.peakCars).toBe(1);
    });

    it('una sola noche sin lugar ya es aviso', () => {
        // El 10 hay dos autos; el 11 solo uno. La estadía igual tiene un problema.
        const parking = getParkingAvailability({
            bookings: [conAuto(10, 11), conAuto(10, 13)],
            spots: 2,
            from: agosto(10),
            to: agosto(13),
        });

        expect(parking?.isFull).toBe(true);
        expect(parking?.fullNights).toBe(1);
        expect(parking?.peakNight).toEqual(agosto(10));
    });

    it('la noche de salida no ocupa cochera', () => {
        // El auto de la reserva que termina el 11 se va a la mañana: esa noche
        // el lugar queda libre, igual que la habitación.
        const parking = getParkingAvailability({
            bookings: [conAuto(9, 11)],
            spots: 1,
            from: agosto(11),
            to: agosto(13),
        });

        expect(parking?.isFull).toBe(false);
    });

    it('las canceladas, no-show y las que ya salieron no ocupan', () => {
        const parking = getParkingAvailability({
            bookings: [
                conAuto(10, 13, { status: 'CANCELLED' }),
                conAuto(10, 13, { status: 'NO_SHOW' }),
                conAuto(10, 13, { status: 'CHECKED_OUT' }),
            ],
            spots: 1,
            from: agosto(10),
            to: agosto(13),
        });

        expect(parking?.peakCars).toBe(0);
        expect(parking?.isFull).toBe(false);
    });

    it('las reservas sin auto no ocupan cochera', () => {
        const parking = getParkingAvailability({
            bookings: [conAuto(10, 13, { hasVehicle: false })],
            spots: 1,
            from: agosto(10),
            to: agosto(13),
        });

        expect(parking?.peakCars).toBe(0);
    });

    it('el huésped alojado sigue ocupando su cochera', () => {
        const parking = getParkingAvailability({
            bookings: [conAuto(9, 13, { status: 'CHECKED_IN' })],
            spots: 1,
            from: agosto(10),
            to: agosto(12),
        });

        expect(parking?.isFull).toBe(true);
    });

    it('se puede excluir la reserva que se está editando', () => {
        // Sin esto, una reserva que ya tiene cochera se contaría a sí misma.
        const propia = conAuto(10, 13);
        const parking = getParkingAvailability({
            bookings: [propia],
            spots: 1,
            from: agosto(10),
            to: agosto(13),
            excludeBookingId: propia.id,
        });

        expect(parking?.isFull).toBe(false);
    });
});
