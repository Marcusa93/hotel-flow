import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ReservationsFiltersProps {
    search: string;
    onSearchChange: (value: string) => void;
    statusFilter: string;
    onStatusFilterChange: (value: string) => void;
}

const STATUS_CHIPS = [
    { value: 'ALL', label: 'Todas' },
    { value: 'PENDING', label: 'Pendientes' },
    { value: 'CONFIRMED', label: 'Confirmadas' },
    { value: 'CHECKED_IN', label: 'Hospedados' },
    { value: 'CHECKED_OUT', label: 'Salidas' },
    { value: 'CANCELLED', label: 'Canceladas' },
] as const;

export function ReservationsFilters({
    search,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
}: ReservationsFiltersProps) {
    return (
        <div className="space-y-3">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                    placeholder="Buscar por huésped, habitación o ID..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-10 bg-white/60 dark:bg-slate-900/40 backdrop-blur border-slate-200/60 dark:border-slate-700/40 rounded-xl h-10 shadow-sm focus:shadow-md transition-all"
                />
            </div>

            {/* Status filter chips — scrollable on mobile */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                {STATUS_CHIPS.map(chip => (
                    <Button
                        key={chip.value}
                        variant="ghost"
                        size="sm"
                        onClick={() => onStatusFilterChange(chip.value)}
                        className={cn(
                            'rounded-xl h-8 px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-all',
                            statusFilter === chip.value
                                ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                                : 'bg-slate-100 dark:bg-slate-800/50 text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700/50',
                        )}
                    >
                        {chip.label}
                    </Button>
                ))}
            </div>
        </div>
    );
}
