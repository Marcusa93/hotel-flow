import { z } from 'zod';
import type { CashClosing, CashSession, Payment } from '@/types/hotel';
import { closingForDay, isDayClosed, sessionAt } from '@/lib/cashClosing';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { formatLocalDate, parseLocalDate } from '@/lib/utils';

/**
 * Corregirle el día a un cobro ya registrado.
 *
 * Un cobro cae en la caja del día que dice su fecha y de ningún otro
 * (`belongsToClosingDay`). Recepción cobra a la mañana algo que corresponde al
 * cajón de ayer, el diálogo de cobro viene con la fecha de hoy, y el cobro
 * termina en la caja equivocada. Hasta acá la única salida era marcarlo como
 * Reembolsado y volver a cargarlo: dos pasos, sin vuelta atrás en la UI —el menú
 * no ofrece Reembolsado → Pagado—, y entre uno y otro la reserva figura impaga,
 * porque el saldo solo descuenta los PAID (`bookingAccount.ts`). Es la maniobra
 * que este archivo viene a reemplazar.
 *
 * Todo lo que decide vive acá y no en el diálogo: mover plata de una caja a otra
 * es la clase de cuenta que hay que poder probar sin montar una pantalla.
 */

/**
 * Cuántos días para atrás se puede llevar un cobro.
 *
 * El límite no es una regla del hotel: es la defensa contra el año mal tecleado.
 * Un 2025-08-03 en vez de 2026-08-03 se ve casi idéntico en el casillero y manda
 * el cobro a una caja de hace un año, cerrada hace rato y que nadie va a volver
 * a mirar. Dos meses cubre de sobra el olvido real —cargar hoy lo de ayer— y
 * deja afuera el error de tipeo.
 */
export const PAYMENT_DATE_MIN_DAYS_BACK = 60;

/** El día más viejo al que se puede llevar un cobro. */
export const earliestPaymentDay = (now: Date = new Date()): string => {
  const d = new Date(now);
  // Restando días y no milisegundos: el calendario no siempre tiene días de 24h.
  d.setDate(d.getDate() - PAYMENT_DATE_MIN_DAYS_BACK);
  return formatLocalDate(d);
};

/** El día más nuevo: hoy. Un cobro con fecha futura no existe. */
export const latestPaymentDay = (now: Date = new Date()): string => formatLocalDate(now);

/**
 * Le cambia el día a un cobro conservando la hora en que entró la plata.
 *
 * La hora se conserva por dos razones. La primera es que se ve: el historial de
 * la reserva imprime "d MMM yyyy, HH:mm", y aplastar todo a medianoche borra el
 * dato con el que se discute a qué hora se cobró. La segunda es que el gráfico
 * de ingresos corta con `.lte('date', ahora)`: un cobro con hora futura no da
 * error, simplemente desaparece del gráfico hasta que el reloj lo alcance.
 *
 * De ahí el recorte: mover a hoy un cobro de las 23:40 daría un instante que
 * todavía no pasó, así que en ese caso —y solo en ese— la hora queda en la de
 * ahora. Es el único momento en que la hora original se pierde, y se pierde
 * porque era imposible.
 *
 * El día entra por `parseLocalDate` y nunca por `new Date('2026-08-03')` pelado:
 * ese es medianoche UTC, o sea las 21 del día anterior acá, y el cobro se iría
 * justo al día que se estaba tratando de corregir.
 */
export function withLocalDay(instant: Date, day: string, now: Date = new Date()): Date {
  const target = parseLocalDate(day);
  const moved = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
    instant.getHours(),
    instant.getMinutes(),
    instant.getSeconds(),
    instant.getMilliseconds()
  );
  return moved.getTime() > now.getTime() ? new Date(now.getTime()) : moved;
}

/**
 * La fecha que queda cuando se elige un día en el calendario del cobro.
 *
 * El calendario devuelve el día a medianoche. Guardar eso tal cual le pone al
 * cobro una hora que no es la que entró la plata, y desde que el turno de caja
 * corta por instante (`belongsToSessionInterval`) esa hora inventada decide en
 * qué caja cae: recepción cobra a las 15, toca el calendario para confirmar
 * "hoy", y el cobro queda a las 00:00 — antes de la apertura del turno, que
 * arrancó a las 11 cuando se cerró el de la mañana. La plata está en el cajón y
 * no figura en ningún cierre.
 *
 * Por eso el día se cambia conservando la hora: es el mismo criterio con el que
 * "Corregir fecha" mueve un cobro ya registrado. Elegir el día de hoy tiene que
 * devolver este momento, no el principio del día.
 */
export function pickedPaymentDate(
  picked: Date | undefined,
  current: Date,
  now: Date = new Date()
): Date {
  if (!picked) return current;
  return withLocalDay(current, formatLocalDate(picked), now);
}

/**
 * Qué día se puede elegir.
 *
 * Compara días y no instantes, que es la misma moneda con la que el cierre
 * decide qué entra en cada caja. Comparar timestamps obliga a inventar una
 * tolerancia para "hoy" y esa tolerancia siempre termina dejando pasar algo.
 */
export const paymentDaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Elegí un día')
  .refine(day => day <= latestPaymentDay(), 'La fecha no puede ser futura')
  .refine(
    day => day >= earliestPaymentDay(),
    `No se puede mover un cobro más de ${PAYMENT_DATE_MIN_DAYS_BACK} días atrás`
  );

export type PaymentDateVerdict = 'SIN_CAMBIO' | 'LIBRE' | 'BLOQUEADO';

export interface PaymentDateMove {
  verdict: PaymentDateVerdict;
  /** El día del que sale el cobro */
  originDay: string;
  /** El día al que va */
  targetDay: string;
  /** Los días con cierre firmado que la corrección tocaría. Vacío si no hay. */
  closedDays: string[];
  /** Si el cobro cambia de mes, y con él dos balances mensuales */
  crossesMonth: boolean;
}

/**
 * Si esta corrección se puede hacer.
 *
 * Bloquea en cuanto alguno de los dos días —del que sale o al que va— tenga un
 * cierre firmado. La alternativa era dejar pasar y confiar en `closingDrift`,
 * pero ese detector es demasiado grueso para apoyarle encima un movimiento de
 * plata: compara cinco totales, así que dos correcciones opuestas del mismo
 * monto se cancelan y no levanta nada, un cobro a cuenta corriente no figura en
 * ninguno de los cinco, y encima deja de correr si el día quedó reabierto.
 *
 * Y hay una razón de permisos: recepción puede cobrar pero no puede cerrar ni
 * reabrir una caja. Dejarla descuadrar un cierre firmado es dejarla romper algo
 * que después no puede arreglar. El camino queda: administración reabre el día,
 * se corrige, administración lo vuelve a cerrar — y la reapertura deja su propio
 * rastro.
 *
 * No mira el método a propósito. Un cobro a cuenta corriente no entra a ninguna
 * caja, pero sí mueve el renglón "A cuenta corriente (no ingresó)" del cierre
 * impreso, y ese renglón no está en `closingDrift`: es el movimiento más
 * silencioso que existe, o sea el que menos se puede permitir.
 */
export function resolvePaymentDateMove({
  payment,
  targetDay,
  closings,
  sessions = [],
  now = new Date(),
}: {
  payment: Pick<Payment, 'date'>;
  targetDay: string;
  closings: CashClosing[];
  /** Los turnos de caja. Conviven con los cierres por día: son dos épocas del mismo libro. */
  sessions?: CashSession[];
  now?: Date;
}): PaymentDateMove {
  const origin = new Date(payment.date);
  const originDay = formatLocalDate(origin);

  if (originDay === targetDay) {
    return { verdict: 'SIN_CAMBIO', originDay, targetDay, closedDays: [], crossesMonth: false };
  }

  // Cerrado es cerrado, venga de la época que venga: los días firmados del
  // sistema viejo (cash_closings) y los turnos cerrados del nuevo
  // (cash_sessions). El turno se mira por el INSTANTE —el mismo corte con que
  // el cierre decide qué entra—, así que el instante que importa del destino es
  // el que el cobro tendría después de moverse, con su hora conservada.
  const firmado = (day: string, instant: Date): boolean =>
    isDayClosed(closingForDay(closings, day)) || !!sessionAt(sessions, instant)?.closedAt;

  const closedDays = [
    ...(firmado(originDay, origin) ? [originDay] : []),
    ...(firmado(targetDay, withLocalDay(origin, targetDay, now)) ? [targetDay] : []),
  ];

  return {
    verdict: closedDays.length > 0 ? 'BLOQUEADO' : 'LIBRE',
    originDay,
    targetDay,
    closedDays,
    crossesMonth: originDay.slice(0, 7) !== targetDay.slice(0, 7),
  };
}

/** 2026-08-04 → 04/08/2026. Siempre con año: es lo que delata el año mal tecleado. */
export const readableDay = (day: string): string => day.split('-').reverse().join('/');

/**
 * Lo que queda escrito en la auditoría.
 *
 * Dice de qué día a qué día, cuánto y por qué método, porque quien lo lee
 * después está tratando de explicar por qué una caja dio distinto — y para eso
 * el monto y el método importan tanto como las fechas.
 */
export function describePaymentDateMove({
  move,
  payment,
}: {
  move: Pick<PaymentDateMove, 'originDay' | 'targetDay'>;
  payment: Pick<Payment, 'amount' | 'method'>;
}): string {
  const metodo = PAYMENT_METHOD_LABELS[payment.method] || payment.method;
  return (
    `Cobro reimputado del ${readableDay(move.originDay)} al ${readableDay(move.targetDay)}` +
    ` — $${payment.amount.toLocaleString('es-AR')} (${metodo})`
  );
}
