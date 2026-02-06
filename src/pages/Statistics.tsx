import { useHotel } from '@/context/HotelContext';
import { PageHeader, KPICard } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { TrendingUp, DollarSign, BedDouble, Users, Calendar } from 'lucide-react';
import { format, subDays, startOfMonth, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

const COLORS = ['hsl(217, 91%, 50%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(271, 81%, 56%)'];

export default function Statistics() {
  const { getDashboardStats, getOccupancyByType, bookings, payments, rooms, roomTypes } = useHotel();
  
  const stats = getDashboardStats();
  const occupancyByType = getOccupancyByType();

  // Booking status distribution
  const statusCounts = bookings.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusData = [
    { name: 'Check-in', value: statusCounts['CHECKED_IN'] || 0 },
    { name: 'Confirmadas', value: statusCounts['CONFIRMED'] || 0 },
    { name: 'Pendientes', value: statusCounts['PENDING'] || 0 },
    { name: 'Check-out', value: statusCounts['CHECKED_OUT'] || 0 },
  ];

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

  // Occupancy by room type for pie chart
  const occupancyPieData = occupancyByType.map(type => ({
    name: type.roomTypeName,
    value: type.occupied,
  }));

  // Revenue by payment method
  const methodCounts = payments.reduce((acc, p) => {
    if (p.status === 'PAID') {
      acc[p.method] = (acc[p.method] || 0) + p.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const methodData = [
    { name: 'Efectivo', value: methodCounts['CASH'] || 0 },
    { name: 'Tarjeta', value: methodCounts['CARD'] || 0 },
    { name: 'Transferencia', value: methodCounts['TRANSFER'] || 0 },
    { name: 'Otro', value: methodCounts['OTHER'] || 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estadísticas"
        description="Métricas y análisis del hotel"
      />

      {/* KPI Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Ocupación Promedio"
          value={`${stats.occupancyRate.toFixed(0)}%`}
          icon={<BedDouble className="w-5 h-5 text-primary" />}
          trend={{ value: 5, label: 'vs semana anterior', isPositive: true }}
        />
        <KPICard
          title="Ingresos del Mes"
          value={`$${stats.monthlyRevenue.toLocaleString('es-AR')}`}
          icon={<DollarSign className="w-5 h-5 text-status-available" />}
          trend={{ value: 12, label: 'vs mes anterior', isPositive: true }}
        />
        <KPICard
          title="Total Reservas"
          value={bookings.length}
          icon={<Calendar className="w-5 h-5 text-primary" />}
        />
        <KPICard
          title="Huéspedes Activos"
          value={bookings.filter(b => b.status === 'CHECKED_IN').length}
          icon={<Users className="w-5 h-5 text-accent" />}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ingresos Últimos 7 Días</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis 
                    className="text-xs"
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toLocaleString('es-AR')}`, 'Ingresos']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="revenue" fill="hsl(217, 91%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Booking status distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estado de Reservas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Occupancy by type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ocupación por Tipo de Habitación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={occupancyByType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis dataKey="roomTypeName" type="category" width={100} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(0)}%`, 'Ocupación']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="rate" fill="hsl(142, 76%, 36%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue by payment method */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ingresos por Método de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={methodData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => value > 0 ? `${name}` : ''}
                  >
                    {methodData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toLocaleString('es-AR')}`, '']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
