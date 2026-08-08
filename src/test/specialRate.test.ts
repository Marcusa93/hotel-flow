import { describe, it, expect } from 'vitest';
import {
  bookingsPendingRate,
  hasSpecialRate,
  isPendingAndInHouse,
  isSpecialRatePending,
} from '@/lib/specialRate';
import type { Booking } from '@/types/hotel';

// La tarifa especial: el precio que el hotel le hace a quien quiere. Los dueños
// que se alojan y no pagan, el amigo al que se le hace un precio. El precio lo
// pone administración, pero la MARCA la pone recepción: si llega alguien un
// domingo a la noche, el mostrador no puede quedar trabado esperando.

const reserva = (over: Partial<Booking> = {}): Booking => ({
  id: 'b-1',
  guestId: 'h-1',
  roomId: 'r-1',
  checkInDate: new Date(2026, 7, 10),
  checkOutDate: new Date(2026, 7, 13),
  adults: 2,
  children: 0,
  infants: 0,
  status: 'CONFIRMED',
  totalAmount: 0,
  createdAt: new Date(2026, 7, 7),
  ...over,
});

describe('si la estadía tiene tarifa especial', () => {
  it('con monto puesto, sí', () => {
    expect(hasSpecialRate(reserva({ specialRateAmount: 30_000 }))).toBe(true);
  });

  it('en cero también: es un precio decidido, no un campo vacío', () => {
    // Es el caso de los dueños. Tratarlo como "sin precio" lo dejaría apareciendo
    // como pendiente para siempre.
    expect(hasSpecialRate(reserva({ specialRateAmount: 0 }))).toBe(true);
  });

  it('una reserva normal no', () => {
    expect(hasSpecialRate(reserva())).toBe(false);
  });
});

describe('las que esperan precio', () => {
  it('marcada y sin monto está pendiente', () => {
    expect(isSpecialRatePending(reserva({ specialRatePending: true }))).toBe(true);
  });

  it('una vez tarifada deja de estarlo, aunque sea en cero', () => {
    // El pendiente no puede vivir en el monto: sin la marca aparte, tarifar en
    // cero sería indistinguible de no haber tarifado.
    expect(
      isSpecialRatePending(reserva({ specialRatePending: true, specialRateAmount: 0 }))
    ).toBe(false);
  });

  it('una reserva normal nunca está pendiente', () => {
    expect(isSpecialRatePending(reserva())).toBe(false);
  });

  it('las ordena por la entrada más próxima', () => {
    // La que entra mañana es la que hay que tarifar hoy.
    const lista = bookingsPendingRate([
      reserva({ id: 'lejana', specialRatePending: true, checkInDate: new Date(2026, 7, 20) }),
      reserva({ id: 'normal' }),
      reserva({ id: 'proxima', specialRatePending: true, checkInDate: new Date(2026, 7, 9) }),
    ]);

    expect(lista.map(b => b.id)).toEqual(['proxima', 'lejana']);
  });

  it('deja afuera las canceladas: no hay nada que cobrarle a quien no viene', () => {
    const lista = bookingsPendingRate([
      reserva({ id: 'cancelada', specialRatePending: true, status: 'CANCELLED' }),
      reserva({ id: 'noshow', specialRatePending: true, status: 'NO_SHOW' }),
      reserva({ id: 'viva', specialRatePending: true }),
    ]);

    expect(lista.map(b => b.id)).toEqual(['viva']);
  });
});

describe('la que ya entró sin precio', () => {
  it('avisa cuando está alojado y todavía no se tarifó', () => {
    // Está adentro, en cualquier momento se va, y el sistema dice que no debe nada.
    expect(isPendingAndInHouse(reserva({ specialRatePending: true, status: 'CHECKED_IN' }))).toBe(true);
  });

  it('si ya se fue sin tarifar, sigue siendo urgente', () => {
    expect(isPendingAndInHouse(reserva({ specialRatePending: true, status: 'CHECKED_OUT' }))).toBe(true);
  });

  it('la que todavía no llegó no es urgente', () => {
    expect(isPendingAndInHouse(reserva({ specialRatePending: true, status: 'CONFIRMED' }))).toBe(false);
  });

  it('una ya tarifada no avisa nada', () => {
    expect(
      isPendingAndInHouse(reserva({ specialRatePending: false, specialRateAmount: 0, status: 'CHECKED_IN' }))
    ).toBe(false);
  });
});
