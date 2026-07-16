import { useState, useMemo, lazy, Suspense, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, Download } from 'lucide-react';
import { usePaymentOperations } from '@/hooks/domain/usePaymentOperations';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useAppRole } from '@/context/AppRoleContext';
import { PageHeader, EmptyState, TableSkeleton } from '@/components/shared';
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
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/constants';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

const BillingContent = lazy(() => import('./Billing'));

export default function Payments() {
  const { currentRole } = useAppRole();
  const canWrite = currentRole === 'admin' || currentRole === 'reception';
  const { payments, updatePayment, isLoading: isLoadingPayments } = usePaymentOperations();
  const { bookings } = useBookingOperations();
  const { guests } = useGuestOperations();
  const { rooms } = useRoomOperations();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'ALL'>('ALL');

  // Accept ?status=PENDING|PAID|FAILED|REFUNDED from deep links (Dashboard alerts).
  useEffect(() => {
    const statusParam = searchParams.get('status');
    const validStatuses: PaymentStatus[] = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];
    if (statusParam && (validStatuses as string[]).includes(statusParam)) {
      setStatusFilter(statusParam as PaymentStatus);
      const next = new URLSearchParams(searchParams);
      next.delete('status');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);
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
    if (!canWrite) {
      toast({ title: 'Acción no permitida', description: 'Tu rol no puede modificar pagos', variant: 'destructive' });
      return;
    }
    updatePayment(paymentId, { status: newStatus });
  };

  const handleViewReceipt = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsReceiptOpen(true);
  };

  const handleExportCSV = () => {
    if (filteredPayments.length === 0) return;
    const headers = ['Fecha', 'Huésped', 'Método', 'Monto', 'Estado', 'Referencia'];
    const rows = filteredPayments.map(p => {
      const info = getBookingInfo(p.bookingId);
      return [
        format(new Date(p.date), 'dd/MM/yyyy'),
        info.guest?.fullName || 'N/A',
        PAYMENT_METHOD_LABELS[p.method] || p.method,
        p.amount.toString(),
        PAYMENT_STATUS_LABELS[p.status] || p.status,
        p.reference || '',
      ];
    });
    // RFC 4180: double embedded quotes; prefix ' to neutralize spreadsheet formula injection
    const csvCell = (c: string) => {
      const safe = /^[=+\-@]/.test(c) ? `'${c}` : c;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const csvContent = [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagos_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exportado', description: `${filteredPayments.length} pagos exportados a CSV` });
  };

  const totalPaid = payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
  const now = new Date();
  const totalPaidMonth = payments
    .filter(p => p.status === 'PAID')
    .filter(p => {
      const d = new Date(p.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0);
  const totalFailed = payments.filter(p => p.status === 'FAILED').length;
  const settledCount = payments.filter(p => p.status === 'PAID' || p.status === 'FAILED').length;
  const successRate = settledCount > 0
    ? (payments.filter(p => p.status === 'PAID').length / settledCount) * 100
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzas"
        description="Pagos, cobros y facturación"
        actions={
          <div className="flex items-center gap-2">
            {filteredPayments.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            )}
            {canWrite && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setIsNewPaymentOpen(true)}
              >
                Nuevo Cobro
              </Button>
            )}
          </div>
        }
      />

      <NewPaymentDialog open={isNewPaymentOpen} onOpenChange={setIsNewPaymentOpen} />

      <Tabs defaultValue="payments" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="payments">Pagos</TabsTrigger>
          <TabsTrigger value="invoices">Facturas</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-6">
          <PaymentStats
            totalPaid={totalPaid}
            totalPaidMonth={totalPaidMonth}
            totalPending={totalPending}
            totalFailed={totalFailed}
            successRate={successRate}
          />

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
              <SelectTrigger className="w-full md:w-[150px] border-transparent bg-transparent hover:bg-white/50 rounded-xl">
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
              <SelectTrigger className="w-full md:w-[150px] border-transparent bg-transparent hover:bg-white/50 rounded-xl">
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

          {isLoadingPayments && payments.length === 0 ? (
            <TableSkeleton rows={6} columns={7} />
          ) : filteredPayments.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No se encontraron pagos"
              description={search || statusFilter !== 'ALL' || methodFilter !== 'ALL'
                ? "Probá limpiar los filtros o ajustar la búsqueda"
                : "Cuando registres un pago va a aparecer acá"}
              action={
                search || statusFilter !== 'ALL' || methodFilter !== 'ALL'
                  ? { label: 'Limpiar filtros', onClick: () => { setSearch(''); setStatusFilter('ALL'); setMethodFilter('ALL'); } }
                  : canWrite
                    ? { label: 'Nuevo cobro', onClick: () => setIsNewPaymentOpen(true) }
                    : undefined
              }
            />
          ) : (
            <TransactionTable
              payments={filteredPayments}
              getBookingInfo={getBookingInfo}
              onStatusChange={canWrite ? handlePaymentStatusChange : undefined}
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
