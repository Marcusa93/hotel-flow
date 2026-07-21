import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, LogOut, AlertTriangle, BedDouble, Users, CreditCard, Star, ClipboardList, Car } from 'lucide-react';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import { Booking, Room, Guest, Payment } from '@/types/hotel';
import { isToday, isTomorrow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { cn, formatLastNameFirst } from '@/lib/utils';
import { TodayMovementsPanel } from './TodayMovementsPanel';

interface AIBriefingProps {
    bookings: Booking[];
    rooms: Room[];
    guests: Guest[];
    payments: Payment[];
}

interface BriefingItem {
    icon: typeof Sparkles;
    /** Dato principal: corto, en negrita — lo que se lee de un vistazo */
    title: string;
    /** Contexto secundario, gris y truncable */
    detail?: string;
    color: string;
    priority: number; // menor = más importante
    urgent?: boolean;
    route?: string;
}

export function AIBriefing({ bookings, rooms, guests, payments }: AIBriefingProps) {
    const navigate = useNavigate();
    const { data: hotelSettings } = useHotelSettings();
    const parkingSpots = hotelSettings?.parkingSpots ?? 0;

    const items = useMemo(() => {
        const result: BriefingItem[] = [];

        // 1. Cuello de botella: limpieza vs llegadas de mañana
        const dirtyRooms = rooms.filter(r => r.status === 'DIRTY').length;
        const tomorrowCheckIns = bookings.filter(b =>
            isTomorrow(new Date(b.checkInDate)) && (b.status === 'CONFIRMED' || b.status === 'PENDING')
        ).length;
        if (dirtyRooms > 0 && tomorrowCheckIns > 0 && dirtyRooms >= tomorrowCheckIns) {
            result.push({
                icon: AlertTriangle,
                title: 'Priorizar limpieza',
                detail: `${dirtyRooms} hab. sucias y ${tomorrowCheckIns} llegada${tomorrowCheckIns > 1 ? 's' : ''} mañana`,
                color: 'text-red-500',
                priority: 0,
                urgent: true,
                route: '/housekeeping',
            });
        } else if (dirtyRooms > 0) {
            result.push({
                icon: BedDouble,
                title: `${dirtyRooms} hab. a limpiar`,
                detail: 'pendientes de housekeeping',
                color: 'text-amber-500',
                priority: 5,
                route: '/housekeeping',
            });
        }

        // 2. Ocupación
        const occupied = rooms.filter(r => r.status === 'OCCUPIED').length;
        const available = rooms.filter(r => r.status === 'AVAILABLE').length;
        const total = rooms.length;
        const rate = total > 0 ? ((occupied / total) * 100).toFixed(0) : '0';
        result.push({
            icon: Users,
            title: `Ocupación ${rate}%`,
            detail: `${occupied} ocupadas · ${available} libres de ${total}`,
            color: 'text-blue-600',
            priority: 1,
            route: '/rooms',
        });

        // 3. Pagos pendientes
        const pendingPayments = payments.filter(p => p.status === 'PENDING');
        const pendingTotal = pendingPayments.reduce((s, p) => s + p.amount, 0);
        if (pendingTotal > 0) {
            result.push({
                icon: CreditCard,
                title: `$${pendingTotal.toLocaleString('es-AR')} por cobrar`,
                detail: `${pendingPayments.length} pago${pendingPayments.length > 1 ? 's' : ''} pendiente${pendingPayments.length > 1 ? 's' : ''}`,
                color: 'text-orange-500',
                priority: 3,
                route: '/payments',
            });
        }

        // 5. Cocheras — solo si el hotel configuró cuántas tiene
        if (parkingSpots > 0) {
            const parkedNow = bookings.filter(b => b.status === 'CHECKED_IN' && b.hasVehicle).length;
            const arrivingWithCar = bookings.filter(b =>
                b.hasVehicle
                && (b.status === 'CONFIRMED' || b.status === 'PENDING')
                && isToday(new Date(b.checkInDate))
            ).length;
            const demand = parkedNow + arrivingWithCar;
            const overbooked = demand > parkingSpots;
            const free = parkingSpots - parkedNow;

            // Los libres van siempre: si solo se mostraban las llegadas, después de
            // un check-in parecía que el auto que ya entró seguía "por llegar".
            const pending = arrivingWithCar > 0
                ? ` · falta${arrivingWithCar > 1 ? 'n' : ''} llegar ${arrivingWithCar} auto${arrivingWithCar > 1 ? 's' : ''}`
                : '';

            result.push({
                icon: Car,
                title: `Cocheras ${parkedNow}/${parkingSpots}`,
                detail: overbooked
                    ? `${demand} autos para ${parkingSpots} lugares — falta lugar`
                    : `${free} libre${free === 1 ? '' : 's'}${pending}`,
                color: overbooked ? 'text-red-500' : 'text-slate-500',
                priority: overbooked ? 0 : 4,
                urgent: overbooked,
                route: '/bookings?filter=checkin-today',
            });
        }

        // 6. Huéspedes frecuentes que llegan hoy o mañana
        const frequent = bookings
            .filter(b => (isToday(new Date(b.checkInDate)) || isTomorrow(new Date(b.checkInDate))) && (b.status === 'CONFIRMED' || b.status === 'PENDING'))
            .map(b => {
                const guest = guests.find(g => g.id === b.guestId);
                if (!guest) return null;
                const visits = bookings.filter(bb => bb.guestId === guest.id).length;
                if (visits < 3) return null;
                const totalSpend = bookings.filter(bb => bb.guestId === guest.id).reduce((s, bb) => s + bb.totalAmount, 0);
                const when = isToday(new Date(b.checkInDate)) ? 'hoy' : 'mañana';
                return { guest, visits, totalSpend, when };
            })
            .filter(Boolean);

        for (const f of frequent) {
            if (!f) continue;
            result.push({
                icon: Star,
                title: `Frecuente: ${formatLastNameFirst(f.guest.fullName)}`,
                detail: `llega ${f.when} · ${f.visits} visitas · $${(f.totalSpend / 1000).toFixed(0)}k`,
                color: 'text-indigo-500',
                priority: 4,
            });
        }

        return result.sort((a, b) => a.priority - b.priority).slice(0, 5);
    }, [bookings, rooms, guests, payments, parkingSpots]);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';

    return (
        <Card className="border-none shadow-lg bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/80 dark:from-indigo-950/30 dark:via-slate-900/60 dark:to-violet-950/30 backdrop-blur">
            <CardContent className="p-4 md:p-5">
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
                        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-100">
                        {greeting} — Resumen del día
                    </h3>
                    <span className="text-xs text-muted-foreground capitalize ml-auto hidden sm:block">
                        {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
                    </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 lg:gap-6 lg:divide-x lg:divide-slate-200/70 dark:lg:divide-slate-700/50">
                    {/* ── Estado del día ── */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-2 px-2">
                            <ClipboardList className="w-3.5 h-3.5 text-indigo-500" />
                            Cómo viene el día
                        </h4>
                        {items.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">Todo tranquilo por ahora.</p>
                        ) : (
                            <div className="space-y-0.5">{items.map((item, i) => {
                                const Row = item.route ? 'button' : 'div';
                                return (
                                    <Row
                                        key={i}
                                        onClick={item.route ? () => navigate(item.route!) : undefined}
                                        className={cn(
                                            'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors',
                                            item.urgent && 'bg-red-50/80 dark:bg-red-950/25',
                                            item.route && 'hover:bg-white/80 dark:hover:bg-slate-800/60 cursor-pointer',
                                        )}
                                    >
                                        <item.icon className={cn('w-4 h-4 shrink-0', item.color)} />
                                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 shrink-0">
                                            {item.title}
                                        </span>
                                        {item.detail && (
                                            <span className="text-xs text-muted-foreground truncate min-w-0">
                                                {item.detail}
                                            </span>
                                        )}
                                    </Row>
                                );
                            })}</div>
                        )}
                    </div>

                    {/* ── Entradas y salidas del día ── */}
                    <div className="lg:pl-6 border-t lg:border-t-0 border-slate-200/70 dark:border-slate-700/50 pt-3 lg:pt-0">
                        <TodayMovementsPanel />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
