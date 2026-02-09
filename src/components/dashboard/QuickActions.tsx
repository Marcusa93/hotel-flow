import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, CreditCard, Sparkles, UserPlus, CalendarPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function QuickActions() {
    const navigate = useNavigate();

    const actions = [
        {
            label: 'Nueva Reserva',
            icon: CalendarPlus,
            color: 'from-blue-500 to-blue-600',
            onClick: () => navigate('/bookings?new=true'),
        },
        {
            label: 'Nuevo Huésped',
            icon: UserPlus,
            color: 'from-violet-500 to-violet-600',
            onClick: () => navigate('/guests?new=true'),
        },
        {
            label: 'Registrar Pago',
            icon: CreditCard,
            color: 'from-emerald-500 to-emerald-600',
            onClick: () => navigate('/payments'),
        },
        {
            label: 'Housekeeping',
            icon: Sparkles,
            color: 'from-amber-500 to-amber-600',
            onClick: () => navigate('/housekeeping'),
        }
    ];

    return (
        <Card className="col-span-1 lg:col-span-4 border-none shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/0 dark:from-slate-900/40 dark:to-slate-900/0 pointer-events-none" />

            <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Plus className="w-4 h-4 text-primary" />
                    Acciones Rápidas
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {actions.map((action) => (
                        <Button
                            key={action.label}
                            onClick={action.onClick}
                            variant="outline"
                            className="h-auto py-4 flex flex-col gap-3 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group border-slate-200/60 dark:border-slate-800/60"
                        >
                            <div className={`p-3 rounded-full bg-gradient-to-br ${action.color} text-white shadow-md group-hover:scale-110 transition-transform duration-300`}>
                                <action.icon className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{action.label}</span>
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
