import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, formatLastNameFirst } from '@/lib/utils';
import { Room, Booking, Guest, RoomType } from '@/types/hotel';
import { useNavigate } from 'react-router-dom';
import { BedDouble, User, Wrench, Sparkles, Ban } from 'lucide-react';
import { format } from 'date-fns';

interface RoomStatusMapProps {
    rooms: Room[];
    bookings: Booking[];
    guests: Guest[];
    roomTypes: RoomType[];
}

const STATUS_CONFIG = {
    AVAILABLE: {
        bg: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
        text: 'text-emerald-700 dark:text-emerald-300',
        dot: 'bg-emerald-500',
        label: 'Disponible',
        icon: Sparkles,
    },
    OCCUPIED: {
        bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
        text: 'text-blue-700 dark:text-blue-300',
        dot: 'bg-blue-500',
        label: 'Ocupada',
        icon: User,
    },
    DIRTY: {
        bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
        text: 'text-amber-700 dark:text-amber-300',
        dot: 'bg-amber-500',
        label: 'Sucia',
        icon: BedDouble,
    },
    MAINTENANCE: {
        bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
        text: 'text-red-700 dark:text-red-300',
        dot: 'bg-red-500',
        label: 'Mantenimiento',
        icon: Wrench,
    },
    OUT_OF_ORDER: {
        bg: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600',
        text: 'text-slate-500 dark:text-slate-400',
        dot: 'bg-slate-400',
        label: 'Fuera de servicio',
        icon: Ban,
    },
} as const;

export function RoomStatusMap({ rooms, bookings, guests, roomTypes }: RoomStatusMapProps) {
    const navigate = useNavigate();

    const sortedRooms = useMemo(() =>
        [...rooms].sort((a, b) => {
            const numA = parseInt(a.roomNumber, 10);
            const numB = parseInt(b.roomNumber, 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.roomNumber.localeCompare(b.roomNumber);
        }),
        [rooms]
    );

    // Map room → current guest + booking
    const roomGuestMap = useMemo(() => {
        const map = new Map<string, { guest: Guest; booking: Booking }>();
        for (const b of bookings) {
            if (b.status === 'CHECKED_IN' && b.roomId) {
                const guest = guests.find(g => g.id === b.guestId);
                if (guest) map.set(b.roomId, { guest, booking: b });
            }
        }
        return map;
    }, [bookings, guests]);

    const typeMap = useMemo(() => {
        const m = new Map<string, string>();
        for (const rt of roomTypes) m.set(rt.id, `${rt.maxGuests}p`);
        return m;
    }, [roomTypes]);

    const stats = useMemo(() => ({
        available: rooms.filter(r => r.status === 'AVAILABLE').length,
        occupied: rooms.filter(r => r.status === 'OCCUPIED').length,
        dirty: rooms.filter(r => r.status === 'DIRTY').length,
        maintenance: rooms.filter(r => r.status === 'MAINTENANCE' || r.status === 'OUT_OF_ORDER').length,
    }), [rooms]);

    // Group by floor
    const floors = useMemo(() => {
        const floorMap: Record<number, typeof sortedRooms> = {};
        for (const r of sortedRooms) {
            if (!floorMap[r.floor]) floorMap[r.floor] = [];
            floorMap[r.floor].push(r);
        }
        return Object.entries(floorMap).sort(([a], [b]) => Number(a) - Number(b));
    }, [sortedRooms]);

    return (
        <Card className="border-none shadow-lg bg-white/70 dark:bg-slate-900/60 backdrop-blur">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">Habitaciones</CardTitle>
                        <Badge variant="outline" className="text-xs font-mono">{rooms.length} total</Badge>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                        <Legend dot={STATUS_CONFIG.AVAILABLE.dot} label="Libre" count={stats.available} />
                        <Legend dot={STATUS_CONFIG.OCCUPIED.dot} label="Ocupada" count={stats.occupied} />
                        <Legend dot={STATUS_CONFIG.DIRTY.dot} label="Sucia" count={stats.dirty} />
                        {stats.maintenance > 0 && (
                            <Legend dot={STATUS_CONFIG.MAINTENANCE.dot} label="Mant." count={stats.maintenance} />
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="space-y-5">
                    {floors.map(([floor, floorRooms]) => (
                        <div key={floor}>
                            <div className="flex items-center gap-2 mb-2.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                                    Piso {floor}
                                </span>
                                <div className="flex-1 h-px bg-border/50" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                                {floorRooms.map(room => {
                                    const config = STATUS_CONFIG[room.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.AVAILABLE;
                                    const occupant = roomGuestMap.get(room.id);
                                    const Icon = config.icon;
                                    const guestName = occupant ? formatLastNameFirst(occupant.guest.fullName) : null;
                                    const checkoutDate = occupant?.booking.checkOutDate
                                        ? format(new Date(occupant.booking.checkOutDate), 'dd/MM')
                                        : null;

                                    return (
                                        <TooltipProvider key={room.id}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        onClick={() => {
                                                            const occ = roomGuestMap.get(room.id);
                                                            if (occ) navigate(`/bookings/${occ.booking.id}`);
                                                            else navigate('/rooms');
                                                        }}
                                                        className={cn(
                                                            'relative flex flex-col items-start rounded-2xl border-2 p-3.5 min-h-[88px] transition-all hover:scale-[1.04] hover:shadow-xl cursor-pointer w-full text-left group',
                                                            config.bg,
                                                        )}
                                                    >
                                                        {/* Status dot indicator */}
                                                        <div className={cn('absolute top-2 right-2 w-2 h-2 rounded-full', config.dot, occupant && 'animate-pulse')} />

                                                        {/* Room number + capacity */}
                                                        <div className="flex items-baseline gap-1.5 mb-1.5">
                                                            <span className={cn('text-2xl font-extrabold leading-none tracking-tight', config.text)}>
                                                                {room.roomNumber}
                                                            </span>
                                                            <span className="text-[9px] text-muted-foreground font-medium">
                                                                {typeMap.get(room.roomTypeId) || ''}
                                                            </span>
                                                        </div>

                                                        {/* Content by status */}
                                                        {occupant ? (
                                                            <div className="flex flex-col gap-0.5 w-full min-w-0">
                                                                <span className={cn('text-[12px] font-semibold truncate', config.text)}>
                                                                    {guestName}
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground font-medium">
                                                                    checkout {checkoutDate}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 mt-auto">
                                                                <Icon className={cn('w-3.5 h-3.5 opacity-40 group-hover:opacity-70 transition-opacity', config.text)} />
                                                                <span className={cn('text-[11px] opacity-60 group-hover:opacity-90 transition-opacity', config.text)}>
                                                                    {config.label}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="text-xs space-y-0.5">
                                                    <p className="font-bold">Hab {room.roomNumber} — {typeMap.get(room.roomTypeId) || '?'}</p>
                                                    <p>Estado: {config.label}</p>
                                                    {occupant && (
                                                        <>
                                                            <p className="font-medium">{formatLastNameFirst(occupant.guest.fullName)}</p>
                                                            <p>Checkout: {checkoutDate}</p>
                                                        </>
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

function Legend({ dot, label, count }: { dot: string; label: string; count: number }) {
    return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={cn('w-2.5 h-2.5 rounded-full', dot)} />
            <span>{label}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-bold">{count}</Badge>
        </div>
    );
}
