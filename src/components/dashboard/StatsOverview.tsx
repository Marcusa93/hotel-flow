import { Card } from '@/components/ui/card';
import { DollarSign, BedDouble, Users, TrendingUp } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface StatsOverviewProps {
    occupancyRate: number;
    monthlyRevenue: number;
    totalGuests: number;
    adr: number; // Average Daily Rate
}

export function StatsOverview({ occupancyRate, monthlyRevenue, totalGuests, adr }: StatsOverviewProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Revenue Card */}
            <Card className="p-6 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <DollarSign className="w-24 h-24 -mr-6 -mt-6" />
                </div>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ingresos (Mes)</p>
                        <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">${monthlyRevenue.toLocaleString('es-AR')}</h3>
                    </div>
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <DollarSign className="w-5 h-5" />
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
                    <TrendingUp className="w-3 h-3" />
                    <span>+12% vs. mes pasado</span>
                </div>
            </Card>

            {/* Occupancy Card */}
            <Card className="p-6 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <BedDouble className="w-24 h-24 -mr-6 -mt-6" />
                </div>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ocupación</p>
                        <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">{occupancyRate.toFixed(1)}%</h3>
                    </div>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <BedDouble className="w-5 h-5" />
                    </div>
                </div>
                {/* Mini Chart Mock */}
                <div className="h-10 w-full opacity-50">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={[{ v: 20 }, { v: 40 }, { v: 30 }, { v: 70 }, { v: 50 }, { v: occupancyRate }]}>
                            <Area type="monotone" dataKey="v" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.2} />
                        </AreaChart>
                    </ResponsiveContainer>
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
