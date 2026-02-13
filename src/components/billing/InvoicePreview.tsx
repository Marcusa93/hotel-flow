import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Download, Send, Edit, CheckCircle, Printer, QrCode } from 'lucide-react';
import { Invoice, Guest, Booking, Room, RoomType } from '@/types/hotel';
import { useUpdateInvoice } from '@/hooks/useUpdateInvoice';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface InvoicePreviewProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: Invoice | null;
    guest?: Guest;
    booking?: Booking;
    room?: Room;
    roomType?: RoomType;
}

const statusConfig: Record<Invoice['status'], { label: string; color: string }> = {
    DRAFT: { label: 'Borrador', color: 'bg-slate-100 text-slate-700' },
    ISSUED: { label: 'Emitida', color: 'bg-blue-100 text-blue-700' },
    PAID: { label: 'Pagada', color: 'bg-emerald-100 text-emerald-700' },
    CANCELLED: { label: 'Anulada', color: 'bg-rose-100 text-rose-700' },
    OVERDUE: { label: 'Vencida', color: 'bg-amber-100 text-amber-700' },
};

const itemTypeLabels: Record<string, string> = {
    ACCOMMODATION: 'Alojamiento',
    SERVICE: 'Servicio',
    EXTRA: 'Extra',
    OTHER: 'Otro',
};

export function InvoicePreview({
    open,
    onOpenChange,
    invoice,
    guest,
    booking,
    room,
    roomType,
}: InvoicePreviewProps) {
    const updateInvoiceMutation = useUpdateInvoice();
    const { data: hotelSettings } = useHotelSettings();
    const printRef = useRef<HTMLDivElement>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    if (!invoice) return null;

    const statusInfo = statusConfig[invoice.status];

    const handleStatusChange = async (newStatus: Invoice['status']) => {
        setIsUpdating(true);
        try {
            await updateInvoiceMutation.mutateAsync({
                id: invoice.id,
                data: { status: newStatus },
            });
            toast({
                title: '✅ Estado actualizado',
                description: `Factura marcada como ${statusConfig[newStatus].label}`,
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudo actualizar el estado',
                variant: 'destructive',
            });
        } finally {
            setIsUpdating(false);
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) return;

        const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Factura ${invoice.invoiceNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; color: #1e293b; }
          
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
          .logo { font-size: 24px; font-weight: 700; color: #003366; }
          .logo-sub { font-size: 12px; color: #64748b; }
          .invoice-info { text-align: right; }
          .invoice-number { font-size: 20px; font-weight: 700; color: #4f46e5; }
          .invoice-date { font-size: 12px; color: #64748b; margin-top: 4px; }
          
          .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .party { flex: 1; }
          .party h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin-bottom: 8px; }
          .party p { font-size: 14px; line-height: 1.6; }
          .party .name { font-weight: 600; font-size: 16px; }
          
          .items { margin-bottom: 30px; }
          .items table { width: 100%; border-collapse: collapse; }
          .items th { text-align: left; padding: 12px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border-bottom: 2px solid #e2e8f0; }
          .items td { padding: 16px 8px; border-bottom: 1px solid #f1f5f9; }
          .items tr:last-child td { border-bottom: none; }
          .items .description { font-weight: 500; }
          .items .type { font-size: 12px; color: #64748b; }
          .items .number { text-align: right; font-variant-numeric: tabular-nums; }
          
          .totals { margin-left: auto; width: 280px; }
          .totals .row { display: flex; justify-content: space-between; padding: 8px 0; }
          .totals .row.subtotal { border-top: 1px solid #e2e8f0; padding-top: 16px; }
          .totals .row.total { border-top: 2px solid #1e293b; margin-top: 8px; padding-top: 16px; font-size: 18px; font-weight: 700; }
          .totals .label { color: #64748b; }
          .totals .value { font-weight: 600; font-variant-numeric: tabular-nums; }
          
          .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; }
          .signature { width: 200px; }
          .signature-line { border-top: 1px solid #94a3b8; margin-top: 60px; }
          .signature-label { font-size: 11px; color: #64748b; margin-top: 8px; text-align: center; }
          .qr-placeholder { width: 80px; height: 80px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 10px; }
          
          .notes { margin-top: 40px; padding: 16px; background: #f8fafc; border-radius: 8px; }
          .notes h4 { font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 8px; }
          .notes p { font-size: 13px; color: #475569; }
          
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">HoMe App</div>
            <div class="logo-sub">Sistema de Gestión Hotelera</div>
          </div>
          <div class="invoice-info">
            <div class="invoice-number">${invoice.invoiceNumber}</div>
            <div class="invoice-date">Emitida: ${format(new Date(invoice.issueDate), "dd 'de' MMMM 'de' yyyy", { locale: es })}</div>
            ${invoice.dueDate ? `<div class="invoice-date">Vence: ${format(new Date(invoice.dueDate), "dd 'de' MMMM 'de' yyyy", { locale: es })}</div>` : ''}
          </div>
        </div>
        
        <div class="parties">
          <div class="party">
            <h3>Facturar a</h3>
            <p class="name">${guest?.fullName || 'Huésped'}</p>
            <p>${guest?.documentId ? `DNI/CUIT: ${guest.documentId}` : ''}</p>
            <p>${guest?.email || ''}</p>
            <p>${guest?.phone || ''}</p>
          </div>
          <div class="party" style="text-align: right;">
            <h3>Detalles de Estadía</h3>
            <p>Habitación ${room?.roomNumber || '-'} (${roomType?.name || ''})</p>
            ${booking ? `<p>${format(new Date(booking.checkInDate), 'dd MMM', { locale: es })} - ${format(new Date(booking.checkOutDate), 'dd MMM yyyy', { locale: es })}</p>` : ''}
          </div>
        </div>
        
        <div class="items">
          <table>
            <thead>
              <tr>
                <th style="width: 50%">Concepto</th>
                <th style="width: 15%">Tipo</th>
                <th class="number" style="width: 10%">Cant.</th>
                <th class="number" style="width: 12%">P. Unit.</th>
                <th class="number" style="width: 13%">Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items?.map(item => `
                <tr>
                  <td class="description">${item.description}</td>
                  <td class="type">${itemTypeLabels[item.itemType] || item.itemType}</td>
                  <td class="number">${item.quantity}</td>
                  <td class="number">$${item.unitPrice.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td class="number">$${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        
        <div class="totals">
          <div class="row subtotal">
            <span class="label">Subtotal</span>
            <span class="value">$${invoice.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="row">
            <span class="label">IVA (${invoice.taxRate}%)</span>
            <span class="value">$${invoice.taxAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="row total">
            <span class="label">Total</span>
            <span class="value" style="color: #4f46e5;">$${invoice.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
        
        ${invoice.notes ? `
          <div class="notes">
            <h4>Notas</h4>
            <p>${invoice.notes}</p>
          </div>
        ` : ''}
        
        <div class="footer">
          <div class="signature">
            <div class="signature-line"></div>
            <div class="signature-label">Firma del Huésped</div>
          </div>
          <div class="qr-placeholder">
            <span>QR</span>
          </div>
        </div>
      </body>
      </html>
    `;

        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
                <SheetHeader className="p-6 pb-4 border-b bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50">
                    <div className="flex items-center justify-between">
                        <div>
                            <SheetTitle className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
                                {invoice.invoiceNumber}
                            </SheetTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                {format(new Date(invoice.issueDate), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                            </p>
                        </div>
                        <Badge className={cn('text-xs', statusInfo.color)}>
                            {statusInfo.label}
                        </Badge>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Guest Info */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Cliente</h4>
                        <p className="font-semibold text-lg">{guest?.fullName || 'Huésped'}</p>
                        {guest?.documentId && <p className="text-sm text-muted-foreground">DNI/CUIT: {guest.documentId}</p>}
                        {booking && room && (
                            <p className="text-sm text-muted-foreground mt-1">
                                Hab. {room.roomNumber} • {format(new Date(booking.checkInDate), 'dd MMM', { locale: es })} - {format(new Date(booking.checkOutDate), 'dd MMM', { locale: es })}
                            </p>
                        )}
                    </div>

                    {/* Items */}
                    <div>
                        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Conceptos</h4>
                        <div className="space-y-2">
                            {invoice.items?.map((item) => (
                                <div key={item.id} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                    <div>
                                        <p className="font-medium text-sm">{item.description}</p>
                                        <p className="text-xs text-muted-foreground">{item.quantity} x ${item.unitPrice.toLocaleString('es-AR')}</p>
                                    </div>
                                    <span className="font-semibold">${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {/* Totals */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span>${invoice.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">IVA ({invoice.taxRate}%)</span>
                            <span>${invoice.taxAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-xl font-bold pt-2 border-t">
                            <span>Total</span>
                            <span className="text-indigo-600">${invoice.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    {invoice.notes && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                            <h4 className="text-xs font-medium text-amber-700 mb-1">Notas</h4>
                            <p className="text-sm text-amber-800 dark:text-amber-200">{invoice.notes}</p>
                        </div>
                    )}
                </div>

                {/* Actions Footer */}
                <div className="flex-shrink-0 p-4 border-t bg-slate-50 dark:bg-slate-900/50 space-y-3">
                    <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={handlePrint}>
                            <Printer className="w-4 h-4 mr-2" />
                            Imprimir
                        </Button>
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={async () => {
                                try {
                                    const { generateInvoicePDF } = await import('@/lib/pdfUtils');
                                    await generateInvoicePDF({
                                        invoice,
                                        guest,
                                        booking,
                                        room,
                                        roomType,
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
                            }}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            PDF
                        </Button>
                    </div>

                    {invoice.status === 'DRAFT' && (
                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            onClick={() => handleStatusChange('ISSUED')}
                            disabled={isUpdating}
                        >
                            <Send className="w-4 h-4 mr-2" />
                            Emitir Factura
                        </Button>
                    )}

                    {invoice.status === 'ISSUED' && (
                        <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleStatusChange('PAID')}
                            disabled={isUpdating}
                        >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Marcar como Pagada
                        </Button>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
