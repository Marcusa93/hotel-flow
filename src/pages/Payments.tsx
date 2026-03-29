import { useState, useMemo, lazy, Suspense } from 'react';
import { Search, Filter } from 'lucide-react';
import { usePaymentOperations } from '@/hooks/domain/usePaymentOperations';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useAppRole } from '@/context/AppRoleContext';
import { PageHeader, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Payment, PaymentStatus, PaymentMethod } from '@/types/hotel';
import { PaymentStats, TransactionTable, NewPaymentDialog, PaymentReceipt } from '@/components/payments';

const BillingContent = lazy(() => import('./Billing'));

export default function Payments() {
  const { currentRole } = useAppRole();
  const canWrite = currentRole === 'admin' || currentRole === 'reception';
  const { payments, updatePayment } = usePaymentOperations();
  const { bookings } = useBookingOperations();
  const { guests } = useGuestOperations();
  const { rooms } = useRoomOperations();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'ALL'>('ALL');
  const [isNewPaymentOpen, setIsNewPaymentOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

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
    return {
      guest,
      room,
      checkIn: booking.checkInDate ? String(booking.checkInDate) : undefined,
      checkOut: booking.checkOutDate ? String(booking.checkOutDate) : undefined,
    };
  };

  const handlePaymentStatusChange = (paymentId: string, newStatus: PaymentStatus) => {
    updatePayment(paymentId, { status: newStatus });
  };

  const handleViewReceipt = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsReceiptOpen(true);
  };

  const totalPaid = payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);
  const totalFailed = payments.filter(p => p.status === 'FAILED').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzas"
        description="Pagos, cobros y facturación"
        actions={canWrite ? (
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setIsNewPaymentOpen(true)}
          >
            Nuevo Cobro
          </Button>
        ) : undefined}
      />

      <NewPaymentDialog open={isNewPaymentOpen} onOpenChange={setIsNewPaymentOpen} />

      <Tabs defaultValue="payments" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="payments">Pagos</TabsTrigger>
          <TabsTrigger value="invoices">Facturas</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-6">
          <PaymentStats totalPaid={totalPaid} totalPending={totalPending} totalFailed={totalFailed} />

          <div className="flex flex-col gap-4 md:flex-row md:items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-3 rounded-2xl border border-white/20 shadow-sm">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por huésped, referencia..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 border-transparent bg-white/50 focus:bg-white transition-all shadow-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PaymentStatus | 'ALL')}>
              <SelectTrigger className="w-[150px] border-transparent bg-transparent hover:bg-white/50 rounded-xl">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
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
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="CASH">Efectivo</SelectItem>
                <SelectItem value="CARD">Tarjeta</SelectItem>
                <SelectItem value="TRANSFER">Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredPayments.length === 0 ? (
            <EmptyState icon={Search} title="No se encontraron pagos" description="Ajusta los filtros de búsqueda" />
          ) : (
            <TransactionTable
              payments={filteredPayments}
              getBookingInfo={getBookingInfo}
              onStatusChange={handlePaymentStatusChange}
              onViewReceipt={handleViewReceipt}
            />
          )}
        </TabsContent>

        <TabsContent value="invoices">
          <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Cargando facturas...</div>}>
            <BillingContent />
          </Suspense>
        </TabsContent>
      </Tabs>

      <PaymentReceipt open={isReceiptOpen} onOpenChange={setIsReceiptOpen} payment={selectedPayment} />
    </div>
  );
}
