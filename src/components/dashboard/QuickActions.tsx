import { Button } from '@/components/ui/button';
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
            gradient: 'from-blue-500 to-indigo-600',
            bgColor: 'bg-blue-500/10 hover:bg-blue-500/20',
            textColor: 'text-blue-600 dark:text-blue-400',
            onClick: () => navigate('/bookings?new=true'),
        },
        {
            label: 'Nuevo Huésped',
            description: 'Registrar huésped',
            icon: UserPlus,
            gradient: 'from-violet-500 to-purple-600',
            bgColor: 'bg-violet-500/10 hover:bg-violet-500/20',
            textColor: 'text-violet-600 dark:text-violet-400',
            onClick: () => navigate('/guests?new=true'),
        },
        {
            label: 'Registrar Pago',
            description: 'Cobro rápido',
            icon: CreditCard,
            gradient: 'from-emerald-500 to-teal-600',
            bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/20',
            textColor: 'text-emerald-600 dark:text-emerald-400',
            onClick: () => navigate('/payments'),
        },
        {
            label: 'Housekeeping',
            description: 'Gestionar limpieza',
            icon: Sparkles,
            gradient: 'from-amber-500 to-orange-600',
            bgColor: 'bg-amber-500/10 hover:bg-amber-500/20',
            textColor: 'text-amber-600 dark:text-amber-400',
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
                        group relative p-4 md:p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60
                        ${action.bgColor}
                        transition-all duration-300 ease-out
                        hover:scale-[1.02] hover:shadow-lg hover:border-transparent
                        active:scale-[0.98]
                        text-left
                    `}
                >
                    {/* Icon */}
                    <div className={`
                        inline-flex p-2.5 rounded-xl bg-gradient-to-br ${action.gradient} 
                        text-white shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50
                        group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300
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
                        absolute bottom-4 right-4 w-4 h-4 ${action.textColor}
                        opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0
                        transition-all duration-300
                        hidden md:block
                    `} />
                </button>
            ))}
        </div>
    );
}
