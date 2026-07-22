import { Rate } from '@/types/hotel';

/**
 * Nightly price a promotion produces for a given base price.
 *
 * A flat promo price wins when it's set: it's the number the manager typed and
 * the one the Tarifas table shows as the headline price, so charging a
 * percentage off the base instead would contradict the panel. The discount
 * fields are an alternative way of expressing the same offer, not a surcharge
 * on top of the promo price.
 *
 * A price above the base is left alone — that's a seasonal peak rate, not an
 * offer, and a booking dialog should never silently raise the nightly price.
 */
export const getPromoNightlyPrice = (promo: Rate, basePrice: number): number => {
  if (promo.price > 0 && promo.price < basePrice) return promo.price;

  if (promo.discountType === 'FIXED' && promo.discountAmount) {
    return Math.max(0, basePrice - promo.discountAmount);
  }

  if (promo.discountPercent) {
    return basePrice * (1 - promo.discountPercent / 100);
  }

  return basePrice;
};

/**
 * Cheapest promotion for the guest.
 *
 * Compares what each promo actually charges, not the raw `price` column:
 * discount-only promos are stored with price 0, so comparing the column alone
 * makes every one of them look like the best possible deal.
 */
export const getBestPromo = (promos: Rate[], basePrice: number): Rate | null => {
  if (promos.length === 0) return null;

  return promos.reduce((best, current) =>
    getPromoNightlyPrice(current, basePrice) < getPromoNightlyPrice(best, basePrice)
      ? current
      : best
  );
};
