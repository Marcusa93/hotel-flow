import { describe, it, expect } from 'vitest';
import { buildCurrentAccount, isCurrentAccountPayment } from '@/lib/currentAccount';
import type { Booking, CurrentAccountPayment, Payment } from '@/types/hotel';

// El huésped frecuente carga sus estadías a la cuenta y salda cuando pasa.
// Un cargo es un cobro de reserva hecho con método "Cuenta corriente"; un pago
// es lo que después trae para bajarla.

const RECURRENTE = 'g-1';
const OTRO = 'g-2';

const reserva = (id: string, guestId: string) => ({ id, guestId }) as Booking;

const cobro = (over: Partial<Payment> = {}): Payment => ({
    id: 'p-1',
    bookingId: 'b-1',
    date: new Date(2026, 6, 10),
    method: 'CUENTA_CORRIENTE',
    status: 'PAID',
    amount: 100_000,
    ...over,
});

const pagoDeCuenta = (over: Partial<CurrentAccountPayment> = {}): CurrentAccountPayment => ({
    id: 'cc-1',
    guestId: RECURRENTE,
    date: new Date(2026, 6, 20),
    amount: 60_000,
    method: 'CASH',
    createdAt: new Date(2026, 6, 20),
    ...over,
});

describe('isCurrentAccountPayment', () => {
    it('distingue el cobro que no cobra', () => {
        expect(isCurrentAccountPayment({ method: 'CUENTA_CORRIENTE' })).toBe(true);
        expect(isCurrentAccountPayment({ method: 'CASH' })).toBe(false);
    });
});

describe('buildCurrentAccount', () => {
    const bookings = [reserva('b-1', RECURRENTE), reserva('b-2', RECURRENTE), reserva('b-9', OTRO)];

    it('acumula las estadías cargadas a la cuenta', () => {
        const account = buildCurrentAccount({
            guestId: RECURRENTE,
            bookings,
            payments: [cobro(), cobro({ id: 'p-2', bookingId: 'b-2', amount: 80_000 })],
        });

        expect(account.charged).toBe(180_000);
        expect(account.balance).toBe(180_000);
    });

    it('los cobros normales no van a la cuenta corriente', () => {
        // Si el huésped paga en efectivo, esa estadía no le queda debiendo.
        const account = buildCurrentAccount({
            guestId: RECURRENTE,
            bookings,
            payments: [cobro({ method: 'CASH' })],
        });

        expect(account.charged).toBe(0);
        expect(account.charges).toHaveLength(0);
    });

    it('baja el saldo con lo que el huésped paga', () => {
        const account = buildCurrentAccount({
            guestId: RECURRENTE,
            bookings,
            payments: [cobro()],
            accountPayments: [pagoDeCuenta()],
        });

        expect(account.charged).toBe(100_000);
        expect(account.settled).toBe(60_000);
        expect(account.balance).toBe(40_000);
    });

    it('no cuenta las estadías de otro huésped', () => {
        // El cobro es a la reserva b-9, que es de otro: no puede caer en esta cuenta.
        const account = buildCurrentAccount({
            guestId: RECURRENTE,
            bookings,
            payments: [cobro({ bookingId: 'b-9' })],
        });

        expect(account.charged).toBe(0);
    });

    it('no cuenta los pagos de otro huésped', () => {
        const account = buildCurrentAccount({
            guestId: RECURRENTE,
            bookings,
            payments: [cobro()],
            accountPayments: [pagoDeCuenta({ guestId: OTRO, amount: 100_000 })],
        });

        expect(account.settled).toBe(0);
        expect(account.balance).toBe(100_000);
    });

    it('pagar de más deja la cuenta en cero, no a favor', () => {
        // Esta cuenta corriente solo sirve para deber. Un saldo negativo
        // invitaría a descontarlo de la próxima estadía, que no es lo acordado.
        const account = buildCurrentAccount({
            guestId: RECURRENTE,
            bookings,
            payments: [cobro()],
            accountPayments: [pagoDeCuenta({ amount: 150_000 })],
        });

        expect(account.balance).toBe(0);
    });

    it('un huésped sin movimientos no debe nada', () => {
        const account = buildCurrentAccount({ guestId: RECURRENTE });

        expect(account.balance).toBe(0);
        expect(account.charges).toHaveLength(0);
        expect(account.payments).toHaveLength(0);
    });

    it('lista los movimientos del más nuevo al más viejo', () => {
        const account = buildCurrentAccount({
            guestId: RECURRENTE,
            bookings,
            payments: [
                cobro({ id: 'viejo', date: new Date(2026, 6, 1) }),
                cobro({ id: 'nuevo', bookingId: 'b-2', date: new Date(2026, 6, 15) }),
            ],
        });

        expect(account.charges.map(c => c.paymentId)).toEqual(['nuevo', 'viejo']);
    });
});
