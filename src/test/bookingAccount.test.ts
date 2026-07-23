import { describe, it, expect } from 'vitest';
import {
    buildBookingAccount,
    buildAccountsByBooking,
    buildOutstandingTotals,
    paymentState,
    paymentStateLabel,
} from '@/lib/bookingAccount';
import { Payment, BookingCharge } from '@/types/hotel';

const payment = (overrides: Partial<Payment>): Payment => ({
    id: 'p1',
    bookingId: 'b1',
    date: new Date('2026-07-22'),
    method: 'TRANSFER',
    status: 'PAID',
    amount: 0,
    ...overrides,
});

const charge = (overrides: Partial<BookingCharge>): BookingCharge => ({
    id: 'c1',
    bookingId: 'b1',
    category: 'MINIBAR',
    description: 'Agua',
    amount: 0,
    quantity: 1,
    createdAt: new Date('2026-07-22'),
    ...overrides,
} as BookingCharge);

describe('buildBookingAccount', () => {
    it('un cupón al cobrar salda la cuenta en vez de dejar deuda', () => {
        // El caso real: reserva de $255.000, cupón del 20%, se cobran $204.000.
        // Antes el saldo mostraba $51.000 de deuda, que era el descuento.
        const account = buildBookingAccount({
            booking: { totalAmount: 255_000 },
            payments: [payment({ amount: 204_000, discountAmount: 51_000 })],
        });

        expect(account.discount).toBe(51_000);
        expect(account.paid).toBe(204_000);
        expect(account.balance).toBe(0);
        expect(account.isSettled).toBe(true);
        expect(account.progress).toBe(100);
    });

    it('no descuenta dos veces la promoción aplicada al reservar', () => {
        // Una promo al reservar ya bajó booking.totalAmount: el total es el
        // precio con promo. Restarla otra vez daría un saldo a favor inventado.
        const account = buildBookingAccount({
            booking: { totalAmount: 204_000 },
            payments: [payment({ amount: 204_000 })],
        });

        expect(account.discount).toBe(0);
        expect(account.balance).toBe(0);
    });

    it('suma los consumos al total', () => {
        const account = buildBookingAccount({
            booking: { totalAmount: 100_000 },
            payments: [payment({ amount: 100_000 })],
            charges: [charge({ amount: 5_000, quantity: 2 })],
        });

        expect(account.extras).toBe(10_000);
        expect(account.total).toBe(110_000);
        expect(account.balance).toBe(10_000);
        expect(account.isSettled).toBe(false);
    });

    it('contempla cargos de último momento que aún no están guardados', () => {
        const account = buildBookingAccount({
            booking: { totalAmount: 80_000 },
            payments: [payment({ amount: 80_000 })],
            pendingExtra: 5_000, // check-out tardío
        });

        expect(account.balance).toBe(5_000);
        expect(account.isSettled).toBe(false);
    });

    it('ignora los pagos que no están cobrados', () => {
        const account = buildBookingAccount({
            booking: { totalAmount: 100_000 },
            payments: [
                payment({ id: 'ok', amount: 40_000 }),
                payment({ id: 'pendiente', amount: 60_000, status: 'PENDING' }),
                payment({ id: 'fallido', amount: 60_000, status: 'FAILED' }),
            ],
        });

        expect(account.paid).toBe(40_000);
        expect(account.balance).toBe(60_000);
    });

    it('no cuenta el descuento de un pago que no llegó a cobrarse', () => {
        const account = buildBookingAccount({
            booking: { totalAmount: 100_000 },
            payments: [payment({ amount: 80_000, discountAmount: 20_000, status: 'PENDING' })],
        });

        expect(account.discount).toBe(0);
        expect(account.balance).toBe(100_000);
    });

    it('marca saldada una reserva cobrada de más', () => {
        const account = buildBookingAccount({
            booking: { totalAmount: 100_000 },
            payments: [payment({ amount: 120_000 })],
        });

        expect(account.balance).toBe(-20_000);
        expect(account.isSettled).toBe(true);
        expect(account.progress).toBe(100);
    });

    it('no divide por cero con una reserva sin monto', () => {
        const account = buildBookingAccount({ booking: { totalAmount: 0 } });
        expect(account.progress).toBe(0);
        expect(account.isSettled).toBe(true);
    });
});

describe('paymentState', () => {
    it('distingue la habitación paga con consumos pendientes', () => {
        // El caso que mostraba "Pagado" en el tablero: se cobró la habitación
        // completa y después se agregaron dos noches sin cobrar.
        const account = buildBookingAccount({
            booking: { totalAmount: 240_000 },
            payments: [payment({ amount: 240_000 })],
            charges: [charge({ amount: 80_000, quantity: 2 })],
        });

        expect(paymentState(account)).toBe('extras');
        expect(paymentStateLabel(account)).toBe('Extras $160.000');
    });

    it('sigue siendo un pago parcial si falta parte de la habitación', () => {
        // Acá la deuda no es solo de consumos: mandar a recepción a mirar la
        // cuenta de extras sería mandarla al lugar equivocado.
        const account = buildBookingAccount({
            booking: { totalAmount: 240_000 },
            payments: [payment({ amount: 100_000 })],
            charges: [charge({ amount: 80_000, quantity: 1 })],
        });

        expect(paymentState(account)).toBe('partial');
        expect(paymentStateLabel(account)).toBe('Debe $220.000');
    });

    it('el descuento cuenta como habitación cubierta', () => {
        // Cupón que salda el alojamiento, más minibar sin pagar.
        const account = buildBookingAccount({
            booking: { totalAmount: 100_000 },
            payments: [payment({ amount: 80_000, discountAmount: 20_000 })],
            charges: [charge({ amount: 5_000, quantity: 1 })],
        });

        expect(paymentState(account)).toBe('extras');
    });

    it('sin un peso cobrado es sin pagar, aunque haya consumos', () => {
        const account = buildBookingAccount({
            booking: { totalAmount: 100_000 },
            charges: [charge({ amount: 5_000, quantity: 1 })],
        });

        expect(paymentState(account)).toBe('unpaid');
        expect(paymentStateLabel(account)).toBe('Sin pagar');
    });

    it('saldada es saldada, incluso cobrando de más', () => {
        const account = buildBookingAccount({
            booking: { totalAmount: 100_000 },
            payments: [payment({ amount: 120_000 })],
            charges: [charge({ amount: 5_000, quantity: 1 })],
        });

        expect(paymentState(account)).toBe('paid');
        expect(paymentStateLabel(account)).toBe('Pagado');
    });
});

describe('buildAccountsByBooking', () => {
    it('le da a cada reserva sus propios pagos y cargos', () => {
        const accounts = buildAccountsByBooking({
            bookings: [
                { id: 'b1', totalAmount: 100_000 },
                { id: 'b2', totalAmount: 50_000 },
            ],
            payments: [
                payment({ id: 'p1', bookingId: 'b1', amount: 100_000 }),
                payment({ id: 'p2', bookingId: 'b2', amount: 10_000 }),
            ],
            charges: [
                { bookingId: 'b1', amount: 8_000, quantity: 2 },
                { bookingId: 'b2', amount: 1_000, quantity: 1 },
            ],
        });

        expect(accounts.get('b1')?.extras).toBe(16_000);
        expect(accounts.get('b1')?.balance).toBe(16_000);
        expect(accounts.get('b2')?.extras).toBe(1_000);
        expect(accounts.get('b2')?.balance).toBe(41_000);
    });

    it('no le adjudica a nadie los pagos sin reserva', () => {
        const accounts = buildAccountsByBooking({
            bookings: [{ id: 'b1', totalAmount: 100_000 }],
            payments: [payment({ id: 'suelto', bookingId: undefined, amount: 100_000 })],
        });

        expect(accounts.get('b1')?.paid).toBe(0);
        expect(accounts.get('b1')?.balance).toBe(100_000);
    });

    it('arma la cuenta de una reserva sin movimientos', () => {
        const accounts = buildAccountsByBooking({
            bookings: [{ id: 'b1', totalAmount: 100_000 }],
            payments: [],
        });

        expect(accounts.get('b1')?.total).toBe(100_000);
        expect(accounts.get('b1')?.balance).toBe(100_000);
    });
});

describe('buildOutstandingTotals', () => {
    it('cuenta los consumos impagos del que está alojado', () => {
        // El caso que daba $0 en Finanzas: habitación cobrada, extras no.
        const totals = buildOutstandingTotals({
            bookings: [{ id: 'b1', totalAmount: 240_000, status: 'CHECKED_IN' }],
            payments: [payment({ bookingId: 'b1', amount: 240_000 })],
            charges: [{ bookingId: 'b1', amount: 80_000, quantity: 2 }],
        });

        expect(totals.outstanding).toBe(160_000);
        expect(totals.outstandingCount).toBe(1);
    });

    it('separa la deuda del que ya se fue', () => {
        const totals = buildOutstandingTotals({
            bookings: [
                { id: 'adentro', totalAmount: 100_000, status: 'CHECKED_IN' },
                { id: 'salido', totalAmount: 50_000, status: 'CHECKED_OUT' },
            ],
            payments: [],
        });

        expect(totals.outstanding).toBe(150_000);
        expect(totals.outstandingCount).toBe(2);
        expect(totals.departedDebt).toBe(50_000);
    });

    it('deja las reservas futuras afuera del total', () => {
        // Una reserva de diciembre sin seña debe todo. Sumada al principal, el
        // número lo dominarían estadías que ni empezaron.
        const totals = buildOutstandingTotals({
            bookings: [
                { id: 'adentro', totalAmount: 100_000, status: 'CHECKED_IN' },
                { id: 'diciembre', totalAmount: 900_000, status: 'CONFIRMED' },
                { id: 'a-confirmar', totalAmount: 300_000, status: 'PENDING' },
            ],
            payments: [],
        });

        expect(totals.outstanding).toBe(100_000);
        expect(totals.outstandingCount).toBe(1);
        expect(totals.upcoming).toBe(1_200_000);
    });

    it('no espera cobrar lo cancelado ni el no-show', () => {
        const totals = buildOutstandingTotals({
            bookings: [
                { id: 'cancelada', totalAmount: 100_000, status: 'CANCELLED' },
                { id: 'no-vino', totalAmount: 80_000, status: 'NO_SHOW' },
            ],
            payments: [],
        });

        expect(totals.outstanding).toBe(0);
        expect(totals.upcoming).toBe(0);
    });

    it('un pago sin cobrar no achica la deuda y no se cuenta dos veces', () => {
        // Se cargó el pago pero quedó en PENDING: la plata todavía no entró, así
        // que los $100.000 tienen que seguir figurando una sola vez.
        const totals = buildOutstandingTotals({
            bookings: [{ id: 'b1', totalAmount: 100_000, status: 'CHECKED_IN' }],
            payments: [payment({ bookingId: 'b1', amount: 100_000, status: 'PENDING' })],
        });

        expect(totals.outstanding).toBe(100_000);
    });

    it('una reserva cobrada de más no tapa la deuda de otra', () => {
        const totals = buildOutstandingTotals({
            bookings: [
                { id: 'de-mas', totalAmount: 100_000, status: 'CHECKED_OUT' },
                { id: 'debe', totalAmount: 100_000, status: 'CHECKED_IN' },
            ],
            payments: [payment({ bookingId: 'de-mas', amount: 150_000 })],
        });

        expect(totals.outstanding).toBe(100_000);
        expect(totals.outstandingCount).toBe(1);
    });
});
