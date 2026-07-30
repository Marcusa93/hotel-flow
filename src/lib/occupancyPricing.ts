import type { Rate, RoomType } from '@/types/hotel';
import { getPromoNightlyPrice } from '@/lib/promoPricing';
import { guestsLabel } from '@/lib/utils';

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
  /** true cuando el tramo lo eligió recepción y no el cálculo por ocupación */
  isManual?: boolean;
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
 * El tramo que se cobra, con la última palabra en el mostrador.
 *
 * getOccupancyPricing decide por ocupación y acierta casi siempre. Cuando no
 * —el hotel le cobra igual la doble al que viene solo—, la reserva guarda el
 * tramo que eligió recepción y se cobra ese. Se respeta tal cual y no se
 * recalcula: si al editar o al hacer el check-in se volviera al automático, la
 * elección no serviría de nada.
 *
 * Un tramo elegido que ya no existe (se borró de Tarifas) vuelve al automático
 * en vez de dejar la reserva sin precio.
 */
export function getBookingPricing(
  roomTypes: RoomType[],
  roomType: RoomType | undefined | null,
  occupancy: { adults: number | string; children: number | string },
  chosenTypeId?: string | null
): OccupancyPricing | null {
  if (!roomType) return null;

  const chosen = chosenTypeId ? roomTypes.find(rt => rt.id === chosenTypeId) : undefined;
  if (!chosen) return getOccupancyPricing(roomTypes, roomType, occupancy);

  return {
    pricingType: chosen,
    nightlyPrice: chosen.basePrice,
    billable: billableGuests(occupancy),
    isDownTiered: chosen.maxGuests < roomType.maxGuests,
    isManual: true,
  };
}

/**
 * Los tramos que se le pueden elegir a esta habitación, de menor a mayor.
 *
 * Se corta en el tramo de la habitación por la misma razón que el cálculo
 * automático: meter seis en una quíntuple no la convierte en séxtuple, y
 * ofrecer un tramo más caro que la habitación sería justo el sobreprecio que el
 * resto del sistema evita. Para abajo se ofrece todo, incluso por debajo de la
 * gente que entra: quien cobra es el que está atendiendo.
 */
export function selectableTiers(
  roomTypes: RoomType[],
  roomType: RoomType | undefined | null
): RoomType[] {
  if (!roomType) return [];
  return roomTypes
    .filter(rt => rt.maxGuests <= roomType.maxGuests)
    .sort((a, b) => a.maxGuests - b.maxGuests || a.basePrice - b.basePrice);
}

/**
 * Por qué el precio no es el de la habitación, dicho para recepción.
 *
 * Cuando el tramo coincide con la gente que entra es una buena noticia —pagan
 * menos que la habitación— y se dice derecho. Cuando no hay tramo para esa
 * cantidad y se cobra el de arriba, la misma frase se leía como un recargo:
 * "entra 1, se cobra la tarifa de 2" llegó reportado como precio duplicado. No
 * lo es, es que abajo de ese tramo la lista no tiene nada, y hay que decirlo.
 */
export function describeDownTier(pricing: OccupancyPricing, roomMaxGuests: number): string {
  const entran = `Entra${pricing.billable === 1 ? '' : 'n'} ${pricing.billable} en una habitación de ${roomMaxGuests}`;
  const tarifa = guestsLabel(pricing.pricingType.maxGuests);

  if (pricing.billable === pricing.pricingType.maxGuests) {
    return `${entran}: se cobra la tarifa de ${tarifa}.`;
  }
  return `${entran}: no hay tarifa de ${pricing.billable}, se cobra la más cercana, la de ${tarifa}.`;
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

export interface CheckInTotalInput {
  /** El total con el que está cargada la reserva: lo que se pactó */
  agreedTotal: number;
  nights: number;
  /** Precio del tramo que corresponde a la ocupación que se confirma ahora */
  tierNightly: number;
  /** Precio del tramo que correspondía a la ocupación con la que se tomó la reserva */
  bookedTierNightly: number;
  /** La promoción de la reserva, si todavía se puede resolver por rateId */
  promo?: Rate | null;
  /** Proporción descontada. Solo se usa cuando la promoción ya no se resuelve. */
  discountRatio?: number;
}

/**
 * El total que queda al confirmar la ocupación real en el check-in.
 *
 * Dos reglas, y la segunda existe porque la primera sola se rompe:
 *
 * 1. Se respeta lo pactado y se lo corre por la diferencia entre tramos. Si se
 *    rearmara desde la tarifa de hoy, una reserva tomada hace dos meses cambiaría
 *    de precio sola porque la tarifa subió en el medio.
 *
 * 2. Techo en lo que la lista cobra hoy por el tramo que se confirma. Sin esto,
 *    una reserva vieja —cargada al precio de la habitación y no al del tramo—
 *    arrastra su sobreprecio: corregida hacia arriba terminaba cobrando MÁS que
 *    la habitación entera, justo el techo que getOccupancyPricing promete.
 *
 * Con promoción resoluble se la reaplica sobre el tramo nuevo en vez de escalar
 * por proporción: hay promos de precio plano y de monto fijo que no son
 * proporcionales al precio base, y escalarlas regalaba o cobraba de más.
 */
export function resolveCheckInTotal({
  agreedTotal,
  nights,
  tierNightly,
  bookedTierNightly,
  promo,
  discountRatio = 0,
}: CheckInTotalInput): number {
  if (nights <= 0) return agreedTotal;

  // La promoción sabe qué cobra sobre cualquier precio base; es más fiel que
  // arrastrar la proporción de un total que está cambiando.
  if (promo) return Math.round(getPromoNightlyPrice(promo, tierNightly) * nights);

  const agreedNightly = agreedTotal / nights;
  const movedNightly = agreedNightly + (tierNightly - bookedTierNightly) * (1 - discountRatio);
  const listNightly = tierNightly * (1 - discountRatio);

  return Math.round(Math.min(movedNightly, listNightly) * nights);
}

/**
 * La media estadía cobra la mitad. Del hotel: "tiene un costo del 50% de lo que
 * corresponde a cada habitación", y lo que corresponde es el tramo que sale por
 * la gente que entra, igual que en cualquier reserva.
 */
export const HALF_DAY_RATIO = 0.5;

/** Lo que sale una media estadía sobre el precio por noche del tramo. */
export function halfDayTotal(tierNightly: number): number {
  return Math.round(tierNightly * HALF_DAY_RATIO);
}

/**
 * El total de una estadía: noches x precio, o la mitad si es media estadía.
 *
 * La media estadía no tiene noches —entra y sale el mismo día— así que
 * multiplicar por `nights` daría cero. Va por acá y no por un `if` en cada
 * pantalla para que las cuatro que cotizan una reserva digan el mismo número.
 */
export function stayTotal(
  nightlyPrice: number,
  nights: number,
  isHalfDay = false
): number {
  if (isHalfDay) return halfDayTotal(nightlyPrice);
  if (nights <= 0) return 0;
  return Math.round(nightlyPrice * nights);
}

export interface EditedTotalInput {
  /** El total con el que está cargada la reserva: lo que se pactó. */
  agreedTotal: number;
  /** Las noches sobre las que se pactó ese total. */
  agreedNights: number;
  /** Las noches que quedan después de la edición. */
  nights: number;
  /** Precio del tramo que corresponde a la habitación y la ocupación nuevas */
  tierNightly: number;
  /** Precio del tramo con el que se tomó la reserva */
  bookedTierNightly: number;
  /** Precio por noche pactado a mano con el cliente. Cuando está, manda. */
  specialRateNightly?: number | null;
  /** Media estadía: sin noches y a mitad de tramo. Manda sobre todo lo demás. */
  isHalfDay?: boolean;
  /** La promoción de la reserva, si todavía se puede resolver por rateId */
  promo?: Rate | null;
  /** Proporción descontada. Solo se usa cuando la promoción ya no se resuelve. */
  discountRatio?: number;
}

/**
 * El total que queda al editar una reserva ya tomada.
 *
 * Editar recalculaba `noches × precio de tramo` y con eso le devolvía el precio
 * de lista al huésped que había reservado con promoción: abrir el diálogo de una
 * reserva de $144.000 con 10% off ya proponía $160.000 sin que nadie tocara
 * nada, y guardarlo le inventaba una deuda a alguien que había pagado todo.
 *
 * La regla es la misma que en el check-in —respetar lo pactado, correrlo por la
 * diferencia entre tramos y no pasarse de lo que la lista cobra hoy—, así que
 * resuelve el mismo resolveCheckInTotal. Lo que agrega la edición son dos cosas
 * que el check-in no tiene:
 *
 *   1. Las noches se pueden mover, y lo pactado era por las noches viejas. Se
 *      resuelve el precio de la noche y recién ahí se multiplica por las nuevas.
 *
 *   2. La tarifa especial es un precio por noche acordado con ese cliente: no
 *      sale de ningún tramo, así que cambiar de habitación no la mueve.
 */
export function resolveEditedTotal({
  agreedTotal,
  agreedNights,
  nights,
  tierNightly,
  bookedTierNightly,
  specialRateNightly,
  isHalfDay = false,
  promo,
  discountRatio = 0,
}: EditedTotalInput): number {
  // Va primero de todo: una media estadía no tiene noches, así que cualquier
  // cuenta que multiplique por `nights` da cero. Y no admite promoción ni tarifa
  // especial — el 50% ya es el descuento.
  if (isHalfDay) return halfDayTotal(tierNightly);

  if (nights <= 0) return 0;

  if (specialRateNightly != null) return Math.round(specialRateNightly * nights);

  // Reserva sin noches: no hay pactado por noche del que partir, así que lo
  // único honesto es la lista de hoy.
  if (agreedNights <= 0) return Math.round(tierNightly * nights);

  const resolvedNightly =
    resolveCheckInTotal({
      agreedTotal,
      nights: agreedNights,
      tierNightly,
      bookedTierNightly,
      promo,
      discountRatio,
    }) / agreedNights;

  return Math.round(resolvedNightly * nights);
}
