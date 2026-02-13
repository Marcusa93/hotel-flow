import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStats } from '@/hooks/domain/useDashboardStats';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { PageHeader, AvailabilityTimeline, AvailabilityFilters } from '@/components/shared';
import { KPICard } from '@/components/shared/KPICard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BedDouble, Calendar, AlertTriangle, CheckCircle2, LogIn, LogOut, Users } from 'lucide-react';
import { format, isSameDay, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';

export default function Availability() {
  const navigate = useNavigate();
  const { stats, occupancyByType } = useDashboardStats();
  const { rooms, roomTypes } = useRoomOperations();
  const { bookings } = useBookingOperations();
  const { guests } = useGuestOperations();

  // Filter State
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedFloors, setSelectedFloors] = useState<number[]>([]);

  // Derived Data
  const uniqueFloors = useMemo(() => {
    return Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b);
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    return rooms.filter(room => {
      const typeMatch = selectedTypes.length === 0 || selectedTypes.includes(room.roomTypeId);
      const floorMatch = selectedFloors.length === 0 || selectedFloors.includes(room.floor);
      return typeMatch && floorMatch;
    });
  }, [rooms, selectedTypes, selectedFloors]);

  // Today's bookings
  const today = startOfDay(new Date());

  const checkInsToday = bookings.filter(b =>
    isSameDay(new Date(b.checkInDate), today) &&
    (b.status === 'CONFIRMED' || b.status === 'PENDING')
  );

  const checkOutsToday = bookings.filter(b =>
    isSameDay(new Date(b.checkOutDate), today) &&
    b.status === 'CHECKED_IN'
  );

  const currentGuests = bookings.filter(b => b.status === 'CHECKED_IN').length;

  // Navigation handlers
  const handleOccupancyClick = () => {
    navigate('/rooms?status=OCCUPIED');
  };

  const handleAvailableClick = () => {
    navigate('/rooms?status=AVAILABLE');
  };

  const handleMaintenanceClick = () => {
    navigate('/rooms?status=MAINTENANCE');
  };

  const handleCheckInsClick = () => {
    navigate('/calendar?view=today&filter=arriving');
  };

  const handleCheckOutsClick = () => {
    navigate('/calendar?view=today&filter=departing');
  };

  return (
    <div className="space-y-6 p-1">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <PageHeader
          title="Disponibilidad & Ocupación"
          description={`Vista general al ${format(new Date(), "d 'de' MMMM", { locale: es })}`}
        />
      </motion.div>

      {/* KPI Stats Grid - Now Clickable */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleOccupancyClick}
          className="cursor-pointer"
        >
          <KPICard
            title="Ocupación Total"
            value={`${stats.occupancyRate.toFixed(0)}%`}
            subtitle={`${stats.occupiedRooms} de ${stats.totalRooms} habitaciones`}
            icon={<BedDouble className="w-5 h-5" />}
            trend={{ value: 2, label: 'vs ayer', isPositive: true }}
            delay={0.1}
            chartData={[{ value: 40 }, { value: 30 }, { value: 45 }, { value: 60 }, { value: 55 }, { value: stats.occupancyRate }]}
          />
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAvailableClick}
          className="cursor-pointer"
        >
          <KPICard
            title="Disponibles"
            value={stats.availableRooms}
            subtitle="Listas para venta"
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            delay={0.2}
          />
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleMaintenanceClick}
          className="cursor-pointer"
        >
          <KPICard
            title="Mantenimiento"
            value={stats.maintenanceRooms}
            subtitle="Fuera de servicio"
            icon={<AlertTriangle className="w-5 h-5 text-rose-500" />}
            delay={0.3}
          />
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCheckInsClick}
          className="cursor-pointer"
        >
          <KPICard
            title="Check-ins Hoy"
            value={checkInsToday.length}
            subtitle="Llegadas esperadas"
            icon={<LogIn className="w-5 h-5 text-blue-500" />}
            delay={0.4}
          />
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCheckOutsClick}
          className="cursor-pointer"
        >
          <KPICard
            title="Check-outs Hoy"
            value={checkOutsToday.length}
            subtitle="Salidas programadas"
            icon={<LogOut className="w-5 h-5 text-amber-500" />}
            delay={0.5}
          />
        </motion.div>
      </div>

      {/* Current Guests Banner */}
      {currentGuests > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 rounded-2xl p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold text-indigo-900 dark:text-indigo-100">
                {currentGuests} huéspedes hospedados actualmente
              </p>
              <p className="text-sm text-indigo-600/70 dark:text-indigo-400/70">
                En {stats.occupiedRooms} habitaciones ocupadas
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/calendar?view=today')}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 underline underline-offset-2"
          >
            Ver en calendario →
          </button>
        </motion.div>
      )}

      {/* Modern Timeline View */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Card className="glass border-none shadow-lg overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle>Cronograma de Reservas</CardTitle>
                <CardDescription>Haz clic en una reserva para ver los detalles</CardDescription>
              </div>
              <AvailabilityFilters
                roomTypes={roomTypes}
                selectedTypeIds={selectedTypes}
                onTypeChange={setSelectedTypes}
                floors={uniqueFloors}
                selectedFloors={selectedFloors}
                onFloorChange={setSelectedFloors}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-6 pt-0">
              <AvailabilityTimeline
                rooms={filteredRooms}
                bookings={bookings}
                roomTypes={roomTypes}
                guests={guests}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Room Types Breakdown with Click */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Card className="glass border-none shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Detalle por Categoría</CardTitle>
            <CardDescription>Haz clic en una categoría para filtrar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {occupancyByType.map((type) => (
                <motion.div
                  key={type.roomTypeId}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (selectedTypes.includes(type.roomTypeId)) {
                      setSelectedTypes(prev => prev.filter(id => id !== type.roomTypeId));
                    } else {
                      setSelectedTypes([type.roomTypeId]);
                    }
                  }}
                  className={`space-y-3 p-4 rounded-xl border cursor-pointer transition-all ${selectedTypes.includes(type.roomTypeId)
                      ? 'bg-primary/10 border-primary/30 ring-2 ring-primary/20'
                      : 'bg-background/40 border-white/5 hover:bg-white/10'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{type.roomTypeName}</span>
                    <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                      {type.occupied}/{type.total}
                    </span>
                  </div>
                  <Progress value={type.rate} className="h-2" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground text-xs">Ocupación</span>
                    <span className={`font-bold ${type.rate > 80 ? 'text-rose-500' : type.rate > 50 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {type.rate.toFixed(0)}%
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
