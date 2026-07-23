import { CheckCircle, AlertCircle, XCircle, Receipt } from 'lucide-react';
import { paymentState, paymentStateLabel, type BookingAccount, type PaymentState } from '@/lib/bookingAccount';
import { cn } from '@/lib/utils';

/**
 * Cómo se ve cada estado de pago. Uno solo para todas las listas: el tablero,
 * la tabla y las tarjetas de mobile mostraban el mismo dato con tres criterios
 * distintos, y la única forma de que no vuelvan a divergir es que salga de acá.
 *
 * El naranja con ícono de recibo es el mismo de la sección Consumos / Extras
 * del detalle: quien ve el badge y quien va a cobrarlo miran el mismo color.
 */
const STATE_META: Record<PaymentState, { icon: typeof CheckCircle; text: string; chip: string }> = {
    paid: {
        icon: CheckCircle,
        text: 'text-emerald-600 dark:text-emerald-400',
        chip: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    extras: {
        icon: Receipt,
        text: 'text-orange-600 dark:text-orange-400',
        chip: 'bg-orange-50 dark:bg-orange-950/30',
    },
    partial: {
        icon: AlertCircle,
        text: 'text-amber-600 dark:text-amber-400',
        chip: 'bg-amber-50 dark:bg-amber-950/30',
    },
    unpaid: {
        icon: XCircle,
        text: 'text-red-500 dark:text-red-400',
        chip: 'bg-red-50 dark:bg-red-950/30',
    },
};

interface PaymentStateBadgeProps {
    account: BookingAccount;
    className?: string;
    /** Sin texto, para la celda de una tabla. El label queda en el title. */
    iconOnly?: boolean;
}

export function PaymentStateBadge({ account, className, iconOnly = false }: PaymentStateBadgeProps) {
    const { icon: Icon, text, chip } = STATE_META[paymentState(account)];
    const label = paymentStateLabel(account);

    if (iconOnly) {
        return (
            <span title={label} className={cn('inline-flex', className)}>
                <Icon className={cn('w-4 h-4', text)} />
                <span className="sr-only">{label}</span>
            </span>
        );
    }

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap',
                text,
                chip,
                className
            )}
        >
            <Icon className="w-3 h-3 shrink-0" />
            {label}
        </span>
    );
}
