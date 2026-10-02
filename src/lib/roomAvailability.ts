import type { Booking } from '@/types/hotel';

/**
 * Si una habitación está libre en esas fechas, y qué la ocupa si no lo está.
 *
 * Es el espejo del trigger `prevent_booking_overlap` de la base. La base es la
 * que manda —es la única que ve todas las reservas y gana las carreras entre
 * dos recepcionistas—, pero rechazar recién al guardar llega tarde: el que
 * carga ya eligió habitación, fechas y huésped. Esto dice lo mismo antes.
 *
 * Que los dos digan lo mismo importa en las dos direcciones. Si acá sobra una
 * regla, el mostrador no puede vender una noche que estaba libre, que es peor
 * que la molestia que esto viene a sacar. Si falta, se ofrece una habitación
 * que la base después rechaza.
 */

export interface AvailabilityQuery {
    roomId: string;
    checkIn: Date;
    checkOut: Date;
    /** La reserva que se está editando: no choca consigo misma. */
    excludeBookingId?: string;
    /** La que se está por cargar es media estadía: entra y sale el mismo día. */
    isHalfDay?: boolean;
    /** La que se está por cargar es estadía y media: se retira a las 18:00. */
    halfDayAdd?: boolean;
}

export interface AvailabilityResult {
    available: boolean;
    conflicts: Booking[];
}

/** Lo que no ocupa nada: cancelada, no vino, o ya se fue. */
const occupiesRoom = (status: Booking['status']): boolean =>
    status !== 'CANCELLED' && status !== 'NO_SHOW' && status !== 'CHECKED_OUT';

export const findRoomConflicts = (
    bookings: Booking[],
    { roomId, checkIn, checkOut, excludeBookingId, isHalfDay = false, halfDayAdd = false }: AvailabilityQuery
): AvailabilityResult => {
    const newCheckIn = new Date(checkIn);
    const newCheckOut = new Date(checkOut);

    const conflicts = bookings.filter(b => {
        if (!occupiesRoom(b.status)) return false;
        if (excludeBookingId && b.id === excludeBookingId) return false;

        const bCheckIn = new Date(b.checkInDate);
        const bCheckOut = new Date(b.checkOutDate);

        // El hotel alquilado completo choca con cualquier habitación: la
        // habitación puede estar libre y no importa, el hotel está cerrado.
        if (b.isFullHotel) return newCheckIn < bCheckOut && newCheckOut > bCheckIn;

        if (b.roomId !== roomId) return false;

        // Dos medias estadías el mismo día quieren la misma habitación de 10 a
        // 18. La comparación de intervalos no las ve: el de una media estadía es
        // vacío —entra y sale el mismo día— y da falso siempre.
        if (isHalfDay && b.isHalfDay) return bCheckIn.getTime() === newCheckIn.getTime();

        // La estadía y media se retira a las 18:00 del día de salida, así que
        // ese día la habitación sigue tomada en la franja de la media estadía.
        // Para el intervalo ese día no existe —llega hasta el check-out sin
        // incluirlo— y para el caso de arriba la estadía y media es invisible,
        // porque tiene isHalfDay en false.
        if (isHalfDay && b.halfDayAdd) return bCheckOut.getTime() === newCheckIn.getTime();
        if (halfDayAdd && b.isHalfDay) return bCheckIn.getTime() === newCheckOut.getTime();

        return newCheckIn < bCheckOut && newCheckOut > bCheckIn;
    });

    return { available: conflicts.length === 0, conflicts };
};
