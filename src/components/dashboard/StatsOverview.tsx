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
                trend={{ value: 12, label: 'vs mes anterior', isPositive: true }}
                variant="success"
                delay={0}
                chartData={[{ value: 30 }, { value: 45 }, { value: 35 }, { value: 50 }, { value: 65 }, { value: monthlyRevenue / 1000 }]}
            />

            <KPICard
                title="Ocupación"
                value={`${occupancyRate.toFixed(1)}%`}
                subtitle={`${availableRooms} Habitaciones Disp.`}
                icon={<BedDouble className="w-5 h-5" />}
                iconColor="bg-blue-100 dark:bg-blue-900/30"
                iconTextColor="text-blue-600"
                variant="primary"
                delay={0.1}
                chartData={[{ value: 60 }, { value: 55 }, { value: 70 }, { value: 65 }, { value: 75 }, { value: occupancyRate }]}
            />

            <KPICard
                title="Tarifa Promedio (ADR)"
                value={`$${adr.toLocaleString('es-AR')}`}
                subtitle="Estable vs ayer"
                icon={<TrendingUp className="w-5 h-5" />}
                iconColor="bg-purple-100 dark:bg-purple-900/30"
                iconTextColor="text-purple-600"
                delay={0.2}
            />

            <KPICard
                title="Huéspedes Activos"
                value={totalGuests}
                subtitle="+3 últimos 7 días"
                icon={<Users className="w-5 h-5" />}
                iconColor="bg-orange-100 dark:bg-orange-900/30"
                iconTextColor="text-orange-600"
                trend={{ value: 8, label: 'vs semana anterior', isPositive: true }}
                delay={0.3}
            />
        </div>
    );
}
