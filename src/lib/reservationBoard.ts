import { differenceInCalendarDays, startOfDay } from 'date-fns';
import type { Booking, BookingStatus } from '@/types/hotel';

/**
 * El tablero de Reservas es la pantalla de trabajo del día, no el archivo.
 *
 * Las cuatro columnas son estados. Canceladas no tiene columna propia: se ve
 * por la pestaña, que es donde se la va a buscar cuando hace falta.
 */
export const BOARD_STATUSES = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

const isBoardStatus = (status: BookingStatus): status is BoardStatus =>
  (BOARD_STATUSES as readonly string[]).includes(status);

/** 'asc' pone primero al que llegó o salió antes; 'desc' al revés. */
export type BoardOrder = 'asc' | 'desc';

/**
 * Por qué fecha se ordena cada columna.
 *
 * Las que todavía no llegaron y las que están alojadas se miran por la entrada;
 * las salidas, por la salida. Es la fecha que tiene en la cabeza el que está
 * mirando esa columna, y ordenar las cuatro por una sola no servía para
 * ninguna: en Salidas la fecha de entrada no dice nada.
 */
const columnDate = (booking: Booking, status: BoardStatus): number =>
  new Date(status === 'CHECKED_OUT' ? booking.checkOutDate : booking.checkInDate).getTime();

/**
 * Si esta salida todavía es del día.
 *
 * La columna venía acumulando todo lo que alguna vez salió, así que a los pocos
 * meses es una lista de historia tapando la pantalla de trabajo. Se queda con
 * las que no pasaron de fecha: pasado el día, la salida cae sola y la columna
 * arranca limpia para las de la jornada nueva.
 *
 * Se compara contra la fecha de salida de la reserva y no contra cuándo se
 * marcó el check-out, porque eso último no queda registrado en ningún lado:
 * bookings.updated_at no tiene trigger y se quedó en el alta.
 *
 * No borra nada. La reserva sigue entera y la pestaña "Salidas" las muestra
 * todas, incluidas las viejas.
 */
export const isCurrentDeparture = (booking: Booking, today: Date): boolean =>
  startOfDay(new Date(booking.checkOutDate)).getTime() >= startOfDay(today).getTime();

export interface BoardInput {
  bookings: Booking[];
  today: Date;
  order: BoardOrder;
  /** Con la pestaña "Salidas" elegida se muestran todas, también las de antes. */
  allDepartures?: boolean;
}

export interface Board {
  columns: Record<BoardStatus, Booking[]>;
  /** Cuántas salidas de días anteriores quedaron afuera. Se avisa, no se esconde. */
  hiddenDepartures: number;
}

export function buildBoard({ bookings, today, order, allDepartures = false }: BoardInput): Board {
  const columns: Record<BoardStatus, Booking[]> = {
    PENDING: [],
    CONFIRMED: [],
    CHECKED_IN: [],
    CHECKED_OUT: [],
  };
  let hiddenDepartures = 0;

  for (const booking of bookings) {
    if (!isBoardStatus(booking.status)) continue;

    if (booking.status === 'CHECKED_OUT' && !allDepartures && !isCurrentDeparture(booking, today)) {
      hiddenDepartures++;
      continue;
    }

    columns[booking.status].push(booking);
  }

  const factor = order === 'asc' ? 1 : -1;
  for (const status of BOARD_STATUSES) {
    columns[status].sort((a, b) => (columnDate(a, status) - columnDate(b, status)) * factor);
  }

  return { columns, hiddenDepartures };
}

/* ─────────────────── Separadores dentro de una columna ─────────────────── */

/**
 * Una columna de 81 reservas repartidas en tres meses no se navega: se scrollea
 * a ciegas. Los separadores le dan puntos de referencia — cuando parás, sabés
 * si estás mirando lo de esta semana o lo de noviembre.
 */
export type ProximityKey = 'atrasadas' | 'hoy' | 'semana' | 'mes' | 'despues';

export interface BoardGroup {
  key: ProximityKey;
  label: string;
  bookings: Booking[];
}

/**
 * Cómo se llama cada tramo según la columna.
 *
 * La fecha que se agrupa es la misma por la que la columna ya está ordenada
 * —entrada en las tres primeras, salida en la última—, así que los grupos salen
 * contiguos. Agrupar por una fecha distinta de la del orden mezclaría los
 * tramos y los separadores dirían cualquier cosa.
 */
const GROUP_LABELS: Record<BoardStatus, Record<ProximityKey, string>> = {
  PENDING: {
    atrasadas: 'Ya deberían haber llegado',
    hoy: 'Llegan hoy',
    semana: 'Esta semana',
    mes: 'Próximos 30 días',
    despues: 'Más adelante',
  },
  CONFIRMED: {
    atrasadas: 'Ya deberían haber llegado',
    hoy: 'Llegan hoy',
    semana: 'Esta semana',
    mes: 'Próximos 30 días',
    despues: 'Más adelante',
  },
  CHECKED_IN: {
    atrasadas: 'De días anteriores',
    hoy: 'Entraron hoy',
    semana: 'Entraron esta semana',
    mes: 'Entran en los próximos 30 días',
    despues: 'Entran más adelante',
  },
  CHECKED_OUT: {
    atrasadas: 'De días anteriores',
    hoy: 'Salieron hoy',
    semana: 'Salen esta semana',
    mes: 'Salen en los próximos 30 días',
    despues: 'Salen más adelante',
  },
};

const proximityOf = (booking: Booking, status: BoardStatus, today: Date): ProximityKey => {
  const dias = differenceInCalendarDays(
    startOfDay(new Date(status === 'CHECKED_OUT' ? booking.checkOutDate : booking.checkInDate)),
    startOfDay(today),
  );
  if (dias < 0) return 'atrasadas';
  if (dias === 0) return 'hoy';
  if (dias <= 7) return 'semana';
  if (dias <= 30) return 'mes';
  return 'despues';
};

/**
 * Parte una columna ya ordenada en tramos por cercanía.
 *
 * Siempre devuelve al menos un tramo si hay reservas, incluso cuando caen todas
 * en el mismo. Podría ahorrarse ese título único, pero entonces unas columnas
 * arrancarían con un separador y otras con una tarjeta, y las cuatro quedarían
 * corridas entre sí: con un tramo por columna las tarjetas empiezan todas a la
 * misma altura. Y el título igual dice algo cierto —"Esta semana"— que la
 * cabecera de la columna no dice.
 *
 * Los tramos salen en el orden en que aparecen, así que el botón de invertir el
 * orden del tablero los da vuelta solo.
 */
export function groupByProximity({
  bookings,
  status,
  today,
}: {
  bookings: Booking[];
  status: BoardStatus;
  today: Date;
}): BoardGroup[] {
  const grupos: BoardGroup[] = [];
  const porClave = new Map<ProximityKey, BoardGroup>();

  for (const booking of bookings) {
    const key = proximityOf(booking, status, today);
    let grupo = porClave.get(key);
    if (!grupo) {
      grupo = { key, label: GROUP_LABELS[status][key], bookings: [] };
      porClave.set(key, grupo);
      grupos.push(grupo);
    }
    grupo.bookings.push(booking);
  }

  return grupos;
}
