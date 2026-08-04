import { addDays, differenceInCalendarDays, startOfDay } from 'date-fns';
import type {
  Booking,
  BookingStatus,
  CurrentAccountPayment,
  OtherIncome,
  Payment,
  Room,
  RoomType,
} from '@/types/hotel';
import { isCurrentAccountPayment } from '@/lib/currentAccount';

/**
 * Las cuentas del resumen del mes.
 *
 * Puro a propósito, igual que el cierre de caja: son los números con los que el
 * dueño decide, y se prueban sin base de por medio. El recorte por fecha lo hace
 * la consulta —cada función recibe las filas del período y no vuelve a filtrar
 * por día— pero las reglas de qué suma y qué no viven acá.
 */

/* ────────────────────────────── Plata ────────────────────────────── */

export interface MonthIncome {
  /** Lo cobrado por método. Sin cuenta corriente: eso no es una forma de cobrar. */
  byMethod: Record<string, number>;
  /** Lo que entró de verdad a la caja del hotel en el mes. */
  total: number;
  /** Cobros de reservas. */
  fromBookings: number;
  /** Ingresos que no salen de una reserva: alquiler de salón, y demás. */
  fromOther: number;
  /** Huéspedes que vinieron a bajar su cuenta corriente. */
  fromAccounts: number;
  /**
   * Estadías cargadas a la cuenta corriente de un huésped.
   *
   * Va aparte y NO suma: la reserva queda saldada, pero a la caja no entró un
   * peso. Sumarlo —como se venía haciendo— inflaba el mes con plata que todavía
   * se debe, y encima no aparecía en ninguna fila del desglose, así que el total
   * no cerraba contra lo que se veía en pantalla.
   */
  toAccounts: number;
}

/**
 * Lo que entró en el mes, por dónde entró.
 *
 * Las tres fuentes son distintas y se muestran juntas porque las tres son plata
 * del mismo mes: lo cobrado por reservas, lo que no viene de una reserva, y lo
 * que los huéspedes trajeron para bajar la cuenta corriente.
 */
export function summarizeMonthIncome({
  payments,
  otherIncome,
  accountPayments,
}: {
  payments: Payment[];
  otherIncome: OtherIncome[];
  accountPayments: CurrentAccountPayment[];
}): MonthIncome {
  const byMethod: Record<string, number> = {};
  const add = (method: string, amount: number) => {
    byMethod[method] = (byMethod[method] || 0) + amount;
  };

  let fromBookings = 0;
  let toAccounts = 0;

  for (const p of payments) {
    // Un cobro que no está pagado todavía no es plata.
    if (p.status !== 'PAID') continue;
    if (isCurrentAccountPayment(p)) {
      toAccounts += p.amount;
      continue;
    }
    add(p.method, p.amount);
    fromBookings += p.amount;
  }

  let fromOther = 0;
  for (const o of otherIncome) {
    add(o.method, o.amount);
    fromOther += o.amount;
  }

  let fromAccounts = 0;
  for (const p of accountPayments) {
    add(p.method, p.amount);
    fromAccounts += p.amount;
  }

  return {
    byMethod,
    total: fromBookings + fromOther + fromAccounts,
    fromBookings,
    fromOther,
    fromAccounts,
    toAccounts,
  };
}

/* ──────────────────────────── Ocupación ──────────────────────────── */

/**
 * Qué reservas ocupan una habitación.
 *
 * Canceladas y no-show quedan afuera: nadie durmió ahí. Las pendientes también,
 * porque todavía no son una estadía. Las confirmadas sí cuentan aunque nadie
 * les haya marcado el check-in: en un mes ya cerrado esa reserva ocurrió, y
 * pedirle al sistema que adivine cuáles se olvidaron de marcar daría un hotel
 * más vacío de lo que estuvo.
 */
const OCCUPYING_STATUSES: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
]);

const dayMs = (d: Date): number => startOfDay(new Date(d)).getTime();

/**
 * Si esta reserva ocupa la noche de ese día.
 *
 * La noche del día D va de D a D+1, así que el día de salida no se cuenta: esa
 * mañana la habitación queda libre para venderla de nuevo.
 */
const occupiesNight = (booking: Booking, date: Date): boolean =>
  dayMs(booking.checkInDate) <= dayMs(date) && dayMs(date) < dayMs(booking.checkOutDate);

export interface DayOccupancy {
  date: Date;
  /** Habitaciones ocupadas esa noche. */
  occupied: number;
}

export interface MonthOccupancy {
  /** Noches-habitación vendidas en el período. */
  nightsSold: number;
  /** Noches-habitación que había para vender: habitaciones × días contados. */
  nightsAvailable: number;
  /** Porcentaje ocupado. 0 cuando no hay nada que ocupar. */
  rate: number;
  /** Cuántos días entraron en la cuenta. En el mes en curso, hasta hoy. */
  daysCounted: number;
  byDay: DayOccupancy[];
  /** El día más lleno y el más vacío. Null si no se contó ningún día. */
  busiest: DayOccupancy | null;
  quietest: DayOccupancy | null;
  /**
   * Medias estadías que empezaron en el período.
   *
   * No ocupan noche —entran y salen el mismo día, y esa noche la habitación se
   * puede vender igual— así que no entran en la ocupación. Se cuentan aparte
   * para que no queden invisibles: generaron plata sin generar noches.
   */
  halfDays: number;
}

const emptyOccupancy = (daysCounted: number): MonthOccupancy => ({
  nightsSold: 0,
  nightsAvailable: 0,
  rate: 0,
  daysCounted,
  byDay: [],
  busiest: null,
  quietest: null,
  halfDays: 0,
});

export interface OccupancyInput {
  bookings: Booking[];
  /** Cuántas habitaciones tiene el hotel. */
  roomCount: number;
  /** Primer día contado. */
  start: Date;
  /** Último día contado, inclusive. */
  end: Date;
}

/**
 * Cuán lleno estuvo el hotel en el período, noche por noche.
 *
 * Se cuenta en noches-habitación y no en reservas: una reserva de cinco noches
 * llena la habitación cinco veces más que una de una noche, y contarlas iguales
 * decía muy poco. Es la ocupación que el sistema no tenía —la que se mostraba
 * hasta ahora era la de este momento, o sea cuántas habitaciones están ocupadas
 * mientras se mira la pantalla.
 */
export function monthOccupancy({ bookings, roomCount, start, end }: OccupancyInput): MonthOccupancy {
  const daysCounted = differenceInCalendarDays(end, start) + 1;
  if (daysCounted <= 0 || roomCount <= 0) return emptyOccupancy(Math.max(0, daysCounted));

  const occupying = bookings.filter(b => OCCUPYING_STATUSES.has(b.status));
  const stays = occupying.filter(b => !b.isHalfDay);

  const halfDays = occupying.filter(
    b => b.isHalfDay && dayMs(b.checkInDate) >= dayMs(start) && dayMs(b.checkInDate) <= dayMs(end)
  ).length;

  const byDay: DayOccupancy[] = [];
  for (let i = 0; i < daysCounted; i++) {
    const date = addDays(start, i);
    let occupied = 0;
    let fullHotel = false;

    for (const b of stays) {
      if (!occupiesNight(b, date)) continue;
      // El alquiler del hotel completo no tiene habitación asignada: bloquea
      // todas. Contarlo como una sola dejaría la noche que se alquiló entero
      // como la más vacía del mes.
      if (b.isFullHotel) fullHotel = true;
      else occupied++;
    }

    // El tope es el hotel: dos reservas encimadas en la misma habitación son un
    // error de carga, y dejarlo pasar mostraría más del 100% ocupado.
    byDay.push({ date, occupied: fullHotel ? roomCount : Math.min(occupied, roomCount) });
  }

  const nightsSold = byDay.reduce((sum, d) => sum + d.occupied, 0);
  const nightsAvailable = roomCount * daysCounted;

  let busiest = byDay[0];
  let quietest = byDay[0];
  for (const d of byDay) {
    if (d.occupied > busiest.occupied) busiest = d;
    if (d.occupied < quietest.occupied) quietest = d;
  }

  return {
    nightsSold,
    nightsAvailable,
    rate: nightsAvailable > 0 ? (nightsSold / nightsAvailable) * 100 : 0,
    daysCounted,
    byDay,
    busiest,
    quietest,
    halfDays,
  };
}

export interface TypeOccupancy {
  roomTypeId: string;
  label: string;
  rooms: number;
  nightsSold: number;
  nightsAvailable: number;
  rate: number;
}

/**
 * La misma cuenta, abierta por tipo de habitación.
 *
 * Es lo que dice si lo que falta vender son las chicas o las grandes, que con el
 * porcentaje del hotel entero no se ve.
 */
export function occupancyByRoomType({
  bookings,
  rooms,
  roomTypes,
  start,
  end,
}: {
  bookings: Booking[];
  rooms: Room[];
  roomTypes: RoomType[];
  start: Date;
  end: Date;
}): TypeOccupancy[] {
  const daysCounted = differenceInCalendarDays(end, start) + 1;
  if (daysCounted <= 0) return [];

  const occupying = bookings.filter(b => OCCUPYING_STATUSES.has(b.status) && !b.isHalfDay);

  return roomTypes
    .map(rt => {
      const typeRoomIds = new Set(rooms.filter(r => r.roomTypeId === rt.id).map(r => r.id));
      const roomCount = typeRoomIds.size;
      if (roomCount === 0) {
        return {
          roomTypeId: rt.id,
          label: rt.name,
          rooms: 0,
          nightsSold: 0,
          nightsAvailable: 0,
          rate: 0,
        };
      }

      let nightsSold = 0;
      for (let i = 0; i < daysCounted; i++) {
        const date = addDays(start, i);
        let occupied = 0;
        let fullHotel = false;
        for (const b of occupying) {
          if (!occupiesNight(b, date)) continue;
          // El hotel completo se lleva todos los tipos, no solo uno.
          if (b.isFullHotel) fullHotel = true;
          else if (typeRoomIds.has(b.roomId)) occupied++;
        }
        nightsSold += fullHotel ? roomCount : Math.min(occupied, roomCount);
      }

      const nightsAvailable = roomCount * daysCounted;
      return {
        roomTypeId: rt.id,
        label: rt.name,
        rooms: roomCount,
        nightsSold,
        nightsAvailable,
        rate: nightsAvailable > 0 ? (nightsSold / nightsAvailable) * 100 : 0,
      };
    })
    .sort((a, b) => b.rate - a.rate);
}

/* ─────────────────────────── El período ─────────────────────────── */

export interface MonthRange {
  /** Primer día del mes. */
  start: Date;
  /** Último día del mes. */
  monthEnd: Date;
  /**
   * Hasta dónde se cuenta la ocupación.
   *
   * En el mes en curso es hoy y no fin de mes: dividir lo que se vendió en cuatro
   * días por las noches de los treinta y uno daría una ocupación ridícula y en
   * caída libre hasta el día 31.
   */
  end: Date;
  /** Si el mes todavía no terminó, para poder decirlo en pantalla. */
  isPartial: boolean;
}

/** El período que cubre un mes 'YYYY-MM', recortado a hoy si todavía corre. */
export function monthRange(month: string, today = new Date()): MonthRange {
  const start = new Date(`${month}-01T00:00:00`);
  const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const isPartial = startOfDay(today) < startOfDay(monthEnd);
  return {
    start,
    monthEnd,
    end: isPartial ? startOfDay(today) : monthEnd,
    isPartial,
  };
}
