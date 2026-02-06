
import { BookingStatus } from '@/types/hotel';
import { cn } from '@/lib/utils'; // Assuming cn exists

interface ReservationStatusBadgeProps {
    status: BookingStatus;
    className?: string;
}

const statusConfig: Record<BookingStatus, { label: string; className: string }> = {
    PENDING: {
        label: 'Pendiente',
        className: 'bg-amber-100/50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
    },
    CONFIRMED: {
        label: 'Confirmada',
        className: 'bg-blue-100/50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
    },
    CHECKED_IN: {
        label: 'Hospedado',
        className: 'bg-emerald-100/50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
    },
    CHECKED_OUT: {
        label: 'Salida',
        className: 'bg-slate-100/50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20'
    },
    CANCELLED: {
        label: 'Cancelada',
        className: 'bg-rose-100/50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
    },
    NO_SHOW: {
        label: 'No Show',
        className: 'bg-gray-100/50 text-gray-700 border-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20'
    }
};

export function ReservationStatusBadge({ status, className }: ReservationStatusBadgeProps) {
    const config = statusConfig[status];
    return (
        <span className={cn(
            "px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold border",
            config.className,
            className
        )}>
            {config.label}
        </span>
    );
}
