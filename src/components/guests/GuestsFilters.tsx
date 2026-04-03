import { Search, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface GuestsFiltersProps {
    search: string;
    onSearchChange: (value: string) => void;
    statusFilter: string;
    onStatusFilterChange: (value: string) => void;
}

export function GuestsFilters({
    search,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
}: GuestsFiltersProps) {
    return (
        <div className="flex items-center gap-2 mt-3">
            {/* Search */}
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                    placeholder="Buscar por nombre, email, teléfono o documento..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-10 bg-white/60 dark:bg-slate-900/40 backdrop-blur border-slate-200/60 dark:border-slate-700/40 rounded-xl h-10 shadow-sm focus:shadow-md transition-all"
                />
            </div>

            {/* Sort */}
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                <SelectTrigger className="w-[130px] sm:w-[150px] rounded-xl h-10 bg-white/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-700/40 shadow-sm shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ArrowUpDown className="w-3 h-3" />
                        <SelectValue placeholder="Ordenar" />
                    </div>
                </SelectTrigger>
                <SelectContent align="end" className="rounded-xl">
                    <SelectItem value="recent">Recientes</SelectItem>
                    <SelectItem value="name_asc">A → Z</SelectItem>
                    <SelectItem value="spend_desc">Mayor gasto</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
