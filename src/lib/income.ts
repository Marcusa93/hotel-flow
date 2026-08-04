import type { CurrentAccountPayment, OtherIncome, Payment } from '@/types/hotel';
import { isCurrentAccountPayment } from '@/lib/currentAccount';

/**
 * Qué cuenta como plata que entró.
 *
 * Vive en un solo lugar porque el sistema lo venía respondiendo de dos maneras
 * distintas y el hotel veía dos números para el mismo día: el cierre de caja
 * decía uno y Finanzas otro. La diferencia era siempre la misma —los cobros con
 * método "Cuenta corriente"— y la pregunta "¿cuánto entró?" no puede tener dos
 * respuestas según la pantalla que mires.
 *
 * La distinción que no hay que perder:
 *
 *   ¿Cuánto entró a la caja?  → la cuenta corriente NO cuenta. La estadía se le
 *   anotó al huésped: no entró un peso. La plata entra después, cuando viene a
 *   pagar la cuenta, y ahí es un cobro de cuenta corriente.
 *
 *   ¿Cuánto se saldó de esta reserva?  → la cuenta corriente SÍ cuenta. La
 *   reserva quedó paga y la deuda cambió de dueño. Eso no se calcula acá: es
 *   bookingAccount.ts, y ahí los cobros a cuenta corriente tienen que seguir
 *   sumando. Confundir las dos preguntas deja al huésped debiendo dos veces.
 */

/** Si este cobro es plata que entró de verdad. */
export const isReceivedPayment = (payment: Payment): boolean =>
  payment.status === 'PAID' && !isCurrentAccountPayment(payment);

/**
 * Los cobros que son plata.
 *
 * Lo que se descarta son las dos cosas que no entraron a la caja: lo que todavía
 * no se cobró, y lo que se le anotó al huésped en la cuenta.
 */
export const receivedPayments = (payments: Payment[]): Payment[] =>
  payments.filter(isReceivedPayment);

export interface IncomeSources {
  payments?: Payment[];
  otherIncome?: OtherIncome[];
  accountPayments?: CurrentAccountPayment[];
}

/**
 * Toda la plata que entró, de las tres fuentes que existen.
 *
 * Son tres y no una: los cobros de reservas, los ingresos que no salen de
 * ninguna reserva (alquiler del salón y demás) y lo que los huéspedes traen para
 * bajar su cuenta corriente. Mirar solo la primera —como hacían Finanzas y el
 * tablero— deja afuera plata que sí entró al cajón, y encima suma la cuenta
 * corriente, que no entró. Los dos errores a la vez, en direcciones opuestas.
 */
export function totalIncome({
  payments = [],
  otherIncome = [],
  accountPayments = [],
}: IncomeSources): number {
  const sum = (rows: { amount: number }[]) => rows.reduce((acc, r) => acc + r.amount, 0);
  return sum(receivedPayments(payments)) + sum(otherIncome) + sum(accountPayments);
}

/**
 * Lo anotado a cuentas corrientes. No es plata: es deuda que cambió de dueño.
 *
 * Se muestra aparte para que el total no dé distinto que la suma de las filas
 * del desglose y nadie tenga que adivinar dónde se fue la diferencia.
 */
export function chargedToAccounts(payments: Payment[]): number {
  return payments
    .filter(p => p.status === 'PAID' && isCurrentAccountPayment(p))
    .reduce((sum, p) => sum + p.amount, 0);
}
