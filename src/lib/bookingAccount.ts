import { Booking, Payment, BookingCharge } from '@/types/hotel';

/**
 * Cómo está de pagada una reserva, para los badges de las listas.
 *
 * 'extras' es el caso que faltaba: la habitación quedó saldada y lo que debe
 * son los consumos —minibar, o las noches que se agregaron después—. Antes eso
 * mostraba "Pagado" porque el cálculo comparaba lo cobrado contra el total de
 * la reserva, que no incluye los cargos. El recepcionista dejaba salir al
 * huésped mirando un badge verde.
 */
export type PaymentState = 'paid' | 'extras' | 'partial' | 'unpaid';

export interface BookingAccount {
    /** Alojamiento: el total de la reserva */
    lodging: number;
    /** Consumos y extras cargados a la estadía */
    extras: number;
    /** Lo que costó la estadía antes de descuentos aplicados al cobrar */
    total: number;
    /** Descuentos por promoción aplicados al momento de cobrar */
    discount: number;
    /** Cobrado efectivamente (pagos en estado PAID) */
    paid: number;
    /** Lo que falta cobrar. Negativo significa que se cobró de más. */
    balance: number;
    /** Sin saldo pendiente */
    isSettled: boolean;
    /** Porcentaje saldado, acotado a 100 */
    progress: number;
}

/** Lo mínimo que hace falta de un pago para saldar cuenta */
type SettleablePayment = Pick<Payment, 'amount'> & {
    status: Payment['status'] | string;
    discountAmount?: number;
};

// Acá vivía settledAmount, un atajo que devolvía cuánto se había cobrado de una
// reserva para las pantallas que "solo" querían saber si estaba al día. El
// atajo era la trampa: contemplaba el descuento pero no los cargos, así que
// toda pantalla que lo usaba comparaba lo cobrado contra el total de la reserva
// y daba por saldada una cuenta con consumos pendientes. Las cuatro que lo
// usaban ahora arman la cuenta completa; no queda forma de preguntar "¿está
// pagada?" sin mirar los cargos.

interface BuildAccountParams {
    booking: Pick<Booking, 'totalAmount'>;
    /** Pagos de ESTA reserva. El filtrado por estado lo hace esta función. */
    payments?: SettleablePayment[];
    charges?: Pick<BookingCharge, 'amount' | 'quantity'>[];
    /** Cargos de último momento que todavía no están en la base, como el check-out tardío */
    pendingExtra?: number;
}

/**
 * Estado de cuenta de una reserva.
 *
 * Existe porque este cálculo estaba repetido en nueve lugares —detalle, check-out,
 * check-in rápido, ficha del huésped, dos veces en pagos, la tarjeta del tablero y
 * las alertas automáticas— y ninguno contemplaba los descuentos. Un cupón aplicado
 * al cobrar bajaba lo que se cobraba pero no lo que se debía, así que el descuento
 * aparecía como deuda en las ocho pantallas a la vez.
 *
 * OJO con no descontar dos veces: si la promoción se aplicó al reservar, ya está
 * metida dentro de booking.totalAmount —el total se calculó con el precio
 * promocional—, así que booking.discountAmount NO va acá. Solo entra el descuento
 * de los pagos, que es el que el total nunca contempló.
 */
export const buildBookingAccount = ({
    booking,
    payments = [],
    charges = [],
    pendingExtra = 0,
}: BuildAccountParams): BookingAccount => {
    const settled = payments.filter(p => p.status === 'PAID');

    const lodging = booking.totalAmount || 0;
    const extras = charges.reduce((sum, c) => sum + c.amount * c.quantity, 0) + pendingExtra;
    const total = lodging + extras;

    const discount = settled.reduce((sum, p) => sum + (p.discountAmount || 0), 0);
    const paid = settled.reduce((sum, p) => sum + p.amount, 0);

    // El descuento salda parte de la cuenta igual que un pago: es plata que el
    // hotel resignó, no plata que el huésped todavía debe.
    const balance = total - discount - paid;

    return {
        lodging,
        extras,
        total,
        discount,
        paid,
        balance,
        isSettled: balance <= 0,
        progress: total > 0 ? Math.min(((paid + discount) / total) * 100, 100) : 0,
    };
};

/**
 * En qué estado de pago mostrar una reserva.
 *
 * El orden de las preguntas importa: primero si debe algo, y recién después de
 * dónde viene la deuda. Separar 'extras' de 'partial' es lo que deja distinguir
 * "falta cobrar la habitación" de "la habitación está paga, faltan los
 * consumos", que en el mostrador son dos conversaciones distintas.
 */
export const paymentState = (account: BookingAccount): PaymentState => {
    const covered = account.paid + account.discount;

    if (account.balance <= 0) return 'paid';
    if (covered <= 0) return 'unpaid';
    if (covered >= account.lodging) return 'extras';
    return 'partial';
};

/**
 * El texto del badge. Dice de dónde viene la deuda, no solo cuánta es.
 *
 * "Debe $160.000" en una reserva con la habitación paga hace que recepción
 * revise el cobro del alojamiento buscando un error que no está. "Extras
 * $160.000" manda directo a la cuenta de consumos.
 */
export const paymentStateLabel = (account: BookingAccount): string => {
    const pesos = `$${Math.round(account.balance).toLocaleString('es-AR')}`;

    switch (paymentState(account)) {
        case 'paid':
            return 'Pagado';
        case 'extras':
            return `Extras ${pesos}`;
        case 'partial':
            return `Debe ${pesos}`;
        case 'unpaid':
            return 'Sin pagar';
    }
};

interface BuildAccountsByBookingParams {
    bookings: Pick<Booking, 'id' | 'totalAmount'>[];
    payments: (SettleablePayment & { bookingId?: string })[];
    charges?: (Pick<BookingCharge, 'amount' | 'quantity'> & { bookingId: string })[];
}

/**
 * El estado de cuenta de muchas reservas de una, para las pantallas de lista.
 *
 * Existe porque el tablero, la tabla y las tarjetas de mobile armaban cada una
 * su propio mapa de "cuánto pagó cada reserva" y comparaban contra
 * booking.totalAmount. Tres copias de la misma cuenta incompleta: ninguna
 * miraba los cargos, así que una reserva con la habitación paga y $160.000 de
 * consumos salía "Pagado" en las tres.
 *
 * Agrupa una sola vez en vez de filtrar los pagos por reserva adentro del
 * render, que en una lista larga es recorrer todos los pagos por cada fila.
 */
export const buildAccountsByBooking = ({
    bookings,
    payments,
    charges = [],
}: BuildAccountsByBookingParams): Map<string, BookingAccount> => {
    const paymentsByBooking = new Map<string, SettleablePayment[]>();
    for (const payment of payments) {
        if (!payment.bookingId) continue;
        const list = paymentsByBooking.get(payment.bookingId);
        if (list) list.push(payment);
        else paymentsByBooking.set(payment.bookingId, [payment]);
    }

    const chargesByBooking = new Map<string, Pick<BookingCharge, 'amount' | 'quantity'>[]>();
    for (const charge of charges) {
        const list = chargesByBooking.get(charge.bookingId);
        if (list) list.push(charge);
        else chargesByBooking.set(charge.bookingId, [charge]);
    }

    return new Map(
        bookings.map(booking => [
            booking.id,
            buildBookingAccount({
                booking,
                payments: paymentsByBooking.get(booking.id) || [],
                charges: chargesByBooking.get(booking.id) || [],
            }),
        ])
    );
};

export interface OutstandingTotals {
    /** Lo que falta cobrar de estadías ya devengadas: alojados o ya salidos */
    outstanding: number;
    /** Cuántas reservas componen ese saldo */
    outstandingCount: number;
    /** Cuánto de ese saldo quedó en huéspedes que ya se fueron */
    departedDebt: number;
    /** Saldo de reservas que todavía no empezaron. Expectativa, no deuda. */
    upcoming: number;
}

interface BuildOutstandingParams {
    bookings: (Pick<Booking, 'id' | 'totalAmount'> & { status: Booking['status'] | string })[];
    payments: (SettleablePayment & { bookingId?: string })[];
    charges?: (Pick<BookingCharge, 'amount' | 'quantity'> & { bookingId: string })[];
}

/**
 * Cuánta plata falta cobrar, mirando las reservas y no los pagos.
 *
 * Las pantallas que mostraban esto sumaban los pagos en estado PENDING, que no
 * es lo que se debe sino lo que alguien cargó sin marcar como cobrado. Como
 * recepción registra el pago recién cuando cobra, casi nunca hay ninguno: el
 * número daba $0 con huéspedes debiendo la estadía y los consumos.
 *
 * Lo devengado va separado de lo futuro a propósito. Una reserva de diciembre
 * sin seña debe su total entero; sumada acá, el número lo terminan dominando
 * reservas que ni empezaron. Deuda es la del que está en la habitación o ya se
 * fue.
 *
 * Un pago en PENDING no achica el saldo —la cuenta solo suma los PAID—, así que
 * ya está adentro de estos totales sin contarse dos veces.
 */
export const buildOutstandingTotals = ({
    bookings,
    payments,
    charges = [],
}: BuildOutstandingParams): OutstandingTotals => {
    const accounts = buildAccountsByBooking({ bookings, payments, charges });
    const totals: OutstandingTotals = {
        outstanding: 0,
        outstandingCount: 0,
        departedDebt: 0,
        upcoming: 0,
    };

    for (const booking of bookings) {
        if (booking.status === 'CANCELLED' || booking.status === 'NO_SHOW') continue;

        const balance = accounts.get(booking.id)?.balance ?? 0;
        if (balance <= 0) continue;

        if (booking.status === 'CHECKED_IN' || booking.status === 'CHECKED_OUT') {
            totals.outstanding += balance;
            totals.outstandingCount += 1;
            if (booking.status === 'CHECKED_OUT') totals.departedDebt += balance;
        } else {
            totals.upcoming += balance;
        }
    }

    return totals;
};
