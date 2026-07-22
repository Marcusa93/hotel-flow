import { describe, it, expect } from 'vitest';
import { getPromoNightlyPrice, getBestPromo } from '@/lib/promoPricing';
import { Rate } from '@/types/hotel';

const makeRate = (overrides: Partial<Rate>): Rate => ({
  id: 'r1',
  roomTypeId: '',
  startDate: new Date('2026-08-01'),
  endDate: new Date('2026-08-31'),
  price: 0,
  label: 'Promo',
  isActive: true,
  ...overrides,
});

const BASE = 100_000;

describe('getPromoNightlyPrice', () => {
  it('applies a percentage discount off the base price', () => {
    const promo = makeRate({ discountType: 'PERCENTAGE', discountPercent: 20 });
    expect(getPromoNightlyPrice(promo, BASE)).toBe(80_000);
  });

  it('applies a fixed discount off the base price', () => {
    const promo = makeRate({ discountType: 'FIXED', discountAmount: 15_000 });
    expect(getPromoNightlyPrice(promo, BASE)).toBe(85_000);
  });

  it('never charges below zero with an oversized fixed discount', () => {
    const promo = makeRate({ discountType: 'FIXED', discountAmount: 250_000 });
    expect(getPromoNightlyPrice(promo, BASE)).toBe(0);
  });

  it('uses the flat promo price when no discount is set', () => {
    const promo = makeRate({ price: 70_000 });
    expect(getPromoNightlyPrice(promo, BASE)).toBe(70_000);
  });

  it('prefers the flat promo price over the discount when both are set', () => {
    // The Tarifas table shows the promo price as the headline number, so the
    // booking must charge that and not 10% off the base.
    const promo = makeRate({ price: 80_000, discountType: 'PERCENTAGE', discountPercent: 10 });
    expect(getPromoNightlyPrice(promo, BASE)).toBe(80_000);
  });

  it('ignores a promo price above the base price', () => {
    const promo = makeRate({ price: 150_000 });
    expect(getPromoNightlyPrice(promo, BASE)).toBe(BASE);
  });

  it('falls back to the base price when the promo has no pricing at all', () => {
    expect(getPromoNightlyPrice(makeRate({}), BASE)).toBe(BASE);
  });
});

describe('getBestPromo', () => {
  it('returns null with no promotions', () => {
    expect(getBestPromo([], BASE)).toBeNull();
  });

  it('picks the discount promo over a weaker flat-price one', () => {
    // Both are stored with price 0 vs 90.000; comparing the raw price column
    // would crown the 5% promo just because its price field is 0.
    const weak = makeRate({ id: 'weak', discountType: 'PERCENTAGE', discountPercent: 5 });
    const strong = makeRate({ id: 'strong', price: 60_000 });
    expect(getBestPromo([weak, strong], BASE)?.id).toBe('strong');
  });

  it('picks the deepest discount among discount-only promos', () => {
    const small = makeRate({ id: 'small', discountType: 'PERCENTAGE', discountPercent: 10 });
    const big = makeRate({ id: 'big', discountType: 'PERCENTAGE', discountPercent: 35 });
    const fixed = makeRate({ id: 'fixed', discountType: 'FIXED', discountAmount: 20_000 });
    expect(getBestPromo([small, big, fixed], BASE)?.id).toBe('big');
  });

  it('keeps the first promo when two are equally cheap', () => {
    const a = makeRate({ id: 'a', discountType: 'PERCENTAGE', discountPercent: 20 });
    const b = makeRate({ id: 'b', price: 80_000 });
    expect(getBestPromo([a, b], BASE)?.id).toBe('a');
  });
});
