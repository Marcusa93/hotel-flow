import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, TrendingUp, CreditCard } from 'lucide-react';
import { format, getWeek } from 'date-fns';
import { es } from 'date-fns/locale';

interface CalendarHeaderProps {
    currentDate: Date;
    view: 'month' | 'week' | 'timeline';
    stats: {
        occupancyRate: number;
        totalRevenue: number;
    };
}

export function CalendarHeader({ currentDate, view, stats }: CalendarHeaderProps) {
    return (
        <div className="flex flex-col space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                        Calendario Inteligente
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm font-medium">
                        Visualiza ocupación y patrones de demanda
                    </p>
                </div>
                {/* Actions can go here if needed */}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="flex items-center p-4 py-3 gap-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur border-none shadow-sm">
                    <div className="p-2 bg-primary/10 rounded-full text-primary">
                        <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase">Período Actual</p>
                        <p className="text-lg font-bold capitalize text-slate-800 dark:text-slate-100">
                            {view === 'month'
                                ? format(currentDate, 'MMMM yyyy', { locale: es })
                                : `Semana ${getWeek(currentDate)} - ${format(currentDate, 'MMM yyyy', { locale: es })}`
                            }
                        </p>
                    </div>
                </Card>

                <Card className="flex items-center p-4 py-3 gap-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur border-none shadow-sm">
                    <div className="p-2 bg-emerald-500/10 rounded-full text-emerald-600 dark:text-emerald-400">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase">Ocupación Mensual</p>
                        <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{stats.occupancyRate.toFixed(0)}%</p>
                    </div>
                </Card>

                <Card className="flex items-center p-4 py-3 gap-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur border-none shadow-sm">
                    <div className="p-2 bg-amber-500/10 rounded-full text-amber-600 dark:text-amber-400">
                        <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase">Ingresos Estimados</p>
                        <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            ${stats.totalRevenue.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
}
