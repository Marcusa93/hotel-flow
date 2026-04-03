import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, LogIn, LogOut, AlertTriangle, BedDouble, Users, CreditCard, Star } from 'lucide-react';
import { Booking, Room, Guest, Payment } from '@/types/hotel';
import { isToday, isTomorrow, format } from 'date-fns';
import { cn, formatLastNameFirst } from '@/lib/utils';

interface AIBriefingProps {
    bookings: Booking[];
    rooms: Room[];
    guests: Guest[];
    payments: Payment[];
}

interface BriefingItem {
    icon: typeof Sparkles;
    text: string;
    color: string;
    priority: number; // lower = more important
}

export function AIBriefing({ bookings, rooms, guests, payments }: AIBriefingProps) {
    const items = useMemo(() => {
        const result: BriefingItem[] = [];
        const now = new Date();

        // 1. Today's check-ins with guest names
        const todayCheckIns = bookings.filter(b =>
            isToday(new Date(b.checkInDate)) && (b.status === 'CONFIRMED' || b.status === 'PENDING')
        );
        if (todayCheckIns.length > 0) {
            const names = todayCheckIns.slice(0, 3).map(b => {
                const guest = guests.find(g => g.id === b.guestId);
                const room = rooms.find(r => r.id === b.roomId);
                return `**${guest ? formatLastNameFirst(guest.fullName) : 'Huésped'}** (Hab ${room?.roomNumber || '?'})`;
            });
            const extra = todayCheckIns.length > 3 ? ` y ${todayCheckIns.length - 3} más` : '';
            result.push({
                icon: LogIn,
                text: `**${todayCheckIns.length} check-in${todayCheckIns.length > 1 ? 's' : ''} hoy**: ${names.join(', ')}${extra}`,
                color: 'text-emerald-600',
                priority: 1,
            });
        }

        // 2. Today's check-outs
        const todayCheckOuts = bookings.filter(b =>
            isToday(new Date(b.checkOutDate)) && b.status === 'CHECKED_IN'
        );
        if (todayCheckOuts.length > 0) {
            const names = todayCheckOuts.slice(0, 3).map(b => {
                const guest = guests.find(g => g.id === b.guestId);
                return `**${guest ? formatLastNameFirst(guest.fullName) : 'Huésped'}**`;
            });
            result.push({
                icon: LogOut,
                text: `**${todayCheckOuts.length} check-out${todayCheckOuts.length > 1 ? 's' : ''} hoy**: ${names.join(', ')}`,
                color: 'text-amber-600',
                priority: 2,
            });
        }

        // 3. Dirty rooms bottleneck alert
        const dirtyRooms = rooms.filter(r => r.status === 'DIRTY').length;
        const tomorrowCheckIns = bookings.filter(b =>
            isTomorrow(new Date(b.checkInDate)) && (b.status === 'CONFIRMED' || b.status === 'PENDING')
        ).length;
        if (dirtyRooms > 0 && tomorrowCheckIns > 0 && dirtyRooms >= tomorrowCheckIns) {
            result.push({
                icon: AlertTriangle,
                text: `**Cuello de botella**: ${dirtyRooms} hab sucias y ${tomorrowCheckIns} check-in${tomorrowCheckIns > 1 ? 's' : ''} mañana — priorizar limpieza`,
                color: 'text-red-500',
                priority: 0,
            });
        } else if (dirtyRooms > 3) {
            result.push({
                icon: BedDouble,
                text: `**${dirtyRooms} habitaciones** pendientes de limpieza`,
                color: 'text-amber-500',
                priority: 5,
            });
        }

        // 4. Frequent guests arriving today or tomorrow
        const upcomingFrequent = bookings
            .filter(b => (isToday(new Date(b.checkInDate)) || isTomorrow(new Date(b.checkInDate))) && (b.status === 'CONFIRMED' || b.status === 'PENDING'))
            .map(b => {
                const guest = guests.find(g => g.id === b.guestId);
                if (!guest) return null;
                const guestBookings = bookings.filter(bb => bb.guestId === guest.id).length;
                if (guestBookings < 3) return null;
                const totalSpend = bookings.filter(bb => bb.guestId === guest.id).reduce((s, bb) => s + bb.totalAmount, 0);
                const room = rooms.find(r => r.id === b.roomId);
                const when = isToday(new Date(b.checkInDate)) ? 'hoy' : 'mañana';
                return { guest, guestBookings, totalSpend, room, when };
            })
            .filter(Boolean);

        for (const freq of upcomingFrequent) {
            if (!freq) continue;
            result.push({
                icon: Star,
                text: `**Frecuente**: **${formatLastNameFirst(freq.guest.fullName)}** llega ${freq.when} (${freq.guestBookings} visitas, $${(freq.totalSpend / 1000).toFixed(0)}k) → Hab ${freq.room?.roomNumber || '?'}`,
                color: 'text-indigo-500',
                priority: 1,
            });
        }

        // 5. Pending payments alert
        const pendingPayments = payments.filter(p => p.status === 'PENDING');
        const pendingTotal = pendingPayments.reduce((s, p) => s + p.amount, 0);
        if (pendingTotal > 0) {
            result.push({
                icon: CreditCard,
                text: `**$${pendingTotal.toLocaleString()}** en pagos pendientes (${pendingPayments.length} cobros)`,
                color: 'text-orange-500',
                priority: 4,
            });
        }

        // 6. Occupancy summary
        const occupied = rooms.filter(r => r.status === 'OCCUPIED').length;
        const available = rooms.filter(r => r.status === 'AVAILABLE').length;
        const total = rooms.length;
        const rate = total > 0 ? ((occupied / total) * 100).toFixed(0) : '0';
        result.push({
            icon: Users,
            text: `Ocupación **${rate}%** — ${occupied} ocupadas, ${available} disponibles de ${total}`,
            color: 'text-blue-600',
            priority: 6,
        });

        // 7. Tomorrow check-ins preview
        if (tomorrowCheckIns > 0 && !result.some(r => r.text.includes('mañana'))) {
            result.push({
                icon: LogIn,
                text: `**${tomorrowCheckIns} llegada${tomorrowCheckIns > 1 ? 's' : ''}** programada${tomorrowCheckIns > 1 ? 's' : ''} para mañana`,
                color: 'text-blue-500',
                priority: 7,
            });
        }

        return result.sort((a, b) => a.priority - b.priority).slice(0, 5);
    }, [bookings, rooms, guests, payments]);

    if (items.length === 0) return null;

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
                </div>

                <div className="space-y-2">
                    {items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-sm">
                            <item.icon className={cn("w-4 h-4 mt-0.5 shrink-0", item.color)} />
                            <span className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                <InlineMarkdown text={item.text} />
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

/** Minimal inline bold renderer */
function InlineMarkdown({ text }: { text: string }) {
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return (
        <>
            {parts.map((part, i) =>
                i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
            )}
        </>
    );
}
