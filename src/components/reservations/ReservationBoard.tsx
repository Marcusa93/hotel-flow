
import { useMemo } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { Booking, BookingStatus, Guest, Room, RoomType } from '@/types/hotel';
import { buildBookingAccount, type BookingAccount } from '@/lib/bookingAccount';
import { buildBoard, type BoardOrder, type BoardStatus } from '@/lib/reservationBoard';
import { formatLocalDate } from '@/lib/utils';
import { ReservationColumn } from './ReservationColumn';
import { ReservationCard } from './ReservationCard';

interface ReservationBoardProps {
    bookings: Booking[];
    guests: Guest[];
    rooms: Room[];
    roomTypes: RoomType[];
    /** Estado de cuenta por reserva, armado en la página con pagos y cargos */
    accounts: Map<string, BookingAccount>;
    /** Primero los que llegaron o salieron antes, o primero los últimos */
    order: BoardOrder;
    /** Con la pestaña "Salidas" elegida el tablero muestra también las viejas */
    allDepartures?: boolean;
    onStatusChange: (id: string, newStatus: BookingStatus) => void;
    onCardClick: (bookingId: string) => void;
}

const COLUMNS: { id: BoardStatus; title: string; color: string }[] = [
    { id: 'PENDING', title: 'Pendientes', color: 'bg-amber-400 ring-amber-400' },
    { id: 'CONFIRMED', title: 'Confirmadas', color: 'bg-blue-500 ring-blue-500' },
    { id: 'CHECKED_IN', title: 'Hospedadas', color: 'bg-emerald-500 ring-emerald-500' },
    { id: 'CHECKED_OUT', title: 'Salidas', color: 'bg-slate-400 ring-slate-400' },
];

export function ReservationBoard({ bookings, guests, rooms, roomTypes, accounts, order, allDepartures = false, onStatusChange, onCardClick }: ReservationBoardProps) {

    // El día entra como dependencia y no como `new Date()` suelto: el mostrador
    // deja esta pantalla abierta toda la noche, y a las 00:00 la columna de
    // salidas tiene que arrancar limpia sin que nadie recargue nada.
    const todayKey = formatLocalDate(new Date());
    const { columns, hiddenDepartures } = useMemo(
        () => buildBoard({
            bookings,
            today: new Date(`${todayKey}T00:00:00`),
            order,
            allDepartures,
        }),
        [bookings, todayKey, order, allDepartures]
    );

    const onDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        onStatusChange(draggableId, destination.droppableId as BookingStatus);
    };

    const getGuest = (id: string) => guests.find(g => g.id === id);
    const getRoom = (id: string) => rooms.find(r => r.id === id);
    const getRoomType = (id?: string) => roomTypes.find(rt => rt.id === id);

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            {/* Las columnas reparten el ancho en partes iguales. El min-w es el
                piso: recién cuando el tablero es más angosto que eso vuelve a
                aparecer el scroll lateral, en vez de aparecer siempre. */}
            <div className="flex h-full gap-3 overflow-x-auto pb-4 snap-x snap-mandatory px-4 md:px-0 scrollbar-hide">
                {COLUMNS.map(col => (
                    // min-w 240px: piso elegido para que 1366 —la resolución de
                    // notebook más común— entre sin scroll. Con 260 faltaban 14px
                    // y volvía a aparecer.
                    <div key={col.id} className="snap-start flex-1 min-w-[240px]">
                        <ReservationColumn
                            id={col.id}
                            title={col.title}
                            count={columns[col.id]?.length || 0}
                            headerColorClass={col.color}
                            hint={col.id === 'CHECKED_OUT' && hiddenDepartures > 0
                                ? `${hiddenDepartures} de días anteriores · están en la pestaña Salidas`
                                : undefined}
                        >
                            {columns[col.id]?.map((booking, index) => {
                                const room = getRoom(booking.roomId);
                                return (
                                    <ReservationCard
                                        key={booking.id}
                                        index={index}
                                        booking={booking}
                                        guest={getGuest(booking.guestId)}
                                        room={room}
                                        roomType={getRoomType(room?.roomTypeId)}
                                        account={accounts.get(booking.id) || buildBookingAccount({ booking })}
                                        onClick={() => onCardClick(booking.id)}
                                    />
                                );
                            })}
                        </ReservationColumn>
                    </div>
                ))}
            </div>
        </DragDropContext>
    );
}
