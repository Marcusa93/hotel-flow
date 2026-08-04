import { describe, it, expect } from 'vitest';
import {
  monthOccupancy,
  monthRange,
  occupancyByRoomType,
  summarizeMonthIncome,
} from '@/lib/monthlySummary';
import type {
  Booking,
  CurrentAccountPayment,
  OtherIncome,
  Payment,
  Room,
  RoomType,
} from '@/types/hotel';

// El resumen que mira el dueño para saber cómo le fue el mes. Dos preguntas:
// cuánta plata entró de verdad, y cuán lleno estuvo el hotel.

const pago = (over: Partial<Payment> = {}): Payment => ({
  id: 'p-1',
  bookingId: 'b-1',
  amount: 10_000,
  method: 'CASH',
  status: 'PAID',
  date: new Date(2026, 6, 10),
  ...over,
});

const otro = (over: Partial<OtherIncome> = {}): OtherIncome => ({
  id: 'o-1',
  date: new Date(2026, 6, 10),
  description: 'Alquiler del salón',
  method: 'TRANSFER',
  amount: 50_000,
  createdAt: new Date(2026, 6, 10),
  ...over,
});

const deCuenta = (over: Partial<CurrentAccountPayment> = {}): CurrentAccountPayment => ({
  id: 'ca-1',
  guestId: 'g-1',
  date: new Date(2026, 6, 10),
  amount: 30_000,
  method: 'CASH',
  createdAt: new Date(2026, 6, 10),
  ...over,
});

describe('summarizeMonthIncome', () => {
  it('suma lo cobrado por método', () => {
    const result = summarizeMonthIncome({
      payments: [
        pago({ id: 'a', amount: 10_000, method: 'CASH' }),
        pago({ id: 'b', amount: 25_000, method: 'TRANSFER' }),
        pago({ id: 'c', amount: 5_000, method: 'CASH' }),
      ],
      otherIncome: [],
      accountPayments: [],
    });

    expect(result.byMethod).toEqual({ CASH: 15_000, TRANSFER: 25_000 });
    expect(result.total).toBe(40_000);
  });

  it('lo cargado a cuenta corriente no entró a la caja', () => {
    // Era el error del balance viejo: la reserva queda saldada, pero de esa plata
    // el hotel todavía no vio un peso. Sumarla inflaba el mes.
    const result = summarizeMonthIncome({
      payments: [
        pago({ id: 'a', amount: 10_000, method: 'CASH' }),
        pago({ id: 'fiado', amount: 80_000, method: 'CUENTA_CORRIENTE' }),
      ],
      otherIncome: [],
      accountPayments: [],
    });

    expect(result.total).toBe(10_000);
    expect(result.toAccounts).toBe(80_000);
    // Y no ensucia el desglose con un método que no es una forma de cobrar.
    expect(result.byMethod).toEqual({ CASH: 10_000 });
  });

  it('el total cierra contra la suma del desglose', () => {
    // La otra mitad del mismo error: el total incluía la cuenta corriente pero
    // ninguna fila la mostraba, así que en pantalla no cerraba.
    const result = summarizeMonthIncome({
      payments: [
        pago({ id: 'a', amount: 10_000, method: 'CASH' }),
        pago({ id: 'fiado', amount: 80_000, method: 'CUENTA_CORRIENTE' }),
      ],
      otherIncome: [otro({ amount: 50_000, method: 'TRANSFER' })],
      accountPayments: [deCuenta({ amount: 30_000, method: 'CASH' })],
    });

    const sumaDelDesglose = Object.values(result.byMethod).reduce((s, v) => s + v, 0);
    expect(sumaDelDesglose).toBe(result.total);
  });

  it('cuando el huésped viene a bajar la cuenta, ahí sí entra la plata', () => {
    const result = summarizeMonthIncome({
      payments: [],
      otherIncome: [],
      accountPayments: [
        deCuenta({ id: 'a', amount: 30_000, method: 'CASH' }),
        deCuenta({ id: 'b', amount: 20_000, method: 'TRANSFER' }),
      ],
    });

    expect(result.fromAccounts).toBe(50_000);
    expect(result.total).toBe(50_000);
    expect(result.byMethod).toEqual({ CASH: 30_000, TRANSFER: 20_000 });
  });

  it('un cobro que todavía no se pagó no es plata', () => {
    const result = summarizeMonthIncome({
      payments: [
        pago({ id: 'a', amount: 10_000, status: 'PAID' }),
        pago({ id: 'b', amount: 99_000, status: 'PENDING' }),
      ],
      otherIncome: [],
      accountPayments: [],
    });

    expect(result.total).toBe(10_000);
  });

  it('separa de dónde vino cada peso', () => {
    const result = summarizeMonthIncome({
      payments: [pago({ amount: 10_000 })],
      otherIncome: [otro({ amount: 50_000 })],
      accountPayments: [deCuenta({ amount: 30_000 })],
    });

    expect(result.fromBookings).toBe(10_000);
    expect(result.fromOther).toBe(50_000);
    expect(result.fromAccounts).toBe(30_000);
    expect(result.total).toBe(90_000);
  });
});

const reserva = (over: Partial<Booking> = {}): Booking => ({
  id: 'b-1',
  guestId: 'g-1',
  roomId: 'r-1',
  checkInDate: new Date(2026, 6, 1),
  checkOutDate: new Date(2026, 6, 3),
  adults: 2,
  children: 0,
  infants: 0,
  status: 'CHECKED_OUT',
  totalAmount: 100_000,
  createdAt: new Date(2026, 6, 1),
  ...over,
});

// Julio 2026: 31 días.
const julio = { start: new Date(2026, 6, 1), end: new Date(2026, 6, 31) };

describe('monthOccupancy', () => {
  it('cuenta noches-habitación, no reservas', () => {
    // Del 1 al 3 son dos noches: la del 1 y la del 2. El 3 se va y la habitación
    // queda libre.
    const result = monthOccupancy({
      bookings: [reserva()],
      roomCount: 10,
      ...julio,
    });

    expect(result.nightsSold).toBe(2);
    expect(result.nightsAvailable).toBe(310);
  });

  it('el día de salida no ocupa', () => {
    const result = monthOccupancy({
      bookings: [reserva({ checkInDate: new Date(2026, 6, 5), checkOutDate: new Date(2026, 6, 6) })],
      roomCount: 1,
      ...julio,
    });

    expect(result.byDay.find(d => d.date.getDate() === 5)?.occupied).toBe(1);
    expect(result.byDay.find(d => d.date.getDate() === 6)?.occupied).toBe(0);
  });

  it('recorta la reserva que cruza el fin de mes', () => {
    // Entra el 30 de junio y se va el 2 de julio: al mes de julio le pone una
    // sola noche, la del 1.
    const result = monthOccupancy({
      bookings: [reserva({ checkInDate: new Date(2026, 5, 30), checkOutDate: new Date(2026, 6, 2) })],
      roomCount: 1,
      ...julio,
    });

    expect(result.nightsSold).toBe(1);
  });

  it('canceladas y no-show no ocupan', () => {
    const result = monthOccupancy({
      bookings: [
        reserva({ id: 'a', status: 'CANCELLED' }),
        reserva({ id: 'b', status: 'NO_SHOW' }),
        reserva({ id: 'c', status: 'PENDING' }),
      ],
      roomCount: 5,
      ...julio,
    });

    expect(result.nightsSold).toBe(0);
  });

  it('una confirmada que no se marcó cuenta igual', () => {
    // En un mes ya cerrado esa gente durmió en el hotel. Exigir el check-in
    // marcado mostraría un hotel más vacío del que estuvo.
    const result = monthOccupancy({
      bookings: [reserva({ status: 'CONFIRMED' })],
      roomCount: 1,
      ...julio,
    });

    expect(result.nightsSold).toBe(2);
  });

  it('el hotel completo ocupa todas las habitaciones', () => {
    // No tiene habitación asignada: contarlo como una sola dejaba la noche que se
    // alquiló entero como la más vacía del mes.
    const result = monthOccupancy({
      bookings: [reserva({ isFullHotel: true, roomId: '' })],
      roomCount: 8,
      ...julio,
    });

    expect(result.nightsSold).toBe(16);
    expect(result.busiest?.occupied).toBe(8);
  });

  it('la media estadía no ocupa la noche, pero se cuenta aparte', () => {
    // Entra y sale el mismo día: esa noche la habitación se puede vender igual.
    const result = monthOccupancy({
      bookings: [
        reserva({
          id: 'media',
          isHalfDay: true,
          checkInDate: new Date(2026, 6, 4),
          checkOutDate: new Date(2026, 6, 4),
        }),
      ],
      roomCount: 3,
      ...julio,
    });

    expect(result.nightsSold).toBe(0);
    expect(result.halfDays).toBe(1);
  });

  it('calcula el porcentaje sobre lo que había para vender', () => {
    const result = monthOccupancy({
      bookings: [
        reserva({ id: 'a', roomId: 'r-1', checkInDate: new Date(2026, 6, 1), checkOutDate: new Date(2026, 6, 3) }),
        reserva({ id: 'b', roomId: 'r-2', checkInDate: new Date(2026, 6, 1), checkOutDate: new Date(2026, 6, 3) }),
      ],
      roomCount: 2,
      start: new Date(2026, 6, 1),
      end: new Date(2026, 6, 2),
    });

    // Dos habitaciones, dos días, las dos llenas las dos noches.
    expect(result.nightsSold).toBe(4);
    expect(result.nightsAvailable).toBe(4);
    expect(result.rate).toBe(100);
  });

  it('encuentra el día más lleno y el más vacío', () => {
    const result = monthOccupancy({
      bookings: [
        reserva({ id: 'a', roomId: 'r-1', checkInDate: new Date(2026, 6, 1), checkOutDate: new Date(2026, 6, 4) }),
        reserva({ id: 'b', roomId: 'r-2', checkInDate: new Date(2026, 6, 2), checkOutDate: new Date(2026, 6, 3) }),
      ],
      roomCount: 2,
      start: new Date(2026, 6, 1),
      end: new Date(2026, 6, 4),
    });

    expect(result.busiest?.date.getDate()).toBe(2);
    expect(result.busiest?.occupied).toBe(2);
    expect(result.quietest?.date.getDate()).toBe(4);
    expect(result.quietest?.occupied).toBe(0);
  });

  it('nunca pasa del 100% aunque haya reservas encimadas', () => {
    // Dos reservas en la misma habitación es un error de carga; mostrar 200%
    // ocupado haría dudar de todo el resumen.
    const result = monthOccupancy({
      bookings: [
        reserva({ id: 'a', roomId: 'r-1' }),
        reserva({ id: 'b', roomId: 'r-1' }),
      ],
      roomCount: 1,
      start: new Date(2026, 6, 1),
      end: new Date(2026, 6, 2),
    });

    expect(result.rate).toBeLessThanOrEqual(100);
  });

  it('sin habitaciones cargadas no divide por cero', () => {
    const result = monthOccupancy({ bookings: [reserva()], roomCount: 0, ...julio });

    expect(result.rate).toBe(0);
    expect(result.nightsSold).toBe(0);
  });
});

const habitacion = (id: string, roomTypeId: string): Room =>
  ({ id, roomNumber: id, roomTypeId, status: 'AVAILABLE' }) as Room;

const tipo = (id: string, name: string): RoomType =>
  ({ id, name, maxGuests: 2, basePrice: 50_000 }) as RoomType;

describe('occupancyByRoomType', () => {
  it('abre la ocupación por tipo', () => {
    const result = occupancyByRoomType({
      bookings: [
        reserva({ id: 'a', roomId: 'dobl-1', checkInDate: new Date(2026, 6, 1), checkOutDate: new Date(2026, 6, 3) }),
      ],
      rooms: [habitacion('dobl-1', 'doble'), habitacion('dobl-2', 'doble'), habitacion('sui-1', 'suite')],
      roomTypes: [tipo('doble', 'Doble'), tipo('suite', 'Suite')],
      start: new Date(2026, 6, 1),
      end: new Date(2026, 6, 2),
    });

    const doble = result.find(r => r.roomTypeId === 'doble');
    const suite = result.find(r => r.roomTypeId === 'suite');

    // Dos dobles × dos noches = 4 disponibles, se vendieron 2.
    expect(doble?.nightsSold).toBe(2);
    expect(doble?.nightsAvailable).toBe(4);
    expect(doble?.rate).toBe(50);
    expect(suite?.nightsSold).toBe(0);
  });

  it('el hotel completo llena todos los tipos', () => {
    const result = occupancyByRoomType({
      bookings: [reserva({ isFullHotel: true, roomId: '' })],
      rooms: [habitacion('dobl-1', 'doble'), habitacion('sui-1', 'suite')],
      roomTypes: [tipo('doble', 'Doble'), tipo('suite', 'Suite')],
      start: new Date(2026, 6, 1),
      end: new Date(2026, 6, 2),
    });

    expect(result.every(r => r.rate === 100)).toBe(true);
  });

  it('un tipo sin habitaciones no divide por cero', () => {
    const result = occupancyByRoomType({
      bookings: [],
      rooms: [],
      roomTypes: [tipo('doble', 'Doble')],
      start: new Date(2026, 6, 1),
      end: new Date(2026, 6, 2),
    });

    expect(result[0].rate).toBe(0);
  });
});

describe('monthRange', () => {
  it('un mes ya cerrado se cuenta entero', () => {
    const result = monthRange('2026-06', new Date(2026, 6, 15));

    expect(result.isPartial).toBe(false);
    expect(result.end.getDate()).toBe(30);
  });

  it('el mes en curso se corta en hoy', () => {
    // Dividir lo vendido en cuatro días por las noches de los treinta y uno daría
    // una ocupación ridícula, y en caída hasta fin de mes.
    const result = monthRange('2026-07', new Date(2026, 6, 4));

    expect(result.isPartial).toBe(true);
    expect(result.end.getDate()).toBe(4);
  });

  it('el último día del mes ya es el mes entero', () => {
    const result = monthRange('2026-07', new Date(2026, 6, 31));

    expect(result.isPartial).toBe(false);
    expect(result.end.getDate()).toBe(31);
  });
});
