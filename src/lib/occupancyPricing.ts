import type { RoomType } from '@/types/hotel';

/**
 * El precio lo define cuánta gente entra, no la capacidad de la habitación.
 *
 * Este hotel cobra por cantidad de personas: los tipos de habitación son tramos
 * de capacidad —Tarifas los muestra como "Hab. N personas"— y cada uno tiene su
 * precio base. Faltaba que el precio siguiera a la gente: cuatro personas en una
 * quíntuple pagaban quíntuple. Ahora pagan el tramo de cuatro, estén donde estén.
 */

/** Cuántas personas se cobran. Los menores de 5 ocupan lugar pero quedan afuera. */
export const billableGuests = (occupancy: {
  adults: number | string;
  children: number | string;
}): number => (Number(occupancy.adults) || 0) + (Number(occupancy.children) || 0);

/** Cuántos cuerpos entran a la habitación, para contrastar contra la capacidad. */
export const totalOccupants = (occupancy: {
  adults: number | string;
  children: number | string;
  infants?: number | string;
}): number => billableGuests(occupancy) + (Number(occupancy.infants) || 0);

export interface OccupancyPricing {
  /** El tipo cuyo precio se cobra: puede no ser el de la habitación */
  pricingType: RoomType;
  /** Precio por noche antes de promociones */
  nightlyPrice: number;
  /** Personas que se cobran (sin los menores de 5) */
  billable: number;
  /** true cuando se cobra un tramo más barato que el de la habitación */
  isDownTiered: boolean;
}

/**
 * Qué tramo se le cobra a esta ocupación en esta habitación.
 *
 * `roomType` es el tipo real de la habitación y marca el techo: nunca se cobra
 * más caro que la habitación que se está ocupando, ni siquiera cuando entran más
 * personas que su capacidad (recepción puede forzarlo con el tilde de "capacidad
 * excedida", y meter seis en una quíntuple no la convierte en séxtuple).
 *
 * Si dos tipos comparten capacidad, gana el más barato, salvo que uno de ellos
 * sea el de la habitación. Hoy no pasa —hay un tipo por tramo— pero el día que
 * se cargue una suite de 4 al lado de una cuádruple común, el huésped de la
 * suite tiene que seguir pagando la suite.
 */
export function getOccupancyPricing(
  roomTypes: RoomType[],
  roomType: RoomType | undefined | null,
  occupancy: { adults: number | string; children: number | string }
): OccupancyPricing | null {
  if (!roomType) return null;

  const billable = billableGuests(occupancy);
  const stay = { pricingType: roomType, nightlyPrice: roomType.basePrice, billable, isDownTiered: false };

  // Sin gente cargada todavía no hay nada que decidir: vale la habitación.
  if (billable <= 0 || billable >= roomType.maxGuests) return stay;

  const cheaperTiers = roomTypes.filter(
    rt => rt.maxGuests >= billable && rt.maxGuests < roomType.maxGuests
  );
  if (cheaperTiers.length === 0) return stay;

  const tier = cheaperTiers.reduce((best, current) => {
    if (current.maxGuests !== best.maxGuests) return current.maxGuests < best.maxGuests ? current : best;
    return current.basePrice < best.basePrice ? current : best;
  });

  // Un tramo menor más caro que la habitación es un precio mal cargado, no una
  // oferta: antes que cobrarlo de más se deja el de la habitación.
  if (tier.basePrice >= roomType.basePrice) return stay;

  return { pricingType: tier, nightlyPrice: tier.basePrice, billable, isDownTiered: true };
}

/**
 * Qué proporción del precio traía descontada la reserva.
 *
 * Al recalcular por ocupación se rearma el total desde cero, y sin esto el
 * huésped que reservó con promoción la perdía justo al entrar: entran menos
 * personas, baja el tramo, pero se le cae el descuento y termina pagando más.
 * Se guarda la proporción y no el monto porque el monto era contra el total
 * viejo, que es el que está cambiando.
 */
export const bookingDiscountRatio = (booking: {
  baseAmount?: number;
  discountAmount?: number;
}): number => {
  const { baseAmount, discountAmount } = booking;
  if (!baseAmount || !discountAmount || baseAmount <= 0 || discountAmount <= 0) return 0;
  return Math.min(1, discountAmount / baseAmount);
};
