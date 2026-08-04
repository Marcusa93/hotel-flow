import { describe, it, expect } from 'vitest';
import { chargedToAccounts, isReceivedPayment, receivedPayments, totalIncome } from '@/lib/income';
import type { CurrentAccountPayment, OtherIncome, Payment } from '@/types/hotel';

// El hotel reportó que el sistema mostraba un monto y el cierre de caja otro.
// La diferencia eran siempre los cobros con método "Cuenta corriente": la
// estadía se le anota al huésped y no entra un peso, pero Finanzas, el tablero
// y las estadísticas los sumaban como plata cobrada. Estos tests fijan la
// distinción para que la respuesta a "¿cuánto entró?" sea una sola.

const cobro = (over: Partial<Payment> = {}): Payment => ({
  id: 'p-1',
  bookingId: 'b-1',
  date: new Date(2026, 7, 3),
  method: 'CASH',
  status: 'PAID',
  amount: 100_000,
  ...over,
});

const ingresoVario = (over: Partial<OtherIncome> = {}): OtherIncome => ({
  id: 'oi-1',
  date: new Date(2026, 7, 3),
  description: 'Alquiler del salón',
  method: 'CASH',
  amount: 50_000,
  createdAt: new Date(2026, 7, 3),
  ...over,
});

const pagoDeCuenta = (over: Partial<CurrentAccountPayment> = {}): CurrentAccountPayment => ({
  id: 'cc-1',
  guestId: 'g-1',
  date: new Date(2026, 7, 3),
  method: 'CASH',
  amount: 30_000,
  createdAt: new Date(2026, 7, 3),
  ...over,
});

describe('isReceivedPayment', () => {
  it('un cobro pagado es plata', () => {
    expect(isReceivedPayment(cobro())).toBe(true);
  });

  it('lo anotado a cuenta corriente NO es plata', () => {
    // La reserva queda saldada, pero al cajón no entró nada: la deuda cambió
    // de dueño. Entra después, cuando el huésped viene a pagar la cuenta.
    expect(isReceivedPayment(cobro({ method: 'CUENTA_CORRIENTE' }))).toBe(false);
  });

  it('lo que todavía no se cobró tampoco es plata', () => {
    expect(isReceivedPayment(cobro({ status: 'PENDING' }))).toBe(false);
    expect(isReceivedPayment(cobro({ status: 'FAILED' }))).toBe(false);
  });
});

describe('receivedPayments', () => {
  it('deja afuera lo pendiente y lo anotado a cuenta', () => {
    const lista = [
      cobro({ id: 'a', amount: 10_000 }),
      cobro({ id: 'b', amount: 20_000, method: 'CUENTA_CORRIENTE' }),
      cobro({ id: 'c', amount: 40_000, status: 'PENDING' }),
      cobro({ id: 'd', amount: 80_000, method: 'QR' }),
    ];
    expect(receivedPayments(lista).map(p => p.id)).toEqual(['a', 'd']);
  });
});

describe('totalIncome', () => {
  it('suma las tres fuentes de plata', () => {
    // Cobros de reservas + lo que no sale de ninguna reserva + lo que los
    // huéspedes traen para bajar la cuenta corriente.
    expect(totalIncome({
      payments: [cobro({ amount: 100_000 })],
      otherIncome: [ingresoVario({ amount: 50_000 })],
      accountPayments: [pagoDeCuenta({ amount: 30_000 })],
    })).toBe(180_000);
  });

  it('no cuenta lo anotado a cuenta corriente', () => {
    expect(totalIncome({
      payments: [cobro({ amount: 100_000 }), cobro({ id: 'p-2', amount: 70_000, method: 'CUENTA_CORRIENTE' })],
    })).toBe(100_000);
  });

  it('funciona con fuentes vacías', () => {
    expect(totalIncome({})).toBe(0);
    expect(totalIncome({ payments: [] })).toBe(0);
  });

  it('el mismo día da lo mismo que el cierre de caja', () => {
    // El caso que reportó el hotel: Finanzas sumaba la cuenta corriente y no
    // miraba las otras dos fuentes, así que daba distinto que el cierre.
    // Los dos números tienen que salir de esta misma función.
    const delDia = {
      payments: [
        cobro({ id: 'a', amount: 247_499 }),
        cobro({ id: 'b', amount: 95_000, method: 'CREDIT' }),
        cobro({ id: 'c', amount: 200_000, method: 'CUENTA_CORRIENTE' }),
      ],
      otherIncome: [ingresoVario({ amount: 76_800, method: 'QR' })],
      accountPayments: [] as CurrentAccountPayment[],
    };

    expect(totalIncome(delDia)).toBe(419_299);
    // Lo anotado a cuenta se informa aparte, para que el total cierre contra
    // las filas del desglose y nadie tenga que adivinar la diferencia.
    expect(chargedToAccounts(delDia.payments)).toBe(200_000);
  });
});

describe('chargedToAccounts', () => {
  it('solo cuenta lo anotado y ya confirmado', () => {
    expect(chargedToAccounts([
      cobro({ id: 'a', amount: 10_000, method: 'CUENTA_CORRIENTE' }),
      cobro({ id: 'b', amount: 20_000, method: 'CUENTA_CORRIENTE', status: 'PENDING' }),
      cobro({ id: 'c', amount: 40_000 }),
    ])).toBe(10_000);
  });
});
