import { describe, it, expect } from 'vitest';
import {
  bookingsOfGroup,
  groupsPendingPrice,
  isPendingAndInHouse,
  isPendingPrice,
  splitGroupAmount,
} from '@/lib/bookingGroup';
import type { Booking, BookingGroup } from '@/types/hotel';

// La reserva masiva: un contingente toma varias habitaciones y recepción la arma
// SIN precio, porque el precio de un grupo se negocia y lo cierra administración.
// Cada habitación sigue siendo una reserva normal; el grupo solo las une.

const grupo = (over: Partial<BookingGroup> = {}): BookingGroup => ({
  id: 'g-1',
  createdAt: new Date(2026, 7, 7, 10, 0),
  ...over,
});

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

describe('el reparto del monto entre las habitaciones', () => {
  it('reparte en partes iguales cuando divide justo', () => {
    expect(splitGroupAmount(120_000, 3)).toEqual([40_000, 40_000, 40_000]);
  });

  it('la suma da el total exacto aunque no divida justo', () => {
    // Es la propiedad que importa: $100.000 entre 3 redondeando cada parte da
    // $99.999,99, y el grupo quedaría debiendo un centavo para siempre.
    const partes = splitGroupAmount(100_000, 3);
    expect(partes.reduce((a, b) => a + b, 0)).toBe(100_000);
  });

  it('el sobrante se reparte de a un centavo, no se apila en una', () => {
    const partes = splitGroupAmount(100_000, 3);
    expect(partes).toEqual([33_333.34, 33_333.33, 33_333.33]);
  });

  it('cierra exacto para cualquier cantidad de habitaciones', () => {
    for (let n = 1; n <= 24; n++) {
      for (const total of [100_000, 333_333.33, 1, 0.05, 987_654.21]) {
        const suma = splitGroupAmount(total, n).reduce((a, b) => a + b, 0);
        expect(Math.round(suma * 100)).toBe(Math.round(total * 100));
      }
    }
  });

  it('una sola habitación se lleva todo', () => {
    expect(splitGroupAmount(85_000, 1)).toEqual([85_000]);
  });

  it('sin habitaciones no reparte nada', () => {
    expect(splitGroupAmount(50_000, 0)).toEqual([]);
  });

  it('un grupo en cero reparte ceros y no rompe', () => {
    expect(splitGroupAmount(0, 3)).toEqual([0, 0, 0]);
  });
});

describe('los grupos a los que les falta precio', () => {
  it('sin monto está a tarifar', () => {
    expect(isPendingPrice(grupo({ totalAmount: null }))).toBe(true);
    expect(isPendingPrice(grupo({ totalAmount: undefined }))).toBe(true);
  });

  it('en cero NO está a tarifar: cero puede ser un precio acordado', () => {
    // Por eso el pendiente es null y no cero. Una cortesía se tarifa en cero a
    // propósito, y no tiene que quedar apareciendo como pendiente para siempre.
    expect(isPendingPrice(grupo({ totalAmount: 0 }))).toBe(false);
  });

  it('los lista del más viejo al más nuevo', () => {
    // El que lleva más tiempo sin tarifar es el que más cerca está de que el
    // contingente se vaya sin que nadie le haya puesto un monto.
    const pendientes = groupsPendingPrice([
      grupo({ id: 'nuevo', createdAt: new Date(2026, 7, 7) }),
      grupo({ id: 'tarifado', createdAt: new Date(2026, 7, 1), totalAmount: 500_000 }),
      grupo({ id: 'viejo', createdAt: new Date(2026, 7, 2) }),
    ]);

    expect(pendientes.map(g => g.id)).toEqual(['viejo', 'nuevo']);
  });
});

describe('el grupo que ya entró sin precio', () => {
  it('avisa cuando la gente está adentro y todavía no se tarifó', () => {
    // El caso urgente: están alojados, en cualquier momento se van, y el sistema
    // dice que no deben nada.
    expect(
      isPendingAndInHouse(grupo({ totalAmount: null }), [
        reserva({ status: 'CONFIRMED' }),
        reserva({ id: 'b-2', status: 'CHECKED_IN' }),
      ])
    ).toBe(true);
  });

  it('un grupo que todavía no llegó no es urgente', () => {
    expect(
      isPendingAndInHouse(grupo({ totalAmount: null }), [reserva({ status: 'CONFIRMED' })])
    ).toBe(false);
  });

  it('si ya se fue sin tarifar, sigue siendo urgente', () => {
    // Ahí ya es tarde para cobrarle en el mostrador, pero justamente por eso hay
    // que verlo: el sistema no puede dejarlo pasar en silencio.
    expect(
      isPendingAndInHouse(grupo({ totalAmount: null }), [reserva({ status: 'CHECKED_OUT' })])
    ).toBe(true);
  });

  it('un grupo tarifado no avisa nada', () => {
    expect(
      isPendingAndInHouse(grupo({ totalAmount: 500_000 }), [reserva({ status: 'CHECKED_IN' })])
    ).toBe(false);
  });
});

describe('las reservas de un grupo', () => {
  it('trae solo las del grupo pedido', () => {
    const todas = [
      reserva({ id: 'a', groupId: 'g-1' }),
      reserva({ id: 'b', groupId: 'g-2' }),
      reserva({ id: 'c', groupId: 'g-1' }),
      reserva({ id: 'suelta' }),
    ];

    expect(bookingsOfGroup(todas, 'g-1').map(b => b.id)).toEqual(['a', 'c']);
  });

  it('una reserva normal no pertenece a ningún grupo', () => {
    expect(bookingsOfGroup([reserva()], 'g-1')).toEqual([]);
  });
});
