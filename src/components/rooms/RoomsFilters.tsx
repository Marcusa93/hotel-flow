import { Filter, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RoomsFiltersProps {
    statusFilter: string;
    onStatusFilterChange: (value: string) => void;
    floorFilter: string;
    onFloorFilterChange: (value: string) => void;
    floors: string[];
}

export function RoomsFilters({
    statusFilter,
    onStatusFilterChange,
    floorFilter,
    onFloorFilterChange,
    floors
}: RoomsFiltersProps) {
    return (
        <div className="flex flex-col md:flex-row gap-4 items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-2 rounded-2xl border border-white/20 shadow-sm mt-4">

            {/* Status Segment Tabs */}
            <Tabs value={statusFilter} onValueChange={onStatusFilterChange} className="w-full md:w-auto flex-1">
                <TabsList className="bg-slate-100/50 dark:bg-slate-800/50 p-1 h-10 w-full md:w-auto">
                    <TabsTrigger value="ALL" className="rounded-lg text-xs">Todas</TabsTrigger>
                    <TabsTrigger value="AVAILABLE" className="rounded-lg text-xs data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-700">Disponibles</TabsTrigger>
                    <TabsTrigger value="OCCUPIED" className="rounded-lg text-xs data-[state=active]:bg-rose-100 data-[state=active]:text-rose-700">Ocupadas</TabsTrigger>
                    <TabsTrigger value="DIRTY" className="rounded-lg text-xs data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700">Sucias</TabsTrigger>
                    <TabsTrigger value="MAINTENANCE" className="rounded-lg text-xs data-[state=active]:bg-slate-200 data-[state=active]:text-slate-700">Mantenimiento</TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Floor Filter */}
            <Select value={floorFilter} onValueChange={onFloorFilterChange}>
                <SelectTrigger className="w-full md:w-[160px] border-none bg-transparent hover:bg-white/50 rounded-xl h-10 font-medium">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Layers className="w-3.5 h-3.5" />
                        <SelectValue placeholder="Piso" />
                    </div>
                </SelectTrigger>
                <SelectContent align="end" className="rounded-xl border-none shadow-lg bg-white/90 backdrop-blur-md">
                    <SelectItem value="ALL">Todos los pisos</SelectItem>
                    {floors.map(f => (
                        <SelectItem key={f} value={f}>Piso {f}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
