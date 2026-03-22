import { useRef } from 'react';
import {
    format,
    differenceInDays,
    startOfDay,
    isSameDay
} from 'date-fns';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Booking, Room, Guest } from '@/types/hotel';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TimelineViewProps {
    days: Date[];
    rooms: Room[];
    bookings: Booking[];
    getBookingsForDay: (day: Date) => Booking[];
    getGuest: (id: string) => Guest | undefined;
}

const DAY_WIDTH = 80;

export function TimelineView({
    days,
    rooms,
    bookings,
    getGuest
}: TimelineViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const startDate = days[0];

    // Helper to position bubbles
    const getPositionStyle = (booking: Booking) => {
        const checkIn = new Date(booking.checkInDate);
        const checkOut = new Date(booking.checkOutDate);

        // Calculate offset days from start of timeline
        // Math.max(0, ...) ensures we handle bookings starting before the visible range gracefully-ish
        // (though in a real infinite scroll we'd handle virtual windowing)
        const startDiff = differenceInDays(startOfDay(checkIn), startOfDay(startDate));
        const duration = differenceInDays(startOfDay(checkOut), startOfDay(checkIn)) || 1;

        return {
            left: `${startDiff * DAY_WIDTH}px`,
            width: `${duration * DAY_WIDTH}px`,
        };
    };

    return (
        <div className="flex-1 min-h-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl mt-4 rounded-2xl border border-white/20 shadow-lg flex flex-col overflow-hidden relative">

            {/* Scrollable Container */}
            <div
                ref={containerRef}
                className="overflow-x-auto overflow-y-auto flex-1 relative scroll-smooth"
            >
                <div> {/* Wrapper for width constraint */}

                    {/* Sticky Header (Dates) */}
                    <div className="sticky top-0 z-20 flex bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 min-w-max">
                        {/* Sticky Corner (Room Label Placeholder) */}
                        <div className="sticky left-0 z-30 w-[160px] bg-slate-50/95 dark:bg-slate-900/95 border-r border-slate-200 dark:border-slate-800 flex items-center justify-center font-bold text-xs uppercase tracking-widest text-muted-foreground shadow-sm">
                            Habitaciones
                        </div>

                        {/* Dates Track */}
                        {days.map(day => (
                            <div
                                key={day.toISOString()}
                                style={{ width: DAY_WIDTH }}
                                className={cn(
                                    "flex-none h-[50px] flex flex-col items-center justify-center border-r border-slate-100 dark:border-slate-800 p-1",
                                    isSameDay(day, new Date()) && "bg-blue-50/50 dark:bg-blue-900/20"
                                )}
                            >
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{format(day, 'EEE')}</span>
                                <span className={cn(
                                    "text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full",
                                    isSameDay(day, new Date()) ? "bg-primary text-white shadow-md" : "text-slate-700 dark:text-slate-300"
                                )}>
                                    {format(day, 'd')}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Room Rows */}
                    <div className="relative min-w-max">
                        {/* Current Time Indicator Line (Approximate for 'Today') */}
                        {/* Implementing accurate time indicator requires precise hour calculation, skipping for MVP visuals */}

                        {rooms.map(room => {
                            // Find bookings for this room that interact with the visible timeline
                            // Ideally this filtering happens in parent or memoized
                            const roomBookings = bookings.filter(b =>
                                b.roomId === room.id &&
                                ['CONFIRMED', 'CHECKED_IN', 'PENDING'].includes(b.status)
                            );

                            return (
                                <div key={room.id} className="flex h-[60px] border-b border-slate-100 dark:border-slate-800 hover:bg-white/40 dark:hover:bg-slate-800/30 transition-colors group">
                                    {/* Sticky Room Label */}
                                    <div className="sticky left-0 z-10 w-[160px] flex-none bg-white/90 dark:bg-slate-900/90 backdrop-blur border-r border-slate-200 dark:border-slate-800 flex items-center px-4 gap-3 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)]">
                                        <div className={cn(
                                            "w-2 h-8 rounded-full",
                                            room.status === 'AVAILABLE' ? "bg-emerald-500" :
                                                room.status === 'DIRTY' ? "bg-amber-500" :
                                                    room.status === 'OCCUPIED' ? "bg-rose-500" : "bg-slate-500"
                                        )} />
                                        <div>
                                            <p className="font-bold text-sm text-slate-700 dark:text-slate-200">{room.roomNumber}</p>
                                            <p className="text-[10px] text-muted-foreground truncate max-w-[80px]">{room.type}</p>
                                        </div>
                                    </div>

                                    {/* Timeline Lane */}
                                    <div className="relative flex">
                                        {/* Background Grid Cells */}
                                        {days.map(day => (
                                            <div
                                                key={day.toISOString()}
                                                style={{ width: DAY_WIDTH }}
                                                className={cn(
                                                    "flex-none border-r border-slate-50 dark:border-slate-800/50 h-full",
                                                    isSameDay(day, new Date()) && "bg-blue-50/20 dark:bg-blue-900/10"
                                                )}
                                            />
                                        ))}

                                        {/* Booking Pills layer */}
                                        {roomBookings.map(booking => {
                                            const guest = getGuest(booking.guestId);
                                            const style = getPositionStyle(booking);

                                            // Ensure we only render if it's within our visual range roughly
                                            // (Simplified logic: CSS overflow handles cutting it off, but style needs to be valid)

                                            return (
                                                <Tooltip key={booking.id}>
                                                    <TooltipTrigger asChild>
                                                        <motion.div
                                                            initial={{ opacity: 0, scaleY: 0.5 }}
                                                            animate={{ opacity: 1, scaleY: 1 }}
                                                            whileHover={{ scale: 1.05, zIndex: 20 }}
                                                            className={cn(
                                                                "absolute top-2 bottom-2 rounded-xl shadow-lg border backdrop-blur-md cursor-pointer flex items-center px-3 gap-2 overflow-hidden",
                                                                booking.status === 'CHECKED_IN'
                                                                    ? "bg-gradient-to-r from-emerald-500/80 to-emerald-600/80 border-emerald-400/50 text-white"
                                                                    : "bg-gradient-to-r from-blue-500/80 to-blue-600/80 border-blue-400/50 text-white"
                                                            )}
                                                            style={{
                                                                ...style,
                                                                left: `calc(${style.left} + 2px)`, // Small gap adjustments
                                                                width: `calc(${style.width} - 4px)`
                                                            }}
                                                        >
                                                            <Avatar className="w-6 h-6 border border-white/30 hidden sm:block">
                                                                <AvatarFallback className="bg-white/20 text-[10px] text-white">
                                                                    {guest?.fullName.substring(0, 2).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <span className="text-xs font-bold truncate shadow-black/20 drop-shadow-sm">
                                                                {guest?.fullName}
                                                            </span>
                                                        </motion.div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="font-bold">{guest?.fullName}</p>
                                                        <p className="text-xs">{format(new Date(booking.checkInDate), 'dd MMM')} - {format(new Date(booking.checkOutDate), 'dd MMM')}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Scroll Indication Shadow */}
            <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-black/5 to-transparent pointer-events-none" />
        </div>
    );
}
