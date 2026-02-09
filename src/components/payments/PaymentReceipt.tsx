import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, Download, Printer, Check } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useHotel } from '@/context/HotelContext';
import { Payment } from '@/types/hotel';
import { toast } from '@/hooks/use-toast';

interface PaymentReceiptProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    payment: Payment | null;
}

export function PaymentReceipt({ open, onOpenChange, payment }: PaymentReceiptProps) {
    const { bookings, guests, rooms, roomTypes } = useHotel();
    const receiptRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    if (!payment) return null;

    const booking = bookings.find(b => b.id === payment.bookingId);
    const guest = booking ? guests.find(g => g.id === booking.guestId) : null;
    const room = booking ? rooms.find(r => r.id === booking.roomId) : null;
    const roomType = room ? roomTypes.find(rt => rt.id === room.roomTypeId) : null;

    const getMethodLabel = (method: string) => {
        switch (method) {
            case 'CASH': return 'Efectivo';
            case 'CARD': return 'Tarjeta';
            case 'TRANSFER': return 'Transferencia';
            default: return 'Otro';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PAID': return 'Pagado';
            case 'PENDING': return 'Pendiente';
            case 'REFUNDED': return 'Reembolsado';
            default: return status;
        }
    };

    // Signature pad handlers
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        setIsDrawing(true);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
        const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
        const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#1e293b';
        ctx.lineTo(x, y);
        ctx.stroke();
        setHasSignature(true);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
    };

    const downloadPDF = async () => {
        if (!receiptRef.current) return;

        try {
            // Create a printable version
            const printContent = receiptRef.current.innerHTML;
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                toast({ title: 'Error', description: 'No se pudo abrir la ventana de impresión', variant: 'destructive' });
                return;
            }

            printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Recibo de Pago - ${payment.id.slice(-8).toUpperCase()}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
            .hotel-name { font-size: 24px; font-weight: bold; color: #1e293b; }
            .receipt-title { font-size: 14px; color: #64748b; margin-top: 5px; }
            .receipt-number { font-family: monospace; font-size: 12px; color: #94a3b8; margin-top: 5px; }
            .section { margin-bottom: 20px; }
            .section-title { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
            .info-label { color: #64748b; font-size: 13px; }
            .info-value { font-weight: 500; color: #1e293b; font-size: 13px; }
            .amount-section { background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
            .amount-label { font-size: 12px; color: #64748b; }
            .amount-value { font-size: 32px; font-weight: bold; color: #059669; }
            .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
            .status-paid { background: #dcfce7; color: #166534; }
            .status-pending { background: #fef9c3; color: #854d0e; }
            .signature-section { margin-top: 40px; }
            .signature-line { border-top: 1px solid #cbd5e1; width: 200px; margin: 60px auto 10px; }
            .signature-label { text-align: center; font-size: 12px; color: #64748b; }
            .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="hotel-name">Hotel Mediterráneo</div>
            <div class="receipt-title">Recibo de Pago</div>
            <div class="receipt-number">Nº ${payment.id.slice(-8).toUpperCase()}</div>
          </div>

          <div class="section">
            <div class="section-title">Información del Huésped</div>
            <div class="info-row">
              <span class="info-label">Nombre</span>
              <span class="info-value">${guest?.fullName || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Documento</span>
              <span class="info-value">${guest?.documentId || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Habitación</span>
              <span class="info-value">${room?.roomNumber || 'N/A'} - ${roomType?.name || ''}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Detalles del Pago</div>
            <div class="info-row">
              <span class="info-label">Fecha</span>
              <span class="info-value">${format(new Date(payment.date), 'PPP', { locale: es })}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Método</span>
              <span class="info-value">${getMethodLabel(payment.method)}</span>
            </div>
            ${payment.reference ? `<div class="info-row"><span class="info-label">Referencia</span><span class="info-value">${payment.reference}</span></div>` : ''}
            <div class="info-row">
              <span class="info-label">Estado</span>
              <span class="info-value"><span class="status-badge ${payment.status === 'PAID' ? 'status-paid' : 'status-pending'}">${getStatusLabel(payment.status)}</span></span>
            </div>
          </div>

          <div class="amount-section">
            <div class="amount-label">Monto Total</div>
            <div class="amount-value">$${payment.amount.toLocaleString('es-AR')}</div>
          </div>

          <div class="signature-section">
            <div class="signature-line"></div>
            <div class="signature-label">Firma del Huésped</div>
          </div>

          <div class="footer">
            <p>Gracias por su preferencia</p>
            <p>Documento generado el ${format(new Date(), 'PPP HH:mm', { locale: es })}</p>
          </div>
        </body>
        </html>
      `);
            printWindow.document.close();
            printWindow.print();

            toast({ title: '✅ Recibo generado', description: 'El recibo está listo para imprimir o guardar como PDF' });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo generar el recibo', variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] p-0 flex flex-col">
                <DialogHeader className="p-6 pb-0 flex-shrink-0">
                    <DialogTitle className="flex items-center justify-between">
                        <span>Recibo de Pago</span>
                        <span className="text-xs font-mono text-muted-foreground bg-slate-100 px-2 py-1 rounded">
                            #{payment.id.slice(-8).toUpperCase()}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4" ref={receiptRef}>
                    {/* Guest Info */}
                    <div className="mb-6">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Información del Huésped
                        </h3>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Nombre</span>
                                <span className="font-medium">{guest?.fullName || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Documento</span>
                                <span className="font-medium">{guest?.documentId || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Habitación</span>
                                <span className="font-medium">{room?.roomNumber} - {roomType?.name}</span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Details */}
                    <div className="mb-6">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Detalles del Pago
                        </h3>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Fecha</span>
                                <span className="font-medium">{format(new Date(payment.date), 'PPP', { locale: es })}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Método</span>
                                <span className="font-medium">{getMethodLabel(payment.method)}</span>
                            </div>
                            {payment.reference && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Referencia</span>
                                    <span className="font-mono text-xs">{payment.reference}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm items-center">
                                <span className="text-muted-foreground">Estado</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${payment.status === 'PAID'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}>
                                    {getStatusLabel(payment.status)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Amount */}
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-6 text-center mb-6">
                        <p className="text-xs text-muted-foreground mb-1">Monto Total</p>
                        <p className="text-3xl font-bold text-emerald-600">${payment.amount.toLocaleString('es-AR')}</p>
                    </div>

                    {/* Signature Pad */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Firma del Huésped
                            </h3>
                            {hasSignature && (
                                <Button variant="ghost" size="sm" onClick={clearSignature} className="text-xs h-6">
                                    Borrar
                                </Button>
                            )}
                        </div>
                        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 relative">
                            <canvas
                                ref={canvasRef}
                                width={400}
                                height={120}
                                className="w-full cursor-crosshair touch-none"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                            />
                            {!hasSignature && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <p className="text-sm text-muted-foreground">Firme aquí</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex-shrink-0 p-4 border-t bg-slate-50 dark:bg-slate-900/50 flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        <X className="w-4 h-4 mr-2" />
                        Cerrar
                    </Button>
                    <Button onClick={downloadPDF} className="bg-blue-600 hover:bg-blue-700">
                        <Download className="w-4 h-4 mr-2" />
                        Descargar PDF
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
