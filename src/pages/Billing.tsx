import { useState, useMemo } from 'react';
import { Search, Plus, FileText } from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { useInvoices } from '@/hooks/useInvoices';
import { useUpdateInvoice } from '@/hooks/useUpdateInvoice';
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
import {
  InvoiceGallery,
  InvoiceDialog,
  InvoicePreview,
  InvoiceStats,
} from '@/components/billing';
import { Invoice, InvoiceStatus } from '@/types/hotel';
import { toast } from '@/hooks/use-toast';

export default function Billing() {
  const { bookings, guests, rooms, roomTypes } = useHotel();
  const { data: invoices = [], isLoading } = useInvoices();
  const updateInvoiceMutation = useUpdateInvoice();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices
      .filter(invoice => {
        const guest = guests.find(g => g.id === invoice.guestId);
        const searchLower = search.toLowerCase();

        const matchesSearch =
          invoice.invoiceNumber.toLowerCase().includes(searchLower) ||
          guest?.fullName.toLowerCase().includes(searchLower);

        const matchesStatus = statusFilter === 'ALL' || invoice.status === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  }, [invoices, guests, search, statusFilter]);

  // Get invoice related info
  const getInvoiceInfo = (invoice: Invoice) => {
    const booking = bookings.find(b => b.id === invoice.bookingId);
    const guest = guests.find(g => g.id === invoice.guestId);
    const room = booking ? rooms.find(r => r.id === booking.roomId) : undefined;
    const roomType = room ? roomTypes.find(rt => rt.id === room.roomTypeId) : undefined;
    return { guest, room, booking, roomType };
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsPreviewOpen(true);
  };

  const handleStatusChange = async (invoiceId: string, newStatus: InvoiceStatus) => {
    try {
      await updateInvoiceMutation.mutateAsync({
        id: invoiceId,
        data: { status: newStatus },
      });
      toast({
        title: '✅ Estado actualizado',
        description: `Factura marcada como ${newStatus.toLowerCase()}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado',
        variant: 'destructive',
      });
    }
  };

  const selectedInfo = selectedInvoice ? getInvoiceInfo(selectedInvoice) : {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturación"
        description="Gestión de Facturas y Comprobantes Fiscales"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Exportar
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => setIsNewInvoiceOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Nueva Factura
            </Button>
          </div>
        }
      />

      {/* Invoice Dialog */}
      <InvoiceDialog
        open={isNewInvoiceOpen}
        onOpenChange={setIsNewInvoiceOpen}
      />

      {/* Invoice Preview */}
      <InvoicePreview
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        invoice={selectedInvoice}
        guest={selectedInfo.guest}
        booking={selectedInfo.booking}
        room={selectedInfo.room}
        roomType={selectedInfo.roomType}
      />

      {/* Stats */}
      <InvoiceStats invoices={invoices} />

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-3 rounded-2xl border border-white/20 shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, huésped..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 border-transparent bg-white/50 focus:bg-white transition-all shadow-sm"
          />
        </div>
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block" />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as InvoiceStatus | 'ALL')}>
          <SelectTrigger className="w-[150px] border-transparent bg-transparent hover:bg-white/50 rounded-xl">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="DRAFT">Borrador</SelectItem>
            <SelectItem value="ISSUED">Emitida</SelectItem>
            <SelectItem value="PAID">Pagada</SelectItem>
            <SelectItem value="OVERDUE">Vencida</SelectItem>
            <SelectItem value="CANCELLED">Anulada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoice Gallery */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredInvoices.length === 0 && search === '' && statusFilter === 'ALL' ? (
        <EmptyState
          icon={FileText}
          title="No hay facturas"
          description="Crea tu primera factura seleccionando una reserva completada"
          action={{
            label: 'Nueva Factura',
            onClick: () => setIsNewInvoiceOpen(true),
          }}
        />
      ) : (
        <InvoiceGallery
          invoices={filteredInvoices}
          getInvoiceInfo={getInvoiceInfo}
          onViewInvoice={handleViewInvoice}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
