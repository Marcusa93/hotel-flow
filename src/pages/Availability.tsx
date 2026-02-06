import { useState, useMemo } from 'react';
import { useHotel } from '@/context/HotelContext';
import { PageHeader, AvailabilityTimeline, AvailabilityFilters } from '@/components/shared';
import { KPICardModern } from '@/components/shared/KPICardModern';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BedDouble, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';

export default function Availability() {
  const { getDashboardStats, getOccupancyByType, rooms, bookings, roomTypes } = useHotel();

  const stats = getDashboardStats();
  const occupancyByType = getOccupancyByType();

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

      {/* KPI Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KPICardModern
          title="Ocupación Total"
          value={`${stats.occupancyRate.toFixed(0)}%`}
          subtitle={`${stats.occupiedRooms} / ${stats.totalRooms} habitaciones`}
          icon={<BedDouble className="w-5 h-5" />}
          trend={{ value: 2, label: 'vs ayer', isPositive: true }}
          delay={0.1}
          chartData={[{ value: 40 }, { value: 30 }, { value: 45 }, { value: 60 }, { value: 55 }, { value: stats.occupancyRate }]}
        />
        <KPICardModern
          title="Disponibles"
          value={stats.availableRooms}
          subtitle="Listas para venta"
          icon={<CheckCircle2 className="w-5 h-5 text-status-available" />}
          delay={0.2}
          chartData={[{ value: 10 }, { value: 12 }, { value: 8 }, { value: 15 }, { value: 10 }, { value: stats.availableRooms }]}
        />
        <KPICardModern
          title="Mantenimiento"
          value={stats.maintenanceRooms}
          subtitle="Fuera de servicio"
          icon={<AlertTriangle className="w-5 h-5 text-destructive" />}
          delay={0.3}
          chartData={[{ value: 1 }, { value: 2 }, { value: 1 }, { value: 3 }, { value: 2 }, { value: stats.maintenanceRooms }]}
        />
        <KPICardModern
          title="Check-ins Hoy"
          value={stats.checkInsToday}
          subtitle="Llegadas esperadas"
          icon={<Calendar className="w-5 h-5" />}
          delay={0.4}
        />
      </div>

      {/* Modern Timeline View */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Card className="glass border-none shadow-lg overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Cronograma de Reservas</CardTitle>
                <CardDescription>Visualización de ocupación en tiempo real</CardDescription>
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
              <AvailabilityTimeline rooms={filteredRooms} bookings={bookings} roomTypes={roomTypes} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Room Types Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Card className="glass border-none shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Detalle por Categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {occupancyByType.map((type, index) => (
                <div key={type.roomTypeId} className="space-y-3 p-4 rounded-xl bg-background/40 border border-white/5 hover:bg-white/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{type.roomTypeName}</span>
                    <span className="text-xs text-muted-foreground">
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
