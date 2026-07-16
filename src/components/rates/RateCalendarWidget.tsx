import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Rate } from '@/types/hotel';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';

interface RateCalendarWidgetProps {
    rates?: Rate[];
}

export function RateCalendarWidget({ rates = [] }: RateCalendarWidgetProps) {
    // Next 14 days
    const nextDays = Array.from({ length: 14 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return startOfDay(d);
    });

    const activePromos = rates.filter(r => r.isActive);

    // A day is "high" when an active promo covers it; weekends are a secondary hint.
    const getPriceLevel = (date: Date): 'promo' | 'weekend' | 'base' => {
        const covered = activePromos.some(r =>
            isWithinInterval(date, {
                start: startOfDay(new Date(r.startDate)),
                end: endOfDay(new Date(r.endDate)),
            })
        );
        if (covered) return 'promo';
        const day = date.getDay();
        if (day === 0 || day === 6) return 'weekend';
        return 'base';
    };

    return (
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
            <CardContent className="p-6">
                <h3 className="text-sm font-medium text-slate-500 mb-4">Próximos 14 días</h3>
                {activePromos.length === 0 && (
                    <p className="text-[11px] text-muted-foreground mb-3">
                        No hay promociones activas; se muestran solo fines de semana.
                    </p>
                )}
                <div className="grid grid-cols-7 gap-2">
                    {nextDays.map((date, i) => {
                        const level = getPriceLevel(date);
                        return (
                            <div key={i} className="flex flex-col items-center gap-1 group cursor-pointer">
                                <span className="text-[10px] text-slate-400 font-mono">{date.getDate()}</span>
                                <div className={cn(
                                    "w-full aspect-square rounded-md transition-all group-hover:scale-110",
                                    level === 'promo'
                                        ? "bg-purple-500/80 shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                                        : level === 'weekend'
                                            ? "bg-purple-500/40"
                                            : "bg-purple-500/10"
                                )} />
                            </div>
                        );
                    })}
                </div>
                <div className="flex items-center gap-4 mt-4 text-[10px] text-slate-400 justify-center flex-wrap">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-purple-500/10" /> Base
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-purple-500/40" /> Fin de semana
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-purple-500/80" /> Promoción
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
