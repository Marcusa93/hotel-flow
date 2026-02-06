import { Button } from '@/components/ui/button';
import { Calendar, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DashboardHeaderProps {
    onNewBooking: () => void;
}

export function DashboardHeader({ onNewBooking }: DashboardHeaderProps) {
    const today = new Date();

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                    Hola, Marco 👋
                </h1>
                <p className="text-muted-foreground mt-1 text-sm font-medium flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(today, "EEEE d 'de' MMMM, yyyy", { locale: es })}
                </p>
            </div>
            <div className="flex gap-3">
                <Button
                    onClick={onNewBooking}
                    className="rounded-full px-6 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all bg-slate-900 border-none hover:bg-black"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Nueva Reserva
                </Button>
            </div>
        </div>
    );
}
