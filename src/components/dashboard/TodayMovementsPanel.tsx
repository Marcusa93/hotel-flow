import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight, AlertCircle, ArrowRight, LogIn, LogOut, Car } from 'lucide-react';
import { formatLastNameFirst } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { usePaymentOperations } from '@/hooks/domain/usePaymentOperations';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import { isToday, isTomorrow, startOfDay, isAfter, isBefore, setHours, setMinutes } from 'date-fns';
import { QuickCheckInDialog } from '@/components/bookings/QuickCheckInDialog';
import { CheckoutDialog } from '@/components/bookings/CheckoutDialog';
import type { BookingWithDetails } from '@/types/hotel';

const VISIBLE_ROWS = 3;

/** Entrada o salida, y qué tan urgente es. El orden del enum es el orden de la lista. */
const URGENCY = ['late', 'today', 'tomorrow'] as const;
type Urgency = typeof URGENCY[number];

interface Movement {
    key: string;
    bookingId: string;
    kind: 'IN' | 'OUT';
    urgency: Urgency;
    guestName: string;
    roomNumber: string;
    roomId: string;
    hasVehicle?: boolean;
    licensePlate?: string;
    /** Datos que necesitan los diálogos de check-in / check-out */
    checkInDate: Date;
    checkOutDate: Date;
    totalAmount: number;
    amountPaid: number;
    adults: number;
    children: number;
}

const parseTime = (value: string | undefined, fallbackHour: number, day: Date): Date => {
    const [h, m] = (value || '').split(':').map(Number);
    return Number.isNaN(h) || Number.isNaN(m)
        ? setHours(day, fallbackHour)
        : setMinutes(setHours(day, h), m);
};

/**
 * Lo que entra y lo que sale hoy, en una sola lista y con la acción al lado.
 *
 * Antes solo mostraba llegadas: las salidas se avisaban (alertas, push) pero
 * para hacer el check-out había que ir a Reservas → reserva → detalle.
 */
export function TodayMovementsPanel() {
    const { bookings } = useBookingOperations();
    const { guests } = useGuestOperations();
    const { rooms, roomTypes } = useRoomOperations();
    const { payments } = usePaymentOperations();
    const { data: hotelSettings } = useHotelSettings();
    const navigate = useNavigate();

    const [checkInDialog, setCheckInDialog] = useState<Movement | null>(null);
    const [checkoutBooking, setCheckoutBooking] = useState<BookingWithDetails | null>(null);

    const checkOutTime = hotelSettings?.checkOutTime;

    const movements = useMemo(() => {
        const today = startOfDay(new Date());
        const now = new Date();
        const result: Movement[] = [];

        for (const booking of bookings) {
            const guest = guests.find(g => g.id === booking.guestId);
            const room = rooms.find(r => r.id === booking.roomId);
            const checkInDate = new Date(booking.checkInDate);
            const checkOutDate = new Date(booking.checkOutDate);
            const amountPaid = payments
                .filter(p => p.bookingId === booking.id)
                .reduce((sum, p) => sum + p.amount, 0);

            const base = {
                bookingId: booking.id,
                guestName: guest ? formatLastNameFirst(guest.fullName) : 'Huésped',
                roomNumber: room?.roomNumber || '-',
                roomId: room?.id || '',
                hasVehicle: booking.hasVehicle,
                licensePlate: booking.licensePlate,
                checkInDate,
                checkOutDate,
                totalAmount: booking.totalAmount,
                amountPaid,
                adults: booking.adults,
                children: booking.children,
            };

            // ── Llegadas: confirmadas de hoy y mañana ──
            if (booking.status === 'CONFIRMED' && (isToday(checkInDate) || isTomorrow(checkInDate))) {
                // Tarde = pasada la hora que avisó el huésped, o las 14:00 si no avisó.
                const threshold = parseTime(booking.estimatedArrivalTime, 14, today);
                const isLate = isToday(checkInDate) && isAfter(now, threshold);
                result.push({
                    ...base,
                    key: `${booking.id}-in`,
                    kind: 'IN',
                    urgency: isLate ? 'late' : isToday(checkInDate) ? 'today' : 'tomorrow',
                });
            }

            // ── Salidas: alojados que se van hoy o mañana ──
            if (booking.status === 'CHECKED_IN' && !isAfter(startOfDay(checkOutDate), startOfDay(new Date(today.getTime() + 86400000)))) {
                // Se pasó de hora: quedó de un día anterior, o ya pasó la hora de
                // check-out del hotel (la configurada en Ajustes, no una fija).
                const overdue =
                    isBefore(startOfDay(checkOutDate), today) ||
                    (isToday(checkOutDate) && isAfter(now, parseTime(checkOutTime, 11, today)));
                result.push({
                    ...base,
                    key: `${booking.id}-out`,
                    kind: 'OUT',
                    urgency: overdue ? 'late' : isToday(checkOutDate) ? 'today' : 'tomorrow',
                });
            }
        }

        // Lo urgente primero; dentro de cada nivel, las salidas antes que las
        // llegadas: liberar la habitación es lo que destraba el resto del día.
        return result.sort((a, b) => {
            const byUrgency = URGENCY.indexOf(a.urgency) - URGENCY.indexOf(b.urgency);
            if (byUrgency !== 0) return byUrgency;
            if (a.kind !== b.kind) return a.kind === 'OUT' ? -1 : 1;
            return a.roomNumber.localeCompare(b.roomNumber);
        });
    }, [bookings, guests, rooms, payments, checkOutTime]);

    const visible = movements.slice(0, VISIBLE_ROWS);
    const hidden = movements.length - visible.length;
    const lateCount = movements.filter(m => m.urgency === 'late').length;

    const openCheckout = (movement: Movement) => {
        const booking = bookings.find(b => b.id === movement.bookingId);
        const guest = guests.find(g => g.id === booking?.guestId);
        const room = rooms.find(r => r.id === booking?.roomId);
        const roomType = roomTypes.find(rt => rt.id === room?.roomTypeId);
        if (!booking || !guest || !room || !roomType) {
            navigate(`/bookings/${movement.bookingId}`);
            return;
        }
        setCheckoutBooking({
            ...booking,
            guest,
            room,
            roomType,
            payments: payments.filter(p => p.bookingId === booking.id),
        });
    };

    return (
        <>
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500" />
                        Entradas y salidas
                        {movements.length > 0 && (
                            <span className="text-slate-400 dark:text-slate-500 font-semibold">({movements.length})</span>
                        )}
                    </h4>
                    {lateCount > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                            <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                            {lateCount} atrasado{lateCount > 1 ? 's' : ''}
                        </Badge>
                    )}
                </div>

                {movements.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">Sin entradas ni salidas pendientes.</p>
                ) : (
                    <div className="space-y-1">
                        {visible.map(movement => {
                            const isLate = movement.urgency === 'late';
                            const KindIcon = movement.kind === 'IN' ? LogIn : LogOut;
                            return (
                                <div
                                    key={movement.key}
                                    role="button"
                                    tabIndex={0}
                                    title={rowTooltip(movement)}
                                    onClick={() => navigate(`/bookings/${movement.bookingId}`)}
                                    onKeyDown={e => e.key === 'Enter' && navigate(`/bookings/${movement.bookingId}`)}
                                    className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer transition-colors ${isLate
                                        ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                        : 'border-transparent hover:bg-white dark:hover:bg-slate-800/60 hover:border-slate-200 dark:hover:border-slate-700'
                                        }`}
                                >
                                    <KindIcon
                                        className={`w-3.5 h-3.5 shrink-0 ${isLate
                                            ? 'text-rose-500'
                                            : movement.kind === 'IN'
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-amber-600 dark:text-amber-500'
                                            }`}
                                    />
                                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate flex-1 min-w-0">
                                        {movement.guestName}
                                    </span>
                                    {movement.hasVehicle && (
                                        <Car className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-label="En auto" />
                                    )}
                                    <span className="text-xs text-muted-foreground shrink-0">
                                        Hab {movement.roomNumber}
                                    </span>
                                    {/* Con la fila angosta el ícono ya distingue entrada de salida. */}
                                    <span
                                        className={`text-[10px] font-semibold shrink-0 w-12 text-right ${isLate
                                            ? 'text-rose-600 dark:text-rose-400'
                                            : 'text-muted-foreground hidden sm:block lg:hidden xl:block'
                                            }`}
                                    >
                                        {stateLabel(movement)}
                                    </span>
                                    <Button
                                        size="sm"
                                        className={`h-6 px-2 text-[10px] shrink-0 text-white ${isLate
                                            ? 'bg-rose-500 hover:bg-rose-600'
                                            : movement.kind === 'IN'
                                                ? 'bg-blue-500 hover:bg-blue-600'
                                                : 'bg-slate-700 hover:bg-slate-800'
                                            }`}
                                        onClick={e => {
                                            e.stopPropagation();
                                            if (movement.kind === 'IN') setCheckInDialog(movement);
                                            else openCheckout(movement);
                                        }}
                                    >
                                        {movement.kind === 'IN' ? 'Check-in' : 'Check-out'}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {movements.length > 0 && (
                    <button
                        onClick={() => navigate('/bookings')}
                        className="mt-1.5 self-start text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                    >
                        {hidden > 0 ? `Ver ${hidden} movimiento${hidden > 1 ? 's' : ''} más` : 'Ver todas las reservas'}
                        <ArrowRight className="w-3 h-3" />
                    </button>
                )}
            </div>

            {checkInDialog && (
                <QuickCheckInDialog
                    open
                    onOpenChange={open => !open && setCheckInDialog(null)}
                    bookingId={checkInDialog.bookingId}
                    guestName={checkInDialog.guestName}
                    roomNumber={checkInDialog.roomNumber}
                    roomId={checkInDialog.roomId}
                    checkInDate={checkInDialog.checkInDate}
                    checkOutDate={checkInDialog.checkOutDate}
                    totalAmount={checkInDialog.totalAmount}
                    amountPaid={checkInDialog.amountPaid}
                    adults={checkInDialog.adults}
                    children={checkInDialog.children}
                />
            )}

            {checkoutBooking && (
                <CheckoutDialog
                    open
                    onOpenChange={open => !open && setCheckoutBooking(null)}
                    booking={checkoutBooking}
                    bookingPayments={checkoutBooking.payments}
                    onCheckoutComplete={() => setCheckoutBooking(null)}
                />
            )}
        </>
    );
}

function stateLabel(movement: Movement): string {
    if (movement.kind === 'IN') {
        return movement.urgency === 'late' ? 'No llegó' : movement.urgency === 'today' ? 'Llega hoy' : 'Mañana';
    }
    return movement.urgency === 'late' ? 'Se pasó' : movement.urgency === 'today' ? 'Sale hoy' : 'Mañana';
}

function rowTooltip(movement: Movement): string {
    const what = movement.kind === 'IN'
        ? movement.urgency === 'late'
            ? 'llegaba hoy y todavía no se presentó'
            : `llega ${movement.urgency === 'today' ? 'hoy' : 'mañana'}`
        : movement.urgency === 'late'
            ? 'pasó la hora de check-out y sigue alojado'
            : `sale ${movement.urgency === 'today' ? 'hoy' : 'mañana'}`;

    const car = movement.hasVehicle
        ? `En auto${movement.licensePlate ? ` (${movement.licensePlate})` : ''}`
        : '';

    return [`${movement.guestName} — ${what}`, car].filter(Boolean).join(' · ');
}
