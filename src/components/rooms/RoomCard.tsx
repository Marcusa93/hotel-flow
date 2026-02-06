import { Room, RoomStatus, Guest, Booking } from '@/types/hotel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, AlertTriangle, Sparkles, LogIn, PaintBucket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface RoomCardProps {
    room: Room;
    guest?: Guest;
    roomTypeName?: string;
    onClick: () => void;
    onQuickAction: (action: 'clean' | 'occupy') => void;
}

const statusColorMap: Record<RoomStatus, string> = {
    AVAILABLE: 'bg-emerald-500',
    OCCUPIED: 'bg-rose-500',
    DIRTY: 'bg-amber-500',
    MAINTENANCE: 'bg-slate-500',
    OUT_OF_ORDER: 'bg-slate-800'
};

const statusBorderMap: Record<RoomStatus, string> = {
    AVAILABLE: 'border-emerald-200 dark:border-emerald-900/50',
    OCCUPIED: 'border-rose-200 dark:border-rose-900/50',
    DIRTY: 'border-amber-200 dark:border-amber-900/50',
    MAINTENANCE: 'border-slate-200 dark:border-slate-800',
    OUT_OF_ORDER: 'border-slate-300 dark:border-slate-700'
};

export function RoomCard({ room, guest, roomTypeName, onClick, onQuickAction }: RoomCardProps) {
    return (
        <motion.div
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="group relative"
        >
            <div
                onClick={onClick}
                className={cn(
                    "bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer h-full border-l-4",
                    statusColorMap[room.status].replace('bg-', 'border-l-'), // Use the color for the left border strip
                    "border-t border-r border-b border-slate-100 dark:border-slate-800" // Rest of borders subtle
                )}
            >
                <div className="p-4 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                {roomTypeName}
                            </span>
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                                {room.roomNumber}
                            </h3>
                        </div>
                        {/* Clean/Dirty Status Badge (Mini) */}
                        {room.status === 'DIRTY' && (
                            <div className="animate-pulse bg-amber-100 p-1.5 rounded-full">
                                <PaintBucket className="w-4 h-4 text-amber-600" />
                            </div>
                        )}
                    </div>

                    <div className="mt-auto space-y-2">
                        {/* Occupancy Info */}
                        {guest ? (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
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

                        <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium uppercase tracking-wide pt-2 border-t border-slate-50 dark:border-slate-800">
                            <span>Piso {room.floor}</span>
                            <span className={cn(
                                "font-bold",
                                room.status === 'AVAILABLE' && "text-emerald-600",
                                room.status === 'OCCUPIED' && "text-rose-600",
                                room.status === 'DIRTY' && "text-amber-600",
                            )}>
                                {room.status}
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
