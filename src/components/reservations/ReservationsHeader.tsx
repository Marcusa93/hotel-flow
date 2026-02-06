
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReservationsHeaderProps {
    onNewBooking: () => void;
}

export function ReservationsHeader({ onNewBooking }: ReservationsHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                    Reservas
                </h1>
                <p className="text-muted-foreground mt-1 text-sm font-medium">
                    Gestión de todas las reservas del hotel
                </p>
            </div>
            <Button
                onClick={onNewBooking}
                className="rounded-full px-6 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                size="lg"
            >
                <Plus className="w-5 h-5 mr-2" />
                Nueva Reserva
            </Button>
        </div>
    );
}
