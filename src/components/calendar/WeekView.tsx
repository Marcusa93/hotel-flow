import { format, isSameDay, isSameMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { DayCell } from './DayCell';
import { Booking, Guest } from '@/types/hotel';

interface WeekViewProps {
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

export function WeekView({
    days,
    today,
    currentDate,
    heatmapMode,
    getHeatmapColor,
    calculateDailyRevenue,
    getBookingsForDay,
    getGuest,
    getRoomNumber
}: WeekViewProps) {

    return (
        <div className="flex-1 min-h-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl mt-4 rounded-2xl border border-white/20 shadow-lg flex flex-col overflow-hidden">
            {/* Days Header */}
            <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
                {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => (
                    <div key={day} className="py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {day}
                    </div>
                ))}
            </div>

            {/* Week Columns */}
            <div className="grid grid-cols-7 flex-1 overflow-y-auto divide-x divide-slate-100 dark:divide-slate-800">
                {days.map(day => (
                    <div key={day.toISOString()} className="h-full min-h-[400px]">
                        <DayCell
                            day={day}
                            today={today}
                            currentDate={currentDate}
                            view="week"
                            bookings={getBookingsForDay(day)}
                            heatmapColor={getHeatmapColor(day)}
                            heatmapMode={heatmapMode}
                            dailyRevenue={calculateDailyRevenue(day)}
                            getGuest={getGuest}
                            getRoomNumber={getRoomNumber}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
