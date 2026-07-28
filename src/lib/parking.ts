import { addDays, startOfDay } from 'date-fns';
import type { Booking } from '@/types/hotel';

/**
 * Si queda cochera para una estadía.
 *
 * El contador del resumen del día responde "cuántos autos hay ahora". Al tomar
 * una reserva la pregunta es otra: si hay lugar todas las noches que se va a
 * quedar. Una sola noche sin lugar ya es un problema, aunque el resto sobre.
 *
 * La noche de salida no cuenta: el auto se va a la mañana y esa noche el lugar
 * queda para otro, igual que la habitación.
 */

/** Reservas que ocupan cochera. Las canceladas y las que ya salieron, no. */
const OCCUPIES_PARKING = (b: Pick<Booking, 'status' | 'hasVehicle'>): boolean =>
  b.hasVehicle === true &&
  b.status !== 'CANCELLED' &&
  b.status !== 'NO_SHOW' &&
  b.status !== 'CHECKED_OUT';

export interface ParkingAvailability {
  spots: number;
  /** Autos ya comprometidos en la noche más cargada de la estadía */
  peakCars: number;
  /** La noche más cargada. Sirve para nombrarla en el aviso. */
  peakNight: Date;
  /** Cuántas noches de la estadía se quedan sin lugar */
  fullNights: number;
  /** true cuando en alguna noche no entra un auto más */
  isFull: boolean;
}

export function getParkingAvailability({
  bookings,
  spots,
  from,
  to,
  excludeBookingId,
}: {
  bookings: Booking[];
  /** Cocheras del hotel. 0 significa que no se llevan cocheras. */
  spots: number;
  from?: Date | null;
  to?: Date | null;
  excludeBookingId?: string;
}): ParkingAvailability | null {
  // Sin cupo configurado no hay nada que controlar: el hotel no lleva cocheras.
  if (!spots || spots <= 0 || !from || !to) return null;

  const first = startOfDay(from);
  const last = startOfDay(to);
  if (last <= first) return null;

  const relevant = bookings.filter(
    b => OCCUPIES_PARKING(b) && b.id !== excludeBookingId
  );

  let peakCars = 0;
  let peakNight = first;
  let fullNights = 0;

  // Noche por noche: la de salida queda afuera.
  for (let night = first; night < last; night = addDays(night, 1)) {
    const cars = relevant.filter(b => {
      const checkIn = startOfDay(new Date(b.checkInDate));
      const checkOut = startOfDay(new Date(b.checkOutDate));
      return checkIn <= night && night < checkOut;
    }).length;

    if (cars > peakCars) {
      peakCars = cars;
      peakNight = night;
    }
    if (cars >= spots) fullNights++;
  }

  return {
    spots,
    peakCars,
    peakNight,
    fullNights,
    isFull: fullNights > 0,
  };
}
