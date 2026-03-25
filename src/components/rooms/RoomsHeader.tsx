import { Plus, BedDouble, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface RoomsHeaderProps {
    totalRooms: number;
    occupiedCount: number;
    dirtyCount: number;
    onAddRoom?: () => void;
}

export function RoomsHeader({ totalRooms, occupiedCount, dirtyCount, onAddRoom }: RoomsHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-2">
            <div className="space-y-4 flex-1">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                        Habitaciones
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm font-medium">
                        Panel de control de housekeeping e inventario
                    </p>
                </div>

                <div className="flex gap-3">
                    <Card className="flex items-center gap-3 px-4 py-2 bg-white/50 backdrop-blur border-none shadow-sm">
                        <div className="p-2 bg-slate-100 rounded-full text-slate-600">
                            <BedDouble className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Total</p>
                            <p className="text-lg font-bold leading-none">{totalRooms}</p>
                        </div>
                    </Card>
                    <Card className="flex items-center gap-3 px-4 py-2 bg-white/50 backdrop-blur border-none shadow-sm">
                        <div className="p-2 bg-rose-100 rounded-full text-rose-600">
                            <AlertCircle className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Ocupadas</p>
                            <p className="text-lg font-bold leading-none">{occupiedCount}</p>
                        </div>
                    </Card>
                    <Card className="flex items-center gap-3 px-4 py-2 bg-white/50 backdrop-blur border-none shadow-sm">
                        <div className="p-2 bg-amber-100 rounded-full text-amber-600">
                            <CheckCircle className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Sucias</p>
                            <p className="text-lg font-bold leading-none">{dirtyCount}</p>
                        </div>
                    </Card>
                </div>
            </div>

            {onAddRoom && (
                <Button
                    onClick={onAddRoom}
                    className="rounded-full px-6 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all mb-1"
                    size="lg"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Agregar Habitación
                </Button>
            )}
        </div>
    );
}
