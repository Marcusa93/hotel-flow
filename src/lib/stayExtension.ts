import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Las noches que se le agregan a una reserva ya iniciada.
 *
 * El huésped alojado avisa en el mostrador que se queda más noches. Eso mueve
 * dos cosas que tienen que moverse juntas: la fecha de salida —si no, la
 * habitación figura libre desde mañana y el tablero la deja sobrevender— y la
 * plata de esas noches.
 */
export interface StayExtension {
    /** Salida vigente de la reserva: la primera noche agregada es esta */
    from: Date;
    /** Salida nueva, una vez sumadas las noches */
    to: Date;
    nights: number;
    pricePerNight: number;
    /** Lo que se agrega a la cuenta: noches × precio */
    total: number;
}

interface BuildStayExtensionParams {
    currentCheckOut: Date;
    nights: number;
    pricePerNight: number;
}

/**
 * El período agregado va de la salida vieja a la nueva, que es también la
 * ventana exacta a chequear contra otras reservas: las noches que ya estaban
 * pagas no se revisan de nuevo, solo las que se suman.
 */
export const buildStayExtension = ({
    currentCheckOut,
    nights,
    pricePerNight,
}: BuildStayExtensionParams): StayExtension => {
    const safeNights = Math.max(0, Math.floor(nights) || 0);
    const safePrice = Math.max(0, pricePerNight || 0);

    return {
        from: currentCheckOut,
        to: addDays(currentCheckOut, safeNights),
        nights: safeNights,
        pricePerNight: safePrice,
        total: safeNights * safePrice,
    };
};

/**
 * La línea que queda en el estado de cuenta.
 *
 * Lleva las fechas adentro porque el cargo sobrevive a la reserva en la
 * factura y en la auditoría: dentro de un mes, "3 noches" sin decir cuáles no
 * le sirve a nadie para reconstruir qué se cobró.
 */
export const describeStayExtension = (extension: StayExtension): string => {
    const day = (date: Date) => format(date, 'd MMM', { locale: es });

    return `${extension.nights} noche${extension.nights === 1 ? '' : 's'} adicional${extension.nights === 1 ? '' : 'es'} (${day(extension.from)} → ${day(extension.to)})`;
};
