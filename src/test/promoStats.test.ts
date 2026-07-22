import { describe, it, expect } from 'vitest';
import { buildPromoUsage, summarizePromoUsage } from '@/lib/promoStats';
import { Rate, Booking, Payment } from '@/types/hotel';

const rate = (overrides: Partial<Rate>): Rate => ({
  id: 'rate-1',
  roomTypeId: '',
  startDate: new Date('2026-08-01'),
  endDate: new Date('2026-08-31'),
  price: 0,
  label: 'Oferta Fin de Semana',
  isActive: true,
  ...overrides,
});

const booking = (overrides: Partial<Booking>): Booking => ({
  id: 'b1',
  guestId: 'g1',
  roomId: 'r1',
  checkInDate: new Date('2026-08-10'),
  checkOutDate: new Date('2026-08-12'),
  adults: 2,
  children: 0,
  status: 'CONFIRMED',
  totalAmount: 160_000,
  createdAt: new Date('2026-08-01'),
  ...overrides,
});

const payment = (overrides: Partial<Payment>): Payment => ({
  id: 'p1',
  bookingId: 'b1',
  date: new Date('2026-08-10'),
  method: 'CASH',
  status: 'PAID',
  amount: 50_000,
  ...overrides,
});

describe('buildPromoUsage', () => {
  it('muestra las promociones sin uso, que es justamente el dato', () => {
    const usage = buildPromoUsage([rate({})], [], []);
    expect(usage).toHaveLength(1);
    expect(usage[0].useCount).toBe(0);
    expect(usage[0].totalDiscount).toBe(0);
  });

  it('acumula reservas: usos, facturación y descuento', () => {
    const usage = buildPromoUsage(
      [rate({})],
      [
        booking({ id: 'b1', rateId: 'rate-1', totalAmount: 160_000, discountAmount: 40_000 }),
        booking({ id: 'b2', rateId: 'rate-1', totalAmount: 240_000, discountAmount: 60_000 }),
      ],
      []
    );

    expect(usage[0].bookingCount).toBe(2);
    expect(usage[0].bookingRevenue).toBe(400_000);
    expect(usage[0].bookingDiscount).toBe(100_000);
    expect(usage[0].avgBookingValue).toBe(200_000);
  });

  it('no suma la facturación de los cobros: son plata de las mismas reservas', () => {
    const usage = buildPromoUsage(
      [rate({})],
      [booking({ rateId: 'rate-1', totalAmount: 160_000, discountAmount: 40_000 })],
      [payment({ rateId: 'rate-1', amount: 100_000, discountAmount: 10_000 })]
    );

    // La facturación sale solo de la reserva; del cobro se toma el descuento.
    expect(usage[0].bookingRevenue).toBe(160_000);
    expect(usage[0].totalDiscount).toBe(50_000);
    expect(usage[0].useCount).toBe(2);
  });

  it('mantiene en el reporte los usos de una promoción borrada', () => {
    // Borrar la tarifa pone rate_id en NULL pero deja promo_label: el descuento
    // se otorgó igual y no puede desaparecer del reporte.
    const usage = buildPromoUsage(
      [],
      [booking({ rateId: undefined, promoLabel: 'Verano 2026', discountAmount: 30_000 })],
      []
    );

    expect(usage).toHaveLength(1);
    expect(usage[0].label).toBe('Verano 2026');
    expect(usage[0].isOrphan).toBe(true);
    expect(usage[0].totalDiscount).toBe(30_000);
  });

  it('agrupa por nombre los usos huérfanos de la misma promoción', () => {
    const usage = buildPromoUsage(
      [],
      [
        booking({ id: 'b1', promoLabel: 'Verano 2026', discountAmount: 30_000 }),
        booking({ id: 'b2', promoLabel: 'Verano 2026', discountAmount: 20_000 }),
      ],
      []
    );

    expect(usage).toHaveLength(1);
    expect(usage[0].bookingCount).toBe(2);
    expect(usage[0].totalDiscount).toBe(50_000);
  });

  it('ignora reservas y cobros sin promoción', () => {
    const usage = buildPromoUsage([], [booking({})], [payment({})]);
    expect(usage).toHaveLength(0);
  });

  it('tolera reservas viejas sin monto de descuento registrado', () => {
    // Anteriores al seguimiento: se cuenta el uso, el descuento queda en 0.
    const usage = buildPromoUsage(
      [rate({})],
      [booking({ rateId: 'rate-1', totalAmount: 160_000, discountAmount: undefined })],
      []
    );

    expect(usage[0].bookingCount).toBe(1);
    expect(usage[0].totalDiscount).toBe(0);
  });

  it('ordena por uso, y a igual uso por descuento otorgado', () => {
    const usage = buildPromoUsage(
      [rate({ id: 'poco', label: 'Poco' }), rate({ id: 'mucho', label: 'Mucho' }), rate({ id: 'igual', label: 'Igual' })],
      [
        booking({ id: 'b1', rateId: 'mucho' }),
        booking({ id: 'b2', rateId: 'mucho' }),
        booking({ id: 'b3', rateId: 'poco', discountAmount: 5_000 }),
        booking({ id: 'b4', rateId: 'igual', discountAmount: 90_000 }),
      ],
      []
    );

    expect(usage.map(u => u.label)).toEqual(['Mucho', 'Igual', 'Poco']);
  });
});

describe('summarizePromoUsage', () => {
  it('cuenta solo las promociones que se usaron al menos una vez', () => {
    const usage = buildPromoUsage(
      [rate({ id: 'usada' }), rate({ id: 'sin-uso' })],
      [booking({ rateId: 'usada', totalAmount: 160_000, discountAmount: 40_000 })],
      []
    );

    const summary = summarizePromoUsage(usage);
    expect(summary.activePromos).toBe(1);
    expect(summary.totalUses).toBe(1);
    expect(summary.totalDiscount).toBe(40_000);
    expect(summary.totalRevenue).toBe(160_000);
  });
});
