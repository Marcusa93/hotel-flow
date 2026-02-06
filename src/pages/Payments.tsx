import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Plus, Eye } from 'lucide-react';
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
import { PaymentStatus, PaymentMethod } from '@/types/hotel';

const methodLabels: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

export default function Payments() {
  const { payments, bookings, guests, rooms } = useHotel();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'ALL'>('ALL');

  const filteredPayments = useMemo(() => {
    return payments
      .filter(payment => {
        const booking = bookings.find(b => b.id === payment.bookingId);
        const guest = booking ? guests.find(g => g.id === booking.guestId) : null;
        const searchLower = search.toLowerCase();
        
        const matchesSearch = 
          guest?.fullName.toLowerCase().includes(searchLower) ||
          payment.reference?.toLowerCase().includes(searchLower) ||
          payment.id.toLowerCase().includes(searchLower);
        
        const matchesStatus = statusFilter === 'ALL' || payment.status === statusFilter;
        const matchesMethod = methodFilter === 'ALL' || payment.method === methodFilter;
        
        return matchesSearch && matchesStatus && matchesMethod;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, bookings, guests, search, statusFilter, methodFilter]);

  const getBookingInfo = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return { guest: null, room: null };
    const guest = guests.find(g => g.id === booking.guestId);
    const room = rooms.find(r => r.id === booking.roomId);
    return { guest, room, booking };
  };

  const totalPaid = payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagos"
        description={`$${totalPaid.toLocaleString('es-AR')} cobrados • $${totalPending.toLocaleString('es-AR')} pendientes`}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por huésped o referencia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PaymentStatus | 'ALL')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="PAID">Pagado</SelectItem>
            <SelectItem value="PENDING">Pendiente</SelectItem>
            <SelectItem value="FAILED">Fallido</SelectItem>
            <SelectItem value="REFUNDED">Reembolsado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={(v) => setMethodFilter(v as PaymentMethod | 'ALL')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Método" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="CASH">Efectivo</SelectItem>
            <SelectItem value="CARD">Tarjeta</SelectItem>
            <SelectItem value="TRANSFER">Transferencia</SelectItem>
            <SelectItem value="OTHER">Otro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredPayments.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No se encontraron pagos"
          description="Intenta ajustar los filtros de búsqueda"
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Huésped</TableHead>
                <TableHead>Habitación</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment) => {
                const { guest, room, booking } = getBookingInfo(payment.bookingId);
                return (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {format(new Date(payment.date), 'dd MMM yyyy', { locale: es })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {guest?.fullName || '-'}
                    </TableCell>
                    <TableCell>{room?.roomNumber || '-'}</TableCell>
                    <TableCell>{methodLabels[payment.method]}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {payment.reference || '-'}
                    </TableCell>
                    <TableCell className="font-medium">
                      ${payment.amount.toLocaleString('es-AR')}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={payment.status} />
                    </TableCell>
                    <TableCell>
                      {booking && (
                        <Link to={`/bookings/${booking.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
