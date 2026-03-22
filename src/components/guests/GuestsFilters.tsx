import { Search, Filter } from 'lucide-react';
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
    onStatusFilterChange
}: GuestsFiltersProps) {
    return (
        <div className="flex flex-col md:flex-row gap-4 items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-3 rounded-2xl border border-white/20 shadow-sm mt-4">
            {/* Search */}
            <div className="relative flex-1 w-full md:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                <Input
                    placeholder="Buscar por nombre, email, teléfono o documento..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-10 bg-transparent border-transparent hover:bg-white/50 focus:bg-white/80 transition-all rounded-xl h-10"
                />
            </div>

            {/* Sort/Status Filter */}
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                <SelectTrigger className="w-full md:w-[180px] border-none bg-transparent hover:bg-white/50 rounded-xl h-10 font-medium">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Filter className="w-3.5 h-3.5" />
                        <SelectValue placeholder="Ordenar por" />
                    </div>
                </SelectTrigger>
                <SelectContent align="end" className="rounded-xl border-none shadow-lg bg-white/90 backdrop-blur-md">
                    <SelectItem value="recent">Recientes</SelectItem>
                    <SelectItem value="name_asc">A-Z</SelectItem>
                    <SelectItem value="spend_desc">Mayor Gasto</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
