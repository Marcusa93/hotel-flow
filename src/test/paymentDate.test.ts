import { describe, it, expect } from 'vitest';
import {
  PAYMENT_DATE_MIN_DAYS_BACK,
  describePaymentDateMove,
  earliestPaymentDay,
  latestPaymentDay,
  paymentDaySchema,
  pickedPaymentDate,
  readableDay,
  resolvePaymentDateMove,
  withLocalDay,
} from '@/lib/paymentDate';
import { belongsToSessionInterval } from '@/lib/cashClosing';
import { formatLocalDate } from '@/lib/utils';
import type { CashClosing, CashSession, Payment } from '@/types/hotel';

// El caso del hotel: recepción cobra a la mañana algo que corresponde al cajón de
// ayer, el diálogo de cobro viene con la fecha de hoy y el cobro cae en la caja
// equivocada. Hasta ahora la única salida era marcarlo Reembolsado y volver a
// cargarlo, que no tiene vuelta atrás y deja la reserva figurando impaga en el
// medio. Esto es la corrección que la reemplaza.

const cobro = (over: Partial<Payment> = {}): Payment => ({
  id: 'p-1',
  bookingId: 'b-1',
  date: new Date(2025, 7, 4, 9, 30),
  method: 'CASH',
  status: 'PAID',
  amount: 85_000,
  ...over,
});

const cierre = (over: Partial<CashClosing> = {}): CashClosing => ({
  id: 'c-1',
  closingDate: new Date(2025, 7, 3),
  cashIncome: 100_000,
  cashFloat: 20_000,
  cashExpenses: 5_000,
  cashToDeposit: 75_000,
  totalIncome: 120_000,
  totalExpenses: 8_000,
  closedAt: new Date(2025, 7, 4, 9, 30),
  createdAt: new Date(2025, 7, 4, 9, 30),
  ...over,
});

const diaAtras = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatLocalDate(d);
};

describe('la fecha corregida del cobro', () => {
  it('lo manda al día que se eligió', () => {
    const movido = withLocalDay(new Date(2025, 7, 4, 9, 30), '2025-08-03');
    expect(formatLocalDate(movido)).toBe('2025-08-03');
  });

  it('conserva la hora en que entró la plata', () => {
    const movido = withLocalDay(new Date(2025, 7, 4, 9, 30, 15, 250), '2025-08-03');
    expect(movido.getHours()).toBe(9);
    expect(movido.getMinutes()).toBe(30);
    expect(movido.getSeconds()).toBe(15);
    expect(movido.getMilliseconds()).toBe(250);
  });

  it('sigue siendo el mismo día después de ir y volver de la base', () => {
    // El viaje real: el hook escribe toISOString(), la columna es TIMESTAMPTZ,
    // mapPayment lo lee con new Date() y el cierre le pregunta el día local. Si
    // el día se corriera en alguno de esos pasos, el cobro caería justo en la
    // caja que se estaba tratando de corregir.
    const movido = withLocalDay(new Date(2025, 7, 4, 9, 30), '2025-08-03');
    const vuelto = new Date(movido.toISOString());
    expect(formatLocalDate(vuelto)).toBe('2025-08-03');
  });

  it('no se corre en ningún mes del año', () => {
    for (let mes = 0; mes < 12; mes++) {
      const dia = formatLocalDate(new Date(2025, mes, 1));
      const movido = withLocalDay(new Date(2025, mes, 15, 18, 0), dia);
      expect(formatLocalDate(movido)).toBe(dia);
      expect(formatLocalDate(new Date(movido.toISOString()))).toBe(dia);
    }
  });

  it('cruza el borde de mes y el de año sin marearse', () => {
    expect(formatLocalDate(withLocalDay(new Date(2025, 8, 1, 8, 0), '2025-08-31'))).toBe('2025-08-31');
    expect(formatLocalDate(withLocalDay(new Date(2025, 0, 1, 8, 0), '2024-12-31'))).toBe('2024-12-31');
  });

  it('no deja el cobro fechado en el futuro', () => {
    // Mover a hoy un cobro de las 23:40 daría un instante que todavía no pasó, y
    // el gráfico de ingresos corta por instante: el cobro desaparecería de ahí
    // sin dar ningún error hasta que el reloj lo alcance.
    const ahora = new Date(2025, 7, 4, 9, 0);
    const movido = withLocalDay(new Date(2025, 7, 3, 23, 40), formatLocalDate(ahora), ahora);

    expect(movido.getTime()).toBeLessThanOrEqual(ahora.getTime());
    expect(formatLocalDate(movido)).toBe(formatLocalDate(ahora));
  });

  it('deja la hora quieta cuando el día elegido ya pasó', () => {
    const ahora = new Date(2025, 7, 4, 9, 0);
    const movido = withLocalDay(new Date(2025, 7, 4, 23, 40), '2025-08-03', ahora);
    expect(movido.getHours()).toBe(23);
    expect(movido.getMinutes()).toBe(40);
  });
});

describe('el día elegido en el calendario del cobro', () => {
  // El calendario entrega el día a medianoche. Antes se guardaba así, y desde que
  // el turno corta por instante esa medianoche decidía en qué caja caía el cobro.
  const medianoche = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  it('elegir hoy deja el cobro en este momento, no a las 00:00', () => {
    const ahora = new Date(2025, 7, 4, 15, 20);
    const elegido = pickedPaymentDate(medianoche(ahora), ahora, ahora);

    expect(elegido.getHours()).toBe(15);
    expect(elegido.getMinutes()).toBe(20);
  });

  it('el cobro de la tarde entra en el turno que se abrió a la mañana', () => {
    // El circuito del hotel: cierran a las 11, abren de nuevo ahí mismo, cobran
    // a las 15 y tocan el calendario para confirmar "hoy". Con medianoche ese
    // cobro caía antes de la apertura: la plata quedaba en el cajón sin figurar
    // en ningún cierre.
    const ahora = new Date(2025, 7, 4, 15, 20);
    const turno: CashSession = {
      id: 's-1',
      openedAt: new Date(2025, 7, 4, 11, 0),
      openingAmount: 10_000,
      createdAt: new Date(2025, 7, 4, 11, 0),
    };

    const elegido = pickedPaymentDate(medianoche(ahora), ahora, ahora);

    expect(belongsToSessionInterval(elegido, turno)).toBe(true);
    expect(belongsToSessionInterval(medianoche(ahora), turno)).toBe(false);
  });

  it('elegir ayer conserva la hora: sigue siendo una corrección, no medianoche', () => {
    const ahora = new Date(2025, 7, 4, 15, 20);
    const elegido = pickedPaymentDate(new Date(2025, 7, 3), ahora, ahora);

    expect(formatLocalDate(elegido)).toBe('2025-08-03');
    expect(elegido.getHours()).toBe(15);
  });

  it('cerrar el calendario sin elegir nada no toca la fecha', () => {
    const actual = new Date(2025, 7, 4, 15, 20);
    expect(pickedPaymentDate(undefined, actual).getTime()).toBe(actual.getTime());
  });

  it('no deja el cobro en el futuro', () => {
    const ahora = new Date(2025, 7, 4, 9, 0);
    const elegido = pickedPaymentDate(new Date(2025, 7, 5), ahora, ahora);
    expect(elegido.getTime()).toBeLessThanOrEqual(ahora.getTime());
  });
});

describe('qué día se puede elegir', () => {
  it('acepta hoy y ayer', () => {
    expect(paymentDaySchema.safeParse(diaAtras(0)).success).toBe(true);
    expect(paymentDaySchema.safeParse(diaAtras(1)).success).toBe(true);
  });

  it('rechaza mañana', () => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    expect(paymentDaySchema.safeParse(formatLocalDate(manana)).success).toBe(false);
  });

  it('rechaza el año mal tecleado', () => {
    // 2025-08-03 en vez de 2026-08-03 se ve casi igual en el casillero y manda el
    // cobro a una caja de hace un año. El piso de días es la única defensa.
    expect(paymentDaySchema.safeParse(diaAtras(PAYMENT_DATE_MIN_DAYS_BACK + 1)).success).toBe(false);
  });

  it('acepta el día más viejo permitido y no uno más', () => {
    expect(paymentDaySchema.safeParse(earliestPaymentDay()).success).toBe(true);
    expect(paymentDaySchema.safeParse(latestPaymentDay()).success).toBe(true);
  });

  it('rechaza cualquier cosa que no sea un día', () => {
    expect(paymentDaySchema.safeParse('').success).toBe(false);
    expect(paymentDaySchema.safeParse('03/08/2025').success).toBe(false);
    expect(paymentDaySchema.safeParse('2025-8-3').success).toBe(false);
  });
});

describe('mover un cobro de una caja a otra', () => {
  it('elegir el mismo día no es un movimiento', () => {
    const move = resolvePaymentDateMove({ payment: cobro(), targetDay: '2025-08-04', closings: [] });
    expect(move.verdict).toBe('SIN_CAMBIO');
  });

  it('con las dos cajas abiertas se puede', () => {
    const move = resolvePaymentDateMove({ payment: cobro(), targetDay: '2025-08-03', closings: [] });
    expect(move.verdict).toBe('LIBRE');
    expect(move.originDay).toBe('2025-08-04');
    expect(move.closedDays).toEqual([]);
  });

  it('no se le puede sacar un cobro a un día ya rendido', () => {
    const move = resolvePaymentDateMove({
      payment: cobro(),
      targetDay: '2025-08-03',
      closings: [cierre({ closingDate: new Date(2025, 7, 4) })],
    });
    expect(move.verdict).toBe('BLOQUEADO');
    expect(move.closedDays).toEqual(['2025-08-04']);
  });

  it('tampoco se le puede meter un cobro a un día ya rendido', () => {
    const move = resolvePaymentDateMove({
      payment: cobro(),
      targetDay: '2025-08-03',
      closings: [cierre()],
    });
    expect(move.verdict).toBe('BLOQUEADO');
    expect(move.closedDays).toEqual(['2025-08-03']);
  });

  it('con los dos días cerrados nombra a los dos', () => {
    const move = resolvePaymentDateMove({
      payment: cobro(),
      targetDay: '2025-08-03',
      closings: [cierre(), cierre({ id: 'c-2', closingDate: new Date(2025, 7, 4) })],
    });
    expect(move.closedDays).toEqual(['2025-08-04', '2025-08-03']);
  });

  it('un día reabierto vuelve a estar disponible', () => {
    // Es el caso que se olvida siempre: reabrir es justamente el permiso para
    // corregir, así que un día reabierto no puede seguir bloqueando.
    const move = resolvePaymentDateMove({
      payment: cobro(),
      targetDay: '2025-08-03',
      closings: [cierre({ reopenedAt: new Date(2025, 7, 5) })],
    });
    expect(move.verdict).toBe('LIBRE');
  });

  it('el cargo a cuenta corriente se bloquea igual', () => {
    // No entra a ninguna caja, pero mueve el renglón "A cuenta corriente" del
    // cierre impreso, y ese renglón no lo mira el detector de cambios: es el
    // movimiento más silencioso que hay.
    const move = resolvePaymentDateMove({
      payment: cobro({ method: 'CUENTA_CORRIENTE' }),
      targetDay: '2025-08-03',
      closings: [cierre()],
    });
    expect(move.verdict).toBe('BLOQUEADO');
  });

  it('avisa cuando el cobro cambia de mes', () => {
    expect(
      resolvePaymentDateMove({
        payment: cobro({ date: new Date(2025, 8, 1, 8, 0) }),
        targetDay: '2025-08-31',
        closings: [],
      }).crossesMonth
    ).toBe(true);

    expect(
      resolvePaymentDateMove({ payment: cobro(), targetDay: '2025-08-03', closings: [] }).crossesMonth
    ).toBe(false);
  });
});

describe('mover un cobro con turnos de caja de por medio', () => {
  // El sistema nuevo: la caja se abre y se cierra a mano, y qué entra en cada
  // una lo decide el instante, no el día. La guarda es la misma que con los
  // días firmados: un turno cerrado es plata rendida y no se toca.

  const turno = (over: Partial<CashSession> = {}): CashSession => ({
    id: 't-1',
    openedAt: new Date(2025, 7, 3, 0, 0),
    openingAmount: 0,
    createdAt: new Date(2025, 7, 3, 0, 0),
    ...over,
  });

  it('no se le puede sacar un cobro a un turno cerrado', () => {
    // El cobro (4/8 09:30) cae dentro del turno cerrado [3/8 00:00, 4/8 10:30).
    const move = resolvePaymentDateMove({
      payment: cobro(),
      targetDay: '2025-08-05',
      closings: [],
      sessions: [turno({ closedAt: new Date(2025, 7, 4, 10, 30) })],
    });
    expect(move.verdict).toBe('BLOQUEADO');
    expect(move.closedDays).toEqual(['2025-08-04']);
  });

  it('tampoco se le puede meter un cobro a un turno cerrado', () => {
    // Turno cerrado que abarca el 2/8 entero; el cobro del 4/8 está libre pero
    // el destino con su hora conservada (2/8 09:30) cae en plata rendida.
    const move = resolvePaymentDateMove({
      payment: cobro(),
      targetDay: '2025-08-02',
      closings: [],
      sessions: [turno({ openedAt: new Date(2025, 7, 2, 0, 0), closedAt: new Date(2025, 7, 3, 10, 0) })],
    });
    expect(move.verdict).toBe('BLOQUEADO');
    expect(move.closedDays).toEqual(['2025-08-02']);
  });

  it('el corte del turno es por hora: la tarde de un día con la mañana rendida queda libre', () => {
    // El turno cerrado se llevó la mañana del 4/8 hasta las 10:30. Un cobro de
    // las 15:00 movido a ese día cae después del corte: es del turno siguiente,
    // que sigue abierto, y por eso se puede.
    const sessions = [
      turno({ openedAt: new Date(2025, 7, 3, 0, 0), closedAt: new Date(2025, 7, 4, 10, 30) }),
      turno({ id: 't-2', openedAt: new Date(2025, 7, 4, 10, 30) }),
    ];
    const mañana = resolvePaymentDateMove({
      payment: cobro({ date: new Date(2025, 7, 5, 9, 0) }),
      targetDay: '2025-08-04',
      closings: [],
      sessions,
    });
    const tarde = resolvePaymentDateMove({
      payment: cobro({ date: new Date(2025, 7, 5, 15, 0) }),
      targetDay: '2025-08-04',
      closings: [],
      sessions,
    });
    expect(mañana.verdict).toBe('BLOQUEADO');
    expect(tarde.verdict).toBe('LIBRE');
  });

  it('el turno abierto no bloquea nada', () => {
    const move = resolvePaymentDateMove({
      payment: cobro(),
      targetDay: '2025-08-03',
      closings: [],
      sessions: [turno()],
    });
    expect(move.verdict).toBe('LIBRE');
  });
});

describe('el rastro que queda', () => {
  it('dice de qué día a qué día, con año, monto y método', () => {
    const move = resolvePaymentDateMove({ payment: cobro(), targetDay: '2025-08-03', closings: [] });
    const texto = describePaymentDateMove({ move, payment: cobro() });

    expect(texto).toBe('Cobro reimputado del 04/08/2025 al 03/08/2025 — $85.000 (Efectivo)');
  });

  it('el día siempre se lee con año', () => {
    // Sin el año, el error de año se ve idéntico a la corrección correcta.
    expect(readableDay('2025-08-03')).toBe('03/08/2025');
  });
});
