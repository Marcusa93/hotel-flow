import { cn } from '@/lib/utils';
import { DayCell } from './DayCell';
import { Booking, Guest } from '@/types/hotel';

interface MonthViewProps {
    days: Date[];
    today: Date;
    currentDate: Date;
    bookings: Booking[];
    heatmapMode: 'none' | 'occupancy' | 'revenue';
    getHeatmapColor: (day: Date) => string | undefined;
    calculateDailyRevenue: (day: Date) => number;
    getBookingsForDay: (day: Date) => Booking[];
    getGuest: (id: string) => Guest | undefined;
    getRoomNumber: (id: string) => string;
}

export function MonthView({
    days,
    today,
    currentDate,
    bookings,
    heatmapMode,
    getHeatmapColor,
    calculateDailyRevenue,
    getBookingsForDay,
    getGuest,
    getRoomNumber
}: MonthViewProps) {
    return (
        <div className="flex-1 min-h-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl mt-4 rounded-2xl border border-white/20 shadow-lg flex flex-col overflow-hidden">
            {/* Days Header */}
            <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
                {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => (
                    <div key={day} className="py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {day.slice(0, 3)}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 grid-rows-5 flex-1 overflow-y-auto">
                {days.map(day => (
                    <DayCell
                        key={day.toISOString()}
                        day={day}
                        today={today}
                        currentDate={currentDate}
                        view="month"
                        bookings={getBookingsForDay(day)}
                        heatmapColor={getHeatmapColor(day)}
                        heatmapMode={heatmapMode}
                        dailyRevenue={calculateDailyRevenue(day)}
                        getGuest={getGuest}
                        getRoomNumber={getRoomNumber}
                    />
                ))}
            </div>
        </div>
    );
}
