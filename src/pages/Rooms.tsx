import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, BedDouble, Users, Eye } from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { PageHeader, StatusBadge, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RoomStatus } from '@/types/hotel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Rooms() {
  const { rooms, roomTypes, guests, bookings, getRoomWithDetails } = useHotel();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RoomStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const filteredRooms = useMemo(() => {
    return rooms
      .filter(room => {
        const matchesSearch = room.roomNumber.includes(search);
        const matchesStatus = statusFilter === 'ALL' || room.status === statusFilter;
        const matchesType = typeFilter === 'ALL' || room.roomTypeId === typeFilter;
        
        return matchesSearch && matchesStatus && matchesType;
      })
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
  }, [rooms, search, statusFilter, typeFilter]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkInsToday = rooms.filter(room => {
    const booking = bookings.find(b => 
      b.roomId === room.id && 
      (b.status === 'CONFIRMED' || b.status === 'PENDING') &&
      new Date(b.checkInDate).setHours(0,0,0,0) === today.getTime()
    );
    return !!booking;
  });

  const checkOutsToday = rooms.filter(room => {
    const booking = bookings.find(b => 
      b.roomId === room.id && 
      b.status === 'CHECKED_IN' &&
      new Date(b.checkOutDate).setHours(0,0,0,0) === today.getTime()
    );
    return !!booking;
  });

  const getRoomTypeInfo = (roomTypeId: string) => 
    roomTypes.find(rt => rt.id === roomTypeId);

  const getCurrentGuest = (roomId: string) => {
    const booking = bookings.find(b => 
      b.roomId === roomId && 
      b.status === 'CHECKED_IN'
    );
    if (booking) {
      return guests.find(g => g.id === booking.guestId);
    }
    return null;
  };

  const getCurrentBooking = (roomId: string) => {
    return bookings.find(b => 
      b.roomId === roomId && 
      b.status === 'CHECKED_IN'
    );
  };

  const getUpcomingBooking = (roomId: string) => {
    return bookings.find(b => 
      b.roomId === roomId && 
      (b.status === 'CONFIRMED' || b.status === 'PENDING') &&
      new Date(b.checkInDate).setHours(0,0,0,0) === today.getTime()
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Habitaciones"
        description={`${rooms.length} habitaciones en total`}
      />

      {/* Quick filters */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">Todas ({rooms.length})</TabsTrigger>
          <TabsTrigger value="occupied">Ocupadas ({rooms.filter(r => r.status === 'OCCUPIED').length})</TabsTrigger>
          <TabsTrigger value="available">Disponibles ({rooms.filter(r => r.status === 'AVAILABLE').length})</TabsTrigger>
          <TabsTrigger value="checkin">Check-in hoy ({checkInsToday.length})</TabsTrigger>
          <TabsTrigger value="checkout">Check-out hoy ({checkOutsToday.length})</TabsTrigger>
        </TabsList>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RoomStatus | 'ALL')}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estados</SelectItem>
              <SelectItem value="AVAILABLE">Disponible</SelectItem>
              <SelectItem value="OCCUPIED">Ocupada</SelectItem>
              <SelectItem value="DIRTY">Sucia</SelectItem>
              <SelectItem value="MAINTENANCE">Mantenimiento</SelectItem>
              <SelectItem value="OUT_OF_ORDER">Fuera de servicio</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <BedDouble className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los tipos</SelectItem>
              {roomTypes.map(type => (
                <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="all" className="mt-6">
          <RoomsGrid rooms={filteredRooms} getRoomTypeInfo={getRoomTypeInfo} getCurrentGuest={getCurrentGuest} getCurrentBooking={getCurrentBooking} getUpcomingBooking={getUpcomingBooking} />
        </TabsContent>
        <TabsContent value="occupied" className="mt-6">
          <RoomsGrid rooms={filteredRooms.filter(r => r.status === 'OCCUPIED')} getRoomTypeInfo={getRoomTypeInfo} getCurrentGuest={getCurrentGuest} getCurrentBooking={getCurrentBooking} getUpcomingBooking={getUpcomingBooking} />
        </TabsContent>
        <TabsContent value="available" className="mt-6">
          <RoomsGrid rooms={filteredRooms.filter(r => r.status === 'AVAILABLE')} getRoomTypeInfo={getRoomTypeInfo} getCurrentGuest={getCurrentGuest} getCurrentBooking={getCurrentBooking} getUpcomingBooking={getUpcomingBooking} />
        </TabsContent>
        <TabsContent value="checkin" className="mt-6">
          <RoomsGrid rooms={checkInsToday} getRoomTypeInfo={getRoomTypeInfo} getCurrentGuest={getCurrentGuest} getCurrentBooking={getCurrentBooking} getUpcomingBooking={getUpcomingBooking} showUpcoming />
        </TabsContent>
        <TabsContent value="checkout" className="mt-6">
          <RoomsGrid rooms={checkOutsToday} getRoomTypeInfo={getRoomTypeInfo} getCurrentGuest={getCurrentGuest} getCurrentBooking={getCurrentBooking} getUpcomingBooking={getUpcomingBooking} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface RoomsGridProps {
  rooms: any[];
  getRoomTypeInfo: (id: string) => any;
  getCurrentGuest: (id: string) => any;
  getCurrentBooking: (id: string) => any;
  getUpcomingBooking: (id: string) => any;
  showUpcoming?: boolean;
}

function RoomsGrid({ rooms, getRoomTypeInfo, getCurrentGuest, getCurrentBooking, getUpcomingBooking, showUpcoming }: RoomsGridProps) {
  if (rooms.length === 0) {
    return (
      <EmptyState
        icon={BedDouble}
        title="No hay habitaciones"
        description="No se encontraron habitaciones con los filtros seleccionados"
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rooms.map((room) => {
        const roomType = getRoomTypeInfo(room.roomTypeId);
        const guest = getCurrentGuest(room.id);
        const booking = showUpcoming ? getUpcomingBooking(room.id) : getCurrentBooking(room.id);

        return (
          <Card key={room.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Hab. {room.roomNumber}</CardTitle>
                <StatusBadge status={room.status} />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{roomType?.name}</Badge>
                <span className="text-xs text-muted-foreground">Piso {room.floor}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>Máx. {roomType?.maxGuests} huéspedes</span>
              </div>
              
              {guest && booking && (
                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-sm font-medium">{guest.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {booking.adults}A {booking.children > 0 && `+ ${booking.children}N`}
                  </p>
                </div>
              )}

              {showUpcoming && booking && !guest && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
                  <p className="text-sm font-medium text-primary">Check-in pendiente</p>
                </div>
              )}

              {room.notes && (
                <p className="text-xs text-muted-foreground italic">{room.notes}</p>
              )}

              {booking && (
                <Link to={`/bookings/${booking.id}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    <Eye className="w-4 h-4 mr-2" />
                    Ver reserva
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
