import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Clock, CreditCard, BedDouble } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import type { Booking, Payment } from '@/types/hotel';

interface SummaryInsightsProps {
  bookings: Booking[];
  payments: Payment[];
}

export function SummaryInsights({ bookings, payments }: SummaryInsightsProps) {
  // Average stay duration
  const avgStay = useMemo(() => {
    const completed = bookings.filter(b => b.status === 'CHECKED_OUT' || b.status === 'CHECKED_IN');
    if (completed.length === 0) return 0;
    const totalDays = completed.reduce((sum, b) => {
      return sum + Math.max(1, differenceInDays(new Date(b.checkOutDate), new Date(b.checkInDate)));
    }, 0);
    return (totalDays / completed.length).toFixed(1);
  }, [bookings]);

  // Payment method breakdown
  const paymentBreakdown = useMemo(() => {
    const paid = payments.filter(p => p.status === 'PAID');
    const total = paid.reduce((sum, p) => sum + p.amount, 0);
    if (total === 0) return [];

    const byMethod: Record<string, number> = {};
    paid.forEach(p => {
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
    });

    const labels: Record<string, string> = {
      CARD: 'Tarjeta',
      CASH: 'Efectivo',
      TRANSFER: 'Transferencia',
      OTHER: 'Otro',
    };

    return Object.entries(byMethod)
      .map(([method, amount]) => ({
        method: labels[method] || method,
        amount,
        pct: ((amount / total) * 100).toFixed(0),
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [payments]);

  // Booking status breakdown
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach(b => {
      counts[b.status] = (counts[b.status] || 0) + 1;
    });

    const labels: Record<string, string> = {
      PENDING: 'Pendiente',
      CONFIRMED: 'Confirmada',
      CHECKED_IN: 'Check-In',
      CHECKED_OUT: 'Check-Out',
      CANCELLED: 'Cancelada',
      NO_SHOW: 'No Show',
    };

    return Object.entries(counts)
      .map(([status, count]) => ({ status: labels[status] || status, count }))
      .sort((a, b) => b.count - a.count);
  }, [bookings]);

  return (
    <Card className="lg:col-span-2 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-500" />
          Resumen Operativo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-3">
          {/* Average Stay */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="w-4 h-4" />
              Estadía Promedio
            </div>
            <div className="text-3xl font-bold text-foreground">
              {avgStay} <span className="text-base font-normal text-muted-foreground">noches</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Basado en {bookings.filter(b => b.status === 'CHECKED_OUT' || b.status === 'CHECKED_IN').length} reservas
            </p>
          </div>

          {/* Payment Methods */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CreditCard className="w-4 h-4" />
              Métodos de Pago
            </div>
            <div className="space-y-2">
              {paymentBreakdown.length > 0 ? paymentBreakdown.map(p => (
                <div key={p.method} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span>{p.method}</span>
                      <span className="font-medium">{p.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${p.pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">Sin datos de pagos</p>
              )}
            </div>
          </div>

          {/* Booking Status */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BedDouble className="w-4 h-4" />
              Estado de Reservas
            </div>
            <div className="space-y-1.5">
              {statusBreakdown.length > 0 ? statusBreakdown.map(s => (
                <div key={s.status} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{s.status}</span>
                  <span className="font-medium tabular-nums">{s.count}</span>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">Sin reservas</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
