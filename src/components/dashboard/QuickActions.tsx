import {
    CalendarPlus,
    UserPlus,
    CreditCard,
    Sparkles,
    ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function QuickActions() {
    const navigate = useNavigate();

    const actions = [
        {
            label: 'Nueva Reserva',
            description: 'Crear reserva rápida',
            icon: CalendarPlus,
            bgColor: 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-800/60',
            iconBg: 'bg-[#112240] dark:bg-slate-700',
            textColor: 'text-slate-800 dark:text-slate-200',
            onClick: () => navigate('/bookings?new=true'),
        },
        {
            label: 'Nuevo Huésped',
            description: 'Registrar huésped',
            icon: UserPlus,
            bgColor: 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-800/60',
            iconBg: 'bg-[#112240] dark:bg-slate-700',
            textColor: 'text-slate-800 dark:text-slate-200',
            onClick: () => navigate('/guests?new=true'),
        },
        {
            label: 'Registrar Pago',
            description: 'Cobro rápido',
            icon: CreditCard,
            bgColor: 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-800/60',
            iconBg: 'bg-[#112240] dark:bg-slate-700',
            textColor: 'text-slate-800 dark:text-slate-200',
            onClick: () => navigate('/payments'),
        },
        {
            label: 'Housekeeping',
            description: 'Gestionar limpieza',
            icon: Sparkles,
            bgColor: 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-800/60',
            iconBg: 'bg-amber-600 dark:bg-amber-700',
            textColor: 'text-slate-800 dark:text-slate-200',
            onClick: () => navigate('/housekeeping'),
        }
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {actions.map((action) => (
                <button
                    key={action.label}
                    onClick={action.onClick}
                    className={`
                        group relative p-4 md:p-5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60
                        ${action.bgColor}
                        transition-all duration-300 ease-out
                        hover:scale-[1.02] hover:shadow-lg hover:border-slate-300/80 dark:hover:border-slate-600/80
                        active:scale-[0.98]
                        text-left
                    `}
                >
                    {/* Icon */}
                    <div className={`
                        inline-flex p-2.5 rounded-xl ${action.iconBg}
                        text-white shadow-sm
                        group-hover:scale-110 transition-transform duration-300
                    `}>
                        <action.icon className="w-5 h-5" />
                    </div>

                    {/* Text */}
                    <div className="mt-3">
                        <p className={`font-semibold ${action.textColor} text-sm`}>
                            {action.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 hidden md:block">
                            {action.description}
                        </p>
                    </div>

                    {/* Arrow indicator */}
                    <ArrowRight className={`
                        absolute bottom-4 right-4 w-4 h-4 text-slate-400
                        opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0
                        transition-all duration-300
                        hidden md:block
                    `} />
                </button>
            ))}
        </div>
    );
}
