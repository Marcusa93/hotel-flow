import { useHotel } from '@/context/HotelContext';
import { PageHeader, KPICard } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BedDouble, TrendingUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Availability() {
  const { getDashboardStats, getOccupancyByType, rooms, bookings } = useHotel();
  
  const stats = getDashboardStats();
  const occupancyByType = getOccupancyByType();

  // Calculate availability for next 7 days
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date;
  });

  const getAvailabilityForDate = (date: Date) => {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const occupiedCount = bookings.filter(booking => {
      const checkIn = new Date(booking.checkInDate);
      checkIn.setHours(0, 0, 0, 0);
      const checkOut = new Date(booking.checkOutDate);
      checkOut.setHours(0, 0, 0, 0);
      
      return (
        targetDate >= checkIn && 
        targetDate < checkOut && 
        (booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN' || booking.status === 'PENDING')
      );
    }).length;

    const availableCount = rooms.length - occupiedCount;
    const rate = (occupiedCount / rooms.length) * 100;
    
    return { occupiedCount, availableCount, rate };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Disponibilidad"
        description="Estado actual y proyección de ocupación"
      />

      {/* Main occupancy */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BedDouble className="w-5 h-5 text-primary" />
              Ocupación Actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6">
              <div className="text-6xl font-bold text-primary mb-2">
                {stats.occupancyRate.toFixed(0)}%
              </div>
              <p className="text-muted-foreground">
                {stats.occupiedRooms} de {stats.totalRooms} habitaciones ocupadas
              </p>
            </div>
            <Progress value={stats.occupancyRate} className="h-3 mb-4" />
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-status-available">{stats.availableRooms}</div>
                <p className="text-xs text-muted-foreground">Disponibles</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-status-dirty">{stats.dirtyRooms}</div>
                <p className="text-xs text-muted-foreground">Sucias</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Proyección 7 días
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {next7Days.map((date, i) => {
                const { rate, availableCount } = getAvailabilityForDate(date);
                const isToday = i === 0;
                
                return (
                  <div 
                    key={date.toISOString()} 
                    className={`p-3 rounded-lg text-center ${isToday ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}`}
                  >
                    <div className="text-xs text-muted-foreground mb-1">
                      {format(date, 'EEE', { locale: es })}
                    </div>
                    <div className="text-sm font-medium mb-2">
                      {format(date, 'd MMM', { locale: es })}
                    </div>
                    <div className={`text-xl font-bold ${rate > 80 ? 'text-destructive' : rate > 50 ? 'text-accent' : 'text-status-available'}`}>
                      {rate.toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {availableCount} libres
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* By room type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ocupación por Tipo de Habitación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {occupancyByType.map(type => (
              <div key={type.roomTypeId} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{type.roomTypeName}</span>
                  <span className="text-sm text-muted-foreground">
                    {type.occupied}/{type.total}
                  </span>
                </div>
                <Progress value={type.rate} className="h-2" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ocupación</span>
                  <span className={`font-medium ${type.rate > 80 ? 'text-destructive' : type.rate > 50 ? 'text-accent' : 'text-status-available'}`}>
                    {type.rate.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Room status breakdown */}
      <div className="grid gap-4 md:grid-cols-5">
        <KPICard
          title="Disponibles"
          value={stats.availableRooms}
          variant="success"
        />
        <KPICard
          title="Ocupadas"
          value={stats.occupiedRooms}
          variant="primary"
        />
        <KPICard
          title="Sucias"
          value={stats.dirtyRooms}
          variant="warning"
        />
        <KPICard
          title="Mantenimiento"
          value={stats.maintenanceRooms}
          variant="danger"
        />
        <KPICard
          title="Check-ins Hoy"
          value={stats.checkInsToday}
        />
      </div>
    </div>
  );
}
