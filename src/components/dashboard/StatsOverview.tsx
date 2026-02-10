import { Card } from '@/components/ui/card';
import { DollarSign, BedDouble, Users, TrendingUp } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface StatsOverviewProps {
    occupancyRate: number;
    monthlyRevenue: number;
    totalGuests: number;
    adr: number; // Average Daily Rate
    availableRooms?: number;
    isLoading?: boolean;
}

export function StatsOverview({ occupancyRate, monthlyRevenue, totalGuests, adr, availableRooms = 0, isLoading }: StatsOverviewProps) {
    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex flex-col space-y-3 p-6 bg-card border rounded-xl shadow-sm">
                        <div className="flex justify-between">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-4 rounded-full" />
                        </div>
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                ))}
            </div>
        );
    }
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Revenue Card */}
            <Card className="p-6 bg-gradient-to-br from-white to-emerald-50/50 dark:from-slate-900 dark:to-emerald-950/20 border-slate-100 dark:border-slate-800 shadow-lg shadow-emerald-100/20 dark:shadow-emerald-900/10 hover:shadow-xl transition-all relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <DollarSign className="w-24 h-24 -mr-6 -mt-6 transform rotate-12" />
                </div>
                <div className="flex justify-between items-start mb-4 relative">
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Ingresos (Mes)</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">${monthlyRevenue.toLocaleString('es-AR')}</h3>
                    </div>
                    <div className="p-2.5 bg-white dark:bg-slate-800 text-emerald-600 rounded-xl shadow-sm ring-1 ring-slate-100 dark:ring-slate-700">
                        <DollarSign className="w-5 h-5" />
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 w-fit px-2 py-1 rounded-lg">
                    <TrendingUp className="w-3 h-3" />
                    <span>Actualizado hoy</span>
                </div>
            </Card>

            {/* Occupancy Card */}
            <Card className="p-6 bg-gradient-to-br from-white to-blue-50/50 dark:from-slate-900 dark:to-blue-950/20 border-slate-100 dark:border-slate-800 shadow-lg shadow-blue-100/20 dark:shadow-blue-900/10 hover:shadow-xl transition-all relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <BedDouble className="w-24 h-24 -mr-6 -mt-6 transform rotate-12" />
                </div>
                <div className="flex justify-between items-start mb-4 relative">
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Ocupación</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{occupancyRate.toFixed(1)}%</h3>
                    </div>
                    <div className="p-2.5 bg-white dark:bg-slate-800 text-blue-600 rounded-xl shadow-sm ring-1 ring-slate-100 dark:ring-slate-700">
                        <BedDouble className="w-5 h-5" />
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 w-fit px-2 py-1 rounded-lg">
                    <span>{availableRooms} Habitaciones Disp.</span>
                </div>
            </Card>

            {/* ADR Card */}
            <Card className="p-6 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <TrendingUp className="w-24 h-24 -mr-6 -mt-6" />
                </div>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tarifa Promedio (ADR)</p>
                        <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">${adr.toLocaleString('es-AR')}</h3>
                    </div>
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span>Estable vs ayer</span>
                </div>
            </Card>

            {/* Guests Card */}
            <Card className="p-6 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Users className="w-24 h-24 -mr-6 -mt-6" />
                </div>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Huéspedes Activos</p>
                        <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">{totalGuests}</h3>
                    </div>
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                        <Users className="w-5 h-5" />
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-orange-600">
                    <TrendingUp className="w-3 h-3" />
                    <span>+3 últimos 7 días</span>
                </div>
            </Card>
        </div>
    );
}
