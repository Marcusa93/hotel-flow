import { useState, useMemo, useCallback } from 'react';
import { Search, Plus, FileText, Download } from 'lucide-react';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useInvoices } from '@/hooks/useInvoices';
import { useUpdateInvoice } from '@/hooks/useUpdateInvoice';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import { PageHeader, EmptyState, TableSkeleton } from '@/components/shared';
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
  const { bookings } = useBookingOperations();
  const { guests } = useGuestOperations();
  const { rooms, roomTypes } = useRoomOperations();
  const { data: invoices = [], isLoading } = useInvoices();
  const updateInvoiceMutation = useUpdateInvoice();
  const { data: hotelSettings } = useHotelSettings();

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

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      const { generateInvoicePDF } = await import('@/lib/pdfUtils');
      const info = getInvoiceInfo(invoice);
      await generateInvoicePDF({
        invoice,
        guest: info.guest,
        booking: info.booking,
        room: info.room,
        roomType: info.roomType,
        hotelSettings: hotelSettings ?? undefined,
      });
      toast({
        title: 'PDF generado',
        description: `Factura ${invoice.invoiceNumber} descargada`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: 'No se pudo generar el PDF',
        variant: 'destructive',
      });
    }
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

  const handleExportExcel = useCallback(async () => {
    try {
      const { exportToExcel } = await import('@/lib/exportUtils');
      const rows = filteredInvoices.map(inv => {
        const guest = guests.find(g => g.id === inv.guestId);
        return {
          Número: inv.invoiceNumber,
          Huésped: guest?.fullName ?? '-',
          Fecha: new Date(inv.issueDate).toLocaleDateString('es-AR'),
          Total: inv.totalAmount,
          Estado: inv.status,
        };
      });
      exportToExcel({ data: rows, fileName: 'facturas', sheetName: 'Facturas' });
      toast({ title: 'Excel exportado', description: `${rows.length} facturas exportadas` });
    } catch {
      toast({ title: 'Error', description: 'No se pudo exportar', variant: 'destructive' });
    }
  }, [filteredInvoices, guests]);

  const selectedInfo = selectedInvoice ? getInvoiceInfo(selectedInvoice) : {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold">Gestión de Facturas</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-1" />
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
      </div>

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
        <TableSkeleton rows={4} columns={5} />
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
          onDownloadPDF={handleDownloadPDF}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
