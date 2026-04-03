import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { Booking, Room, Payment, Guest } from '@/types/hotel';
import { isToday, isTomorrow, subDays, isAfter, isBefore, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { cn, formatLastNameFirst } from '@/lib/utils';

interface AIInsightsProps {
    bookings: Booking[];
    rooms: Room[];
    payments: Payment[];
    guests: Guest[];
    monthlyRevenue: number;
    occupancyRate: number;
}

interface Insight {
    icon: typeof Brain;
    title: string;
    detail: string;
    color: string;
    type: 'alert' | 'opportunity' | 'tip';
}

export function AIInsights({ bookings, rooms, payments, guests, monthlyRevenue, occupancyRate }: AIInsightsProps) {
    const [expanded, setExpanded] = useState(false);

    const insights = useMemo(() => {
        const result: Insight[] = [];
        const now = new Date();

        // 1. PREDICTIVE: Checkout bottleneck tomorrow
        const tomorrowCheckouts = bookings.filter(b =>
            isTomorrow(new Date(b.checkOutDate)) && b.status === 'CHECKED_IN'
        ).length;
        const tomorrowCheckins = bookings.filter(b =>
            isTomorrow(new Date(b.checkInDate)) && (b.status === 'CONFIRMED' || b.status === 'PENDING')
        ).length;
        const cleanRooms = rooms.filter(r => r.status === 'AVAILABLE').length;

        if (tomorrowCheckouts > 0 && tomorrowCheckins > cleanRooms) {
            result.push({
                icon: AlertTriangle,
                title: 'Cuello de botella mañana',
                detail: `${tomorrowCheckins} llegadas pero solo ${cleanRooms} hab limpias. Necesitás ${tomorrowCheckins - cleanRooms} limpieza${tomorrowCheckins - cleanRooms > 1 ? 's' : ''} urgente${tomorrowCheckins - cleanRooms > 1 ? 's' : ''}.`,
                color: 'text-red-500 bg-red-50 dark:bg-red-950/30',
                type: 'alert',
            });
        }

        // 2. PREDICTIVE: Overdue checkouts
        const overdueCheckouts = bookings.filter(b => {
            if (b.status !== 'CHECKED_IN') return false;
            const checkout = new Date(b.checkOutDate);
            return isBefore(checkout, now) || (isToday(checkout) && now.getHours() >= 12);
        });
        if (overdueCheckouts.length > 0) {
            const names = overdueCheckouts.slice(0, 2).map(b => {
                const guest = guests.find(g => g.id === b.guestId);
                return guest ? formatLastNameFirst(guest.fullName).split(',')[0] : '?';
            }).join(', ');
            result.push({
                icon: AlertTriangle,
                title: `${overdueCheckouts.length} checkout${overdueCheckouts.length > 1 ? 's' : ''} vencido${overdueCheckouts.length > 1 ? 's' : ''}`,
                detail: `${names} debería${overdueCheckouts.length > 1 ? 'n' : ''} haber salido. Contactar para confirmar extensión o check-out.`,
                color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
                type: 'alert',
            });
        }

        // 3. REVENUE: Compare this month vs last month
        const thisMonthStart = startOfMonth(now);
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        const lastMonthEnd = endOfMonth(subMonths(now, 1));

        const lastMonthRevenue = payments
            .filter(p => p.status === 'PAID' && isAfter(new Date(p.date), lastMonthStart) && isBefore(new Date(p.date), lastMonthEnd))
            .reduce((s, p) => s + p.amount, 0);

        if (lastMonthRevenue > 0) {
            const diff = monthlyRevenue - lastMonthRevenue;
            const pct = ((diff / lastMonthRevenue) * 100).toFixed(0);
            const isUp = diff >= 0;
            result.push({
                icon: isUp ? TrendingUp : TrendingDown,
                title: `Revenue ${isUp ? 'subió' : 'bajó'} ${Math.abs(Number(pct))}% vs mes anterior`,
                detail: isUp
                    ? `Este mes: $${(monthlyRevenue / 1000).toFixed(0)}k vs $${(lastMonthRevenue / 1000).toFixed(0)}k el anterior.`
                    : `Este mes: $${(monthlyRevenue / 1000).toFixed(0)}k vs $${(lastMonthRevenue / 1000).toFixed(0)}k. Considerá activar una promoción de fin de semana.`,
                color: isUp ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'text-red-500 bg-red-50 dark:bg-red-950/30',
                type: 'opportunity',
            });
        }

        // 4. OPPORTUNITY: Low occupancy suggestion
        if (occupancyRate < 40) {
            const inactiveVIPs = guests.filter(g => {
                const lastBooking = bookings
                    .filter(b => b.guestId === g.id)
                    .sort((a, b) => new Date(b.checkOutDate).getTime() - new Date(a.checkOutDate).getTime())[0];
                if (!lastBooking) return false;
                const guestBookings = bookings.filter(b => b.guestId === g.id).length;
                return guestBookings >= 3 && isBefore(new Date(lastBooking.checkOutDate), subDays(now, 30));
            }).length;

            result.push({
                icon: Lightbulb,
                title: `Ocupación baja (${occupancyRate.toFixed(0)}%)`,
                detail: inactiveVIPs > 0
                    ? `${inactiveVIPs} huésped${inactiveVIPs > 1 ? 'es' : ''} frecuente${inactiveVIPs > 1 ? 's' : ''} sin visitar hace +30 días. Oportunidad de contacto directo.`
                    : 'Considerá activar una promoción o descuento para llenar habitaciones.',
                color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
                type: 'opportunity',
            });
        }

        // 5. TIP: Pending payments aging
        const oldPending = payments.filter(p => {
            if (p.status !== 'PENDING') return false;
            return isBefore(new Date(p.date), subDays(now, 3));
        });
        if (oldPending.length > 0) {
            const total = oldPending.reduce((s, p) => s + p.amount, 0);
            result.push({
                icon: Zap,
                title: `$${total.toLocaleString()} en cobros vencidos`,
                detail: `${oldPending.length} pago${oldPending.length > 1 ? 's' : ''} pendiente${oldPending.length > 1 ? 's' : ''} de más de 3 días. Priorizá el seguimiento.`,
                color: 'text-orange-500 bg-orange-50 dark:bg-orange-950/30',
                type: 'tip',
            });
        }

        return result.slice(0, 4);
    }, [bookings, rooms, payments, guests, monthlyRevenue, occupancyRate]);

    if (insights.length === 0) return null;

    const visibleInsights = expanded ? insights : insights.slice(0, 2);

    return (
        <Card className="border-none shadow-lg bg-gradient-to-br from-violet-50/80 via-white to-rose-50/80 dark:from-violet-950/30 dark:via-slate-900/60 dark:to-rose-950/30 backdrop-blur">
            <CardContent className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/40">
                            <Brain className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <h3 className="text-sm font-bold text-violet-900 dark:text-violet-100">Insights Inteligentes</h3>
                    </div>
                    {insights.length > 2 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => setExpanded(!expanded)}
                        >
                            {expanded ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
                            {expanded ? 'Menos' : `+${insights.length - 2} más`}
                        </Button>
                    )}
                </div>

                <div className="space-y-2.5">
                    {visibleInsights.map((insight, i) => (
                        <div key={i} className={cn("flex items-start gap-3 p-3 rounded-xl", insight.color.split(' ').slice(1).join(' '))}>
                            <insight.icon className={cn("w-4 h-4 mt-0.5 shrink-0", insight.color.split(' ')[0])} />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{insight.title}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{insight.detail}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
