import { describe, it, expect } from 'vitest';
import { buildStayExtension, describeStayExtension } from '@/lib/stayExtension';
import { buildBookingAccount } from '@/lib/bookingAccount';

// Fechas armadas con (año, mes, día) y no con string ISO: '2026-07-25' se parsea
// como medianoche UTC y en Argentina cae el 24 a las 21, que rompe el formateo.
const julio = (day: number) => new Date(2026, 6, day);

describe('buildStayExtension', () => {
    it('corre la salida tantos días como noches se agreguen', () => {
        // El huésped se iba el 25 y pide dos noches más: duerme el 25 y el 26,
        // se va el 27.
        const extension = buildStayExtension({
            currentCheckOut: julio(25),
            nights: 2,
            pricePerNight: 80_000,
        });

        expect(extension.from).toEqual(julio(25));
        expect(extension.to).toEqual(julio(27));
        expect(extension.nights).toBe(2);
    });

    it('cobra por noche', () => {
        const extension = buildStayExtension({
            currentCheckOut: julio(25),
            nights: 3,
            pricePerNight: 80_000,
        });

        expect(extension.total).toBe(240_000);
    });

    it('arranca la ventana en la salida vieja, no al día siguiente', () => {
        // De acá sale el chequeo de disponibilidad. Si empezara un día después,
        // una reserva que entra el 25 no daría conflicto y quedarían dos
        // huéspedes en la misma habitación esa noche.
        const extension = buildStayExtension({
            currentCheckOut: julio(25),
            nights: 1,
            pricePerNight: 80_000,
        });

        expect(extension.from).toEqual(julio(25));
        expect(extension.to).toEqual(julio(26));
    });

    it('no inventa noches ni plata con valores basura', () => {
        const vacio = buildStayExtension({
            currentCheckOut: julio(25),
            nights: 0,
            pricePerNight: 80_000,
        });
        expect(vacio.total).toBe(0);
        expect(vacio.to).toEqual(julio(25));

        const negativo = buildStayExtension({
            currentCheckOut: julio(25),
            nights: -3,
            pricePerNight: -80_000,
        });
        expect(negativo.nights).toBe(0);
        expect(negativo.pricePerNight).toBe(0);
        expect(negativo.total).toBe(0);
    });
});

describe('describeStayExtension', () => {
    it('deja las fechas escritas en el cargo', () => {
        const extension = buildStayExtension({
            currentCheckOut: julio(25),
            nights: 2,
            pricePerNight: 80_000,
        });

        expect(describeStayExtension(extension)).toBe('2 noches adicionales (25 jul → 27 jul)');
    });

    it('usa singular con una sola noche', () => {
        const extension = buildStayExtension({
            currentCheckOut: julio(25),
            nights: 1,
            pricePerNight: 80_000,
        });

        expect(describeStayExtension(extension)).toBe('1 noche adicional (25 jul → 26 jul)');
    });
});

describe('la extensión en el estado de cuenta', () => {
    it('suma al saldo a cobrar sin tocar el total de la reserva', () => {
        // Reserva de $240.000 ya paga, más dos noches a $80.000 cargadas
        // después: la cuenta tiene que quedar debiendo los $160.000 nuevos.
        const extension = buildStayExtension({
            currentCheckOut: julio(25),
            nights: 2,
            pricePerNight: 80_000,
        });

        const account = buildBookingAccount({
            booking: { totalAmount: 240_000 },
            payments: [{ amount: 240_000, status: 'PAID' }],
            charges: [{ amount: extension.pricePerNight, quantity: extension.nights }],
        });

        expect(account.lodging).toBe(240_000);
        expect(account.extras).toBe(160_000);
        expect(account.total).toBe(400_000);
        expect(account.balance).toBe(160_000);
        expect(account.isSettled).toBe(false);
    });
});
