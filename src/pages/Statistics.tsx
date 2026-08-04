import { useState, useMemo, useCallback } from 'react';
import { useDashboardStats } from '@/hooks/domain/useDashboardStats';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { usePaymentOperations } from '@/hooks/domain/usePaymentOperations';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import { useOtherIncome } from '@/hooks/useOtherIncome';
import { useCurrentAccountPayments } from '@/hooks/useCurrentAccount';
import { receivedPayments, totalIncome } from '@/lib/income';
import { PAYMENT_METHODS } from '@/lib/constants';
import { PageHeader, KPICard } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OccupancyChart, RevenueRadarChart, SummaryInsights, DateRangeSelector } from '@/components/statistics';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { chartColors, chartGrid, chartAxis, chartTooltip } from '@/lib/chartTheme';
import { formatCompactMoney } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, BedDouble, Users, Calendar, Activity, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { format, subDays, startOfMonth, eachDayOfInterval, isWithinInterval, startOfDay, endOfDay, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Statistics() {
  const { stats, occupancyByType } = useDashboardStats();
  const { bookings } = useBookingOperations();
  const { payments } = usePaymentOperations();
  // Las otras dos fuentes de plata del período: ver income.ts.
  const { data: otherIncome = [] } = useOtherIncome();
  const { data: accountPayments = [] } = useCurrentAccountPayments();
  const { data: hotelSettings } = useHotelSettings();
  const { toast } = useToast();

  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: new Date(),
  });

  // Memoizados sobre dateRange: sin esto son objetos Date nuevos en cada
  // render, y todos los cálculos de abajo se rehacían siempre aunque el rango
  // no hubiera cambiado.
  const rangeStart = useMemo(() => startOfDay(dateRange.from), [dateRange.from]);
  const rangeEnd = useMemo(() => endOfDay(dateRange.to), [dateRange.to]);
  const inRange = useCallback(
    (d: Date) => isWithinInterval(d, { start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd]
  );

  // Cobros que son plata, dentro del rango. Sin lo anotado a cuenta corriente:
  // eso es deuda del huésped, no un ingreso. Ver income.ts.
  const paidInRange = useMemo(
    () => receivedPayments(payments).filter(p => inRange(new Date(p.date))),
    [payments, inRange]
  );

  // Los ingresos del período: las tres fuentes, igual que el cierre de caja y
  // el balance del mes. Mirando solo los cobros de reservas, este KPI quedaba
  // más bajo que el cierre y nadie sabía cuál de los dos creer.
  const periodRevenue = useMemo(
    () => totalIncome({
      payments: paidInRange,
      otherIncome: otherIncome.filter(o => inRange(o.date)),
      accountPayments: accountPayments.filter(p => inRange(p.date)),
    }),
    [paidInRange, otherIncome, accountPayments, inRange]
  );

  // Bookings whose check-in falls inside the range
  const bookingsInRange = useMemo(
    () => bookings.filter(b => inRange(new Date(b.checkInDate))),
    [bookings, inRange]
  );

  // Revenue by day across the selected range (capped to 62 days so the axis stays readable)
  const revenueByDay = useMemo(() => {
    const spanDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1;
    const days = spanDays > 0 && spanDays <= 62
      ? eachDayOfInterval({ start: rangeStart, end: rangeEnd })
      : Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));
    return days.map(date => ({
      date: format(date, spanDays > 14 ? 'dd/MM' : 'EEE', { locale: es }),
      revenue: paidInRange
        .filter(p => new Date(p.date).toDateString() === date.toDateString())
        .reduce((sum, p) => sum + p.amount, 0),
    }));
  }, [paidInRange, rangeStart, rangeEnd]);

  // Real revenue by payment method for the radar chart
  const revenueByMethod = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const p of paidInRange) {
      totals[p.method] = (totals[p.method] || 0) + p.amount;
    }
    // La lista sale de constants y no de una copia local. La que había acá se
    // había quedado en 'CARD': crédito, débito y QR no aparecían en el gráfico
    // —plata cobrada que no se veía en ninguna parte— y "Tarjeta" daba siempre
    // cero, porque esos cobros se habían migrado a 'CREDIT' hace rato.
    return PAYMENT_METHODS.map(({ value, label }) => ({
      subject: label,
      A: totals[value] || 0,
    }));
  }, [paidInRange]);

  // Occupancy data formatting
  const occupancyPieData = occupancyByType.map(type => ({
    name: type.roomTypeName,
    value: type.rate,
  }));

  const hotelName = hotelSettings?.hotelName || 'Hotel';

  const handleExportExcel = async () => {
    try {
      const { exportToExcel } = await import('@/lib/exportUtils');
      exportToExcel({ bookings, payments, stats, occupancyByType, dateRange, hotelName });
      toast({ title: 'Exportado', description: 'Archivo Excel descargado correctamente' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo exportar a Excel', variant: 'destructive' });
    }
  };

  const handleExportPDF = async () => {
    try {
      const { exportToPDF } = await import('@/lib/exportUtils');
      exportToPDF({ stats, occupancyByType, revenueByDay, dateRange, hotelName });
      toast({ title: 'Reporte generado', description: 'Ventana de impresión abierta' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo generar el reporte', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold">Estadísticas del Hotel</h3>
        <div className="flex items-center gap-2">
          <DateRangeSelector dateRange={dateRange} onDateRangeChange={setDateRange} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Formato</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
                Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileText className="w-4 h-4 mr-2 text-blue-600" />
                PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPI Cockpit */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-in slide-in-from-bottom-3 duration-500">
        <KPICard
          title="Ocupación actual"
          value={`${stats.occupancyRate.toFixed(0)}%`}
          icon={<BedDouble className="w-5 h-5 text-indigo-500" />}
        />
        <KPICard
          title="Ingresos (período)"
          value={`$${periodRevenue.toLocaleString('es-AR')}`}
          icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
        />
        <KPICard
          title="Reservas (período)"
          value={bookingsInRange.length}
          icon={<Calendar className="w-5 h-5 text-blue-500" />}
        />
        <KPICard
          title="Huéspedes Activos"
          value={bookings.filter(b => b.status === 'CHECKED_IN').length}
          icon={<Users className="w-5 h-5 text-amber-500" />}
        />
      </div>

      {/* Primary Visual Row */}
      <div className="grid gap-6 lg:grid-cols-3 animate-in slide-in-from-bottom-5 duration-700 delay-100">
        <div className="lg:col-span-2">
          <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm h-full">
            <CardHeader>
              <CardTitle className="text-lg">Ingresos por Día (período)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByDay} barSize={40}>
                    <CartesianGrid strokeDasharray={chartGrid.strokeDasharray} vertical={false} stroke={chartGrid.stroke} opacity={0.5} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={chartAxis.tick}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => formatCompactMoney(value)}
                      tick={chartAxis.tick}
                    />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      formatter={(value: number) => [`$${value.toLocaleString('es-AR')}`, 'Ingresos']}
                      contentStyle={chartTooltip.contentStyle}
                    />
                    <Bar
                      dataKey="revenue"
                      fill={chartColors.blue}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          <RevenueRadarChart data={revenueByMethod} />
        </div>
      </div>

      {/* Secondary Visual Row */}
      <div className="grid gap-6 lg:grid-cols-3 animate-in slide-in-from-bottom-5 duration-700 delay-200">
        <div className="lg:col-span-1">
          <OccupancyChart data={occupancyPieData} />
        </div>
        <SummaryInsights bookings={bookings} payments={payments} />
      </div>
    </div>
  );
}
