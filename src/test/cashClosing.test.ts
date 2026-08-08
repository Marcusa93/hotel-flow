import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CASH_SOURCE,
  belongsToClosingDay,
  belongsToDailyCash,
  belongsToSessionInterval,
  cashToDeposit,
  closingDrift,
  closingForDay,
  isDayClosed,
  companyCashBalance,
  defaultClosingDay,
  expenseCashSource,
  expenseSource,
  nextSessionStart,
  resolveCashFloat,
  sessionAt,
  sessionIncomeRows,
  summarizeExpenses,
} from '@/lib/cashClosing';
import type { CashClosing, CashSession, Expense, Payment } from '@/types/hotel';

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
      cash: 0, cashRecaudacion: 0, cashEmpresa: 0, empresa: 0,
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

describe('el supuesto de qué caja pagó', () => {
  // De acá salió un faltante real en producción: el formulario arrancaba en
  // EMPRESA por su cuenta mientras la lectura de gastos suponía RECAUDACION.
  // Recepción pagaba del cajón sin tocar el desplegable, el gasto no bajaba el
  // efectivo a rendir y el cierre pedía rendir plata que ya no estaba.

  it('el default que usa el formulario es el mismo que lee el cierre', () => {
    // Si alguien cambia uno de los dos, este test lo frena.
    expect(expenseCashSource(gasto({ method: 'CASH' }))).toBe(DEFAULT_CASH_SOURCE);
  });

  it('el supuesto es recaudación, que es el que no genera faltante', () => {
    // Errarle para el lado de la recaudación hace sobrar plata, que se ve.
    // Errarle para el lado de la empresa la hace faltar, que es lo que pasó.
    expect(DEFAULT_CASH_SOURCE).toBe('RECAUDACION');
  });

  it('un gasto en efectivo sin caja elegida baja el efectivo a rendir', () => {
    const result = summarizeExpenses([gasto({ method: 'CASH', amount: 15_000 })]);

    expect(
      cashToDeposit({ cashIncome: 100_000, cashFloat: 20_000, cashExpenses: result.cashRecaudacion })
    ).toBe(65_000);
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


// ─── Cerrar el día ────────────────────────────────────────────────────

const cierre = (over: Partial<CashClosing> = {}): CashClosing => ({
  id: 'c-1',
  closingDate: new Date(2026, 7, 3),
  cashIncome: 100_000,
  cashFloat: 20_000,
  cashExpenses: 5_000,
  cashToDeposit: 75_000,
  totalIncome: 120_000,
  totalExpenses: 8_000,
  closedAt: new Date(2026, 7, 4, 9, 30),
  createdAt: new Date(2026, 7, 4, 9, 30),
  ...over,
});

describe('belongsToClosingDay', () => {
  // El hotel eligió que el cierre se lleve lo que tiene la fecha de ese día.
  it('entra lo que tiene la fecha del día que se cierra', () => {
    expect(belongsToClosingDay('2026-08-03', '2026-08-03')).toBe(true);
  });

  it('no entra lo cargado con otra fecha, aunque sea del cajón de ese día', () => {
    // El cobro que entró el 3 y se carga el 4 a la mañana queda con fecha del 4:
    // hay que corregirle la fecha a mano para que caiga en el cierre del 3.
    expect(belongsToClosingDay('2026-08-04', '2026-08-03')).toBe(false);
  });

  it('el cobro corregido cambia de caja: entra en la nueva y sale de la vieja', () => {
    // Ni en las dos ni en ninguna. Es lo que hace que corregir la fecha no sea
    // ni duplicar la plata ni perderla.
    const corregido = '2026-08-03';
    expect(belongsToClosingDay(corregido, '2026-08-03')).toBe(true);
    expect(belongsToClosingDay(corregido, '2026-08-04')).toBe(false);
  });
});

describe('closingForDay', () => {
  it('encuentra el cierre por su día local', () => {
    expect(closingForDay([cierre()], '2026-08-03')?.id).toBe('c-1');
  });

  it('un día sin cierre no devuelve nada', () => {
    expect(closingForDay([cierre()], '2026-08-04')).toBeUndefined();
  });
});

describe('isDayClosed', () => {
  it('un día con cierre está cerrado', () => {
    expect(isDayClosed(cierre())).toBe(true);
  });

  it('reabierto vuelve a contar como pendiente', () => {
    expect(isDayClosed(cierre({ reopenedAt: new Date(2026, 7, 5) }))).toBe(false);
  });

  it('un día sin cierre está pendiente', () => {
    expect(isDayClosed(undefined)).toBe(false);
  });
});

describe('closingDrift', () => {
  const ahora = {
    cashIncome: 100_000, cashExpenses: 5_000, cashToDeposit: 75_000,
    totalIncome: 120_000, totalExpenses: 8_000,
  };

  it('sin cambios no avisa nada', () => {
    expect(closingDrift(cierre(), ahora)).toEqual([]);
  });

  it('avisa cuando alguien cargó un gasto después de cerrar', () => {
    // El gasto nuevo mueve los gastos y, con él, el efectivo a rendir.
    const drift = closingDrift(cierre(), { ...ahora, cashExpenses: 12_000, cashToDeposit: 68_000 });

    expect(drift.map(d => d.label)).toEqual(['Gastos en efectivo', 'Efectivo a rendir']);
    expect(drift[0]).toMatchObject({ closed: 5_000, now: 12_000 });
  });

  it('los centavos de redondeo no cuentan como cambio', () => {
    // Sin el redondeo, un total con decimales marcaría descuadre todos los días.
    expect(closingDrift(cierre(), { ...ahora, cashToDeposit: 75_000.4 })).toEqual([]);
  });

  it('dos movimientos opuestos del mismo monto no levantan nada', () => {
    // Sacar un cobro de $10.000 del día y meter otro de $10.000 deja los cinco
    // totales igual que antes: este detector compara sumas, no movimientos.
    // Por eso corregir la fecha de un cobro se PROHÍBE sobre un día cerrado en
    // vez de permitirse y confiar en que acá se vea.
    expect(closingDrift(cierre(), ahora)).toEqual([]);
  });
});


// ─── El turno de caja: corte por instante ─────────────────────────────
// El circuito real del hotel: la caja del jueves se cierra el viernes a las
// 10-11 de la mañana. Lo cargado hasta ese momento se rinde en ese cierre; lo
// cargado después arranca la caja siguiente. Por día calendario, la mañana del
// viernes caía en los dos cierres y se rendía dos veces.

const turno = (over: Partial<CashSession> = {}): CashSession => ({
  id: 't-1',
  openedAt: new Date(2026, 7, 6, 11, 0),
  openingAmount: 10_000,
  createdAt: new Date(2026, 7, 6, 11, 0),
  ...over,
});

describe('belongsToSessionInterval', () => {
  const cerrado = turno({
    openedAt: new Date(2026, 7, 6, 11, 0),   // jueves 6, 11:00
    closedAt: new Date(2026, 7, 7, 10, 30),  // viernes 7, 10:30
  });

  it('lo cargado entre la apertura y el cierre entra, sin importar el día', () => {
    // Jueves a la tarde y viernes a la mañana: días distintos, mismo turno.
    expect(belongsToSessionInterval(new Date(2026, 7, 6, 18, 0), cerrado)).toBe(true);
    expect(belongsToSessionInterval(new Date(2026, 7, 7, 9, 45), cerrado)).toBe(true);
  });

  it('el instante de la apertura ya es del turno', () => {
    expect(belongsToSessionInterval(new Date(2026, 7, 6, 11, 0), cerrado)).toBe(true);
  });

  it('el instante del cierre ya NO: es del turno siguiente', () => {
    // [apertura, cierre): como el siguiente arranca donde este terminó, un
    // movimiento clavado en el instante del cierre iría a los dos turnos si
    // este extremo fuera inclusivo. Es la mitad de la garantía de no duplicar.
    expect(belongsToSessionInterval(new Date(2026, 7, 7, 10, 30), cerrado)).toBe(false);
  });

  it('lo cargado después del cierre no entra, aunque sea del mismo día', () => {
    // El viernes a las 15:00 la caja del jueves ya está rendida: esa plata es
    // de la caja nueva. Es exactamente lo que el corte por día hacía mal.
    expect(belongsToSessionInterval(new Date(2026, 7, 7, 15, 0), cerrado)).toBe(false);
  });

  it('lo cargado antes de la apertura no entra', () => {
    expect(belongsToSessionInterval(new Date(2026, 7, 6, 10, 59), cerrado)).toBe(false);
  });

  it('el turno abierto toma todo desde su apertura en adelante', () => {
    const abierto = turno({ openedAt: new Date(2026, 7, 7, 10, 30) });
    expect(belongsToSessionInterval(new Date(2026, 7, 7, 10, 30), abierto)).toBe(true);
    expect(belongsToSessionInterval(new Date(2026, 7, 9, 23, 0), abierto)).toBe(true);
  });

  it('dos turnos encadenados se reparten todos los instantes sin superponerse', () => {
    // La propiedad completa: el nuevo abre en el instante exacto del cierre
    // anterior (nextSessionStart), así que cada instante cae en UNO solo.
    const siguiente = turno({ id: 't-2', openedAt: cerrado.closedAt! });
    const instantes = [
      new Date(2026, 7, 7, 10, 29, 59),
      new Date(2026, 7, 7, 10, 30),
      new Date(2026, 7, 7, 11, 15),
    ];
    for (const t of instantes) {
      const enAmbos = belongsToSessionInterval(t, cerrado) && belongsToSessionInterval(t, siguiente);
      const enAlguno = belongsToSessionInterval(t, cerrado) || belongsToSessionInterval(t, siguiente);
      expect(enAmbos).toBe(false);
      expect(enAlguno).toBe(true);
    }
  });
});

describe('nextSessionStart', () => {
  it('la caja nueva arranca donde terminó la última cerrada', () => {
    const sesiones = [
      turno({ id: 'a', closedAt: new Date(2026, 7, 5, 10, 0) }),
      turno({ id: 'b', closedAt: new Date(2026, 7, 7, 10, 30) }),
      turno({ id: 'c', closedAt: new Date(2026, 7, 6, 9, 45) }),
    ];
    expect(nextSessionStart(sesiones)?.getTime()).toBe(new Date(2026, 7, 7, 10, 30).getTime());
  });

  it('los turnos abiertos no cuentan como punto de partida', () => {
    expect(nextSessionStart([turno()])).toBeNull();
  });

  it('sin ningún turno no hay de dónde encadenarse', () => {
    // La primera apertura de todas elige su comienzo a mano.
    expect(nextSessionStart([])).toBeNull();
  });
});

describe('sessionAt', () => {
  const viejo = turno({
    id: 'viejo',
    openedAt: new Date(2026, 7, 5, 0, 0),
    closedAt: new Date(2026, 7, 7, 10, 30),
  });
  const nuevo = turno({ id: 'nuevo', openedAt: new Date(2026, 7, 7, 10, 30) });

  it('encuentra el turno que contiene el instante', () => {
    expect(sessionAt([nuevo, viejo], new Date(2026, 7, 6, 15, 0))?.id).toBe('viejo');
    expect(sessionAt([nuevo, viejo], new Date(2026, 7, 7, 12, 0))?.id).toBe('nuevo');
  });

  it('un instante fuera de todo turno no pertenece a ninguno', () => {
    expect(sessionAt([nuevo, viejo], new Date(2026, 7, 4, 12, 0))).toBeUndefined();
  });

  it('si dos turnos viejos se solapan gana el de apertura más reciente', () => {
    // No debería pasar con las aperturas encadenadas, pero con datos viejos
    // puede: el criterio es el mismo con que la pantalla elige qué mostrar.
    const solapado = turno({ id: 'solapado', openedAt: new Date(2026, 7, 6, 8, 0) });
    expect(sessionAt([viejo, solapado], new Date(2026, 7, 6, 9, 0))?.id).toBe('solapado');
  });
});

// ─── El detalle con el que se controla el cierre ──────────────────────
// El hotel no podía verificar el total: la pantalla mostraba los métodos y nada
// más, así que iban a Finanzas y sumaban la tabla — que suma otra cosa. De ahí
// los $740.500 a mano contra los $752.700 del sistema.

const cobro = (over: Partial<Payment> = {}): Payment => ({
  id: 'p-1',
  bookingId: 'b-1',
  date: new Date(2026, 7, 6, 15, 0),
  method: 'CASH',
  status: 'PAID',
  amount: 50_000,
  ...over,
});

describe('sessionIncomeRows', () => {
  const abierto = turno({ openedAt: new Date(2026, 7, 6, 11, 0) });

  it('junta las tres fuentes en una sola lista', () => {
    const rows = sessionIncomeRows({
      session: abierto,
      payments: [cobro()],
      otherIncome: [{
        id: 'o-1', date: new Date(2026, 7, 6), description: 'Alquiler del salón',
        method: 'TRANSFER', amount: 30_000, createdAt: new Date(2026, 7, 6, 16, 0),
      }],
      accountPayments: [{
        id: 'a-1', guestId: 'g-1', date: new Date(2026, 7, 6), amount: 20_000,
        method: 'CASH', createdAt: new Date(2026, 7, 6, 17, 0),
      }],
    });

    expect(rows.map(r => r.source)).toEqual(['COBRO', 'EXTERNO', 'CTA_CTE']);
  });

  it('la suma de los renglones que entraron da el total del turno', () => {
    // La propiedad que hace útil a la lista: si no cierra contra el total, el
    // detalle no sirve para controlar nada.
    const rows = sessionIncomeRows({
      session: abierto,
      payments: [
        cobro({ id: 'p-1', amount: 50_000 }),
        cobro({ id: 'p-2', amount: 12_200, method: 'TRANSFER' }),
        cobro({ id: 'p-3', amount: 99_000, method: 'CUENTA_CORRIENTE' }),
      ],
      otherIncome: [{
        id: 'o-1', date: new Date(2026, 7, 6), description: 'Salón',
        method: 'CASH', amount: 30_000, createdAt: new Date(2026, 7, 6, 16, 0),
      }],
      accountPayments: [{
        id: 'a-1', guestId: 'g-1', date: new Date(2026, 7, 6), amount: 20_000,
        method: 'CASH', createdAt: new Date(2026, 7, 6, 17, 0),
      }],
    });

    const entro = rows.filter(r => !r.toAccount).reduce((s, r) => s + r.amount, 0);
    expect(entro).toBe(112_200);
  });

  it('lista lo anotado a cuenta corriente pero lo marca: no es plata', () => {
    const rows = sessionIncomeRows({
      session: abierto,
      payments: [cobro({ method: 'CUENTA_CORRIENTE' })],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].toAccount).toBe(true);
  });

  it('deja afuera los cobros que no están pagados', () => {
    // Son los que inflan la suma a mano de Finanzas: la tabla los lista igual.
    const rows = sessionIncomeRows({
      session: abierto,
      payments: [cobro({ status: 'PENDING' }), cobro({ id: 'p-2', status: 'REFUNDED' })],
    });

    expect(rows).toEqual([]);
  });

  it('deja afuera lo que cayó en otro turno', () => {
    const rows = sessionIncomeRows({
      session: abierto,
      payments: [cobro({ date: new Date(2026, 7, 6, 10, 30) })],
      otherIncome: [{
        id: 'o-1', date: new Date(2026, 7, 6), description: 'De antes',
        method: 'CASH', amount: 5_000, createdAt: new Date(2026, 7, 6, 9, 0),
      }],
    });

    expect(rows).toEqual([]);
  });

  it('el ingreso externo entra por cuándo se cargó, no por la fecha que dice', () => {
    // Su columna de fecha es un día pelado sin hora: por ahí el corte no existe.
    const rows = sessionIncomeRows({
      session: abierto,
      otherIncome: [{
        id: 'o-1', date: new Date(2026, 7, 1), description: 'Cargado hoy, fechado antes',
        method: 'CASH', amount: 5_000, createdAt: new Date(2026, 7, 6, 16, 0),
      }],
    });

    expect(rows).toHaveLength(1);
  });

  it('ordena por el instante, que es el orden en que entró la plata', () => {
    const rows = sessionIncomeRows({
      session: abierto,
      payments: [
        cobro({ id: 'tarde', date: new Date(2026, 7, 6, 20, 0) }),
        cobro({ id: 'temprano', date: new Date(2026, 7, 6, 12, 0) }),
      ],
    });

    expect(rows.map(r => r.id)).toEqual(['temprano', 'tarde']);
  });

  it('sin turno no hay nada que mostrar', () => {
    expect(sessionIncomeRows({ session: null, payments: [cobro()] })).toEqual([]);
  });
});

// ─── De qué caja sale, sin mirar con qué se pagó ──────────────────────
// El dueño paga la luz por transferencia y el súper en efectivo, y las dos cosas
// salen de lo acumulado del hotel. Antes `cashSource` solo valía para los gastos
// en efectivo, así que la luz no tenía dónde imputarse.

describe('expenseSource', () => {
  it('un gasto por transferencia también puede salir de la caja de la empresa', () => {
    const luz = gasto({ method: 'TRANSFER', cashSource: 'EMPRESA' });
    expect(expenseSource(luz)).toBe('EMPRESA');
    // Pero no baja el efectivo a rendir: no salió plata del cajón.
    expect(expenseCashSource(luz)).toBe(null);
  });

  it('sin marcar sale de la recaudación, como se venía contando', () => {
    expect(expenseSource(gasto({ cashSource: undefined }))).toBe('RECAUDACION');
  });
});

describe('belongsToDailyCash', () => {
  it('los del cajón le tocan al cierre de recepción', () => {
    expect(belongsToDailyCash(gasto({ cashSource: 'RECAUDACION' }))).toBe(true);
    expect(belongsToDailyCash(gasto({ cashSource: undefined }))).toBe(true);
  });

  it('los de la empresa no, ni siquiera pagados en efectivo', () => {
    // Un pago de luz de $300.000 en la lista de gastos del turno solo hace
    // dudar de un número que estaba bien: no es plata de recepción.
    expect(belongsToDailyCash(gasto({ cashSource: 'EMPRESA' }))).toBe(false);
    expect(belongsToDailyCash(gasto({ method: 'CASH', cashSource: 'EMPRESA' }))).toBe(false);
  });
});

describe('lo que salió de la caja de la empresa', () => {
  it('suma los de la empresa con cualquier medio de pago', () => {
    const { empresa, cashEmpresa } = summarizeExpenses([
      gasto({ amount: 300_000, method: 'TRANSFER', cashSource: 'EMPRESA' }),  // la luz
      gasto({ amount: 80_000, method: 'CASH', cashSource: 'EMPRESA' }),       // el súper
      gasto({ amount: 20_000, method: 'CASH', cashSource: 'RECAUDACION' }),   // el panadero
    ]);

    expect(empresa).toBe(380_000);
    // El efectivo de la empresa es un subconjunto: sirve para otra pregunta.
    expect(cashEmpresa).toBe(80_000);
  });

  it('el gasto del cajón no cuenta como de la empresa', () => {
    expect(summarizeExpenses([gasto({ amount: 20_000 })]).empresa).toBe(0);
  });
});

// ─── El cheque ────────────────────────────────────────────────────────
// Un método más para los ingresos, pero con algo que ningún otro tiene: es un
// papel que queda en el mostrador. La transferencia se va sola al banco; el
// cheque hay que entregarlo.

describe('los cheques del turno', () => {
  const abierto = turno({ openedAt: new Date(2026, 7, 6, 11, 0) });

  const conCheques = () =>
    sessionIncomeRows({
      session: abierto,
      payments: [
        cobro({ id: 'efectivo', amount: 50_000, method: 'CASH' }),
        cobro({ id: 'cheque-1', amount: 120_000, method: 'CHEQUE' }),
        cobro({ id: 'cheque-2', amount: 60_000, method: 'CHEQUE' }),
        cobro({ id: 'transfer', amount: 30_000, method: 'TRANSFER' }),
      ],
    });

  it('suman a los ingresos del turno como cualquier otro método', () => {
    const total = conCheques().reduce((s, r) => s + r.amount, 0);
    expect(total).toBe(260_000);
  });

  it('no son efectivo: no tocan lo que hay que rendir del cajón', () => {
    // Es la propiedad que importa. Si el cheque contara como efectivo, el cierre
    // pediría rendir plata que nunca estuvo en el cajón.
    const enEfectivo = conCheques()
      .filter(r => r.method === 'CASH')
      .reduce((s, r) => s + r.amount, 0);

    expect(enEfectivo).toBe(50_000);
    expect(cashToDeposit({ cashIncome: enEfectivo, cashFloat: 10_000, cashExpenses: 0 })).toBe(40_000);
  });

  it('se pueden separar para el renglón de "a entregar"', () => {
    const cheques = conCheques().filter(r => r.method === 'CHEQUE');
    expect(cheques).toHaveLength(2);
    expect(cheques.reduce((s, r) => s + r.amount, 0)).toBe(180_000);
  });

  it('un cheque a cuenta corriente no cuenta: no entró ningún papel', () => {
    // Método CUENTA_CORRIENTE es no cobrar todavía, así que no hay cheque que
    // entregar aunque el huésped después lo pague con uno.
    const rows = sessionIncomeRows({
      session: abierto,
      payments: [cobro({ method: 'CUENTA_CORRIENTE' })],
    });
    expect(rows.filter(r => !r.toAccount && r.method === 'CHEQUE')).toEqual([]);
  });
});
