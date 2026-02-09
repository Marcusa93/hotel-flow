import { Room, RoomStatus, Guest, Booking } from '@/types/hotel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, AlertTriangle, Sparkles, LogIn, PaintBucket, Brush } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface RoomCardProps {
    room: Room;
    guest?: Guest;
    roomTypeName?: string;
    onClick: () => void;
    onQuickAction: (action: 'clean' | 'occupy') => void;
    needsCleaning?: boolean; // Flag para indicar si necesita limpieza
}

// Colores actualizados: verde=disponible, rojo=ocupada, azul=mantenimiento, amarillo=sucia
const statusColorMap: Record<RoomStatus, string> = {
    AVAILABLE: 'bg-emerald-500',
    OCCUPIED: 'bg-rose-500',
    DIRTY: 'bg-amber-500',
    MAINTENANCE: 'bg-blue-500',
    OUT_OF_ORDER: 'bg-slate-800'
};

const statusBgMap: Record<RoomStatus, string> = {
    AVAILABLE: 'bg-emerald-50 dark:bg-emerald-950/30',
    OCCUPIED: 'bg-rose-50 dark:bg-rose-950/30',
    DIRTY: 'bg-amber-50 dark:bg-amber-950/30',
    MAINTENANCE: 'bg-blue-50 dark:bg-blue-950/30',
    OUT_OF_ORDER: 'bg-slate-100 dark:bg-slate-900'
};

const statusTextMap: Record<RoomStatus, string> = {
    AVAILABLE: 'text-emerald-600 dark:text-emerald-400',
    OCCUPIED: 'text-rose-600 dark:text-rose-400',
    DIRTY: 'text-amber-600 dark:text-amber-400',
    MAINTENANCE: 'text-blue-600 dark:text-blue-400',
    OUT_OF_ORDER: 'text-slate-600 dark:text-slate-400'
};

const statusLabels: Record<RoomStatus, string> = {
    AVAILABLE: 'Disponible',
    OCCUPIED: 'Ocupada',
    DIRTY: 'Sucia',
    MAINTENANCE: 'Mantenimiento',
    OUT_OF_ORDER: 'Fuera de Servicio'
};

export function RoomCard({ room, guest, roomTypeName, onClick, onQuickAction, needsCleaning }: RoomCardProps) {
    // Si el estado es DIRTY, automáticamente needsCleaning es true
    const showCleaningIndicator = needsCleaning || room.status === 'DIRTY';

    return (
        <motion.div
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="group relative"
        >
            <div
                onClick={onClick}
                className={cn(
                    "rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer h-full border-l-4",
                    statusColorMap[room.status].replace('bg-', 'border-l-'),
                    statusBgMap[room.status],
                    "border-t border-r border-b border-white/50 dark:border-slate-700"
                )}
            >
                <div className="p-4 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <span className="text-[10px] bg-white/70 dark:bg-slate-800 text-slate-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                {roomTypeName}
                            </span>
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                                {room.roomNumber}
                            </h3>
                        </div>
                        {/* Indicador de limpieza - puede aparecer en cualquier estado */}
                        {showCleaningIndicator && (
                            <div className={cn(
                                "p-1.5 rounded-full",
                                room.status === 'DIRTY' ? "animate-pulse bg-amber-200" : "bg-slate-200 dark:bg-slate-700"
                            )}>
                                <Brush className={cn(
                                    "w-4 h-4",
                                    room.status === 'DIRTY' ? "text-amber-600" : "text-slate-500"
                                )} />
                            </div>
                        )}
                    </div>

                    <div className="mt-auto space-y-2">
                        {/* Occupancy Info */}
                        {guest ? (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-white/70 dark:bg-slate-800/50">
                                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                    {guest.fullName.charAt(0)}
                                </div>
                                <p className="text-xs font-medium truncate flex-1">{guest.fullName}</p>
                            </div>
                        ) : (
                            <div className="h-10 flex items-center text-xs text-muted-foreground p-2">
                                <span className="opacity-50">Sin huésped</span>
                            </div>
                        )}

                        <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium uppercase tracking-wide pt-2 border-t border-white/50 dark:border-slate-800">
                            <span>Piso {room.floor}</span>
                            <span className={cn("font-bold", statusTextMap[room.status])}>
                                {statusLabels[room.status]}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Quick Actions Overlay (Appears on Hover) */}
                <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-4 pointer-events-none group-hover:pointer-events-auto">
                    <Button size="sm" className="w-full rounded-xl bg-slate-900 text-white hover:bg-black" onClick={(e) => { e.stopPropagation(); onClick(); }}>
                        Ver Detalles
                    </Button>

                    {room.status === 'DIRTY' && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="w-full rounded-xl border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 hover:border-emerald-300"
                            onClick={(e) => { e.stopPropagation(); onQuickAction('clean'); }}
                        >
                            <Sparkles className="w-4 h-4 mr-2" /> Marcar Limpia
                        </Button>
                    )}

                    {room.status === 'AVAILABLE' && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="w-full rounded-xl border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 hover:text-blue-800 hover:border-blue-300"
                            onClick={(e) => { e.stopPropagation(); onQuickAction('occupy'); }}
                        >
                            <LogIn className="w-4 h-4 mr-2" /> Check-in Rápido
                        </Button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
