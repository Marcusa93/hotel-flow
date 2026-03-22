import { useState } from 'react';
import { addDays, format, isSameDay, startOfDay, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, User, Calendar as CalendarIcon, Users, CreditCard, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Booking, Room, RoomType, Guest } from '@/types/hotel';
import { useNavigate } from 'react-router-dom';

interface AvailabilityTimelineProps {
    rooms: Room[];
    bookings: Booking[];
    roomTypes: RoomType[];
    guests: Guest[];
}

export function AvailabilityTimeline({ rooms, bookings, roomTypes, guests }: AvailabilityTimelineProps) {
    const navigate = useNavigate();
    const [startDate, setStartDate] = useState(startOfDay(new Date()));
    const daysToShow = 14;

    const dates = Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i));

    const handlePrev = () => setStartDate(prev => addDays(prev, -7));
    const handleNext = () => setStartDate(prev => addDays(prev, 7));
    const handleToday = () => setStartDate(startOfDay(new Date()));

    // Helper to get guest name by ID
    const getGuestName = (guestId: string): string => {
        const guest = guests.find(g => g.id === guestId);
        return guest?.fullName || 'Huésped';
    };

    // Helper to get first name only
    const getGuestFirstName = (guestId: string): string => {
        const fullName = getGuestName(guestId);
        return fullName.split(' ')[0];
    };

    // Sort rooms numerically by room number (101, 102, 103...)
    const sortedRooms = [...rooms].sort((a, b) => {
        const numA = parseInt(a.roomNumber, 10);
        const numB = parseInt(b.roomNumber, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.roomNumber.localeCompare(b.roomNumber);
    });

    // Helper to get room type name
    const getRoomTypeName = (roomTypeId: string): string => {
        const type = roomTypes.find(rt => rt.id === roomTypeId);
        return type?.name || '';
    };

    const getBookingForRoomAndDate = (roomId: string, date: Date) => {
        return bookings.find(b => {
            const checkIn = startOfDay(new Date(b.checkInDate));
            const checkOut = startOfDay(new Date(b.checkOutDate));
            return b.roomId === roomId &&
                (isSameDay(date, checkIn) || (date > checkIn && date < checkOut));
        });
    };

    const getBookingStatusColor = (status: string) => {
        switch (status) {
            case 'CONFIRMED': return 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/50';
            case 'CHECKED_IN': return 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/50';
            case 'PENDING': return 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50';
            case 'CHECKED_OUT': return 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/50';
            default: return 'bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/50';
        }
    };

    const getBookingStatusLabel = (status: string) => {
        switch (status) {
            case 'CONFIRMED': return 'Confirmada';
            case 'CHECKED_IN': return 'Hospedado';
            case 'PENDING': return 'Pendiente';
            case 'CHECKED_OUT': return 'Check-out';
            case 'CANCELLED': return 'Cancelada';
            default: return status;
        }
    };

    const handleBookingClick = (bookingId: string) => {
        navigate(`/bookings/${bookingId}`);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handlePrev} className="h-9 w-9">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleToday} className="text-xs font-medium">
                        Hoy
                    </Button>
                    <div className="flex items-center gap-2 px-4 py-2 bg-background/50 backdrop-blur-sm border rounded-lg font-semibold text-sm">
                        <CalendarIcon className="w-4 h-4 text-primary" />
                        {format(startDate, "d MMM", { locale: es })} - {format(addDays(startDate, daysToShow - 1), "d MMM", { locale: es })}
                    </div>
                    <Button variant="outline" size="icon" onClick={handleNext} className="h-9 w-9">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-green-500/30 border border-green-500/60"></div>
                        <span className="text-muted-foreground">Hospedado</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-blue-500/30 border border-blue-500/60"></div>
                        <span className="text-muted-foreground">Confirmado</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-amber-500/30 border border-amber-500/60"></div>
                        <span className="text-muted-foreground">Pendiente</span>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border bg-background/40 backdrop-blur-md shadow-xl overflow-hidden">
                <ScrollArea className="w-full">
                    <div className="min-w-[900px]">
                        {/* Header Dates */}
                        <div className="grid grid-cols-[160px_1fr] border-b bg-muted/30 sticky top-0 z-20">
                            <div className="p-4 font-semibold text-sm text-muted-foreground border-r flex items-center">
                                Habitación
                            </div>
                            <div className="grid" style={{ gridTemplateColumns: `repeat(${daysToShow}, 1fr)` }}>
                                {dates.map((date) => (
                                    <div
                                        key={date.toISOString()}
                                        className={cn(
                                            "p-2 text-center border-r last:border-r-0 flex flex-col items-center justify-center min-w-[65px]",
                                            isSameDay(date, new Date()) && "bg-primary/10"
                                        )}
                                    >
                                        <span className="text-[10px] text-muted-foreground uppercase font-medium">
                                            {format(date, 'EEE', { locale: es })}
                                        </span>
                                        <span className={cn(
                                            "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mt-1",
                                            isSameDay(date, new Date()) && "bg-primary text-primary-foreground"
                                        )}>
                                            {format(date, 'd')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Rows — flat list sorted by room number */}
                        <div className="divide-y">
                            {sortedRooms.map(room => (
                                <div key={room.id} className="grid grid-cols-[160px_1fr] hover:bg-muted/10 transition-colors">
                                    <div className="p-3 border-r font-medium flex items-center justify-between bg-background/30 sticky left-0 z-10 backdrop-blur-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold">{room.roomNumber}</span>
                                            <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">{getRoomTypeName(room.roomTypeId)}</span>
                                            <span className="text-xs text-muted-foreground">P{room.floor}</span>
                                        </div>
                                        <div className={cn(
                                            "w-2.5 h-2.5 rounded-full shrink-0",
                                            room.status === 'AVAILABLE' ? "bg-green-500" :
                                                room.status === 'DIRTY' ? "bg-amber-500" :
                                                    room.status === 'MAINTENANCE' ? "bg-red-500" : "bg-gray-400"
                                        )} />
                                    </div>

                                    <div className="grid" style={{ gridTemplateColumns: `repeat(${daysToShow}, 1fr)` }}>
                                        {dates.map((date) => {
                                            const booking = getBookingForRoomAndDate(room.id, date);
                                            const isStart = booking && isSameDay(date, new Date(booking.checkInDate));
                                            const isEnd = booking && isSameDay(addDays(date, 1), new Date(booking.checkOutDate));
                                            const guestName = booking ? getGuestFirstName(booking.guestId) : '';
                                            const nights = booking ? differenceInDays(new Date(booking.checkOutDate), new Date(booking.checkInDate)) : 0;

                                            return (
                                                <div
                                                    key={date.toISOString()}
                                                    className={cn(
                                                        "border-r last:border-r-0 relative h-14 p-1",
                                                        isSameDay(date, new Date()) && "bg-primary/5"
                                                    )}
                                                >
                                                    {booking && (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <motion.div
                                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                                        animate={{ opacity: 1, scale: 1 }}
                                                                        onClick={() => handleBookingClick(booking.id)}
                                                                        className={cn(
                                                                            "h-full rounded-lg border text-[11px] font-medium p-1.5 flex items-center cursor-pointer shadow-sm overflow-hidden transition-all hover:scale-[1.02] hover:shadow-md",
                                                                            getBookingStatusColor(booking.status),
                                                                            isStart && "rounded-l-lg ml-0.5",
                                                                            isEnd && "rounded-r-lg mr-0.5",
                                                                            !isStart && !isEnd && "rounded-none border-x-0 mx-[-1px]"
                                                                        )}
                                                                    >
                                                                        {isStart && (
                                                                            <div className="flex items-center gap-1.5 overflow-hidden w-full">
                                                                                <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center shrink-0">
                                                                                    <User className="w-3 h-3" />
                                                                                </div>
                                                                                <div className="flex flex-col min-w-0">
                                                                                    <span className="truncate font-semibold">{guestName}</span>
                                                                                    <span className="text-[9px] opacity-70">{nights}N</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </motion.div>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top" className="bg-white dark:bg-slate-900 border shadow-xl p-0 overflow-hidden max-w-xs">
                                                                    <div className="p-3 space-y-2">
                                                                        <div className="flex items-center justify-between gap-4">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                                                                                    <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                                                                </div>
                                                                                <div>
                                                                                    <p className="font-bold text-sm">{getGuestName(booking.guestId)}</p>
                                                                                    <p className="text-xs text-muted-foreground">Hab. {room.roomNumber}</p>
                                                                                </div>
                                                                            </div>
                                                                            <Badge variant={booking.status === 'CHECKED_IN' ? 'default' : 'secondary'} className="text-[10px]">
                                                                                {getBookingStatusLabel(booking.status)}
                                                                            </Badge>
                                                                        </div>

                                                                        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                                                                            <div className="text-center">
                                                                                <p className="text-[10px] text-muted-foreground">Check-in</p>
                                                                                <p className="text-xs font-semibold">{format(new Date(booking.checkInDate), 'dd MMM')}</p>
                                                                            </div>
                                                                            <div className="text-center">
                                                                                <p className="text-[10px] text-muted-foreground">Noches</p>
                                                                                <p className="text-xs font-semibold">{nights}</p>
                                                                            </div>
                                                                            <div className="text-center">
                                                                                <p className="text-[10px] text-muted-foreground">Check-out</p>
                                                                                <p className="text-xs font-semibold">{format(new Date(booking.checkOutDate), 'dd MMM')}</p>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center justify-between pt-2 border-t">
                                                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                                <Users className="w-3 h-3" />
                                                                                <span>{booking.adults} adultos{booking.children > 0 ? `, ${booking.children} niños` : ''}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                                                                                <CreditCard className="w-3 h-3" />
                                                                                ${booking.totalAmount.toLocaleString()}
                                                                            </div>
                                                                        </div>

                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="w-full text-xs h-7 mt-1"
                                                                            onClick={() => handleBookingClick(booking.id)}
                                                                        >
                                                                            Ver reserva <ExternalLink className="w-3 h-3 ml-1" />
                                                                        </Button>
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>
        </div>
    );
}
