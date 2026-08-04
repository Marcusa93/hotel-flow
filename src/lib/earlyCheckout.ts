import { addDays, differenceInCalendarDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * El huésped se va antes de lo que había reservado.
 *
 * Es el espejo de "Extender estadía", y mueve las mismas dos cosas: la fecha de
 * salida —si no, la habitación sigue figurando ocupada las noches que ya nadie
 * va a usar, y el tablero no deja venderlas— y la plata.
 *
 * No hay multa: se cobran las noches que estuvo y listo. Y el precio sale de lo
 * que se pactó, no de la tarifa de hoy: prorratear el total acordado conserva
 * solo la promoción, la tarifa especial y el tramo elegido a mano, sin tener que
 * volver a resolver ninguno de los tres. Rearmarlo desde la lista le cambiaría el
 * precio al huésped que reservó con descuento, justo cuando se está yendo.
 *
 * OJO con dónde vive la plata del alojamiento: en una estadía extendida está en
 * dos lugares. `total_amount` guarda lo que se cotizó al reservar —contra eso se
 * tomaron las señas— y las noches agregadas después van como cargo aparte, de
 * categoría ALOJAMIENTO. La fecha de salida, en cambio, se movió por las dos.
 *
 * Dividir el total entre todas las noches, entonces, inventa un precio por noche
 * que nunca existió: reparte lo que costaron las primeras noches sobre todas.
 * Una reserva de 1 noche a $80.000 extendida 2 noches más quedaba en $26.667 la
 * noche, y arriba seguía el cargo entero de las 2 noches que el huésped no usó.
 * Por eso las noches se reparten en dos baldes y cada uno se cobra a su precio.
 */
/**
 * Un cargo de noches agregadas por "Extender estadía".
 *
 * `amount` es el precio de UNA noche y `quantity` cuántas: así se puede devolver
 * de a una sin tocar el precio al que se pactaron.
 */
export interface LodgingCharge {
  id: string;
  /** Precio por noche. */
  amount: number;
  /** Cuántas noches cubre. */
  quantity: number;
  /** Para ordenarlos: lo agregado después son las últimas noches de la estadía. */
  createdAt: Date;
}

/** Cómo queda un cargo de noches agregadas después de recortar la estadía. */
export interface ChargeAdjustment {
  id: string;
  /** Noches que quedan cobradas. Cero significa que el cargo se borra. */
  quantity: number;
  /** Lo que se deja de cobrar de este cargo. */
  credited: number;
}

export interface EarlyCheckout {
  /** La salida que figuraba en la reserva. */
  bookedCheckOut: Date;
  /**
   * La salida que se va a guardar.
   *
   * Se deriva de las noches cobradas y no es el día que se pidió tal cual: así la
   * fecha y el precio no pueden contar cosas distintas. Sin esto, el que entra y
   * se va el mismo día quedaba con una noche cobrada y `checkOut` igual a
   * `checkIn` —cero noches— que además es la forma de una media estadía.
   */
  actualCheckOut: Date;
  bookedNights: number;
  stayedNights: number;
  /** Las noches que la reserva tenía tomadas y no se usaron. */
  releasedNights: number;
  /** Las noches de la reserva original, sin contar las agregadas después. */
  bookedBaseNights: number;
  /** Lo pactado por noche en la reserva original. */
  nightlyRate: number;
  /** El total de la reserva que se guarda: solo las noches originales usadas. */
  lodgingTotal: number;
  /** Cómo queda cada cargo de noches agregadas. */
  chargeAdjustments: ChargeAdjustment[];
  /** Lo que se deja de cobrar en total: reserva más cargos. */
  credited: number;
}

interface BuildEarlyCheckoutParams {
  checkInDate: Date;
  /** La salida con la que está cargada la reserva. */
  bookedCheckOut: Date;
  /** El día que el huésped se va de verdad. */
  actualCheckOut: Date;
  /** El total de alojamiento con el que está cargada la reserva: lo pactado. */
  agreedTotal: number;
  /**
   * Los cargos de categoría ALOJAMIENTO de la reserva, si la estadía se extendió.
   * Sin esto la cuenta sale mal en cuanto haya una extensión.
   */
  lodgingCharges?: LodgingCharge[];
}

export const buildEarlyCheckout = ({
  checkInDate,
  bookedCheckOut,
  actualCheckOut,
  agreedTotal,
  lodgingCharges = [],
}: BuildEarlyCheckoutParams): EarlyCheckout => {
  const bookedNights = differenceInCalendarDays(bookedCheckOut, checkInDate);

  // Una media estadía no tiene noches que devolver: entra y sale el mismo día,
  // y eso es lo que la define. Se devuelve intacta en vez de dividir por cero.
  if (bookedNights <= 0) {
    return {
      bookedCheckOut,
      actualCheckOut: bookedCheckOut,
      bookedNights: 0,
      stayedNights: 0,
      releasedNights: 0,
      bookedBaseNights: 0,
      nightlyRate: agreedTotal,
      lodgingTotal: agreedTotal,
      chargeAdjustments: [],
      credited: 0,
    };
  }

  // El piso es una noche. Irse el mismo día que se entró no es una estadía de
  // cero: esa noche la habitación ya salió de la venta y nadie más la va a usar.
  // El techo es lo reservado, porque quedarse de más es Extender estadía, que
  // cobra las noches nuevas aparte en vez de prorratear lo pactado.
  const rawNights = differenceInCalendarDays(actualCheckOut, checkInDate);
  const stayedNights = Math.min(Math.max(rawNights, 1), bookedNights);

  // Las agregadas primero son las que van antes en la estadía: se extendió el
  // martes y después el jueves, así que ese orden es el de las noches.
  const extensions = [...lodgingCharges].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  const extensionNights = extensions.reduce((sum, c) => sum + c.quantity, 0);

  /**
   * Las noches que cubre `agreedTotal`: las de la reserva original.
   *
   * Si los cargos dicen cubrir tantas noches como tiene la estadía entera, los
   * datos no cierran —quedaría una reserva de cero noches con un total— y no se
   * toca nada de los cargos: se prorratea el total sobre todo, que es lo peor
   * que puede pasar, pero no inventa devoluciones sobre datos que no se entienden.
   */
  const bookedBaseNights = bookedNights - extensionNights;
  const dataIsCoherent = bookedBaseNights > 0;

  const baseNights = dataIsCoherent ? bookedBaseNights : bookedNights;
  const nightlyRate = agreedTotal / baseNights;

  // Primero se llenan las noches de la reserva original, y recién después las
  // agregadas: el huésped usa la estadía en orden.
  const baseNightsCharged = Math.min(stayedNights, baseNights);
  let extensionNightsLeft = stayedNights - baseNightsCharged;

  const chargeAdjustments: ChargeAdjustment[] = dataIsCoherent
    ? extensions.map(charge => {
        const keep = Math.min(charge.quantity, extensionNightsLeft);
        extensionNightsLeft -= keep;
        return {
          id: charge.id,
          quantity: keep,
          credited: (charge.quantity - keep) * charge.amount,
        };
      })
    : [];

  const lodgingTotal = Math.round(nightlyRate * baseNightsCharged);
  const chargesCredited = chargeAdjustments.reduce((sum, a) => sum + a.credited, 0);

  return {
    bookedCheckOut,
    // Derivada de las noches, no el día que entró por parámetro: es lo que
    // garantiza que la fecha guardada y el monto cobrado digan lo mismo. De paso
    // normaliza la hora, que si viene de `new Date()` trae la del mostrador.
    actualCheckOut: addDays(checkInDate, stayedNights),
    bookedNights,
    stayedNights,
    releasedNights: bookedNights - stayedNights,
    bookedBaseNights: baseNights,
    nightlyRate,
    lodgingTotal,
    chargeAdjustments,
    credited: agreedTotal - lodgingTotal + chargesCredited,
  };
};

/**
 * La línea que explica el ajuste, para la factura y el detalle.
 *
 * Lleva las fechas adentro por lo mismo que la extensión: dentro de un mes,
 * "2 noches" sin decir cuáles no le sirve a nadie para reconstruir qué se cobró.
 */
export const describeEarlyCheckout = (early: EarlyCheckout): string => {
  const day = (date: Date) => format(date, 'd MMM', { locale: es });
  const noches = (n: number) => `${n} noche${n === 1 ? '' : 's'}`;

  return `Salida adelantada al ${day(early.actualCheckOut)}: se cobran ${noches(early.stayedNights)} de las ${noches(early.bookedNights)} reservadas (salía el ${day(early.bookedCheckOut)})`;
};
