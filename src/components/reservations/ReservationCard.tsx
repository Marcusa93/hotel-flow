import { Draggable } from '@hello-pangea/dnd';
import { differenceInCalendarDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BedDouble, Moon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PaymentStateBadge } from '@/components/shared';
import type { BookingAccount } from '@/lib/bookingAccount';
import type { Booking, Guest, Room, RoomType } from '@/types/hotel';
import { cn, getInitials } from '@/lib/utils';

interface ReservationCardProps {
    booking: Booking;
    guest?: Guest;
    room?: Room;
    roomType?: RoomType;
    account: BookingAccount;
    index: number;
    onClick: () => void;
}

/**
 * Una reserva en el tablero.
 *
 * Compacta a propósito. La versión anterior apilaba tres bloques —huésped,
 * fechas, plata— y medía 147px: con la cabecera de la pantalla comiéndose la
 * mitad del alto, entraba una tarjeta y media por columna. Ahora la plata
 * comparte renglón con las fechas y son dos filas.
 */
export function ReservationCard({ booking, guest, room, roomType, account, index, onClick }: ReservationCardProps) {
    const nights = Math.max(
        0,
        differenceInCalendarDays(new Date(booking.checkOutDate), new Date(booking.checkInDate)),
    );
    const fecha = (d: Date | string) => format(new Date(d), 'd/M', { locale: es });

    return (
        <Draggable draggableId={booking.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={onClick}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
                    className={cn(
                        'mb-2 rounded-2xl border bg-white dark:bg-slate-900 p-3 cursor-pointer',
                        'border-slate-200 dark:border-slate-800',
                        'hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        // z-20 sobre los separadores pegajosos, que van en z-10:
                        // sin esto la tarjeta arrastrada se mete por detrás del
                        // título del tramo y parece que se cortó al medio.
                        snapshot.isDragging && 'z-20 shadow-xl ring-2 ring-primary/30 rotate-1',
                    )}
                >
                    {/* Quién y dónde */}
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-bold">
                                {getInitials(guest?.fullName || '??')}
                            </AvatarFallback>
                        </Avatar>
                        <p className="flex-1 min-w-0 truncate font-bold text-[14px] leading-tight text-slate-800 dark:text-slate-100">
                            {guest?.fullName || 'Sin huésped'}
                        </p>
                        <span className="shrink-0 flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                            <BedDouble className="w-3 h-3 opacity-60" />
                            {room?.roomNumber || '—'}
                            {roomType && <span className="opacity-40 font-normal">·{roomType.maxGuests}p</span>}
                        </span>
                    </div>

                    {/* Cuándo y cuánto, en un solo renglón */}
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground whitespace-nowrap">
                            {fecha(booking.checkInDate)} → {fecha(booking.checkOutDate)}
                            <span className="flex items-center gap-0.5 opacity-70">
                                <Moon className="w-3 h-3" />
                                {nights}N
                            </span>
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                            <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                                ${Math.round(account.total).toLocaleString('es-AR')}
                            </span>
                            <PaymentStateBadge account={account} className="h-5" />
                        </span>
                    </div>
                </div>
            )}
        </Draggable>
    );
}
