import { describe, it, expect } from 'vitest';
import {
  adjustmentTotals,
  groupAdjustments,
  sessionIncomeRows,
} from '@/lib/cashClosing';
import type { CashAdjustment, CashSession } from '@/types/hotel';

// El admin necesita que el cierre diga lo que hay de verdad en cada caja: el
// huésped terminó pagando por transferencia lo que estaba cargado como
// efectivo, o administración sacó plata del cajón para un sueldo. El ajuste es
// un renglón con signo; el cambio de método son dos renglones atados que
// netean cero.

const ajuste = (over: Partial<CashAdjustment> = {}): CashAdjustment => ({
  id: 'a-1',
  method: 'CASH',
  amount: -50_000,
  reason: 'retiro para sueldo',
  createdAt: new Date(2026, 8, 1, 10, 0),
  ...over,
});

describe('adjustmentTotals', () => {
  it('un cambio de método mueve los renglones y deja el total en cero', () => {
    const { byMethod, total } = adjustmentTotals([
      ajuste({ id: 'a', method: 'CASH', amount: -50_000, transferGroup: 'g1' }),
      ajuste({ id: 'b', method: 'TRANSFER', amount: 50_000, transferGroup: 'g1' }),
    ]);
    expect(byMethod).toEqual({ CASH: -50_000, TRANSFER: 50_000 });
    expect(total).toBe(0);
  });

  it('un retiro baja el método y el total juntos', () => {
    const { byMethod, total } = adjustmentTotals([
      ajuste({ amount: -80_000 }),
    ]);
    expect(byMethod).toEqual({ CASH: -80_000 });
    expect(total).toBe(-80_000);
  });

  it('sin ajustes no mueve nada', () => {
    expect(adjustmentTotals([])).toEqual({ byMethod: {}, total: 0 });
  });
});

describe('groupAdjustments', () => {
  it('junta las dos patas de un cambio en un solo hecho, de origen a destino', () => {
    const groups = groupAdjustments([
      ajuste({ id: 'entra', method: 'TRANSFER', amount: 50_000, transferGroup: 'g1' }),
      ajuste({ id: 'sale', method: 'CASH', amount: -50_000, transferGroup: 'g1' }),
    ]);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.kind).toBe('CAMBIO');
    if (g.kind === 'CAMBIO') {
      expect(g.fromMethod).toBe('CASH');
      expect(g.toMethod).toBe('TRANSFER');
      expect(g.amount).toBe(50_000);
      expect(g.ids).toContain('sale');
      expect(g.ids).toContain('entra');
    }
  });

  it('un retiro suelto queda como ajuste con su signo', () => {
    const groups = groupAdjustments([ajuste({ amount: -80_000 })]);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.kind).toBe('AJUSTE');
    if (g.kind === 'AJUSTE') {
      expect(g.method).toBe('CASH');
      expect(g.amount).toBe(-80_000);
    }
  });

  it('una pata huérfana se muestra como ajuste suelto, no como cambio inventado', () => {
    // Media transferencia —borrada a mano en la base, o un insert a medias— no
    // puede dibujarse como un cambio completo: mostraría plata llegando a un
    // método del que nunca salió su contraparte.
    const groups = groupAdjustments([
      ajuste({ id: 'solo', method: 'CASH', amount: -50_000, transferGroup: 'g1' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('AJUSTE');
  });

  it('ordena por el instante de carga, cambios y sueltos mezclados', () => {
    const groups = groupAdjustments([
      ajuste({ id: 'tarde', amount: -10_000, createdAt: new Date(2026, 8, 1, 15, 0) }),
      ajuste({ id: 's1', method: 'CASH', amount: -5_000, transferGroup: 'g1', createdAt: new Date(2026, 8, 1, 9, 0) }),
      ajuste({ id: 's2', method: 'QR', amount: 5_000, transferGroup: 'g1', createdAt: new Date(2026, 8, 1, 9, 0) }),
    ]);
    expect(groups.map((g) => g.kind)).toEqual(['CAMBIO', 'AJUSTE']);
  });
});

describe('sessionIncomeRows con ajustes', () => {
  const session: Pick<CashSession, 'openedAt' | 'closedAt'> = {
    openedAt: new Date(2026, 8, 1, 8, 0),
    closedAt: new Date(2026, 8, 2, 10, 0),
  };

  it('los ajustes del turno entran al detalle con su signo, los de otro turno no', () => {
    const rows = sessionIncomeRows({
      session,
      adjustments: [
        ajuste({ id: 'del-turno', amount: -50_000, createdAt: new Date(2026, 8, 1, 12, 0) }),
        ajuste({ id: 'de-otro', amount: -99_000, createdAt: new Date(2026, 8, 2, 11, 0) }),
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('del-turno');
    expect(rows[0].source).toBe('AJUSTE');
    expect(rows[0].amount).toBe(-50_000);
    expect(rows[0].detail).toBe('retiro para sueldo');
  });

  it('el detalle sigue sumando igual que el total: la promesa de la pantalla', () => {
    // La tarjeta de detalle dice "sumando estos renglones tiene que dar el
    // total de arriba". Con el total incluyendo ajustes, el detalle también.
    const adjustments = [
      ajuste({ id: 'sale', method: 'CASH', amount: -50_000, transferGroup: 'g1', createdAt: new Date(2026, 8, 1, 12, 0) }),
      ajuste({ id: 'entra', method: 'TRANSFER', amount: 50_000, transferGroup: 'g1', createdAt: new Date(2026, 8, 1, 12, 0) }),
      ajuste({ id: 'retiro', method: 'CASH', amount: -30_000, createdAt: new Date(2026, 8, 1, 13, 0) }),
    ];
    const rows = sessionIncomeRows({ session, adjustments });
    const sumaDetalle = rows.filter((r) => !r.toAccount).reduce((s, r) => s + r.amount, 0);
    const { total } = adjustmentTotals(adjustments);
    expect(sumaDetalle).toBe(total);
    expect(sumaDetalle).toBe(-30_000);
  });
});
