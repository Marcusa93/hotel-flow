import { useMemo } from 'react';
import { TrendingDown, Ticket, Receipt, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Rate, Booking, Payment } from '@/types/hotel';
import { buildPromoUsage, summarizePromoUsage } from '@/lib/promoStats';
import { cn } from '@/lib/utils';

interface PromoPerformanceProps {
    rates: Rate[];
    bookings: Booking[];
    payments: Payment[];
}

const money = (value: number) => `$${Math.round(value).toLocaleString('es-AR')}`;

export function PromoPerformance({ rates, bookings, payments }: PromoPerformanceProps) {
    const usage = useMemo(
        () => buildPromoUsage(rates, bookings, payments),
        [rates, bookings, payments]
    );
    const summary = useMemo(() => summarizePromoUsage(usage), [usage]);

    // Reservas anteriores a que se registrara el descuento: se ven como uso pero
    // no suman plata. Decirlo evita leer el reporte como si estuviera completo.
    const untracked = useMemo(
        () => bookings.filter(b => (b.rateId || b.promoLabel) && b.discountAmount == null).length,
        [bookings]
    );

    const cards = [
        { label: 'Promos usadas', value: String(summary.activePromos), icon: Ticket, tone: 'text-purple-500' },
        { label: 'Veces aplicadas', value: String(summary.totalUses), icon: Receipt, tone: 'text-indigo-500' },
        { label: 'Descuento otorgado', value: money(summary.totalDiscount), icon: TrendingDown, tone: 'text-amber-500' },
        { label: 'Facturación con promo', value: money(summary.totalRevenue), icon: Receipt, tone: 'text-emerald-500' },
    ];

    return (
        <Card className="glass border-none shadow-lg">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-amber-500" />
                    Rendimiento de Promociones
                </CardTitle>
                <CardDescription>
                    Cuántas veces se usó cada promoción y cuánto descuento representó
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {cards.map(({ label, value, icon: Icon, tone }) => (
                        <div
                            key={label}
                            className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Icon className={cn('w-4 h-4', tone)} />
                                <span className="text-xs text-muted-foreground">{label}</span>
                            </div>
                            <p className="num-display text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                        </div>
                    ))}
                </div>

                {untracked > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-xs text-muted-foreground">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>
                            {untracked} reserva{untracked > 1 ? 's' : ''} con promoción {untracked > 1 ? 'son' : 'es'} anterior
                            {untracked > 1 ? 'es' : ''} al seguimiento: se cuenta el uso, pero el descuento no quedó registrado
                            y no suma a los totales.
                        </p>
                    </div>
                )}

                {usage.length === 0 ? (
                    <div className="text-center py-10">
                        <Ticket className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground text-sm">Todavía no hay promociones para medir</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto -mx-6 px-6">
                        <Table className="min-w-[720px]">
                            <TableHeader>
                                <TableRow className="border-slate-200 dark:border-slate-800">
                                    <TableHead>Promoción</TableHead>
                                    <TableHead className="text-right">Reservas</TableHead>
                                    <TableHead className="text-right">Cobros</TableHead>
                                    <TableHead className="text-right">Facturación</TableHead>
                                    <TableHead className="text-right">Ticket promedio</TableHead>
                                    <TableHead className="text-right">Descuento otorgado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {usage.map(promo => (
                                    <TableRow
                                        key={promo.rateId ?? `label:${promo.label}`}
                                        className={cn(
                                            'border-slate-200 dark:border-slate-800',
                                            promo.useCount === 0 && 'opacity-50'
                                        )}
                                    >
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div>
                                                    <p className="font-semibold">{promo.label}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        {promo.promoCode && (
                                                            <span className="font-mono text-[11px] text-muted-foreground">
                                                                {promo.promoCode}
                                                            </span>
                                                        )}
                                                        {promo.isOrphan && (
                                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                                eliminada
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">{promo.bookingCount}</TableCell>
                                        <TableCell className="text-right tabular-nums">{promo.paymentCount}</TableCell>
                                        <TableCell className="text-right tabular-nums font-medium">
                                            {promo.bookingRevenue > 0 ? money(promo.bookingRevenue) : '—'}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-muted-foreground">
                                            {promo.avgBookingValue > 0 ? money(promo.avgBookingValue) : '—'}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {promo.totalDiscount > 0 ? (
                                                <span className="font-medium text-amber-600 dark:text-amber-400">
                                                    -{money(promo.totalDiscount)}
                                                </span>
                                            ) : (
                                                '—'
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
