import { useMemo, useState } from 'react';
import { format, isToday, isYesterday, startOfDay, subDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown, LogIn, LogOut, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn, formatLastNameFirst, formatLocalDate } from '@/lib/utils';
import type { Booking, Guest, Room } from '@/types/hotel';

/** Días hacia atrás que cubre el registro, contando hoy. */
const WINDOW_DAYS = 7;

interface WeeklyMovementsLogProps {
    bookings: Booking[];
    guests: Guest[];
    rooms: Room[];
    onSelect: (bookingId: string) => void;
}

type MovementKind = 'IN' | 'OUT';
/** done = pasó · pending = todavía puede pasar hoy · missed = quedó sin hacer */
type MovementState = 'done' | 'pending' | 'missed';

interface Movement {
    key: string;
    bookingId: string;
    kind: MovementKind;
    date: Date;
    guestName: string;
    roomNumber: string;
    amount: number;
    state: MovementState;
}

/**
 * Qué entró y qué salió en los últimos 7 días.
 *
 * Se arma con las reservas (fecha prevista + estado) y no con audit_logs: esos
 * solo los puede leer admin/auditor, así que recepción vería el panel vacío.
 */
export function WeeklyMovementsLog({ bookings, guests, rooms, onSelect }: WeeklyMovementsLogProps) {
    const [open, setOpen] = useState(false);

    const guestName = useMemo(() => {
        const map = new Map(guests.map((g) => [g.id, g.fullName]));
        return (id: string) => {
            const name = map.get(id);
            return name ? formatLastNameFirst(name) : 'Huésped';
        };
    }, [guests]);

    const roomNumber = useMemo(() => {
        const map = new Map(rooms.map((r) => [r.id, r.roomNumber]));
        return (id: string) => map.get(id) || '—';
    }, [rooms]);

    const { days, arrivals, departures } = useMemo(() => {
        const today = startOfDay(new Date());
        const from = subDays(today, WINDOW_DAYS - 1);
        const inWindow = (d: Date) => d >= from && d <= today;

        const result: Movement[] = [];

        for (const b of bookings) {
            if (b.status === 'CANCELLED' || b.status === 'NO_SHOW') continue;

            const checkIn = startOfDay(new Date(b.checkInDate));
            const checkOut = startOfDay(new Date(b.checkOutDate));
            const base = {
                bookingId: b.id,
                guestName: guestName(b.guestId),
                roomNumber: roomNumber(b.roomId),
                amount: b.totalAmount,
            };

            if (inWindow(checkIn)) {
                const arrived = b.status === 'CHECKED_IN' || b.status === 'CHECKED_OUT';
                result.push({
                    ...base,
                    key: `${b.id}-in`,
                    kind: 'IN',
                    date: checkIn,
                    state: arrived ? 'done' : isToday(checkIn) ? 'pending' : 'missed',
                });
            }

            if (inWindow(checkOut)) {
                const left = b.status === 'CHECKED_OUT';
                result.push({
                    ...base,
                    key: `${b.id}-out`,
                    kind: 'OUT',
                    date: checkOut,
                    state: left ? 'done' : isToday(checkOut) ? 'pending' : 'missed',
                });
            }
        }

        // Agrupado por día, del más reciente al más viejo. Dentro del día las
        // salidas van primero: es el orden real de la mañana en el hotel.
        const byDay = new Map<string, { date: Date; movements: Movement[] }>();
        for (const m of result) {
            const key = formatLocalDate(m.date);
            if (!byDay.has(key)) byDay.set(key, { date: m.date, movements: [] });
            byDay.get(key)!.movements.push(m);
        }

        const grouped = Array.from(byDay.values())
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .map((group) => ({
                ...group,
                movements: group.movements.sort((a, b) =>
                    a.kind === b.kind ? a.roomNumber.localeCompare(b.roomNumber) : a.kind === 'OUT' ? -1 : 1
                ),
            }));

        return {
            days: grouped,
            arrivals: result.filter((m) => m.kind === 'IN' && m.state === 'done').length,
            departures: result.filter((m) => m.kind === 'OUT' && m.state === 'done').length,
        };
    }, [bookings, guestName, roomNumber]);

    return (
        // La página de Reservas tiene alto fijo: si el historial abriera "en el flujo"
        // le comería todo el alto al tablero. Por eso se despliega flotando encima.
        <Collapsible open={open} onOpenChange={setOpen} className="relative">
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                <CollapsibleTrigger asChild>
                    <button
                        type="button"
                        className="w-full flex items-center justify-between gap-3 p-3 pl-4 text-left hover:bg-muted/40 transition-colors"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <ChevronDown
                                className={cn('w-4 h-4 shrink-0 transition-transform', !open && '-rotate-90')}
                            />
                            <History className="w-4 h-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                                <p className="font-semibold text-sm">Historial de la semana</p>
                                <p className="text-xs text-muted-foreground truncate">
                                    Últimos {WINDOW_DAYS} días · {arrivals} llegada{arrivals === 1 ? '' : 's'} y{' '}
                                    {departures} salida{departures === 1 ? '' : 's'}
                                </p>
                            </div>
                        </div>

                        {/* En mobile los totales ya están en el subtítulo, así que el título
                            se queda con todo el ancho. */}
                        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className="gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900">
                                <LogIn className="w-3 h-3" />
                                {arrivals}
                            </Badge>
                            <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-500 border-amber-200 dark:border-amber-900">
                                <LogOut className="w-3 h-3" />
                                {departures}
                            </Badge>
                        </div>
                    </button>
                </CollapsibleTrigger>
            </div>

            <CollapsibleContent className="absolute bottom-full left-0 right-0 mb-2 z-20 rounded-2xl border bg-card shadow-2xl overflow-hidden">
                    <div className="max-h-[min(24rem,45vh)] overflow-y-auto">
                        {days.length === 0 && (
                            <p className="text-sm text-muted-foreground p-4">
                                No hubo movimientos en los últimos {WINDOW_DAYS} días.
                            </p>
                        )}

                        {days.map((group) => (
                            <div key={formatLocalDate(group.date)}>
                                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-muted/70 backdrop-blur px-4 py-1.5">
                                    <span className="text-xs font-semibold capitalize">{dayLabel(group.date)}</span>
                                    <span className="text-[11px] text-muted-foreground">
                                        {group.movements.filter((m) => m.kind === 'IN').length} in ·{' '}
                                        {group.movements.filter((m) => m.kind === 'OUT').length} out
                                    </span>
                                </div>

                                {group.movements.map((m) => (
                                    <button
                                        key={m.key}
                                        type="button"
                                        onClick={() => onSelect(m.bookingId)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 text-sm text-left hover:bg-muted/40 transition-colors"
                                    >
                                        {m.kind === 'IN' ? (
                                            <LogIn className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                        ) : (
                                            <LogOut className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-500" />
                                        )}

                                        <span className="font-semibold tabular-nums w-9 sm:w-16 shrink-0">
                                            <span className="hidden sm:inline">Hab. </span>
                                            {m.roomNumber}
                                        </span>

                                        <span className="truncate flex-1 min-w-0">{m.guestName}</span>

                                        <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                                            ${m.amount.toLocaleString('es-AR')}
                                        </span>

                                        <Badge
                                            variant="outline"
                                            className={cn('text-[10px] shrink-0 w-[68px] sm:w-24 px-1 justify-center', STATE_STYLES[m.state])}
                                        >
                                            {stateLabel(m.kind, m.state)}
                                        </Badge>
                                    </button>
                                ))}
                            </div>
                        ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

const STATE_STYLES: Record<MovementState, string> = {
    done: 'text-slate-600 dark:text-slate-300',
    pending: 'text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900',
    missed: 'text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900',
};

function stateLabel(kind: MovementKind, state: MovementState): string {
    if (state === 'done') return kind === 'IN' ? 'Ingresó' : 'Salió';
    if (state === 'pending') return kind === 'IN' ? 'Llega hoy' : 'Sale hoy';
    return kind === 'IN' ? 'No llegó' : 'Sin salida';
}

function dayLabel(date: Date): string {
    if (isToday(date)) return 'Hoy';
    if (isYesterday(date)) return 'Ayer';
    const days = differenceInDays(startOfDay(new Date()), date);
    return days < 7
        ? format(date, 'EEEE d', { locale: es })
        : format(date, "d 'de' MMMM", { locale: es });
}
