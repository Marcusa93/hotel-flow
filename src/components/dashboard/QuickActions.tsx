import { useState } from 'react';
import {
    CalendarPlus,
    UserPlus,
    CreditCard,
    Sparkles,
    ArrowRight,
    LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppRole } from '@/context/AppRoleContext';
import type { UserRole } from '@/types/hotel';
import { NewBookingDialog } from '@/components/bookings/NewBookingDialog';
import { NewGuestDialog } from '@/components/guests/NewGuestDialog';
import { NewPaymentDialog } from '@/components/payments/NewPaymentDialog';

type DialogKey = 'booking' | 'guest' | 'payment' | null;

interface QuickAction {
    label: string;
    description: string;
    icon: LucideIcon;
    dialog?: DialogKey;
    href?: string;
    roles: UserRole[];
    bgColor: string;
    iconBg: string;
    textColor: string;
}

const allActions: QuickAction[] = [
    {
        label: 'Nueva Reserva',
        roles: ['admin', 'reception'],
        description: 'Crear reserva rápida',
        icon: CalendarPlus,
        dialog: 'booking',
        bgColor: 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-800/60',
        iconBg: 'bg-[#112240] dark:bg-slate-700',
        textColor: 'text-slate-800 dark:text-slate-200',
    },
    {
        label: 'Nuevo Huésped',
        roles: ['admin', 'reception'],
        description: 'Registrar huésped',
        icon: UserPlus,
        dialog: 'guest',
        bgColor: 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-800/60',
        iconBg: 'bg-[#112240] dark:bg-slate-700',
        textColor: 'text-slate-800 dark:text-slate-200',
    },
    {
        label: 'Registrar Pago',
        roles: ['admin', 'reception'],
        description: 'Cobro rápido',
        icon: CreditCard,
        dialog: 'payment',
        bgColor: 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-800/60',
        iconBg: 'bg-[#112240] dark:bg-slate-700',
        textColor: 'text-slate-800 dark:text-slate-200',
    },
    {
        label: 'Housekeeping',
        roles: ['admin', 'housekeeping'],
        description: 'Gestionar limpieza',
        icon: Sparkles,
        href: '/housekeeping',
        bgColor: 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-800/60',
        iconBg: 'bg-amber-600 dark:bg-amber-700',
        textColor: 'text-slate-800 dark:text-slate-200',
    },
];

export function QuickActions() {
    const navigate = useNavigate();
    const { currentRole } = useAppRole();
    const [openDialog, setOpenDialog] = useState<DialogKey>(null);

    const actions = allActions.filter(a => a.roles.includes(currentRole));

    if (actions.length === 0) return null;

    const handleClick = (action: QuickAction) => {
        if (action.dialog) {
            setOpenDialog(action.dialog);
        } else if (action.href) {
            navigate(action.href);
        }
    };

    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {actions.map((action) => (
                    <button
                        key={action.label}
                        onClick={() => handleClick(action)}
                        className={`
                            group relative p-4 md:p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60
                            ${action.bgColor}
                            transition-all duration-300 ease-out
                            hover:scale-[1.02] hover:shadow-lg hover:border-slate-300/80 dark:hover:border-slate-600/80
                            active:scale-[0.98]
                            text-left
                        `}
                    >
                        <div className={`
                            inline-flex p-2.5 rounded-xl ${action.iconBg}
                            text-white shadow-sm
                            group-hover:scale-110 transition-transform duration-300
                        `}>
                            <action.icon className="w-5 h-5" />
                        </div>
                        <div className="mt-3">
                            <p className={`font-semibold ${action.textColor} text-sm`}>
                                {action.label}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 hidden md:block">
                                {action.description}
                            </p>
                        </div>
                        <ArrowRight className={`
                            absolute bottom-4 right-4 w-4 h-4 text-slate-400
                            opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0
                            transition-all duration-300
                            hidden md:block
                        `} />
                    </button>
                ))}
            </div>

            {/* Inline Dialogs — open from dashboard without navigating */}
            <NewBookingDialog
                open={openDialog === 'booking'}
                onOpenChange={(open) => !open && setOpenDialog(null)}
            />
            <NewGuestDialog
                open={openDialog === 'guest'}
                onOpenChange={(open) => !open && setOpenDialog(null)}
            />
            <NewPaymentDialog
                open={openDialog === 'payment'}
                onOpenChange={(open) => !open && setOpenDialog(null)}
            />
        </>
    );
}
