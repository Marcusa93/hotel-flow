import { Rate, Booking, Payment } from '@/types/hotel';

export interface PromoUsage {
  /** id de la tarifa, o null si la promoción ya no existe y solo queda su nombre */
  rateId: string | null;
  label: string;
  promoCode?: string;
  /** La tarifa fue borrada: el uso quedó registrado igual */
  isOrphan: boolean;
  bookingCount: number;
  /** Facturación de las reservas que usaron la promo (lo efectivamente cobrado) */
  bookingRevenue: number;
  bookingDiscount: number;
  paymentCount: number;
  paymentDiscount: number;
  /** Reservas + cobros: cuántas veces se usó en total */
  useCount: number;
  totalDiscount: number;
  /** Promedio por reserva. 0 si la promo solo se usó en cobros. */
  avgBookingValue: number;
}

/**
 * Agrupa por tarifa cuando el vínculo sigue vivo, y por nombre cuando no.
 *
 * Borrar una promoción pone rate_id en NULL (ON DELETE SET NULL) pero deja
 * promo_label: el uso ocurrió y la plata se resignó igual, así que tiene que
 * seguir apareciendo en el reporte en vez de evaporarse.
 */
const groupKey = (rateId?: string, label?: string): string | null => {
  if (rateId) return rateId;
  if (label) return `label:${label}`;
  return null;
};

/**
 * Uso y costo de cada promoción.
 *
 * Reservas y cobros se cuentan por separado a propósito: los pagos pertenecen a
 * reservas, así que sumar ambas facturaciones contaría la misma plata dos veces.
 * Del lado del cobro solo se acumula el descuento, que sí es plata resignada
 * aparte.
 *
 * Los arrays llegan ya filtrados por período — así el rango se decide afuera y
 * esta función no necesita saber de fechas.
 */
export const buildPromoUsage = (
  rates: Rate[],
  bookings: Booking[],
  payments: Payment[]
): PromoUsage[] => {
  const byKey = new Map<string, PromoUsage>();

  const ensure = (key: string, rateId: string | null, label: string, promoCode?: string): PromoUsage => {
    const existing = byKey.get(key);
    if (existing) return existing;

    const entry: PromoUsage = {
      rateId,
      label,
      promoCode,
      isOrphan: rateId === null,
      bookingCount: 0,
      bookingRevenue: 0,
      bookingDiscount: 0,
      paymentCount: 0,
      paymentDiscount: 0,
      useCount: 0,
      totalDiscount: 0,
      avgBookingValue: 0,
    };
    byKey.set(key, entry);
    return entry;
  };

  // Las promociones vigentes arrancan en cero para que se vean también las que
  // todavía no usó nadie — un 0 usos es justamente lo que hay que saber.
  for (const rate of rates) {
    ensure(rate.id, rate.id, rate.label, rate.promoCode);
  }

  for (const booking of bookings) {
    const key = groupKey(booking.rateId, booking.promoLabel);
    if (!key) continue;

    const entry = ensure(key, booking.rateId ?? null, booking.promoLabel || 'Promoción sin nombre', booking.promoCode);
    entry.bookingCount++;
    entry.bookingRevenue += booking.totalAmount || 0;
    entry.bookingDiscount += booking.discountAmount || 0;
  }

  for (const payment of payments) {
    const key = groupKey(payment.rateId, payment.promoLabel);
    if (!key) continue;

    const entry = ensure(key, payment.rateId ?? null, payment.promoLabel || 'Promoción sin nombre', payment.promoCode);
    entry.paymentCount++;
    entry.paymentDiscount += payment.discountAmount || 0;
  }

  const usage = [...byKey.values()];
  for (const entry of usage) {
    entry.useCount = entry.bookingCount + entry.paymentCount;
    entry.totalDiscount = entry.bookingDiscount + entry.paymentDiscount;
    entry.avgBookingValue = entry.bookingCount > 0 ? entry.bookingRevenue / entry.bookingCount : 0;
  }

  // Más usadas primero; a igual uso, la que más descuento otorgó.
  return usage.sort((a, b) => b.useCount - a.useCount || b.totalDiscount - a.totalDiscount);
};

/** Totales de la cabecera del panel. */
export const summarizePromoUsage = (usage: PromoUsage[]) => ({
  activePromos: usage.filter(u => u.useCount > 0).length,
  totalUses: usage.reduce((sum, u) => sum + u.useCount, 0),
  totalDiscount: usage.reduce((sum, u) => sum + u.totalDiscount, 0),
  totalRevenue: usage.reduce((sum, u) => sum + u.bookingRevenue, 0),
});
