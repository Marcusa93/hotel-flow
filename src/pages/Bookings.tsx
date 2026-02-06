import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, Eye } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BookingStatus } from '@/types/hotel';
import { NewBookingDialog } from '@/components/bookings/NewBookingDialog';

export default function Bookings() {
  const { bookings, guests, rooms, roomTypes } = useHotel();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'ALL'>('ALL');
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);

  const filteredBookings = useMemo(() => {
    return bookings
      .filter(booking => {
        const guest = guests.find(g => g.id === booking.guestId);
        const room = rooms.find(r => r.id === booking.roomId);
        const searchLower = search.toLowerCase();
        
        const matchesSearch = 
          guest?.fullName.toLowerCase().includes(searchLower) ||
          room?.roomNumber.includes(searchLower) ||
          booking.id.toLowerCase().includes(searchLower);
        
        const matchesStatus = statusFilter === 'ALL' || booking.status === statusFilter;
        
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [bookings, guests, rooms, search, statusFilter]);

  const getGuestName = (guestId: string) => 
    guests.find(g => g.id === guestId)?.fullName || 'Huésped desconocido';
  
  const getRoomInfo = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    const roomType = roomTypes.find(rt => rt.id === room?.roomTypeId);
    return room ? `${room.roomNumber} - ${roomType?.name || ''}` : '';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservas"
        description="Gestiona todas las reservas del hotel"
        actions={
          <Button onClick={() => setIsNewDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Reserva
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por huésped, habitación o ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as BookingStatus | 'ALL')}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="PENDING">Pendiente</SelectItem>
            <SelectItem value="CONFIRMED">Confirmada</SelectItem>
            <SelectItem value="CHECKED_IN">Check-in</SelectItem>
            <SelectItem value="CHECKED_OUT">Check-out</SelectItem>
            <SelectItem value="CANCELLED">Cancelada</SelectItem>
            <SelectItem value="NO_SHOW">No Show</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filteredBookings.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No se encontraron reservas"
          description={search || statusFilter !== 'ALL' 
            ? "Intenta ajustar los filtros de búsqueda" 
            : "Aún no hay reservas registradas"}
          action={{
            label: 'Nueva Reserva',
            onClick: () => setIsNewDialogOpen(true),
          }}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Huésped</TableHead>
                <TableHead>Habitación</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead>Huéspedes</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {booking.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {getGuestName(booking.guestId)}
                  </TableCell>
                  <TableCell>{getRoomInfo(booking.roomId)}</TableCell>
                  <TableCell>
                    {format(new Date(booking.checkInDate), 'dd MMM yyyy', { locale: es })}
                  </TableCell>
                  <TableCell>
                    {format(new Date(booking.checkOutDate), 'dd MMM yyyy', { locale: es })}
                  </TableCell>
                  <TableCell>
                    {booking.adults}A {booking.children > 0 && `+ ${booking.children}N`}
                  </TableCell>
                  <TableCell className="font-medium">
                    ${booking.totalAmount.toLocaleString('es-AR')}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={booking.status} />
                  </TableCell>
                  <TableCell>
                    <Link to={`/bookings/${booking.id}`}>
                      <Button variant="ghost" size="icon">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <NewBookingDialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen} />
    </div>
  );
}
