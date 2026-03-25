import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Room, Booking, Guest, RoomType } from '@/types/hotel';
import { useNavigate } from 'react-router-dom';
import { BedDouble, User, Wrench, Sparkles, Ban } from 'lucide-react';

interface RoomStatusMapProps {
    rooms: Room[];
    bookings: Booking[];
    guests: Guest[];
    roomTypes: RoomType[];
}

const STATUS_CONFIG = {
    AVAILABLE: {
        bg: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700',
        text: 'text-emerald-700 dark:text-emerald-300',
        dot: 'bg-emerald-500',
        label: 'Disponible',
        icon: Sparkles,
    },
    OCCUPIED: {
        bg: 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700',
        text: 'text-blue-700 dark:text-blue-300',
        dot: 'bg-blue-500',
        label: 'Ocupada',
        icon: User,
    },
    DIRTY: {
        bg: 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700',
        text: 'text-amber-700 dark:text-amber-300',
        dot: 'bg-amber-500',
        label: 'Sucia',
        icon: BedDouble,
    },
    MAINTENANCE: {
        bg: 'bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700',
        text: 'text-red-700 dark:text-red-300',
        dot: 'bg-red-500',
        label: 'Mantenimiento',
        icon: Wrench,
    },
    OUT_OF_ORDER: {
        bg: 'bg-slate-200 dark:bg-slate-800 border-slate-400 dark:border-slate-600',
        text: 'text-slate-600 dark:text-slate-400',
        dot: 'bg-slate-500',
        label: 'Fuera de servicio',
        icon: Ban,
    },
} as const;

export function RoomStatusMap({ rooms, bookings, guests, roomTypes }: RoomStatusMapProps) {
    const navigate = useNavigate();

    // Sort rooms by number
    const sortedRooms = useMemo(() =>
        [...rooms].sort((a, b) => {
            const numA = parseInt(a.roomNumber, 10);
            const numB = parseInt(b.roomNumber, 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.roomNumber.localeCompare(b.roomNumber);
        }),
        [rooms]
    );

    // Map room → current guest (CHECKED_IN booking)
    const roomGuestMap = useMemo(() => {
        const map: Record<string, { guest: Guest; booking: Booking } | undefined> = {};
        bookings.forEach(b => {
            if (b.status === 'CHECKED_IN' && b.roomId) {
                const guest = guests.find(g => g.id === b.guestId);
                if (guest) map[b.roomId] = { guest, booking: b };
            }
        });
        return map;
    }, [bookings, guests]);

    // Room type name map
    const typeMap = useMemo(() => {
        const m: Record<string, string> = {};
        roomTypes.forEach(rt => { m[rt.id] = rt.name; });
        return m;
    }, [roomTypes]);

    // Stats summary
    const stats = useMemo(() => ({
        total: rooms.length,
        available: rooms.filter(r => r.status === 'AVAILABLE').length,
        occupied: rooms.filter(r => r.status === 'OCCUPIED').length,
        dirty: rooms.filter(r => r.status === 'DIRTY').length,
        maintenance: rooms.filter(r => r.status === 'MAINTENANCE' || r.status === 'OUT_OF_ORDER').length,
    }), [rooms]);

    // Group rooms by floor
    const floors = useMemo(() => {
        const floorMap: Record<number, typeof sortedRooms> = {};
        sortedRooms.forEach(r => {
            if (!floorMap[r.floor]) floorMap[r.floor] = [];
            floorMap[r.floor].push(r);
        });
        return Object.entries(floorMap)
            .sort(([a], [b]) => Number(a) - Number(b));
    }, [sortedRooms]);

    return (
        <Card className="border-none shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg">Mapa de Habitaciones</CardTitle>
                    <div className="flex items-center gap-3 flex-wrap">
                        <StatusBadge dot={STATUS_CONFIG.AVAILABLE.dot} label="Libre" count={stats.available} />
                        <StatusBadge dot={STATUS_CONFIG.OCCUPIED.dot} label="Ocupada" count={stats.occupied} />
                        <StatusBadge dot={STATUS_CONFIG.DIRTY.dot} label="Sucia" count={stats.dirty} />
                        {stats.maintenance > 0 && (
                            <StatusBadge dot={STATUS_CONFIG.MAINTENANCE.dot} label="Mant." count={stats.maintenance} />
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="space-y-4">
                    {floors.map(([floor, floorRooms]) => (
                        <div key={floor}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Piso {floor}
                                </span>
                                <div className="flex-1 h-px bg-border" />
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                                {floorRooms.map(room => {
                                    const config = STATUS_CONFIG[room.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.AVAILABLE;
                                    const occupant = roomGuestMap[room.id];
                                    const Icon = config.icon;
                                    const guestFirstName = occupant?.guest.fullName.split(' ')[0];

                                    return (
                                        <TooltipProvider key={room.id}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        onClick={() => navigate('/rooms')}
                                                        className={cn(
                                                            'relative flex flex-col items-center justify-center rounded-xl border-2 p-2.5 min-h-[72px] transition-all hover:scale-105 hover:shadow-md cursor-pointer',
                                                            config.bg,
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            <span className={cn('text-base font-bold', config.text)}>
                                                                {room.roomNumber}
                                                            </span>
                                                        </div>
                                                        {occupant ? (
                                                            <span className={cn('text-[10px] font-medium truncate max-w-full', config.text)}>
                                                                {guestFirstName}
                                                            </span>
                                                        ) : (
                                                            <Icon className={cn('w-3.5 h-3.5 mt-0.5 opacity-60', config.text)} />
                                                        )}
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="text-xs">
                                                    <p className="font-bold">Hab {room.roomNumber} — {typeMap[room.roomTypeId] || '?'}</p>
                                                    <p>{config.label}</p>
                                                    {occupant && (
                                                        <p className="font-medium">{occupant.guest.fullName}</p>
                                                    )}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function StatusBadge({ dot, label, count }: { dot: string; label: string; count: number }) {
    return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={cn('w-2.5 h-2.5 rounded-full', dot)} />
            <span>{label}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-bold">
                {count}
            </Badge>
        </div>
    );
}
