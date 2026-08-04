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
 */
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
  /** Lo pactado por noche. Es el precio al que se cobran las que sí estuvo. */
  nightlyRate: number;
  /** El alojamiento que se cobra, ya solo por las noches usadas. */
  lodgingTotal: number;
  /** Cuánto baja el alojamiento respecto de lo que figuraba. */
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
}

export const buildEarlyCheckout = ({
  checkInDate,
  bookedCheckOut,
  actualCheckOut,
  agreedTotal,
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
      nightlyRate: agreedTotal,
      lodgingTotal: agreedTotal,
      credited: 0,
    };
  }

  // El piso es una noche. Irse el mismo día que se entró no es una estadía de
  // cero: esa noche la habitación ya salió de la venta y nadie más la va a usar.
  // El techo es lo reservado, porque quedarse de más es Extender estadía, que
  // cobra las noches nuevas aparte en vez de prorratear lo pactado.
  const rawNights = differenceInCalendarDays(actualCheckOut, checkInDate);
  const stayedNights = Math.min(Math.max(rawNights, 1), bookedNights);

  const nightlyRate = agreedTotal / bookedNights;
  const lodgingTotal = Math.round(nightlyRate * stayedNights);

  return {
    bookedCheckOut,
    // Derivada de las noches, no el día que entró por parámetro: es lo que
    // garantiza que la fecha guardada y el monto cobrado digan lo mismo. De paso
    // normaliza la hora, que si viene de `new Date()` trae la del mostrador.
    actualCheckOut: addDays(checkInDate, stayedNights),
    bookedNights,
    stayedNights,
    releasedNights: bookedNights - stayedNights,
    nightlyRate,
    lodgingTotal,
    credited: agreedTotal - lodgingTotal,
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
