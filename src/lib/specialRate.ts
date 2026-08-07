import type { Booking } from '@/types/hotel';

/**
 * La tarifa especial: el precio que el hotel le hace a quien quiere.
 *
 * Los dueños que se alojan y no pagan, el amigo al que se le hace un precio, el
 * cliente de siempre. No sale de ningún tramo ni categoría: es un número
 * acordado, y puede ser cero.
 *
 * El precio lo pone administración, pero la MARCA la pone recepción. Si llega un
 * amigo del dueño un domingo a la noche, el mostrador no puede quedar trabado
 * esperando: marca la reserva, queda "a tarifar", y el monto llega después. Es el
 * mismo circuito de la reserva masiva (ver bookingGroup.ts).
 */

/** Si ya tiene el precio puesto. Cero cuenta: es un precio decidido. */
export const hasSpecialRate = (booking: Pick<Booking, 'specialRateAmount'>): boolean =>
  booking.specialRateAmount != null;

/**
 * Si está marcada y todavía nadie le puso precio.
 *
 * El pendiente no es "monto en cero": cero es un precio válido y hay que poder
 * distinguir "ya se decidió que no paga" de "todavía nadie decidió cuánto". Por
 * eso el estado vive en su propia marca y no en el monto.
 */
export const isSpecialRatePending = (
  booking: Pick<Booking, 'specialRatePending' | 'specialRateAmount'>
): boolean => !!booking.specialRatePending && booking.specialRateAmount == null;

/**
 * Las reservas esperando precio, de la entrada más próxima a la más lejana.
 *
 * Por fecha de entrada y no por cuándo se cargaron: la que entra mañana es la
 * que hay que tarifar hoy. Las canceladas quedan afuera — no hay nada que
 * cobrarle a alguien que no viene.
 */
export function bookingsPendingRate(bookings: Booking[]): Booking[] {
  return bookings
    .filter(b => isSpecialRatePending(b) && b.status !== 'CANCELLED' && b.status !== 'NO_SHOW')
    .sort((a, b) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime());
}

/**
 * Si el huésped ya está adentro y la reserva sigue sin precio.
 *
 * Es el caso urgente, igual que en la reserva masiva: está alojado, en cualquier
 * momento se va, y el sistema dice que no debe nada. Tarifarla deja de ser una
 * tarea pendiente y pasa a ser algo de hoy.
 */
export const isPendingAndInHouse = (booking: Booking): boolean =>
  isSpecialRatePending(booking) &&
  (booking.status === 'CHECKED_IN' || booking.status === 'CHECKED_OUT');
