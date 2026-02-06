
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Room, RoomStatus, Guest } from '@/types/hotel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Users,
    PaintBucket,
    Wrench,
    X,
    CheckCircle,
    AlertTriangle,
    Bed,
    Wifi,
    Wind,
    Tv,
    History
} from 'lucide-react';

interface RoomDetailsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    room?: Room;
    guest?: Guest;
    roomTypeName?: string;
    onStatusChange: (newStatus: RoomStatus) => void;
}

const amenities = [
    { icon: Wifi, label: 'Wi-Fi Alta Velocidad' },
    { icon: Wind, label: 'Aire Acondicionado' },
    { icon: Tv, label: 'Smart TV 55"' },
    { icon: Bed, label: 'Cama King Size' },
];

export function RoomDetailsDrawer({ isOpen, onClose, room, guest, roomTypeName, onStatusChange }: RoomDetailsDrawerProps) {
    if (!room) return null;

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-full sm:max-w-md p-0 bg-white/95 backdrop-blur-xl border-l border-white/20 shadow-2xl">
                <div className="h-full flex flex-col">
                    {/* Header */}
                    <div className="flex-none p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <div className="flex justify-between items-center mb-4">
                            <Badge variant="outline" className="text-xs font-normal">
                                {roomTypeName} • Piso {room.floor}
                            </Badge>
                            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <h2 className="text-4xl font-bold tracking-tighter text-slate-900 dark:text-slate-100">
                            {room.roomNumber}
                        </h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={cn(
                                "inline-flex w-2.5 h-2.5 rounded-full",
                                room.status === 'AVAILABLE' && "bg-emerald-500",
                                room.status === 'OCCUPIED' && "bg-rose-500",
                                room.status === 'DIRTY' && "bg-amber-500",
                                room.status === 'MAINTENANCE' && "bg-slate-500",
                            )} />
                            <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{room.status}</span>
                        </div>
                    </div>

                    <ScrollArea className="flex-1 p-6">
                        <div className="space-y-8">
                            {/* Control Panel */}
                            <section className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    className={cn("h-auto py-4 flex flex-col gap-2 rounded-xl", room.status === 'AVAILABLE' && "border-emerald-500 bg-emerald-50 text-emerald-900")}
                                    onClick={() => onStatusChange('AVAILABLE')}
                                >
                                    <CheckCircle className="w-5 h-5 mb-1" />
                                    <span className="text-xs">Disponible</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className={cn("h-auto py-4 flex flex-col gap-2 rounded-xl", room.status === 'DIRTY' && "border-amber-500 bg-amber-50 text-amber-900")}
                                    onClick={() => onStatusChange('DIRTY')}
                                >
                                    <PaintBucket className="w-5 h-5 mb-1" />
                                    <span className="text-xs">Sucia</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className={cn("h-auto py-4 flex flex-col gap-2 rounded-xl", room.status === 'MAINTENANCE' && "border-slate-500 bg-slate-50 text-slate-900")}
                                    onClick={() => onStatusChange('MAINTENANCE')}
                                >
                                    <Wrench className="w-5 h-5 mb-1" />
                                    <span className="text-xs">Mantenimiento</span>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-auto py-4 flex flex-col gap-2 rounded-xl border-dashed opacity-50 hover:opacity-100"
                                >
                                    <AlertTriangle className="w-5 h-5 mb-1" />
                                    <span className="text-xs">Reportar Daño</span>
                                </Button>
                            </section>

                            {/* Current Occupancy */}
                            {guest && (
                                <section className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Huésped Actual</h3>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                                            {guest.fullName.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{guest.fullName}</p>
                                            <p className="text-xs text-muted-foreground">Check-out pendiente</p>
                                        </div>
                                    </div>
                                </section>
                            )}

                            <Separator />

                            {/* Amenities (Static Mock) */}
                            <section>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Amenidades</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {amenities.map((item, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                            <item.icon className="w-4 h-4 text-primary/70" />
                                            <span>{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <Separator />

                            {/* History Log (Mock) */}
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <History className="w-4 h-4 text-muted-foreground" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Historial Reciente</h3>
                                </div>
                                <div className="space-y-4 pl-2 border-l border-slate-200 ml-2">
                                    <div className="relative pl-6">
                                        <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-white dark:ring-slate-900" />
                                        <p className="text-xs font-medium">Limpieza completada</p>
                                        <p className="text-[10px] text-muted-foreground">Hoy, 10:30 AM • María G.</p>
                                    </div>
                                    <div className="relative pl-6">
                                        <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-rose-400 ring-4 ring-white dark:ring-slate-900" />
                                        <p className="text-xs font-medium">Check-out (Huésped: Juan P.)</p>
                                        <p className="text-[10px] text-muted-foreground">Hoy, 10:00 AM</p>
                                    </div>
                                    <div className="relative pl-6">
                                        <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-400 ring-4 ring-white dark:ring-slate-900" />
                                        <p className="text-xs font-medium">Check-in</p>
                                        <p className="text-[10px] text-muted-foreground">Ayer, 02:15 PM</p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </ScrollArea>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// Utility for styles
import { cn } from '@/lib/utils';
