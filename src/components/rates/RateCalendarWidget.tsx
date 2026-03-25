import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function RateCalendarWidget() {
    // Generate a visual mini-grid for the next 14 days
    const nextDays = Array.from({ length: 14 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d;
    });

    const getPriceLevel = (idx: number) => {
        // Simple pattern: weekends = high demand
        const day = nextDays[idx].getDay();
        if (day === 0 || day === 6) return 'high'; // Weekend
        return 'low';
    };

    return (
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
            <CardContent className="p-6">
                <h3 className="text-sm font-medium text-slate-500 mb-4">Próximos 14 días (Previsión)</h3>
                <div className="grid grid-cols-7 gap-2">
                    {nextDays.map((date, i) => {
                        const level = getPriceLevel(i);
                        return (
                            <div key={i} className="flex flex-col items-center gap-1 group cursor-pointer">
                                <span className="text-[10px] text-slate-400 font-mono">{date.getDate()}</span>
                                <div className={cn(
                                    "w-full aspect-square rounded-md transition-all group-hover:scale-110",
                                    level === 'high'
                                        ? "bg-purple-500/80 shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                                        : "bg-purple-500/20"
                                )} />
                            </div>
                        );
                    })}
                </div>
                <div className="flex items-center gap-4 mt-4 text-[10px] text-slate-400 justify-center">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-purple-500/20" /> Base
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-purple-500/80" /> Demanda Alta
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
