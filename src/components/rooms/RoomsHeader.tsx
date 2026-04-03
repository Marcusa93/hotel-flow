import { BedDouble, AlertCircle, Brush, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoomsHeaderProps {
    totalRooms: number;
    occupiedCount: number;
    dirtyCount: number;
}

export function RoomsHeader({ totalRooms, occupiedCount, dirtyCount }: RoomsHeaderProps) {
    const availableCount = totalRooms - occupiedCount - dirtyCount;

    return (
        <div className="space-y-3 mb-2">
            <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
                    Habitaciones
                </h1>
                <p className="text-muted-foreground text-sm">
                    Estado actual de las habitaciones del hotel
                </p>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                <StatPill icon={BedDouble} label="Total" value={totalRooms} color="slate" />
                <StatPill icon={CheckCircle2} label="Libres" value={availableCount} color="emerald" />
                <StatPill icon={AlertCircle} label="Ocupadas" value={occupiedCount} color="blue" />
                <StatPill icon={Brush} label="Sucias" value={dirtyCount} color="amber" />
            </div>
        </div>
    );
}

function StatPill({ icon: Icon, label, value, color }: {
    icon: typeof BedDouble;
    label: string;
    value: number;
    color: 'slate' | 'emerald' | 'blue' | 'amber';
}) {
    const colors = {
        slate: 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
        blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
        amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
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
