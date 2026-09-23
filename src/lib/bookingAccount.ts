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

/**
 * Un cargo, con lo mínimo para saber cuánto suma y de qué lado de la cuenta cae.
 *
 * La categoría importa: las noches que agrega "Extender estadía" entran como
 * cargo igual que una gaseosa, y sin mirarla las dos terminaban del lado de los
 * consumos. Una noche de hotel no es un consumo —la promoción del huésped tiene
 * que alcanzarla— y para el mostrador tampoco: "la habitación está paga, faltan
 * los extras" es falso cuando lo que falta es una noche.
 */
type CountableCharge = Pick<BookingCharge, 'amount' | 'quantity'> & {
    category?: BookingCharge['category'] | string;
};

/** Si este cargo es alojamiento y no un consumo. */
const isLodgingCharge = (charge: CountableCharge): boolean => charge.category === 'ALOJAMIENTO';

interface BuildAccountParams {
    booking: Pick<Booking, 'totalAmount'>;
    /** Pagos de ESTA reserva. El filtrado por estado lo hace esta función. */
    payments?: SettleablePayment[];
    charges?: CountableCharge[];
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

    const sumar = (list: CountableCharge[]) => list.reduce((sum, c) => sum + c.amount * c.quantity, 0);

    // El total no se mueve: lo que cambia es de qué lado cae cada cargo.
    const lodging = (booking.totalAmount || 0) + sumar(charges.filter(isLodgingCharge));
    const extras = sumar(charges.filter(c => !isLodgingCharge(c))) + pendingExtra;
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

/**
 * Sobre cuánto se calcula un descuento de promoción: el alojamiento entero.
 *
 * El descuento es de la estadía, no del cobro. Se calculaba sobre lo que se
 * estaba cobrando en ese momento, y el que había dejado seña salía perdiendo:
 * su seña ya se había cobrado a precio de lista, así que el 10% caía nada más
 * que sobre el saldo. Reserva de $110.000 con $50.000 de seña, cupón del 10%:
 * descontaba $6.000 en vez de $11.000 y el hotel cobraba $104.000. Peor todavía,
 * la cuenta cerraba en cero y la ficha decía "Pagado": nada avisaba que al
 * huésped le habían quedado $5.000 de descuento sin dar.
 *
 * Los consumos quedan afuera solos, porque la base es el alojamiento y no el
 * total: la promoción del hotel no regala el minibar. Las noches que agrega
 * "Extender estadía" sí entran, que para eso son alojamiento.
 */
export const discountableBase = (account: BookingAccount): number => account.lodging;

/**
 * Cuánto de ese descuento entra en este cobro.
 *
 * Dos topes, y los dos son plata. Lo ya descontado en cobros anteriores no se
 * vuelve a descontar: sin esto, el mismo cupón aplicado en la seña y otra vez
 * en el saldo descontaba dos veces. Y nunca más que lo que se está cobrando,
 * porque un pago en negativo no existe.
 *
 * Cuando el segundo tope recorta —el cupón apareció cuando ya estaba casi todo
 * cobrado— el descuento que sobra se pierde. Es a propósito: la alternativa es
 * que el hotel le quede debiendo plata al huésped, y eso se arregla en el
 * mostrador y no solo. Quien cobra lo ve, porque el diálogo lo dice.
 */
export const applicableDiscount = (
    account: BookingAccount,
    fullDiscount: number,
    amount: number
): number => {
    const pendiente = Math.max(0, fullDiscount - account.discount);
    return Math.min(pendiente, Math.max(0, amount));
};

interface BuildAccountsByBookingParams {
    bookings: Pick<Booking, 'id' | 'totalAmount'>[];
    payments: (SettleablePayment & { bookingId?: string })[];
    charges?: (CountableCharge & { bookingId: string })[];
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

    const chargesByBooking = new Map<string, CountableCharge[]>();
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
    charges?: (CountableCharge & { bookingId: string })[];
}

/** Una reserva devengada a la que le falta cobrarle. */
export interface OutstandingRow {
    bookingId: string;
    /** Lo que falta cobrar, con los consumos sumados y los descuentos restados */
    balance: number;
    /** El huésped ya se fue: esta deuda no se cobra sola, se persigue */
    departed: boolean;
}

/**
 * Qué reserva debe plata y cuánta. Devengado es alojado o ya salido.
 *
 * Es la regla de "quién debe", en un solo lugar: los totales de Finanzas la
 * usan para sumar y el cierre de caja para nombrar a cada deudor. Cuando cada
 * pantalla tenía la suya, el cierre imprimía un total que no coincidía con el
 * de Finanzas para la misma noche.
 */
const outstandingRowsFrom = (
    bookings: BuildOutstandingParams['bookings'],
    accounts: Map<string, BookingAccount>
): OutstandingRow[] => {
    const rows: OutstandingRow[] = [];

    for (const booking of bookings) {
        // CANCELLED y NO_SHOW quedan afuera solas: no son ni alojados ni salidos.
        if (booking.status !== 'CHECKED_IN' && booking.status !== 'CHECKED_OUT') continue;

        const balance = accounts.get(booking.id)?.balance ?? 0;
        if (balance <= 0) continue;

        rows.push({
            bookingId: booking.id,
            balance,
            departed: booking.status === 'CHECKED_OUT',
        });
    }

    return rows;
};

/**
 * Los deudores uno por uno, para las pantallas que los nombran.
 *
 * El cierre de caja necesita la lista y no solo el total: el recepcionista que
 * rinde el turno tiene que saber a quién ir a cobrarle. Sale del mismo cálculo
 * que `buildOutstandingTotals` para que las dos pantallas no puedan discrepar.
 */
export const buildOutstandingRows = ({
    bookings,
    payments,
    charges = [],
}: BuildOutstandingParams): OutstandingRow[] =>
    outstandingRowsFrom(bookings, buildAccountsByBooking({ bookings, payments, charges }));

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

    for (const row of outstandingRowsFrom(bookings, accounts)) {
        totals.outstanding += row.balance;
        totals.outstandingCount += 1;
        if (row.departed) totals.departedDebt += row.balance;
    }

    for (const booking of bookings) {
        if (booking.status === 'CANCELLED' || booking.status === 'NO_SHOW') continue;
        if (booking.status === 'CHECKED_IN' || booking.status === 'CHECKED_OUT') continue;

        const balance = accounts.get(booking.id)?.balance ?? 0;
        if (balance > 0) totals.upcoming += balance;
    }

    return totals;
};
