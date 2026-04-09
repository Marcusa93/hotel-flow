import { Plus, CalendarCheck, Clock, LogIn, XCircle, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReservationsHeaderProps {
    onNewBooking: () => void;
    onScanQR?: () => void;
    stats?: {
        total: number;
        pending: number;
        confirmed: number;
        checkedIn: number;
    };
}

export function ReservationsHeader({ onNewBooking, onScanQR, stats }: ReservationsHeaderProps) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
                        Reservas
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Gestión de todas las reservas del hotel
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {onScanQR && (
                        <Button
                            variant="outline"
                            onClick={onScanQR}
                            className="rounded-xl"
                            title="Escanear QR de check-in"
                        >
                            <ScanLine className="w-4 h-4 mr-1.5" />
                            <span className="hidden sm:inline">Escanear QR</span>
                        </Button>
                    )}
                    <Button
                        onClick={onNewBooking}
                        className="rounded-xl px-5 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                    >
                        <Plus className="w-4 h-4 mr-1.5" />
                        <span className="hidden sm:inline">Nueva Reserva</span>
                        <span className="sm:hidden">Nueva</span>
                    </Button>
                </div>
            </div>

            {/* Mini stats */}
            {stats && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    <StatChip icon={CalendarCheck} label="Total" value={stats.total} color="slate" />
                    <StatChip icon={Clock} label="Pendientes" value={stats.pending} color="amber" />
                    <StatChip icon={CalendarCheck} label="Confirmadas" value={stats.confirmed} color="blue" />
                    <StatChip icon={LogIn} label="Hospedados" value={stats.checkedIn} color="emerald" />
                </div>
            )}
        </div>
    );
}

function StatChip({ icon: Icon, label, value, color }: {
    icon: typeof CalendarCheck;
    label: string;
    value: number;
    color: 'slate' | 'amber' | 'blue' | 'emerald';
}) {
    const colors = {
        slate: 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400',
        amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
        blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    };
    return (
        <div className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0',
            colors[color],
        )}>
            <Icon className="w-3.5 h-3.5" />
            <span className="font-extrabold text-sm">{value}</span>
            <span className="opacity-70 hidden sm:inline">{label}</span>
        </div>
    );
}
