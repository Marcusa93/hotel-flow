import { RoomType } from '@/types/hotel';
import { Button } from '@/components/ui/button';
import { Settings2, X } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface AvailabilityFiltersProps {
    roomTypes: RoomType[];
    selectedTypeIds: string[];
    onTypeChange: (ids: string[]) => void;
    floors: number[];
    selectedFloors: number[];
    onFloorChange: (floors: number[]) => void;
}

export function AvailabilityFilters({
    roomTypes,
    selectedTypeIds,
    onTypeChange,
    floors,
    selectedFloors,
    onFloorChange,
}: AvailabilityFiltersProps) {
    const activeFiltersCount = selectedTypeIds.length + selectedFloors.length;

    const clearFilters = () => {
        onTypeChange([]);
        onFloorChange([]);
    };

    const toggleType = (id: string) => {
        if (selectedTypeIds.includes(id)) {
            onTypeChange(selectedTypeIds.filter(t => t !== id));
        } else {
            onTypeChange([...selectedTypeIds, id]);
        }
    };

    const toggleFloor = (floor: number) => {
        if (selectedFloors.includes(floor)) {
            onFloorChange(selectedFloors.filter(f => f !== floor));
        } else {
            onFloorChange([...selectedFloors, floor]);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1 bg-background/50 backdrop-blur-sm border-dashed">
                        <Settings2 className="h-4 w-4" />
                        <span>Filtros</span>
                        {activeFiltersCount > 0 && (
                            <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                                {activeFiltersCount}
                            </Badge>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px] glass">
                    <DropdownMenuLabel>Tipo de Habitación</DropdownMenuLabel>
                    {roomTypes.map(type => (
                        <DropdownMenuCheckboxItem
                            key={type.id}
                            checked={selectedTypeIds.includes(type.id)}
                            onCheckedChange={() => toggleType(type.id)}
                        >
                            {type.name}
                        </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Piso</DropdownMenuLabel>
                    {floors.map(floor => (
                        <DropdownMenuCheckboxItem
                            key={floor}
                            checked={selectedFloors.includes(floor)}
                            onCheckedChange={() => toggleFloor(floor)}
                        >
                            Piso {floor}
                        </DropdownMenuCheckboxItem>
                    ))}
                    {activeFiltersCount > 0 && (
                        <>
                            <DropdownMenuSeparator />
                            <div className="p-2">
                                <Button variant="ghost" size="sm" className="w-full text-xs justify-start h-8" onClick={clearFilters}>
                                    <X className="mr-2 h-3 w-3" />
                                    Limpiar filtros
                                </Button>
                            </div>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
