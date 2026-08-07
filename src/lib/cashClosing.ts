import type {
  CashClosing, CashSession, CashSource, CurrentAccountPayment, Expense, OtherIncome,
  Payment, SettlementMethod,
} from '@/types/hotel';
import { isCurrentAccountPayment } from '@/lib/currentAccount';
import { formatLocalDate } from '@/lib/utils';

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
   * Todo lo que salió de la caja de la empresa, con cualquier medio de pago.
   *
   * Aparte de `cashEmpresa` porque son dos preguntas: cuánto salió de esa caja
   * —que incluye la luz pagada por transferencia— y cuánto de eso fue en
   * efectivo, que es lo único que puede confundirse con el cajón del día.
   */
  empresa: number;
  /**
   * Gastos anteriores a la columna `method`. No se suponen en efectivo: dar por
   * hecho que salieron de la caja movería el cierre de días ya cerrados.
   */
  unspecified: number;
  total: number;
}

/**
 * De qué caja se supone que salió un gasto en efectivo cuando no lo dice.
 *
 * Vive acá y no en el formulario porque tiene que ser el MISMO supuesto en los
 * tres lugares donde hace falta: el default al cargar un gasto, el fallback al
 * editarlo y la lectura de los gastos viejos. Cuando el formulario tenía el suyo
 * propio —arrancaba en EMPRESA— recepción pagaba del cajón sin tocar el
 * desplegable, el gasto quedaba imputado a la empresa, no bajaba el efectivo a
 * rendir y el cierre daba faltante.
 *
 * De los dos supuestos, este es el que no rompe: si acierta, el cierre cuadra;
 * si se equivoca, el efectivo a rendir da de menos y sobra plata, que se ve
 * enseguida y no genera un faltante.
 */
export const DEFAULT_CASH_SOURCE: CashSource = 'RECAUDACION';

/**
 * De qué caja salió un gasto, sin mirar con qué se pagó.
 *
 * Son dos preguntas distintas y hasta acá estaban pegadas: `cashSource` nació
 * para repartir los gastos en EFECTIVO entre las dos cajas, así que para todo lo
 * demás valía "ninguna". Con eso, la luz pagada por transferencia no podía
 * imputarse a la caja de la empresa —no había dónde decirlo— y es justamente el
 * caso más común de los pagos que hace administración.
 *
 * Sin `cashSource` se lee RECAUDACION, que es como se venían contando los gastos
 * antes de que existieran las dos cajas: cambiarlo movería cierres ya hechos.
 */
export function expenseSource(expense: Pick<Expense, 'cashSource'>): CashSource {
  return expense.cashSource ?? DEFAULT_CASH_SOURCE;
}

/**
 * Si este gasto le toca al cierre de recepción.
 *
 * Los de la empresa no: los paga administración de la plata acumulada del hotel,
 * no del cajón. Aparecían igual en el cierre —sin bajar el efectivo a rendir,
 * pero a la vista— y no son plata de recepción: un pago de luz de $300.000 en la
 * lista de gastos del turno solo hace dudar de un número que estaba bien.
 */
export function belongsToDailyCash(expense: Pick<Expense, 'cashSource'>): boolean {
  return expenseSource(expense) === 'RECAUDACION';
}

/**
 * De qué caja salió un gasto pagado en EFECTIVO. Null si no fue en efectivo.
 *
 * Es lo que decide qué baja el efectivo a rendir, y por eso mira el medio de
 * pago: una transferencia no saca plata del cajón, salga de la caja que salga.
 */
export function expenseCashSource(expense: Expense): CashSource | null {
  if (expense.method !== 'CASH') return null;
  return expenseSource(expense);
}

export function summarizeExpenses(expenses: Expense[]): ExpenseBreakdown {
  const byType: Record<string, number> = {};
  const byMethod: Record<string, number> = {};
  let cash = 0;
  let cashRecaudacion = 0;
  let cashEmpresa = 0;
  let empresa = 0;
  let unspecified = 0;
  let total = 0;

  for (const e of expenses) {
    byType[e.expenseType] = (byType[e.expenseType] || 0) + e.amount;
    total += e.amount;

    // De qué caja salió no depende del medio de pago: la luz por transferencia
    // sale de la empresa igual que el súper en efectivo.
    if (expenseSource(e) === 'EMPRESA') empresa += e.amount;

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

  return { byType, byMethod, cash, cashRecaudacion, cashEmpresa, empresa, unspecified, total };
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

/**
 * Qué movimientos entran en el cierre de un día.
 *
 * Hoy: los que tienen la fecha de ese día. Es lo que el hotel eligió.
 *
 * La alternativa era "todo lo que se cargó y todavía no se cerró", sin mirar la
 * fecha del movimiento. Esa versión arregla sola el desfase que reportaron —el
 * cobro que entró al cajón el 30 y se carga el 31 a la mañana queda contado el
 * 31, y el cierre del 30 da faltante—; con el criterio de acá ese cobro hay que
 * corregirlo a mano, poniéndole la fecha real en el diálogo de cobro.
 *
 * Si al usarlo ven que la caja sigue sin cuadrar, es acá donde se cambia: esta
 * función es el único lugar del sistema que decide la pertenencia.
 *
 * Y si el cobro ya quedó guardado con el día equivocado, se corrige desde el menú
 * del cobro → "Corregir fecha", que le reescribe el día conservando la hora. Ver
 * paymentDate.ts: es la vía que reemplaza al reembolsar-y-volver-a-cargar.
 */
export function belongsToClosingDay(movementDay: string, closingDay: string): boolean {
  return movementDay === closingDay;
}

/** Si el día está cerrado. Reabierto vuelve a contar como pendiente. */
export function isDayClosed(closing: CashClosing | undefined | null): boolean {
  return !!closing && !closing.reopenedAt;
}

/**
 * El cierre de un día, buscado por su día calendario local.
 *
 * Por `formatLocalDate` y no comparando Date: `closingDate` viene de una columna
 * DATE, y compararla cruda contra un 'YYYY-MM-DD' erra por el huso.
 */
export function closingForDay(
  closings: CashClosing[],
  day: string
): CashClosing | undefined {
  return closings.find(c => formatLocalDate(c.closingDate) === day);
}

/**
 * Rango de fechas de un turno de caja.
 *
 * Un turno puede abarcar más de un día (turno noche: lunes 22h → martes 10h).
 * El rango es la fecha de apertura hasta la fecha de cierre inclusive, en local.
 * Si el turno sigue abierto, `end` es hoy.
 */
export function sessionDateRange(session: {
  openedAt: Date;
  closedAt?: Date;
}): { start: string; end: string } {
  return {
    start: formatLocalDate(session.openedAt),
    end: session.closedAt ? formatLocalDate(session.closedAt) : formatLocalDate(new Date()),
  };
}

/**
 * Si un día calendario cae dentro del rango de días del turno.
 *
 * Es para las listas informativas (las deudas por día de check-in), no para la
 * plata: los movimientos de plata entran por `belongsToSessionInterval`, que
 * corta por instante. Este corte por día entero cuenta el día del cierre en los
 * dos turnos que lo comparten, y para la plata eso es rendirla dos veces.
 *
 * Strings en formato ISO ordenan lexicográficamente igual que por fecha,
 * así que la comparación directa funciona.
 */
export function belongsToSession(movementDay: string, start: string, end: string): boolean {
  return movementDay >= start && movementDay <= end;
}

/**
 * Si un movimiento de plata entra en un turno: por el INSTANTE, no por el día.
 *
 * El intervalo es [apertura, cierre): el corte es el momento exacto en que se
 * apretó "Cerrar caja". Lo cargado hasta ese instante se rinde en este turno;
 * lo cargado desde ese instante (inclusive) es del siguiente. Como la caja
 * nueva arranca en el mismo instante en que terminó la anterior (ver
 * `nextSessionStart`), ningún movimiento cae en dos turnos ni queda afuera.
 *
 * Es lo que hace posible el circuito real del hotel: cierran a las 10-11 de la
 * mañana la caja que viene de ayer. Con el corte por día calendario, la mañana
 * del cierre quedaba adentro de los dos turnos y se rendía dos veces.
 *
 * Qué instante usar lo decide quien llama: los cobros van por su fecha-hora
 * (`payment.date`, que "Corregir fecha" mantiene con hora real); los gastos,
 * ingresos varios, aportes y pagos de cuenta corriente van por `createdAt`,
 * porque su columna `date` es un día pelado sin hora.
 */
export function belongsToSessionInterval(
  instant: Date,
  session: Pick<CashSession, 'openedAt' | 'closedAt'>
): boolean {
  const t = instant.getTime();
  if (t < session.openedAt.getTime()) return false;
  return !session.closedAt || t < session.closedAt.getTime();
}

/**
 * En qué instante arranca el próximo turno: donde terminó el último cerrado.
 *
 * Sin esto, entre el cierre y la apertura siguiente queda un hueco, y lo que se
 * cargue en el medio no aparece en ningún turno. Devuelve null si no hay ningún
 * turno cerrado: la primera apertura de todas sí elige su comienzo a mano.
 */
export function nextSessionStart(sessions: CashSession[]): Date | null {
  let last: Date | null = null;
  for (const s of sessions) {
    if (s.closedAt && (!last || s.closedAt.getTime() > last.getTime())) {
      last = s.closedAt;
    }
  }
  return last;
}

/**
 * El turno al que pertenece un instante, si hay alguno.
 *
 * Si por datos viejos dos turnos se solaparan, gana el de apertura más
 * reciente, que es el mismo criterio con que la pantalla elige qué mostrar.
 */
export function sessionAt(
  sessions: CashSession[],
  instant: Date
): CashSession | undefined {
  return [...sessions]
    .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime())
    .find(s => belongsToSessionInterval(instant, s));
}

/** De dónde salió un renglón de ingreso del turno. */
export type IncomeSource = 'COBRO' | 'EXTERNO' | 'CTA_CTE';

/** Un movimiento de plata del turno, listo para mostrar. */
export interface IncomeRow {
  id: string;
  /** El instante con el que entró al turno: el mismo con que se lo filtró. */
  instant: Date;
  /** Quién o qué: el huésped y la habitación, o la descripción del ingreso. */
  detail: string;
  source: IncomeSource;
  method: string;
  amount: number;
  /** Anotado a la cuenta del huésped: se lista pero no suma. */
  toAccount: boolean;
}

/**
 * Todos los movimientos de plata de un turno, en una sola lista ordenada.
 *
 * Existe porque el hotel no podía verificar el cierre. La pantalla mostraba los
 * totales por método y nada más, así que para controlarlos había que ir a
 * Finanzas y sumar la tabla a mano — y esa tabla suma otra cosa: no muestra los
 * ingresos externos ni los cobros de cuenta corriente, y sí muestra lo anotado
 * a cuenta corriente y los cobros pendientes. Las dos sumas no daban igual y no
 * había forma de saber si la diferencia era un error o el criterio.
 *
 * Por eso la lista trae las tres fuentes juntas y trae también lo anotado a
 * cuenta corriente, marcado con `toAccount`: es el renglón que más se extraña
 * cuando los números no cierran, justamente porque no suma. Sumando los que no
 * están marcados tiene que dar el total del turno, exacto.
 *
 * Los instantes son los mismos con los que `belongsToSessionInterval` decide la
 * pertenencia —los cobros por su fecha-hora, el resto por cuándo se cargó—, así
 * que la hora que se ve en pantalla es la que puso el movimiento en este turno
 * y no en el de al lado.
 */
export function sessionIncomeRows({
  session,
  payments = [],
  otherIncome = [],
  accountPayments = [],
  paymentDetail = () => 'Cobro',
  accountPaymentDetail = () => 'Cuenta corriente',
}: {
  session: Pick<CashSession, 'openedAt' | 'closedAt'> | null | undefined;
  payments?: Payment[];
  otherIncome?: OtherIncome[];
  accountPayments?: CurrentAccountPayment[];
  /** Cómo nombrar un cobro: quién pagó y en qué habitación. Lo resuelve la pantalla. */
  paymentDetail?: (payment: Payment) => string;
  accountPaymentDetail?: (payment: CurrentAccountPayment) => string;
}): IncomeRow[] {
  if (!session) return [];
  const rows: IncomeRow[] = [];

  for (const p of payments) {
    // Los pendientes y los reembolsados no entraron: son los que inflan la suma
    // a mano de Finanzas, que los lista igual que a los cobrados.
    if (p.status !== 'PAID') continue;
    const instant = new Date(p.date);
    if (!belongsToSessionInterval(instant, session)) continue;
    rows.push({
      id: p.id,
      instant,
      detail: paymentDetail(p),
      source: 'COBRO',
      method: p.method,
      amount: p.amount,
      toAccount: isCurrentAccountPayment(p),
    });
  }

  for (const o of otherIncome) {
    const instant = new Date(o.createdAt);
    if (!belongsToSessionInterval(instant, session)) continue;
    rows.push({
      id: o.id,
      instant,
      detail: o.description,
      source: 'EXTERNO',
      method: o.method,
      amount: o.amount,
      toAccount: false,
    });
  }

  for (const p of accountPayments) {
    const instant = new Date(p.createdAt);
    if (!belongsToSessionInterval(instant, session)) continue;
    rows.push({
      id: p.id,
      instant,
      detail: accountPaymentDetail(p),
      source: 'CTA_CTE',
      method: p.method,
      amount: p.amount,
      toAccount: false,
    });
  }

  return rows.sort((a, b) => a.instant.getTime() - b.instant.getTime());
}

/** Lo que cambió entre el snapshot guardado al cerrar y los números de ahora. */
export interface SessionDrift {
  label: string;
  saved: number;
  now: number;
}

/** Lo que cambió entre lo que se cerró y lo que dan los números hoy. */
export interface ClosingDrift {
  label: string;
  closed: number;
  now: number;
}

/**
 * Si alguien tocó algo después de cerrar.
 *
 * Un cierre firmado tiene que seguir diciendo lo mismo, pero los movimientos
 * abajo pueden cambiar: se corrige un gasto viejo, se carga un cobro que
 * faltaba. Sin este contraste la pantalla mostraría números nuevos bajo el
 * cartel de "cerrado" y nadie se enteraría de que ya no son los que se rindieron.
 */
export function closingDrift(
  closing: CashClosing,
  now: { cashIncome: number; cashExpenses: number; cashToDeposit: number; totalIncome: number; totalExpenses: number }
): ClosingDrift[] {
  const rows: ClosingDrift[] = [
    { label: 'Efectivo cobrado', closed: closing.cashIncome, now: now.cashIncome },
    { label: 'Gastos en efectivo', closed: closing.cashExpenses, now: now.cashExpenses },
    { label: 'Efectivo a rendir', closed: closing.cashToDeposit, now: now.cashToDeposit },
    { label: 'Total ingresos', closed: closing.totalIncome, now: now.totalIncome },
    { label: 'Total gastos', closed: closing.totalExpenses, now: now.totalExpenses },
  ];
  return rows.filter(r => Math.round(r.closed) !== Math.round(r.now));
}

/** Los métodos que aparecen en el desglose de gastos, en orden fijo. */
export const EXPENSE_METHOD_ORDER: SettlementMethod[] = [
  'CASH', 'TRANSFER', 'DEBIT', 'CREDIT', 'QR', 'OTHER',
];
