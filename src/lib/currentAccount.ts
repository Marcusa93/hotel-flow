import type { Booking, CurrentAccountPayment, Payment } from '@/types/hotel';
import { CURRENT_ACCOUNT_METHOD } from '@/lib/constants';

/**
 * La cuenta corriente de un huésped frecuente.
 *
 * No tiene tabla de saldos: se arma con los movimientos. Un cargo es un cobro de
 * reserva hecho con método "Cuenta corriente" —la reserva queda saldada y la
 * deuda pasa al huésped—, y un pago es lo que después trae para bajarla.
 *
 * El saldo se deriva y no se guarda: un total materializado se desincroniza en
 * cuanto alguien corrige un cobro viejo, y encontrar cuál de los dos números es
 * el bueno cuesta más que sumarlos cada vez.
 */

export interface CurrentAccountCharge {
  bookingId: string;
  paymentId: string;
  date: Date;
  amount: number;
}

export interface CurrentAccountSummary {
  /** Lo que se cargó a la cuenta */
  charged: number;
  /** Lo que el huésped pagó de la cuenta */
  settled: number;
  /** Lo que debe hoy. Nunca menor a cero: pagar de más no genera crédito. */
  balance: number;
  charges: CurrentAccountCharge[];
  payments: CurrentAccountPayment[];
}

/**
 * Si este cobro carga a la cuenta corriente en vez de entrar a la caja.
 *
 * Toma `{ method: string }` y no `Pick<Payment,'method'>` para que también la
 * puedan llamar las listas que trabajan con el método suelto —el detalle del
 * cierre, sin ir más lejos—. El criterio tiene que vivir en un solo lugar: es
 * el que decide si un movimiento es plata o es deuda.
 */
export const isCurrentAccountPayment = (payment: { method: string }): boolean =>
  payment.method === CURRENT_ACCOUNT_METHOD;

export function buildCurrentAccount({
  guestId,
  bookings = [],
  payments = [],
  accountPayments = [],
}: {
  guestId: string;
  bookings?: Pick<Booking, 'id' | 'guestId'>[];
  payments?: Payment[];
  accountPayments?: CurrentAccountPayment[];
}): CurrentAccountSummary {
  const guestBookingIds = new Set(
    bookings.filter(b => b.guestId === guestId).map(b => b.id)
  );

  const charges: CurrentAccountCharge[] = payments
    .filter(p => isCurrentAccountPayment(p) && guestBookingIds.has(p.bookingId))
    .map(p => ({
      bookingId: p.bookingId,
      paymentId: p.id,
      date: new Date(p.date),
      amount: p.amount,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const mine = accountPayments
    .filter(p => p.guestId === guestId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const charged = charges.reduce((sum, c) => sum + c.amount, 0);
  const settled = mine.reduce((sum, p) => sum + p.amount, 0);

  return {
    charged,
    settled,
    // Se corta en cero: esta cuenta corriente solo sirve para deber. Un pago de
    // más es un error de carga, no plata a favor, y mostrarlo en negativo
    // invitaría a descontarlo de la próxima estadía.
    balance: Math.max(0, charged - settled),
    charges,
    payments: mine,
  };
}
