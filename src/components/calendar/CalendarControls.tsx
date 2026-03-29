import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Filter, LayoutGrid, LayoutList, Flame, Coins, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RoomType } from '@/types/hotel';

interface CalendarControlsProps {
    view: 'month' | 'week' | 'timeline';
    onViewChange: (view: 'month' | 'week' | 'timeline') => void;
    heatmapMode: 'none' | 'occupancy' | 'revenue';
    onHeatmapModeChange: (mode: 'none' | 'occupancy' | 'revenue') => void;
    selectedRoomType: string;
    onRoomTypeChange: (value: string) => void;
    roomTypes: RoomType[];
    onNavigate: (direction: 'prev' | 'next') => void;
    onToday: () => void;
}

export function CalendarControls({
    view,
    onViewChange,
    heatmapMode,
    onHeatmapModeChange,
    selectedRoomType,
    onRoomTypeChange,
    roomTypes,
    onNavigate,
    onToday
}: CalendarControlsProps) {
    return (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-2 rounded-2xl border border-white/20 shadow-sm">
            {/* Navigation Group */}
            <div className="flex items-center gap-2">
                <div className="flex items-center bg-white/50 dark:bg-slate-800/50 rounded-xl p-1 shadow-sm">
                    <Button variant="ghost" size="icon" onClick={() => onNavigate('prev')} className="h-8 w-8 rounded-lg hover:bg-white dark:hover:bg-slate-700">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onToday} className="h-8 px-3 text-xs font-medium hover:bg-white dark:hover:bg-slate-700 rounded-lg">
                        Hoy
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onNavigate('next')} className="h-8 w-8 rounded-lg hover:bg-white dark:hover:bg-slate-700">
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>

                {/* View Toggle */}
                <div className="flex items-center bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl">
                    <Button
                        variant={view === 'month' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => onViewChange('month')}
                        className={cn("h-8 rounded-lg text-xs", view === 'month' && "bg-white dark:bg-slate-700 shadow-sm")}
                    >
                        <LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> Mes
                    </Button>
                    <Button
                        variant={view === 'week' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => onViewChange('week')}
                        className={cn("h-8 rounded-lg text-xs", view === 'week' && "bg-white dark:bg-slate-700 shadow-sm")}
                    >
                        <LayoutList className="w-3.5 h-3.5 mr-1.5" /> Semana
                    </Button>
                    <Button
                        variant={view === 'timeline' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => onViewChange('timeline')}
                        className={cn("h-8 rounded-lg text-xs", view === 'timeline' && "bg-white dark:bg-slate-700 shadow-sm")}
                    >
                        <CalendarIcon className="w-3.5 h-3.5 mr-1.5" /> Timeline
                    </Button>
                </div>
            </div>

            {/* Filters Group */}
            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
                {/* Room Type Filter */}
                <div className="relative min-w-[180px]">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground z-10" />
                    <Select value={selectedRoomType} onValueChange={onRoomTypeChange}>
                        <SelectTrigger className="h-10 pl-9 border-none bg-transparent hover:bg-white/50 rounded-xl text-sm font-medium">
                            <SelectValue placeholder="Tipo de habitación" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las habitaciones</SelectItem>
                            {roomTypes.map(rt => (
                                <SelectItem key={rt.id} value={rt.id}>Hab. {rt.maxGuests}p</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block" />

                {/* Heatmap Toggles */}
                <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl">
                    <Button
                        variant={heatmapMode === 'occupancy' ? 'outline' : 'ghost'}
                        size="sm"
                        onClick={() => onHeatmapModeChange(heatmapMode === 'occupancy' ? 'none' : 'occupancy')}
                        className={cn(
                            "h-8 rounded-lg text-xs border-transparent",
                            heatmapMode === 'occupancy' && "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
                        )}
                    >
                        <Flame className="w-3.5 h-3.5 mr-1.5" /> Ocupación
                    </Button>
                    <Button
                        variant={heatmapMode === 'revenue' ? 'outline' : 'ghost'}
                        size="sm"
                        onClick={() => onHeatmapModeChange(heatmapMode === 'revenue' ? 'none' : 'revenue')}
                        className={cn(
                            "h-8 rounded-lg text-xs border-transparent",
                            heatmapMode === 'revenue' && "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                        )}
                    >
                        <Coins className="w-3.5 h-3.5 mr-1.5" /> Ingresos
                    </Button>
                </div>
            </div>
        </div>
    );
}
