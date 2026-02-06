import { 
  BedDouble, 
  CalendarCheck, 
  CalendarX, 
  DollarSign, 
  AlertTriangle,
  Users,
  TrendingUp,
  Clock
} from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { PageHeader, KPICard, StatusBadge } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { 
    getDashboardStats, 
    getOccupancyByType, 
    bookings, 
    rooms, 
    guests, 
    roomTypes 
  } = useHotel();
  
  const stats = getDashboardStats();
  const occupancyByType = getOccupancyByType();
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Upcoming check-ins
  const upcomingCheckIns = bookings
    .filter(b => {
      const checkIn = new Date(b.checkInDate);
      checkIn.setHours(0, 0, 0, 0);
      return checkIn.getTime() === today.getTime() && (b.status === 'CONFIRMED' || b.status === 'PENDING');
    })
    .slice(0, 5);
  
  // Upcoming check-outs
  const upcomingCheckOuts = bookings
    .filter(b => {
      const checkOut = new Date(b.checkOutDate);
      checkOut.setHours(0, 0, 0, 0);
      return checkOut.getTime() === today.getTime() && b.status === 'CHECKED_IN';
    })
    .slice(0, 5);
  
  // Alerts
  const dirtyRooms = rooms.filter(r => r.status === 'DIRTY');
  const maintenanceRooms = rooms.filter(r => r.status === 'MAINTENANCE' || r.status === 'OUT_OF_ORDER');

  const getGuestName = (guestId: string) => {
    return guests.find(g => g.id === guestId)?.fullName || 'Huésped';
  };

  const getRoomNumber = (roomId: string) => {
    return rooms.find(r => r.id === roomId)?.roomNumber || '';
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Dashboard" 
        description={`${format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}`}
        actions={
          <Link to="/bookings/new">
            <Button>Nueva Reserva</Button>
          </Link>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Ocupación Actual"
          value={`${stats.occupancyRate.toFixed(0)}%`}
          subtitle={`${stats.occupiedRooms} de ${stats.totalRooms} habitaciones`}
          icon={<BedDouble className="w-5 h-5 text-primary" />}
          variant="primary"
        />
        <KPICard
          title="Check-ins Hoy"
          value={stats.checkInsToday}
          subtitle="Llegadas programadas"
          icon={<CalendarCheck className="w-5 h-5 text-status-available" />}
          variant="success"
        />
        <KPICard
          title="Check-outs Hoy"
          value={stats.checkOutsToday}
          subtitle="Salidas programadas"
          icon={<CalendarX className="w-5 h-5 text-accent" />}
          variant="warning"
        />
        <KPICard
          title="Ingresos del Mes"
          value={`$${stats.monthlyRevenue.toLocaleString('es-AR')}`}
          subtitle="Pagos cobrados"
          icon={<DollarSign className="w-5 h-5 text-status-available" />}
          trend={{ value: 12, label: 'vs mes anterior', isPositive: true }}
        />
      </div>

      {/* Second row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Reservas Próximas"
          value={stats.upcomingBookings7Days}
          subtitle="En los próximos 7 días"
          icon={<Clock className="w-5 h-5 text-primary" />}
        />
        <KPICard
          title="Pagos Pendientes"
          value={`$${stats.pendingPayments.toLocaleString('es-AR')}`}
          subtitle="Por cobrar"
          icon={<DollarSign className="w-5 h-5 text-accent" />}
          variant={stats.pendingPayments > 0 ? 'warning' : 'default'}
        />
        <KPICard
          title="Habitaciones Disponibles"
          value={stats.availableRooms}
          subtitle="Listas para ocupar"
          icon={<BedDouble className="w-5 h-5 text-status-available" />}
          variant="success"
        />
        <KPICard
          title="Total Huéspedes"
          value={guests.length}
          subtitle="Registrados en sistema"
          icon={<Users className="w-5 h-5 text-primary" />}
        />
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Occupancy by type */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Ocupación por Tipo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {occupancyByType.map(type => (
              <div key={type.roomTypeId} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{type.roomTypeName}</span>
                  <span className="text-muted-foreground">
                    {type.occupied}/{type.total} ({type.rate.toFixed(0)}%)
                  </span>
                </div>
                <Progress value={type.rate} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Today's activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Actividad de Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Check-ins */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-status-available" />
                  Check-ins pendientes
                </h4>
                {upcomingCheckIns.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No hay check-ins hoy</p>
                ) : (
                  <div className="space-y-2">
                    {upcomingCheckIns.map(booking => (
                      <Link 
                        key={booking.id} 
                        to={`/bookings/${booking.id}`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium">{getGuestName(booking.guestId)}</p>
                          <p className="text-xs text-muted-foreground">Hab. {getRoomNumber(booking.roomId)}</p>
                        </div>
                        <StatusBadge status={booking.status} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Check-outs */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <CalendarX className="w-4 h-4 text-accent" />
                  Check-outs pendientes
                </h4>
                {upcomingCheckOuts.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No hay check-outs hoy</p>
                ) : (
                  <div className="space-y-2">
                    {upcomingCheckOuts.map(booking => (
                      <Link 
                        key={booking.id} 
                        to={`/bookings/${booking.id}`}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium">{getGuestName(booking.guestId)}</p>
                          <p className="text-xs text-muted-foreground">Hab. {getRoomNumber(booking.roomId)}</p>
                        </div>
                        <StatusBadge status={booking.status} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {(dirtyRooms.length > 0 || maintenanceRooms.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-accent" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dirtyRooms.length > 0 && (
              <div className="alert-card alert-card-warning">
                <AlertTriangle className="w-5 h-5 text-accent shrink-0" />
                <div>
                  <p className="font-medium">
                    {dirtyRooms.length} habitación{dirtyRooms.length > 1 ? 'es' : ''} requiere{dirtyRooms.length > 1 ? 'n' : ''} limpieza
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Habitaciones: {dirtyRooms.map(r => r.roomNumber).join(', ')}
                  </p>
                </div>
                <Link to="/housekeeping" className="ml-auto">
                  <Button variant="outline" size="sm">Ver limpieza</Button>
                </Link>
              </div>
            )}
            {maintenanceRooms.length > 0 && (
              <div className="alert-card alert-card-error">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                <div>
                  <p className="font-medium">
                    {maintenanceRooms.length} habitación{maintenanceRooms.length > 1 ? 'es' : ''} fuera de servicio
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Habitaciones: {maintenanceRooms.map(r => r.roomNumber).join(', ')}
                  </p>
                </div>
                <Link to="/rooms" className="ml-auto">
                  <Button variant="outline" size="sm">Ver habitaciones</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
