import { useHotel } from '@/context/HotelContext';
import { PageHeader, KPICard } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OccupancyChart, RevenueRadarChart } from '@/components/statistics';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, DollarSign, BedDouble, Users, Calendar, Activity } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Statistics() {
  const { getDashboardStats, getOccupancyByType, bookings, payments } = useHotel();

  const stats = getDashboardStats();
  const occupancyByType = getOccupancyByType();

  // Revenue by day (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));
  const revenueByDay = last7Days.map(date => {
    const dayPayments = payments.filter(p => {
      const pDate = new Date(p.date);
      return pDate.toDateString() === date.toDateString() && p.status === 'PAID';
    });
    return {
      date: format(date, 'EEE', { locale: es }),
      revenue: dayPayments.reduce((sum, p) => sum + p.amount, 0),
    };
  });

  // Occupancy data formatting
  const occupancyPieData = occupancyByType.map(type => ({
    name: type.roomTypeName,
    value: type.rate,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Estadísticas Avanzadas"
        description="Business Intelligence del Hotel"
        actions={
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-medium">
            <Activity className="w-3 h-3" />
            Live Data
          </div>
        }
      />

      {/* KPI Cockpit */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-in slide-in-from-bottom-3 duration-500">
        <KPICard
          title="Ocupación"
          value={`${stats.occupancyRate.toFixed(0)}%`}
          icon={<BedDouble className="w-5 h-5 text-indigo-500" />}
          trend={{ value: 5, label: 'vs semana anterior', isPositive: true }}
        />
        <KPICard
          title="Ingresos (Mes)"
          value={`$${stats.monthlyRevenue.toLocaleString('es-AR')}`}
          icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
          trend={{ value: 12, label: 'vs mes anterior', isPositive: true }}
        />
        <KPICard
          title="Total Reservas"
          value={bookings.length}
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
              <CardTitle className="text-lg">Ingresos Últimos 7 Días</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByDay} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ fill: 'transparent' }}
                      formatter={(value: number) => [`$${value.toLocaleString('es-AR')}`, 'Ingresos']}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.5)',
                        borderRadius: '12px',
                        fontWeight: 'bold',
                        color: '#0f172a'
                      }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="#3b82f6"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          <RevenueRadarChart />
        </div>
      </div>

      {/* Secondary Visual Row */}
      <div className="grid gap-6 lg:grid-cols-3 animate-in slide-in-from-bottom-5 duration-700 delay-200">
        <div className="lg:col-span-1">
          <OccupancyChart data={occupancyPieData} />
        </div>
        {/* You can add more detailed tables or text specific insights here in the future */}
        <Card className="lg:col-span-2 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border-dashed border-indigo-200 dark:border-indigo-800 flex items-center justify-center min-h-[250px]">
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-indigo-900 dark:text-indigo-100">IA Insights (Próximamente)</h3>
            <p className="text-sm text-indigo-600/70 dark:text-indigo-300/70 mt-2 max-w-sm mx-auto">
              Nuestro motor de análisis predictivo te sugerirá cambios de tarifas basados en las tendencias de ocupación detectadas.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
