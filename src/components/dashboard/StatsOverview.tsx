import { DollarSign, BedDouble, Users, TrendingUp } from 'lucide-react';
import { KPICard } from '@/components/shared/KPICard';
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
                            <Skeleton className="h-10 w-10 rounded-xl" />
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
            <KPICard
                title="Ingresos (Mes)"
                value={`$${monthlyRevenue.toLocaleString('es-AR')}`}
                subtitle="Actualizado hoy"
                icon={<DollarSign className="w-5 h-5" />}
                iconColor="bg-emerald-100 dark:bg-emerald-900/30"
                iconTextColor="text-emerald-600"
                variant="success"
                delay={0}
            />

            <KPICard
                title="Ocupación"
                value={`${occupancyRate.toFixed(1)}%`}
                subtitle={`${availableRooms} Habitaciones Disp.`}
                icon={<BedDouble className="w-5 h-5" />}
                iconColor="bg-slate-100 dark:bg-slate-800/50"
                iconTextColor="text-slate-700 dark:text-slate-300"
                variant="primary"
                delay={0.1}
            />

            <KPICard
                title="Tarifa Promedio (ADR)"
                value={`$${adr.toLocaleString('es-AR')}`}
                subtitle="Por noche"
                icon={<TrendingUp className="w-5 h-5" />}
                iconColor="bg-amber-100 dark:bg-amber-900/30"
                iconTextColor="text-amber-700 dark:text-amber-400"
                delay={0.2}
            />

            <KPICard
                title="Huéspedes Activos"
                value={totalGuests}
                subtitle="En el hotel"
                icon={<Users className="w-5 h-5" />}
                iconColor="bg-indigo-100 dark:bg-indigo-900/30"
                iconTextColor="text-indigo-600 dark:text-indigo-400"
                delay={0.3}
            />
        </div>
    );
}
