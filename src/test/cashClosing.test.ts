import { describe, it, expect } from 'vitest';
import {
  cashToDeposit,
  companyCashBalance,
  defaultClosingDay,
  expenseCashSource,
  resolveCashFloat,
  summarizeExpenses,
} from '@/lib/cashClosing';
import type { Expense } from '@/types/hotel';

// El hotel cierra la caja de ayer, a la mañana siguiente. Lo que se rinde es lo
// que quedó físicamente en el cajón: lo cobrado en efectivo, menos el fondo fijo
// que queda para arrancar, menos lo que se pagó de ahí mismo.

const gasto = (over: Partial<Expense> = {}): Expense => ({
  id: 'e-1',
  date: new Date(2026, 6, 30),
  expenseType: 'SUPERMERCADO',
  amount: 10_000,
  createdAt: new Date(2026, 6, 30),
  ...over,
});

describe('summarizeExpenses', () => {
  it('agrupa por rubro y por cuenta a la vez', () => {
    const result = summarizeExpenses([
      gasto({ id: 'a', expenseType: 'PANADERIA', amount: 5_000, method: 'CASH' }),
      gasto({ id: 'b', expenseType: 'PANADERIA', amount: 3_000, method: 'TRANSFER' }),
      gasto({ id: 'c', expenseType: 'BEBIDAS', amount: 20_000, method: 'TRANSFER' }),
    ]);

    expect(result.byType).toEqual({ PANADERIA: 8_000, BEBIDAS: 20_000 });
    expect(result.byMethod).toEqual({ CASH: 5_000, TRANSFER: 23_000 });
    expect(result.total).toBe(28_000);
  });

  it('solo el efectivo cuenta como salido del cajón', () => {
    const result = summarizeExpenses([
      gasto({ id: 'a', amount: 5_000, method: 'CASH' }),
      gasto({ id: 'b', amount: 90_000, method: 'TRANSFER' }),
      gasto({ id: 'c', amount: 7_000, method: 'DEBIT' }),
    ]);

    expect(result.cash).toBe(5_000);
    expect(result.total).toBe(102_000);
  });

  it('un gasto sin método no se da por efectivo', () => {
    // Los gastos cargados antes de que existiera la columna. Suponerlos en
    // efectivo cambiaría el efectivo a rendir de todos los cierres viejos.
    const result = summarizeExpenses([
      gasto({ id: 'viejo', amount: 12_000, method: undefined }),
      gasto({ id: 'nuevo', amount: 3_000, method: 'CASH' }),
    ]);

    expect(result.unspecified).toBe(12_000);
    expect(result.cash).toBe(3_000);
    expect(result.byMethod).toEqual({ CASH: 3_000 });
    // Pero sí suma al total del día: la plata se gastó igual.
    expect(result.total).toBe(15_000);
  });

  it('sin gastos devuelve todo en cero', () => {
    const result = summarizeExpenses([]);
    expect(result).toEqual({
      byType: {}, byMethod: {},
      cash: 0, cashRecaudacion: 0, cashEmpresa: 0,
      unspecified: 0, total: 0,
    });
  });
});

describe('las dos cajas', () => {
  // RECAUDACION es lo cobrado a huéspedes: es lo que se rinde. EMPRESA es la
  // plata que pone el hotel para las compras del día, y gastarla no toca lo que
  // hay que rendir.

  it('un gasto en efectivo sin origen se cuenta como recaudación', () => {
    // Los cargados antes de que existieran las dos cajas. Leerlos como empresa
    // sacaría plata de un fondo que no existía y movería cierres ya hechos.
    expect(expenseCashSource(gasto({ method: 'CASH', cashSource: undefined }))).toBe('RECAUDACION');
  });

  it('un gasto que no es en efectivo no sale de ninguna caja', () => {
    expect(expenseCashSource(gasto({ method: 'TRANSFER' }))).toBeNull();
    expect(expenseCashSource(gasto({ method: undefined }))).toBeNull();
  });

  it('separa el efectivo de cada caja', () => {
    const result = summarizeExpenses([
      gasto({ id: 'a', amount: 5_000, method: 'CASH', cashSource: 'RECAUDACION' }),
      gasto({ id: 'b', amount: 30_000, method: 'CASH', cashSource: 'EMPRESA' }),
      gasto({ id: 'c', amount: 12_000, method: 'TRANSFER' }),
    ]);

    expect(result.cashRecaudacion).toBe(5_000);
    expect(result.cashEmpresa).toBe(30_000);
    expect(result.cash).toBe(35_000);
    expect(result.total).toBe(47_000);
  });

  it('lo pagado con la caja de la empresa no baja el efectivo a rendir', () => {
    // Es el pedido: la compra del panadero sale del fondo del hotel, no de lo
    // que se le cobró a los huéspedes.
    const result = summarizeExpenses([
      gasto({ id: 'a', amount: 30_000, method: 'CASH', cashSource: 'EMPRESA' }),
    ]);

    expect(cashToDeposit({ cashIncome: 100_000, cashFloat: 20_000, cashExpenses: result.cashRecaudacion }))
      .toBe(80_000);
  });
});

describe('companyCashBalance', () => {
  it('es lo que la empresa puso menos lo que se gastó de ahí', () => {
    const balance = companyCashBalance(
      [{ amount: 200_000 }, { amount: 50_000 }],
      [
        gasto({ id: 'a', amount: 30_000, method: 'CASH', cashSource: 'EMPRESA' }),
        gasto({ id: 'b', amount: 20_000, method: 'CASH', cashSource: 'EMPRESA' }),
      ]
    );
    expect(balance).toBe(200_000);
  });

  it('los gastos de la recaudación no le tocan el saldo', () => {
    const balance = companyCashBalance(
      [{ amount: 100_000 }],
      [
        gasto({ id: 'a', amount: 40_000, method: 'CASH', cashSource: 'RECAUDACION' }),
        gasto({ id: 'b', amount: 25_000, method: 'TRANSFER' }),
      ]
    );
    expect(balance).toBe(100_000);
  });

  it('da negativo si se gastó más de lo que la empresa puso', () => {
    // No se corta en cero: el negativo dice que la caja de la empresa está en
    // rojo y hay que reponerla.
    const balance = companyCashBalance(
      [{ amount: 10_000 }],
      [gasto({ id: 'a', amount: 25_000, method: 'CASH', cashSource: 'EMPRESA' })]
    );
    expect(balance).toBe(-15_000);
  });

  it('sin aportes ni gastos es cero', () => {
    expect(companyCashBalance([], [])).toBe(0);
  });
});

describe('cashToDeposit', () => {
  it('descuenta el fondo fijo y los gastos pagados de la caja', () => {
    // Entraron 100.000 en efectivo, quedan 20.000 de fondo y se le pagaron
    // 5.000 al panadero del cajón: se rinden 75.000.
    expect(cashToDeposit({ cashIncome: 100_000, cashFloat: 20_000, cashExpenses: 5_000 })).toBe(75_000);
  });

  it('sin gastos en efectivo se comporta como antes', () => {
    expect(cashToDeposit({ cashIncome: 100_000, cashFloat: 20_000, cashExpenses: 0 })).toBe(80_000);
  });

  it('da negativo cuando se gastó más de lo que entró', () => {
    // No se corta en cero a propósito: el negativo dice que hubo que poner del
    // fondo fijo, y esconderlo haría que la caja no cierre sin explicación.
    expect(cashToDeposit({ cashIncome: 10_000, cashFloat: 20_000, cashExpenses: 5_000 })).toBe(-15_000);
  });
});

describe('resolveCashFloat', () => {
  it('el del día le gana al predeterminado', () => {
    expect(resolveCashFloat(50_000, 20_000)).toBe(50_000);
  });

  it('sin fondo del día usa el predeterminado', () => {
    expect(resolveCashFloat(null, 20_000)).toBe(20_000);
    expect(resolveCashFloat(undefined, 20_000)).toBe(20_000);
  });

  it('un fondo de 0 puesto a mano es un dato, no un vacío', () => {
    // Con || en vez de ?? este día heredaría los 20.000 y el efectivo a rendir
    // saldría 20.000 menos de lo que corresponde.
    expect(resolveCashFloat(0, 20_000)).toBe(0);
  });

  it('sin nada cargado es cero', () => {
    expect(resolveCashFloat(null, null)).toBe(0);
  });
});

describe('defaultClosingDay', () => {
  it('propone ayer, que es el día que se cierra', () => {
    expect(defaultClosingDay(new Date(2026, 6, 31)).getDate()).toBe(30);
  });

  it('cruza bien el cambio de mes', () => {
    const day = defaultClosingDay(new Date(2026, 7, 1));
    expect(day.getMonth()).toBe(6); // julio
    expect(day.getDate()).toBe(31);
  });

  it('cruza bien el cambio de año', () => {
    const day = defaultClosingDay(new Date(2027, 0, 1));
    expect(day.getFullYear()).toBe(2026);
    expect(day.getMonth()).toBe(11);
    expect(day.getDate()).toBe(31);
  });
});
