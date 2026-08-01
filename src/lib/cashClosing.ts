import type { CashSource, Expense, SettlementMethod } from '@/types/hotel';

/**
 * Las cuentas del cierre de caja.
 *
 * Puro a propósito: acá se decide cuánta plata hay que rendir, y eso se prueba
 * sin base de por medio.
 */

/** Cómo quedaron los gastos de un día, mirados por rubro y por cuenta. */
export interface ExpenseBreakdown {
  /** Total por rubro: en qué se gastó. */
  byType: Record<string, number>;
  /** Total por medio de pago: de qué cuenta salió la plata. */
  byMethod: Record<string, number>;
  /** Todo lo pagado en efectivo, de cualquiera de las dos cajas. */
  cash: number;
  /** Efectivo salido de la recaudación. Es lo único que baja el efectivo a rendir. */
  cashRecaudacion: number;
  /** Efectivo salido de la plata que puso la empresa. No toca lo que se rinde. */
  cashEmpresa: number;
  /**
   * Gastos anteriores a la columna `method`. No se suponen en efectivo: dar por
   * hecho que salieron de la caja movería el cierre de días ya cerrados.
   */
  unspecified: number;
  total: number;
}

/**
 * De qué caja salió un gasto en efectivo.
 *
 * Sin `cashSource` se lee RECAUDACION: es como se venían contando los gastos en
 * efectivo antes de que existieran las dos cajas, y cambiarlo movería cierres ya
 * hechos. Los que no son en efectivo no salen de ninguna caja.
 */
export function expenseCashSource(expense: Expense): CashSource | null {
  if (expense.method !== 'CASH') return null;
  return expense.cashSource ?? 'RECAUDACION';
}

export function summarizeExpenses(expenses: Expense[]): ExpenseBreakdown {
  const byType: Record<string, number> = {};
  const byMethod: Record<string, number> = {};
  let cash = 0;
  let cashRecaudacion = 0;
  let cashEmpresa = 0;
  let unspecified = 0;
  let total = 0;

  for (const e of expenses) {
    byType[e.expenseType] = (byType[e.expenseType] || 0) + e.amount;
    total += e.amount;

    if (!e.method) {
      unspecified += e.amount;
      continue;
    }

    byMethod[e.method] = (byMethod[e.method] || 0) + e.amount;

    const source = expenseCashSource(e);
    if (source === 'EMPRESA') {
      cash += e.amount;
      cashEmpresa += e.amount;
    } else if (source === 'RECAUDACION') {
      cash += e.amount;
      cashRecaudacion += e.amount;
    }
  }

  return { byType, byMethod, cash, cashRecaudacion, cashEmpresa, unspecified, total };
}

/**
 * Cuánta plata de la empresa queda en la caja.
 *
 * Se deriva de los movimientos y no se guarda un saldo, por la misma razón que
 * en la cuenta corriente del huésped: un total materializado se desincroniza en
 * cuanto alguien corrige un gasto viejo.
 *
 * Se calcula sobre TODO el historial y no sobre un día: la plata que la empresa
 * puso el lunes sigue estando el miércoles.
 */
export function companyCashBalance(
  contributions: { amount: number }[],
  expenses: Expense[]
): number {
  const puesto = contributions.reduce((sum, c) => sum + c.amount, 0);
  const gastado = expenses.reduce(
    (sum, e) => (expenseCashSource(e) === 'EMPRESA' ? sum + e.amount : sum),
    0
  );
  return puesto - gastado;
}

export interface CashDrawerInput {
  /** Efectivo cobrado en el día. */
  cashIncome: number;
  /** El fondo fijo que queda en la caja para arrancar el día siguiente. */
  cashFloat: number;
  /**
   * Gastos del día pagados con la recaudación. Los pagados con la plata de la
   * empresa NO van acá: esa caja es otra y rendirla no corresponde.
   */
  cashExpenses: number;
}

/**
 * Cuánta plata hay que sacar del cajón y rendir.
 *
 * Los gastos en efectivo se restan porque esa plata ya no está: si se le pagó al
 * panadero de la caja, no se puede rendir dos veces. Antes no se descontaban y
 * el número daba de más todos los días que se pagara algo en efectivo.
 *
 * Puede dar negativo, y eso también es información: significa que se gastó más
 * de lo que entró y hubo que poner del fondo fijo.
 */
export function cashToDeposit({ cashIncome, cashFloat, cashExpenses }: CashDrawerInput): number {
  return cashIncome - cashFloat - cashExpenses;
}

/**
 * El día que toca cerrar: ayer.
 *
 * El hotel se sienta a la mañana a cerrar la caja del día anterior, así que
 * abrir la pantalla en "hoy" los obligaba a corregir la fecha todas las veces.
 */
export function defaultClosingDay(today = new Date()): Date {
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday;
}

/** El fondo fijo de un día: el suyo si lo tiene, y si no el predeterminado. */
export function resolveCashFloat(
  dayFloat: number | null | undefined,
  defaultFloat: number | null | undefined
): number {
  // ?? y no ||: un fondo fijo de 0 puesto a propósito es un dato, no un vacío.
  return dayFloat ?? defaultFloat ?? 0;
}

/** Los métodos que aparecen en el desglose de gastos, en orden fijo. */
export const EXPENSE_METHOD_ORDER: SettlementMethod[] = [
  'CASH', 'TRANSFER', 'DEBIT', 'CREDIT', 'QR', 'OTHER',
];
