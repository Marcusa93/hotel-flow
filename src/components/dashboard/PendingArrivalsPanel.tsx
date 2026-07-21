import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { formatLastNameFirst } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { usePaymentOperations } from '@/hooks/domain/usePaymentOperations';
import { isToday, isTomorrow, startOfDay, isAfter, setHours, setMinutes } from 'date-fns';
import { QuickCheckInDialog } from '@/components/bookings/QuickCheckInDialog';

const VISIBLE_ROWS = 3;

/** Llegadas de hoy y mañana, en una fila por reserva para que entre junto al resumen. */
export function PendingArrivalsPanel() {
    const { bookings } = useBookingOperations();
    const { guests } = useGuestOperations();
    const { rooms, roomTypes } = useRoomOperations();
    const { payments } = usePaymentOperations();
    const navigate = useNavigate();

    const [checkInDialog, setCheckInDialog] = useState<{
        open: boolean;
        booking: typeof arrivals[0] | null;
    }>({ open: false, booking: null });

    const arrivals = useMemo(() => {
        const today = startOfDay(new Date());
        const now = new Date();
        // Se considera "no llegó" pasadas las 14:00 si no avisó otro horario
        const lateThreshold = setHours(today, 14);

        return bookings
            .filter(b => {
                const checkIn = new Date(b.checkInDate);
                return (isToday(checkIn) || isTomorrow(checkIn)) && b.status === 'CONFIRMED';
            })
            .map(booking => {
                const guest = guests.find(g => g.id === booking.guestId);
                const room = rooms.find(r => r.id === booking.roomId);
                const roomType = roomTypes.find(rt => rt.id === room?.roomTypeId);
                const checkInDate = new Date(booking.checkInDate);
                const checkOutDate = new Date(booking.checkOutDate);

                const bookingPayments = payments.filter(p => p.bookingId === booking.id);
                const amountPaid = bookingPayments.reduce((sum, p) => sum + p.amount, 0);

                // Late = pasada la hora que avisó el huésped, o las 14:00 si no avisó ninguna.
                const eta = booking.estimatedArrivalTime;
                let threshold = lateThreshold;
                if (eta) {
                    const [h, m] = eta.split(':').map(Number);
                    if (!Number.isNaN(h) && !Number.isNaN(m)) {
                        threshold = setMinutes(setHours(today, h), m);
                    }
                }
                const isLate = isToday(checkInDate) && isAfter(now, threshold);

                return {
                    id: booking.id,
                    guestName: guest ? formatLastNameFirst(guest.fullName) : 'Huésped',
                    roomNumber: room?.roomNumber || '-',
                    roomId: room?.id || '',
                    roomTypeName: roomType ? `${roomType.maxGuests}p` : '',
                    checkInDate,
                    checkOutDate,
                    isToday: isToday(checkInDate),
                    isLate,
                    totalAmount: booking.totalAmount,
                    amountPaid,
                    adults: booking.adults,
                    children: booking.children,
                };
            })
            .sort((a, b) => {
                if (a.isLate && !b.isLate) return -1;
                if (!a.isLate && b.isLate) return 1;
                return a.checkInDate.getTime() - b.checkInDate.getTime();
            });
    }, [bookings, guests, rooms, roomTypes, payments]);

    const visible = arrivals.slice(0, VISIBLE_ROWS);
    const hidden = arrivals.length - visible.length;
    const lateCount = arrivals.filter(a => a.isLate).length;

    return (
        <>
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <CalendarCheck className="w-3.5 h-3.5 text-blue-500" />
                        Llegadas pendientes
                        {arrivals.length > 0 && (
                            <span className="text-slate-400 dark:text-slate-500 font-semibold">({arrivals.length})</span>
                        )}
                    </h4>
                    {lateCount > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                            <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                            {lateCount} sin llegar
                        </Badge>
                    )}
                </div>

                {arrivals.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">Sin llegadas para hoy ni mañana.</p>
                ) : (
                    <div className="space-y-1">
                        {visible.map(arrival => (
                            <div
                                key={arrival.id}
                                role="button"
                                tabIndex={0}
                                title={arrival.isLate
                                    ? `${arrival.guestName} — llegaba hoy y todavía no se presentó`
                                    : `${arrival.guestName} — llega ${arrival.isToday ? 'hoy' : 'mañana'}`}
                                onClick={() => navigate(`/bookings/${arrival.id}`)}
                                onKeyDown={e => e.key === 'Enter' && navigate(`/bookings/${arrival.id}`)}
                                className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer transition-colors ${arrival.isLate
                                    ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                    : 'border-transparent hover:bg-white dark:hover:bg-slate-800/60 hover:border-slate-200 dark:hover:border-slate-700'
                                    }`}
                            >
                                <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${arrival.isLate ? 'bg-rose-500' : arrival.isToday ? 'bg-emerald-500' : 'bg-amber-400'
                                        }`}
                                />
                                <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate flex-1 min-w-0">
                                    {arrival.guestName}
                                </span>
                                <span className="text-xs text-muted-foreground shrink-0">
                                    Hab {arrival.roomNumber}
                                </span>
                                {/* Cuando la fila queda angosta (mobile, o la columna del resumen entre
                                    1024 y 1280) el color del punto ya distingue hoy/mañana y el texto se
                                    oculta para que el nombre no se corte. Si está demorada, siempre se ve. */}
                                <span
                                    className={`text-[10px] font-semibold shrink-0 w-12 text-right ${arrival.isLate
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : arrival.isToday
                                            ? 'text-emerald-600 dark:text-emerald-400 hidden sm:block lg:hidden xl:block'
                                            : 'text-amber-600 dark:text-amber-500 hidden sm:block lg:hidden xl:block'
                                        }`}
                                >
                                    {arrival.isLate ? 'No llegó' : arrival.isToday ? 'Hoy' : 'Mañana'}
                                </span>
                                <Button
                                    size="sm"
                                    className={`h-6 px-2 text-[10px] shrink-0 text-white ${arrival.isLate
                                        ? 'bg-rose-500 hover:bg-rose-600'
                                        : 'bg-blue-500 hover:bg-blue-600'
                                        }`}
                                    onClick={e => {
                                        e.stopPropagation();
                                        setCheckInDialog({ open: true, booking: arrival });
                                    }}
                                >
                                    Check-in
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {(hidden > 0 || arrivals.length > 0) && (
                    <button
                        onClick={() => navigate('/bookings')}
                        className="mt-1.5 self-start text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                    >
                        {hidden > 0 ? `Ver ${hidden} llegada${hidden > 1 ? 's' : ''} más` : 'Ver todas las reservas'}
                        <ArrowRight className="w-3 h-3" />
                    </button>
                )}
            </div>

            {checkInDialog.booking && (
                <QuickCheckInDialog
                    open={checkInDialog.open}
                    onOpenChange={(open) => setCheckInDialog({ ...checkInDialog, open })}
                    bookingId={checkInDialog.booking.id}
                    guestName={checkInDialog.booking.guestName}
                    roomNumber={checkInDialog.booking.roomNumber}
                    roomId={checkInDialog.booking.roomId}
                    checkInDate={checkInDialog.booking.checkInDate}
                    checkOutDate={checkInDialog.booking.checkOutDate}
                    totalAmount={checkInDialog.booking.totalAmount}
                    amountPaid={checkInDialog.booking.amountPaid}
                    adults={checkInDialog.booking.adults}
                    children={checkInDialog.booking.children}
                />
            )}
        </>
    );
}
