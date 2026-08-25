import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { GuestMovement, MonthIncome, MonthOccupancy, TypeOccupancy } from '@/lib/monthlySummary';
import type { ExpenseBreakdown } from '@/lib/cashClosing';
import type { MinibarSummary } from '@/lib/heladera';

/**
 * El resumen del mes contado en palabras.
 *
 * Las tablas del PDF ya tienen todos los números. Lo que no tienen es cuál de
 * esos números importa: quien lo recibe ve treinta cifras y no sabe si el mes
 * estuvo bien. Estos párrafos dicen lo mismo pero en el orden en que uno se lo
 * preguntaría.
 *
 * Todo sale de los datos y nada se estima. La regla es que ninguna frase pueda
 * ser falsa: donde no hay número no hay frase, y donde el número no dice nada
 * —una diferencia de dos puntos entre semana y fin de semana— tampoco.
 */

const money = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const pct = (n: number) => `${Math.round(n)}%`;
const dia = (d: Date) => format(d, "d 'de' MMMM", { locale: es });

/** "3 noches" / "1 noche" */
const plural = (n: number, singular: string, plural_: string) =>
  `${n.toLocaleString('es-AR')} ${n === 1 ? singular : plural_}`;

export interface NarrativeInput {
  income: MonthIncome;
  expenses: ExpenseBreakdown;
  occupancy: MonthOccupancy;
  byType: TypeOccupancy[];
  guests: GuestMovement;
  minibar: MinibarSummary;
  result: number;
  /** El mes en curso todavía no terminó: no se puede hablar de él en pasado. */
  isPartial: boolean;
}

export interface MonthNarrative {
  /** Cuán lleno estuvo y quién pasó. */
  ocupacion: string[];
  /** Cuánta plata entró, salió y quedó. */
  plata: string[];
  /** Lo que conviene mirar. Vacío cuando no hay nada que señalar. */
  atencion: string[];
}

/**
 * Fin de semana para un hotel: la noche del viernes y la del sábado.
 *
 * Cada día de `byDay` es la noche que empieza ese día, así que el domingo no
 * entra —esa noche la gente ya se volvió— y el viernes sí.
 */
const esFinDeSemana = (d: Date): boolean => d.getDay() === 5 || d.getDay() === 6;

/** Debajo de esto la diferencia es ruido y no vale la pena nombrarla. */
const DIFERENCIA_NOTABLE = 10;

export function narrateMonth(input: NarrativeInput): MonthNarrative {
  const { income, expenses, occupancy, byType, guests, minibar, result, isPartial } = input;
  const periodo = isPartial ? 'en lo que va del mes' : 'en el mes';
  const estuvo = isPartial ? 'viene estando' : 'estuvo';

  return {
    ocupacion: narrarOcupacion({ occupancy, guests, periodo, estuvo }),
    plata: narrarPlata({ income, expenses, occupancy, result, periodo }),
    atencion: señalar(input),
  };
}

// ─── Cuán lleno estuvo ───────────────────────────────────────────────

function narrarOcupacion({
  occupancy, guests, periodo, estuvo,
}: {
  occupancy: MonthOccupancy; guests: GuestMovement; periodo: string; estuvo: string;
}): string[] {
  if (occupancy.nightsAvailable === 0) {
    return ['No hay habitaciones cargadas, así que no se puede calcular la ocupación.'];
  }

  const parrafos: string[] = [];

  parrafos.push(
    `El hotel ${estuvo} ocupado al ${pct(occupancy.rate)}: se vendieron ` +
    `${plural(occupancy.nightsSold, 'noche', 'noches')} de las ` +
    `${occupancy.nightsAvailable.toLocaleString('es-AR')} que había para vender en ` +
    `${plural(occupancy.daysCounted, 'día', 'días')}.`
  );

  // Los extremos sólo dicen algo si son distintos entre sí.
  if (occupancy.busiest && occupancy.quietest &&
      occupancy.busiest.occupied !== occupancy.quietest.occupied) {
    parrafos.push(
      `El día más lleno fue el ${dia(occupancy.busiest.date)}, con ` +
      `${plural(occupancy.busiest.occupied, 'habitación ocupada', 'habitaciones ocupadas')}; ` +
      `el más vacío, el ${dia(occupancy.quietest.date)}, con ${occupancy.quietest.occupied}.`
    );
  }

  const finde = compararFinDeSemana(occupancy);
  if (finde) parrafos.push(finde);

  if (guests.arrivals > 0) {
    const gente =
      `Llegaron ${plural(guests.arrivals, 'reserva', 'reservas')} con ` +
      `${plural(guests.people, 'persona', 'personas')}` +
      (guests.avgNights > 0
        ? `, que se quedaron ${guests.avgNights.toFixed(1).replace('.', ',')} noches en promedio.`
        : '.');
    parrafos.push(gente);
  }

  if (occupancy.halfDays > 0) {
    parrafos.push(
      `Aparte hubo ${plural(occupancy.halfDays, 'media estadía', 'medias estadías')}, que ` +
      `dejan plata pero no ocupan la noche: esa habitación se pudo vender igual.`
    );
  }

  return parrafos;
}

/**
 * Si el fin de semana se vendió distinto que la semana.
 *
 * Devuelve null cuando la diferencia es chica o cuando el período no tiene los
 * dos tipos de día: en una semana suelta la comparación no significa nada.
 */
function compararFinDeSemana(occupancy: MonthOccupancy): string | null {
  let findeOcupadas = 0, findeDias = 0, semanaOcupadas = 0, semanaDias = 0;

  for (const d of occupancy.byDay) {
    if (esFinDeSemana(d.date)) { findeOcupadas += d.occupied; findeDias++; }
    else { semanaOcupadas += d.occupied; semanaDias++; }
  }

  if (findeDias === 0 || semanaDias === 0) return null;

  const habitaciones = occupancy.nightsAvailable / occupancy.daysCounted;
  if (habitaciones === 0) return null;

  const finde = (findeOcupadas / findeDias / habitaciones) * 100;
  const semana = (semanaOcupadas / semanaDias / habitaciones) * 100;
  const brecha = finde - semana;

  if (Math.abs(brecha) < DIFERENCIA_NOTABLE) {
    return `Se vendió parejo toda la semana: ${pct(finde)} los fines de semana contra ${pct(semana)} entre semana.`;
  }

  return brecha > 0
    ? `El movimiento es de fin de semana: viernes y sábado al ${pct(finde)}, contra ${pct(semana)} el resto.`
    : `Se vendió más entre semana que los fines de semana: ${pct(semana)} contra ${pct(finde)}.`;
}

// ─── Cuánta plata ────────────────────────────────────────────────────

function narrarPlata({
  income, expenses, occupancy, result, periodo,
}: {
  income: MonthIncome; expenses: ExpenseBreakdown; occupancy: MonthOccupancy;
  result: number; periodo: string;
}): string[] {
  if (income.total === 0 && expenses.total === 0) {
    return [`No hay movimientos de plata cargados ${periodo}.`];
  }

  const parrafos: string[] = [];

  parrafos.push(
    `Entraron ${money(income.total)} y se gastaron ${money(expenses.total)}: ` +
    (result >= 0
      ? `el mes deja ${money(result)} a favor.`
      : `el mes cierra con ${money(Math.abs(result))} en contra.`)
  );

  if (income.total > 0) {
    const porReservas = (income.fromBookings / income.total) * 100;
    const efectivo = ((income.byMethod['CASH'] || 0) / income.total) * 100;
    parrafos.push(
      `El ${pct(porReservas)} de lo que entró salió de cobros de reservas, y el ` +
      `${pct(efectivo)} del total se cobró en efectivo.`
    );
  }

  // Lo que se sacó por noche: es lo que dice si se vendió bien o barato, y el
  // porcentaje de ocupación solo no lo contesta.
  if (occupancy.nightsSold > 0 && income.fromBookings > 0) {
    parrafos.push(
      `Cada noche vendida dejó ${money(income.fromBookings / occupancy.nightsSold)} en promedio.`
    );
  }

  if (expenses.total > 0 && expenses.empresa > 0) {
    parrafos.push(
      `De los gastos, ${money(expenses.empresa)} salieron de la caja de la empresa y ` +
      `${money(expenses.total - expenses.empresa)} del cajón diario de recepción.`
    );
  }

  return parrafos;
}

// ─── Lo que conviene mirar ───────────────────────────────────────────

/**
 * Sólo lo que amerita una mirada, con el número que lo justifica.
 *
 * Los umbrales son a propósito conservadores: una lista que se llena todos los
 * meses deja de leerse, y entonces el mes en que sí pasó algo pasa de largo.
 */
function señalar({
  income, expenses, occupancy, byType, guests, minibar, result,
}: NarrativeInput): string[] {
  const avisos: string[] = [];

  if (result < 0) {
    avisos.push(`El mes cierra en rojo: se gastó ${money(Math.abs(result))} más de lo que entró.`);
  }

  if (income.toAccounts > 0) {
    avisos.push(
      `Hay ${money(income.toAccounts)} cargados a cuenta corriente. Esas reservas figuran ` +
      `saldadas, pero esa plata todavía no entró.`
    );
  }

  if (expenses.unspecified > 0) {
    avisos.push(
      `Quedaron ${money(expenses.unspecified)} en gastos sin forma de pago cargada: no se ` +
      `sabe de qué caja salieron.`
    );
  }

  // Un tipo de habitación muy por debajo del hotel es lo que se está dejando de
  // vender, y en el porcentaje general no se ve.
  const flojo = byType
    .filter(t => t.nightsAvailable > 0)
    .find(t => occupancy.rate - t.rate >= DIFERENCIA_NOTABLE * 1.5);
  if (flojo) {
    avisos.push(
      `${flojo.label} quedó bastante por debajo del resto: ${pct(flojo.rate)} contra ` +
      `${pct(occupancy.rate)} del hotel.`
    );
  }

  // Una de cada seis reservas caída ya no es la tasa normal de arrepentidos.
  if (guests.arrivals + guests.lost > 0) {
    const caidas = (guests.lost / (guests.arrivals + guests.lost)) * 100;
    if (caidas >= 15) {
      avisos.push(
        `Se cayeron ${plural(guests.lost, 'reserva', 'reservas')} de ` +
        `${guests.arrivals + guests.lost}: el ${pct(caidas)} entre canceladas y no-show.`
      );
    }
  }

  if (minibar.consumoPersonal.unidades > 0) {
    avisos.push(
      `El personal se llevó ${plural(minibar.consumoPersonal.unidades, 'producto', 'productos')} ` +
      `de la heladera` +
      (minibar.consumoPersonal.costo > 0
        ? `, ${money(minibar.consumoPersonal.costo)} al costo.`
        : '.')
    );
  }

  if (minibar.merma.unidades > 0) {
    avisos.push(
      `Se perdieron ${plural(minibar.merma.unidades, 'producto', 'productos')} de la heladera ` +
      `por vencimiento o rotura` +
      (minibar.merma.costo > 0 ? `, ${money(minibar.merma.costo)} al costo.` : '.')
    );
  }

  return avisos;
}
