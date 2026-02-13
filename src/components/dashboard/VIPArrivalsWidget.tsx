import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarCheck, ArrowRight, BedDouble, Users, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { usePaymentOperations } from '@/hooks/domain/usePaymentOperations';
import { isToday, isTomorrow, addDays, startOfDay, isAfter, setHours } from 'date-fns';
import { QuickCheckInDialog } from '@/components/bookings/QuickCheckInDialog';

export function UpcomingArrivalsWidget() {
    const { bookings } = useBookingOperations();
    const { guests } = useGuestOperations();
    const { rooms, roomTypes } = useRoomOperations();
    const { payments } = usePaymentOperations();
    const navigate = useNavigate();

    const [checkInDialog, setCheckInDialog] = useState<{
        open: boolean;
        booking: typeof upcomingArrivals[0] | null;
    }>({ open: false, booking: null });

    // Get upcoming arrivals (today and tomorrow) with CONFIRMED status
    const upcomingArrivals = useMemo(() => {
        const today = startOfDay(new Date());
        const now = new Date();
        // Consider "late" if it's past 2 PM (14:00) and still not checked in
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

                // Calculate amount paid
                const bookingPayments = payments.filter(p => p.bookingId === booking.id);
                const amountPaid = bookingPayments.reduce((sum, p) => sum + p.amount, 0);

                // Check if guest is late (today's check-in, past 2 PM, not arrived)
                const isLate = isToday(checkInDate) && isAfter(now, lateThreshold);

                return {
                    id: booking.id,
                    guestName: guest?.fullName || 'Huésped',
                    guestEmail: guest?.email || '',
                    roomNumber: room?.roomNumber || '-',
                    roomId: room?.id || '',
                    roomTypeName: roomType?.name || 'Habitación',
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
                // Sort late arrivals first
                if (a.isLate && !b.isLate) return -1;
                if (!a.isLate && b.isLate) return 1;
                return a.checkInDate.getTime() - b.checkInDate.getTime();
            })
            .slice(0, 4);
    }, [bookings, guests, rooms, roomTypes, payments]);

    const handleQuickCheckIn = (arrival: typeof upcomingArrivals[0], e: React.MouseEvent) => {
        e.stopPropagation();
        setCheckInDialog({ open: true, booking: arrival });
    };

    return (
        <>
            <Card className="border-none shadow-lg bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />

                <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-100">
                            <CalendarCheck className="w-4 h-4 text-blue-500" />
                            Llegadas Pendientes
                            {upcomingArrivals.some(a => a.isLate) && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 animate-pulse">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Atención
                                </Badge>
                            )}
                        </CardTitle>
                        <Link to="/bookings">
                            <Button size="sm" variant="ghost" className="h-8 text-muted-foreground hover:text-primary">
                                Ver todas <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                        </Link>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {upcomingArrivals.length === 0 ? (
                        <div className="text-center py-8">
                            <CalendarCheck className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                            <p className="text-sm text-muted-foreground">No hay llegadas pendientes</p>
                            <p className="text-xs text-muted-foreground/70 mt-1">Las próximas reservas aparecerán aquí</p>
                        </div>
                    ) : (
                        upcomingArrivals.map(arrival => (
                            <div
                                key={arrival.id}
                                onClick={() => navigate(`/bookings/${arrival.id}`)}
                                className={`
                                    flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800/50 
                                    border transition-all cursor-pointer group
                                    ${arrival.isLate
                                        ? 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10'
                                        : 'border-slate-100 dark:border-slate-700/50 hover:border-blue-200 dark:hover:border-blue-800'
                                    }
                                    hover:shadow-md
                                `}
                            >
                                <Avatar className="h-10 w-10 border-2 border-white dark:border-slate-700 shadow-sm">
                                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${arrival.guestEmail}`} />
                                    <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs font-medium">
                                        {arrival.guestName.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                                            {arrival.guestName}
                                        </p>
                                        {arrival.isLate ? (
                                            <Badge
                                                variant="destructive"
                                                className="text-[10px] px-1.5 py-0"
                                            >
                                                <AlertCircle className="w-3 h-3 mr-0.5" />
                                                No llegó
                                            </Badge>
                                        ) : (
                                            <Badge
                                                variant="outline"
                                                className={`text-[10px] px-1.5 py-0 ${arrival.isToday
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                                                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                                                    }`}
                                            >
                                                {arrival.isToday ? 'Hoy' : 'Mañana'}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                        <span className="flex items-center gap-1">
                                            <BedDouble className="w-3 h-3" />
                                            {arrival.roomNumber} • {arrival.roomTypeName}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            {arrival.adults + arrival.children}
                                        </span>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                                        ${arrival.totalAmount.toLocaleString('es-AR')}
                                    </p>
                                    <Button
                                        size="sm"
                                        className={`h-6 text-[10px] mt-1 transition-opacity ${arrival.isLate
                                                ? 'bg-rose-500 hover:bg-rose-600 opacity-100'
                                                : 'bg-blue-500 hover:bg-blue-600 opacity-0 group-hover:opacity-100'
                                            } text-white`}
                                        onClick={(e) => handleQuickCheckIn(arrival, e)}
                                    >
                                        Check-in
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            {/* Quick Check-in Dialog */}
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
