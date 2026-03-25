import { useMemo } from 'react';
import { AlertTriangle, BedDouble, Clock, CreditCard, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Room, Booking, Payment } from '@/types/hotel';
import { useNavigate } from 'react-router-dom';
import { isToday, isBefore, startOfDay } from 'date-fns';

interface OperationalAlertsProps {
    rooms: Room[];
    bookings: Booking[];
    payments: Payment[];
}

interface Alert {
    id: string;
    icon: typeof AlertTriangle;
    iconColor: string;
    bg: string;
    border: string;
    message: string;
    action: string;
    route: string;
}

export function OperationalAlerts({ rooms, bookings, payments }: OperationalAlertsProps) {
    const navigate = useNavigate();

    const alerts = useMemo(() => {
        const result: Alert[] = [];
        const now = new Date();
        const today = startOfDay(now);

        // Alert 1: Dirty rooms
        const dirtyCount = rooms.filter(r => r.status === 'DIRTY').length;
        if (dirtyCount > 0) {
            result.push({
                id: 'dirty-rooms',
                icon: BedDouble,
                iconColor: 'text-amber-600',
                bg: 'bg-amber-50 dark:bg-amber-950/30',
                border: 'border-amber-200 dark:border-amber-800',
                message: `${dirtyCount} habitación${dirtyCount > 1 ? 'es' : ''} necesita${dirtyCount === 1 ? '' : 'n'} limpieza`,
                action: 'Ver limpieza',
                route: '/housekeeping',
            });
        }

        // Alert 2: Overdue checkouts (CHECKED_IN but checkout date is today and it's past 12:00)
        if (now.getHours() >= 12) {
            const overdueCheckouts = bookings.filter(b => {
                if (b.status !== 'CHECKED_IN') return false;
                const checkOut = new Date(b.checkOutDate);
                return isToday(checkOut) || isBefore(checkOut, today);
            });
            if (overdueCheckouts.length > 0) {
                result.push({
                    id: 'overdue-checkouts',
                    icon: Clock,
                    iconColor: 'text-red-600',
                    bg: 'bg-red-50 dark:bg-red-950/30',
                    border: 'border-red-200 dark:border-red-800',
                    message: `${overdueCheckouts.length} huésped${overdueCheckouts.length > 1 ? 'es' : ''} pasado${overdueCheckouts.length > 1 ? 's' : ''} de hora de checkout`,
                    action: 'Ver reservas',
                    route: '/bookings?filter=checkout-today',
                });
            }
        }

        // Alert 3: Pending payments overdue (more than 3 days)
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const overduePayments = payments.filter(p =>
            p.status === 'PENDING' && isBefore(new Date(p.date), threeDaysAgo)
        );
        if (overduePayments.length > 0) {
            const totalOverdue = overduePayments.reduce((sum, p) => sum + p.amount, 0);
            result.push({
                id: 'overdue-payments',
                icon: CreditCard,
                iconColor: 'text-orange-600',
                bg: 'bg-orange-50 dark:bg-orange-950/30',
                border: 'border-orange-200 dark:border-orange-800',
                message: `$${totalOverdue.toLocaleString('es-AR')} en pagos pendientes (${overduePayments.length} cobros vencidos)`,
                action: 'Ver pagos',
                route: '/payments?status=PENDING',
            });
        }

        // Alert 4: Maintenance rooms
        const maintenanceCount = rooms.filter(r => r.status === 'MAINTENANCE' || r.status === 'OUT_OF_ORDER').length;
        if (maintenanceCount > 0) {
            result.push({
                id: 'maintenance',
                icon: AlertTriangle,
                iconColor: 'text-blue-600',
                bg: 'bg-blue-50 dark:bg-blue-950/30',
                border: 'border-blue-200 dark:border-blue-800',
                message: `${maintenanceCount} habitación${maintenanceCount > 1 ? 'es' : ''} en mantenimiento`,
                action: 'Ver habitaciones',
                route: '/rooms?status=MAINTENANCE',
            });
        }

        return result;
    }, [rooms, bookings, payments]);

    if (alerts.length === 0) return null;

    return (
        <div className="space-y-2">
            {alerts.map(alert => (
                <button
                    key={alert.id}
                    onClick={() => navigate(alert.route)}
                    className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99]',
                        alert.bg,
                        alert.border,
                    )}
                >
                    <alert.icon className={cn('w-5 h-5 shrink-0', alert.iconColor)} />
                    <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                        {alert.message}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                        {alert.action} →
                    </span>
                </button>
            ))}
        </div>
    );
}
