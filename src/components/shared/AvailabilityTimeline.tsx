import { useState } from 'react';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, User, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Booking, Room, RoomType } from '@/types/hotel';

interface AvailabilityTimelineProps {
    rooms: Room[];
    bookings: Booking[];
    roomTypes: RoomType[];
}

export function AvailabilityTimeline({ rooms, bookings, roomTypes }: AvailabilityTimelineProps) {
    const [startDate, setStartDate] = useState(startOfDay(new Date()));
    const daysToShow = 14;

    const dates = Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i));

    const handlePrev = () => setStartDate(prev => addDays(prev, -7));
    const handleNext = () => setStartDate(prev => addDays(prev, 7));

    // Group rooms by type name using roomTypeId
    const roomsByType = rooms.reduce((acc, room) => {
        const type = roomTypes.find(rt => rt.id === room.roomTypeId);
        const typeName = type ? type.name : 'Desconocido';

        if (!acc[typeName]) {
            acc[typeName] = [];
        }
        acc[typeName].push(room);
        return acc;
    }, {} as Record<string, Room[]>);

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

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handlePrev}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2 px-4 py-2 bg-background/50 backdrop-blur-sm border rounded-lg font-medium">
                        <CalendarIcon className="w-4 h-4 text-primary" />
                        {format(startDate, 'MMMM yyyy', { locale: es })}
                    </div>
                    <Button variant="outline" size="icon" onClick={handleNext}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                        <span>Hospedado</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-blue-500/20 border border-blue-500/50"></div>
                        <span>Confirmado</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
                        <span>Pendiente</span>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border bg-background/40 backdrop-blur-md shadow-xl overflow-hidden glass">
                <ScrollArea className="w-full">
                    <div className="min-w-[800px]">
                        {/* Header Dates */}
                        <div className="grid grid-cols-[150px_1fr] border-b bg-muted/30">
                            <div className="p-4 font-semibold text-sm text-muted-foreground border-r flex items-center">
                                Habitación
                            </div>
                            <div className="grid" style={{ gridTemplateColumns: `repeat(${daysToShow}, 1fr)` }}>
                                {dates.map((date, i) => (
                                    <div
                                        key={date.toISOString()}
                                        className={cn(
                                            "p-2 text-center border-r last:border-r-0 flex flex-col items-center justify-center min-w-[60px]",
                                            isSameDay(date, new Date()) && "bg-primary/5"
                                        )}
                                    >
                                        <span className="text-xs text-muted-foreground uppercase">{format(date, 'EEE', { locale: es })}</span>
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

                        {/* Rows */}
                        <div className="divide-y">
                            {Object.entries(roomsByType).map(([type, typeRooms]) => (
                                <div key={type} className="group">
                                    {/* Type Header */}
                                    <div className="px-4 py-2 bg-muted/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground sticky left-0">
                                        {type}
                                    </div>

                                    {typeRooms.map(room => (
                                        <div key={room.id} className="grid grid-cols-[150px_1fr] hover:bg-muted/10 transition-colors">
                                            <div className="p-3 border-r font-medium flex items-center justify-between bg-background/20 sticky left-0 z-10 backdrop-blur-[2px]">
                                                <span>{room.roomNumber}</span>
                                                <div className={cn(
                                                    "w-2 h-2 rounded-full",
                                                    room.status === 'AVAILABLE' ? "bg-green-500" :
                                                        room.status === 'DIRTY' ? "bg-amber-500" :
                                                            room.status === 'MAINTENANCE' ? "bg-red-500" : "bg-gray-400"
                                                )} />
                                            </div>

                                            <div className="grid" style={{ gridTemplateColumns: `repeat(${daysToShow}, 1fr)` }}>
                                                {dates.map((date) => {
                                                    const booking = getBookingForRoomAndDate(room.id, date);
                                                    const isStart = booking && isSameDay(date, new Date(booking.checkInDate));
                                                    const isEnd = booking && isSameDay(date, new Date(booking.checkOutDate));

                                                    return (
                                                        <div
                                                            key={date.toISOString()}
                                                            className={cn(
                                                                "border-r last:border-r-0 relative h-12 p-1",
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
                                                                                className={cn(
                                                                                    "h-full rounded-md border text-[10px] font-medium p-1 flex items-center justify-center cursor-pointer shadow-sm overflow-hidden whitespace-nowrap",
                                                                                    getBookingStatusColor(booking.status),
                                                                                    isStart && "rounded-l-md ml-0.5",
                                                                                    isEnd && "rounded-r-md mr-0.5",
                                                                                    !isStart && !isEnd && "rounded-none border-x-0 mx-[-1px]"
                                                                                )}
                                                                            >
                                                                                {isStart && (
                                                                                    <div className="flex items-center gap-1 overflow-hidden">
                                                                                        <User className="w-3 h-3 shrink-0" />
                                                                                        <span className="truncate">{booking.guestId}</span>
                                                                                    </div>
                                                                                )}
                                                                            </motion.div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent className="glass border-none shadow-xl p-3">
                                                                            <div className="space-y-1">
                                                                                <p className="font-bold text-sm">Reserva #{booking.id.slice(0, 4)}</p>
                                                                                <p className="text-xs text-muted-foreground">Estado: {booking.status}</p>
                                                                                <p className="text-xs">Check-in: {format(new Date(booking.checkInDate), 'dd MMM')}</p>
                                                                                <p className="text-xs">Check-out: {format(new Date(booking.checkOutDate), 'dd MMM')}</p>
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
                            ))}
                        </div>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>
        </div>
    );
}
