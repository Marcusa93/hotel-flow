import { useState, useMemo } from 'react';
import { Search, Filter } from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { PageHeader, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PaymentStatus, PaymentMethod } from '@/types/hotel';
import { PaymentStats, TransactionTable, PaymentRevenueChart, PaymentMethodChart } from '@/components/payments';

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
    if (!booking) return { guest: undefined, room: undefined };
    const guest = guests.find(g => g.id === booking.guestId);
    const room = rooms.find(r => r.id === booking.roomId);
    return { guest, room };
  };

  const totalPaid = payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);
  const totalFailed = payments.filter(p => p.status === 'FAILED').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzas"
        description="Centro de Control de Ingresos y Pagos"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm">Exportar Reporte</Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">Nuevo Cobro</Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <PaymentStats
        totalPaid={totalPaid}
        totalPending={totalPending}
        totalFailed={totalFailed}
      />

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-3 rounded-2xl border border-white/20 shadow-sm mt-8">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por huésped, referencia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 border-transparent bg-white/50 focus:bg-white transition-all shadow-sm"
          />
        </div>
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block" />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PaymentStatus | 'ALL')}>
          <SelectTrigger className="w-[150px] border-transparent bg-transparent hover:bg-white/50 rounded-xl">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="PAID">Pagado</SelectItem>
            <SelectItem value="PENDING">Pendiente</SelectItem>
            <SelectItem value="FAILED">Fallido</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={(v) => setMethodFilter(v as PaymentMethod | 'ALL')}>
          <SelectTrigger className="w-[150px] border-transparent bg-transparent hover:bg-white/50 rounded-xl">
            <SelectValue placeholder="Método" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los métodos</SelectItem>
            <SelectItem value="CASH">Efectivo</SelectItem>
            <SelectItem value="CARD">Tarjeta</SelectItem>
            <SelectItem value="TRANSFER">Transferencia</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transactions List */}
      {filteredPayments.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No se encontraron pagos"
          description="Intenta ajustar los filtros de búsqueda"
        />
      ) : (
        <TransactionTable
          payments={filteredPayments}
          getBookingInfo={getBookingInfo}
        />
      )}
    </div>
  );
}
