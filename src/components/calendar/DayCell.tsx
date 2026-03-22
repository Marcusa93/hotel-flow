import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { format, isSameDay, isSameMonth } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Link } from 'react-router-dom';
import { Booking, Guest } from '@/types/hotel';

interface DayCellProps {
    day: Date;
    today: Date;
    currentDate: Date;
    view: 'month' | 'week';
    bookings: Booking[];
    heatmapColor?: string;
    heatmapMode: 'none' | 'occupancy' | 'revenue';
    dailyRevenue: number;
    getGuest: (id: string) => Guest | undefined;
    getRoomNumber: (id: string) => string;
}

export function DayCell({
    day,
    today,
    currentDate,
    view,
    bookings,
    heatmapColor,
    heatmapMode,
    dailyRevenue,
    getGuest,
    getRoomNumber
}: DayCellProps) {
    const isToday = isSameDay(day, today);
    const isCurrentMonth = isSameMonth(day, currentDate);
    const maxItems = view === 'month' ? 3 : 8;

    return (
        <motion.div
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(
                "border-r border-b relative p-1 transition-all min-h-[100px] flex flex-col group",
                !isCurrentMonth && "bg-slate-50/50 dark:bg-slate-900/50 opacity-60",
                isToday && "bg-primary/5 dark:bg-primary/10 shadow-[inset_0_0_0_2px_rgba(59,130,246,0.5)] z-10"
            )}
            style={{
                backgroundColor: heatmapColor,
            }}
        >
            <div className="flex justify-between items-start p-1 mb-1 relative z-10">
                <span className={cn(
                    "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                    isToday ? "bg-primary text-white shadow-md scale-110" : "text-muted-foreground group-hover:bg-white/50 dark:group-hover:bg-slate-700",
                    heatmapMode !== 'none' && "bg-white/80 dark:bg-slate-800/80 shadow-sm" // Better visibility on heatmap
                )}>
                    {format(day, 'd')}
                </span>

                {/* Heatmap Indicators */}
                {heatmapMode === 'revenue' && dailyRevenue > 0 && (
                    <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded-full shadow-sm backdrop-blur">
                        ${dailyRevenue > 1000 ? (dailyRevenue / 1000).toFixed(1) + 'k' : dailyRevenue.toFixed(0)}
                    </span>
                )}
                {heatmapMode === 'occupancy' && bookings.length > 0 && (
                    <span className="text-[9px] bg-white/80 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-full text-slate-600 dark:text-slate-300 font-mono font-bold shadow-sm">
                        {bookings.length}
                    </span>
                )}
            </div>

            <div className="space-y-1 mt-auto flex-1 relative z-10">
                {heatmapMode === 'none' && (
                    <>
                        {bookings.slice(0, maxItems).map(booking => {
                            const guest = getGuest(booking.guestId);
                            const roomNum = getRoomNumber(booking.roomId);

                            return (
                                <Tooltip key={booking.id}>
                                    <TooltipTrigger asChild>
                                        <Link to={`/bookings/${booking.id}`}>
                                            <motion.div
                                                layoutId={`booking-${booking.id}`}
                                                whileHover={{ scale: 1.02, x: 2 }}
                                                className={cn(
                                                    "text-[9px] px-1.5 py-0.5 rounded-md border truncate cursor-pointer shadow-sm flex items-center gap-1.5 transition-all",
                                                    booking.status === 'CHECKED_IN'
                                                        ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                                        : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                                                )}
                                            >
                                                <span className="font-bold shrink-0 bg-white/50 dark:bg-black/20 px-1 rounded-[3px]">{roomNum}</span>
                                                <span className="opacity-90 truncate font-medium">{guest?.fullName}</span>
                                            </motion.div>
                                        </Link>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="rounded-xl border-none shadow-xl bg-slate-900 text-white p-3">
                                        <p className="font-bold text-sm mb-1">{guest?.fullName}</p>
                                        <div className="flex gap-3 text-xs text-slate-300">
                                            <span>Hab: <strong className="text-white">{roomNum}</strong></span>
                                            <span>Pax: <strong className="text-white">{booking.adults}</strong></span>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                        {bookings.length > maxItems && (
                            <div className="relative group/stack cursor-help mt-1">
                                <div className="text-[9px] text-center text-slate-500 font-medium py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 relative z-10">
                                    +{bookings.length - maxItems} más
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </motion.div>
    );
}
