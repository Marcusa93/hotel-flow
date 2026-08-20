import { z } from 'zod';
import type { CashClosing, CashSession, Payment, SettlementMethod } from '@/types/hotel';
import { closingForDay, isDayClosed, sessionAt } from '@/lib/cashClosing';
import { isCurrentAccountPayment } from '@/lib/currentAccount';
import { readableDay } from '@/lib/paymentDate';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { formatLocalDate } from '@/lib/utils';

/**
 * Corregirle el medio de pago a un cobro ya registrado.
 *
 * El huésped pagó en efectivo, recepción tocó QR y el cobro quedó cargado así.
 * Hasta acá la única salida era la misma que tenía la fecha antes de existir
 * `paymentDate.ts`: marcarlo Reembolsado y volver a cargarlo. Ese camino no tiene
 * vuelta atrás, deja la reserva figurando impaga en el medio, e invita a
 * registrar un cobro de más — que es exactamente como se infla una caja sin que
 * nadie lo note.
 *
 * Es hermano de `paymentDate.ts` y comparte su criterio: la cuenta que decide si
 * el movimiento se puede hacer vive acá y no en el diálogo, porque cambiar un
 * medio de pago mueve plata entre renglones del cierre y eso hay que poder
 * probarlo sin montar una pantalla.
 *
 * Lo que NO hace es tocar la cuenta corriente, en ninguno de los dos sentidos.
 * Ver `CORRECTABLE_PAYMENT_METHODS`.
 */

/**
 * Los medios de pago entre los que se puede corregir.
 *
 * `SettlementMethod` y no `PaymentMethod`: la cuenta corriente queda afuera a
 * propósito. No es una forma de pagar, es la ausencia de pago —el cargo queda
 * anotado en la cuenta del huésped y no entra plata a ninguna caja—, así que
 * moverla no es corregir cómo se pagó: es cambiar si se pagó. Tiene su propio
 * camino, el pago de cuenta corriente, y su propio efecto en el saldo del
 * huésped; ninguno de los dos es lo que este diálogo promete.
 *
 * El efectivo va primero porque es el destino más frecuente de la corrección: el
 * error que se reportó es cobrar en efectivo y tocar QR. El resto sigue el mismo
 * orden que el desglose de gastos del cierre (`EXPENSE_METHOD_ORDER`) para que
 * las dos listas se lean igual.
 */
export const CORRECTABLE_PAYMENT_METHODS: SettlementMethod[] = [
  'CASH', 'TRANSFER', 'DEBIT', 'CREDIT', 'QR', 'CHEQUE', 'OTHER',
];

export const paymentMethodSchema = z.enum(
  CORRECTABLE_PAYMENT_METHODS as [SettlementMethod, ...SettlementMethod[]],
  { required_error: 'Elegí con qué se pagó' }
);

/**
 * - `SIN_CAMBIO`: el método elegido es el que ya tenía.
 * - `LIBRE`: se puede corregir.
 * - `BLOQUEADO`: la caja que contiene el cobro ya se cerró y se rindió.
 * - `CUENTA_CORRIENTE`: el cobro es un cargo a la cuenta del huésped. No se
 *   corrige por acá: no hubo medio de pago que corregir.
 */
export type PaymentMethodVerdict = 'SIN_CAMBIO' | 'LIBRE' | 'BLOQUEADO' | 'CUENTA_CORRIENTE';

export interface PaymentMethodChange {
  verdict: PaymentMethodVerdict;
  /** El método que tiene ahora. Puede ser CUENTA_CORRIENTE: es el caso que se rechaza. */
  originMethod: string;
  targetMethod: SettlementMethod;
  /** El día del cobro, para nombrar la caja que se tocaría. */
  day: string;
  /** La caja del cobro, si está cerrada. Vacío si no lo está. */
  closedDays: string[];
  /**
   * Si la corrección cambia el EFECTIVO del turno.
   *
   * Es el único cambio de método que mueve el "efectivo a rendir": pasar de QR a
   * efectivo agrega plata al cajón que hay que contar, y al revés la saca. El
   * resto de las combinaciones solo reordena el desglose por método.
   */
  movesCash: boolean;
  /**
   * Si la corrección cambia el CHEQUE del turno.
   *
   * El cheque es un papel que queda en el mostrador, y el cierre lo muestra
   * aparte justamente por eso (ver `constants.ts`). Entrar o salir de cheque
   * cambia lo que hay que entregar a mano, aunque no mueva un peso de efectivo.
   */
  movesCheque: boolean;
}

/**
 * Si esta corrección se puede hacer.
 *
 * Bloquea con la caja cerrada por las mismas razones que la corrección de fecha,
 * y una tercera propia:
 *
 * 1. El corte guardado al cerrar no incluye el desglose por método —no lo guarda
 *    ni el turno ni el cierre—, así que `closingDrift` no lo ve. Cambiar QR por
 *    transferencia en un día firmado reescribe el cierre impreso sin que nada
 *    levante la mano. Es más silencioso que mover la fecha, que al menos mueve
 *    totales que el detector compara.
 *
 * 2. Recepción puede cobrar pero no puede reabrir ni volver a cerrar una caja.
 *    Dejarla descuadrar un cierre firmado es dejarla romper algo que después no
 *    puede arreglar.
 *
 * 3. Cuando el cambio involucra el efectivo (`movesCash`) sí mueve un total del
 *    corte, y de los que se cuentan a mano: el efectivo a rendir de un turno ya
 *    rendido dejaría de coincidir con la plata que se contó ese día.
 *
 * Bloquea también las combinaciones que no tocan el efectivo —QR a transferencia,
 * por ejemplo— y eso es a propósito: "con la caja cerrada no se toca" se explica
 * en una frase en el mostrador, y una regla que depende de qué par de métodos son
 * se explica mal y se recuerda peor. El camino queda el mismo de siempre:
 * administración reabre, se corrige, administración vuelve a cerrar.
 */
export function resolvePaymentMethodChange({
  payment,
  targetMethod,
  closings,
  sessions = [],
}: {
  payment: Pick<Payment, 'date' | 'method'>;
  targetMethod: SettlementMethod;
  closings: CashClosing[];
  /** Los turnos de caja. Conviven con los cierres por día: son dos épocas del mismo libro. */
  sessions?: CashSession[];
}): PaymentMethodChange {
  const instant = new Date(payment.date);
  const day = formatLocalDate(instant);
  const originMethod = payment.method;

  const base = {
    originMethod,
    targetMethod,
    day,
    closedDays: [] as string[],
    // Con el veredicto en CUENTA_CORRIENTE o SIN_CAMBIO no hay corrección, así
    // que no hay nada que se mueva: los avisos de la pantalla cuelgan de estos
    // dos y tienen que quedar apagados.
    movesCash: false,
    movesCheque: false,
  };

  // Antes que nada: un cargo a cuenta corriente no tiene medio de pago que
  // corregir. Se rechaza acá y no en el diálogo para que la regla valga también
  // para cualquier otra pantalla que quiera ofrecer esto.
  if (isCurrentAccountPayment(payment)) {
    return { ...base, verdict: 'CUENTA_CORRIENTE' };
  }

  if (originMethod === targetMethod) {
    return { ...base, verdict: 'SIN_CAMBIO' };
  }

  const movesCash = (originMethod === 'CASH') !== (targetMethod === 'CASH');
  const movesCheque = (originMethod === 'CHEQUE') !== (targetMethod === 'CHEQUE');

  // Cerrado es cerrado, venga de la época que venga: los días firmados del
  // sistema viejo (cash_closings) y los turnos cerrados del nuevo
  // (cash_sessions). El turno se mira por el INSTANTE, que es el mismo corte con
  // el que el cierre decide qué entra.
  //
  // Un solo instante y no dos, al revés que la fecha: corregir el método deja el
  // cobro en la misma caja en la que está. Toca una, no dos.
  const cerrado =
    isDayClosed(closingForDay(closings, day)) || !!sessionAt(sessions, instant)?.closedAt;

  return {
    ...base,
    verdict: cerrado ? 'BLOQUEADO' : 'LIBRE',
    closedDays: cerrado ? [day] : [],
    movesCash,
    movesCheque,
  };
}

/** El nombre del método como se lee en pantalla. */
export const methodLabel = (method: string): string => PAYMENT_METHOD_LABELS[method] || method;

/**
 * Lo que queda escrito en la auditoría.
 *
 * Dice de qué método a qué método, cuánto y de qué día, porque quien lo lee
 * después está tratando de explicar por qué el desglose de una caja no coincide
 * con lo que se contó, y para eso el día y el monto importan tanto como los dos
 * métodos. El desglose por método no queda en ningún corte guardado, así que este
 * texto es el único registro de que el renglón cambió.
 */
export function describePaymentMethodChange({
  change,
  payment,
}: {
  change: Pick<PaymentMethodChange, 'originMethod' | 'targetMethod' | 'day'>;
  payment: Pick<Payment, 'amount'>;
}): string {
  return (
    `Cobro del ${readableDay(change.day)} recategorizado de ${methodLabel(change.originMethod)}` +
    ` a ${methodLabel(change.targetMethod)} — $${payment.amount.toLocaleString('es-AR')}`
  );
}
