import type { Booking, BookingGroup } from '@/types/hotel';

/**
 * La reserva masiva: un contingente que toma varias habitaciones.
 *
 * Se distingue del alquiler del hotel completo en dos cosas. La primera es que
 * no cierra el hotel: las habitaciones que el grupo no toma se siguen vendiendo.
 * La segunda es el flujo — recepción arma la reserva sin precio, porque el
 * precio de un grupo se negocia, y administración lo cierra después.
 *
 * Cada habitación sigue siendo una reserva normal (ver la migración: el porqué
 * está ahí). Acá vive lo único que el grupo agrega y que no existía: el precio
 * del conjunto y cómo se reparte.
 */

/** Si al grupo todavía no le pusieron precio. */
export const isPendingPrice = (group: Pick<BookingGroup, 'totalAmount'>): boolean =>
  group.totalAmount == null;

/**
 * Cómo se reparte el monto del grupo entre sus habitaciones.
 *
 * En centavos enteros y con el sobrante distribuido de a uno: dividir $100.000
 * entre 3 y redondear cada parte da $99.999,99, y el grupo quedaría debiendo un
 * centavo para siempre. La suma de lo que devuelve es exactamente el total.
 *
 * En partes iguales y no proporcional a las noches porque el monto es lo
 * acordado por el paquete entero: el hotel negoció un número con el grupo, no
 * una tarifa por habitación que después se suma.
 */
export function splitGroupAmount(total: number, parts: number): number[] {
  if (parts <= 0) return [];

  const cents = Math.round(total * 100);
  const base = Math.floor(cents / parts);
  const extra = cents - base * parts;

  return Array.from({ length: parts }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
}

/** Las reservas de un grupo. */
export const bookingsOfGroup = (bookings: Booking[], groupId: string): Booking[] =>
  bookings.filter(b => b.groupId === groupId);

/**
 * Los grupos a los que les falta precio, del más viejo al más nuevo.
 *
 * Del más viejo primero a propósito: el que lleva más tiempo sin tarifar es el
 * que más cerca está de que el contingente se vaya sin que nadie le haya puesto
 * un monto. Es la lista que mira administración.
 */
export function groupsPendingPrice(groups: BookingGroup[]): BookingGroup[] {
  return groups
    .filter(isPendingPrice)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Si este grupo ya se está usando sin haberse tarifado.
 *
 * Un grupo sin precio al que ya le hicieron check-in es el caso urgente: la
 * gente está adentro, en cualquier momento se va, y el sistema dice que no debe
 * nada. Tarifarlo deja de ser una tarea pendiente y pasa a ser algo que hay que
 * hacer hoy.
 */
export function isPendingAndInHouse(
  group: Pick<BookingGroup, 'totalAmount'>,
  groupBookings: Pick<Booking, 'status'>[]
): boolean {
  return (
    isPendingPrice(group) &&
    groupBookings.some(b => b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT')
  );
}
