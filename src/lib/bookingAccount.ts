import { Booking, Payment, BookingCharge } from '@/types/hotel';

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

/**
 * Cuánto quedó saldado de una lista de pagos: lo cobrado más lo descontado.
 *
 * Para las pantallas que solo necesitan saber si una reserva está al día y no
 * arman el estado de cuenta completo. Sumar únicamente los montos deja el
 * descuento como deuda — el bug que aparecía en el badge "Sin pagar" del
 * tablero y en las alertas automáticas.
 */
export const settledAmount = (payments: SettleablePayment[]): number =>
    payments
        .filter(p => p.status === 'PAID')
        .reduce((sum, p) => sum + p.amount + (p.discountAmount || 0), 0);

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
