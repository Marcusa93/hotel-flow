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
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { Payment } from '@/types/hotel';
import { toast } from '@/hooks/use-toast';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';

interface PaymentReceiptProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    payment: Payment | null;
}

export function PaymentReceipt({ open, onOpenChange, payment }: PaymentReceiptProps) {
    const { bookings } = useBookingOperations();
    const { guests } = useGuestOperations();
    const { rooms, roomTypes } = useRoomOperations();
    const receiptRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    if (!payment) return null;

    const booking = bookings.find(b => b.id === payment.bookingId);
    const guest = booking ? guests.find(g => g.id === booking.guestId) : null;
    const room = booking ? rooms.find(r => r.id === booking.roomId) : null;
    const roomType = room ? roomTypes.find(rt => rt.id === room.roomTypeId) : null;

    const getMethodLabel = (method: string) => PAYMENT_METHOD_LABELS[method] || 'Otro';

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PAID': return 'Pagado';
            case 'PENDING': return 'Pendiente';
            case 'REFUNDED': return 'Reembolsado';
            default: return status;
        }
    };

    // Signature pad handlers
    // The canvas has a fixed internal size (400x120) but is styled w-full, so pointer
    // coordinates (CSS px) must be scaled to canvas px or strokes drift from the cursor
    const getCanvasPoint = (
        canvas: HTMLCanvasElement,
        e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    ) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height),
        };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        setIsDrawing(true);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCanvasPoint(canvas, e);

        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCanvasPoint(canvas, e);

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
        try {
            const { generateReceiptPDF } = await import('@/lib/pdfUtils');
            await generateReceiptPDF({
                payment,
                guest: guest ?? undefined,
                room: room ?? undefined,
                roomType: roomType ?? undefined,
                signatureDataUrl: hasSignature && canvasRef.current
                    ? canvasRef.current.toDataURL('image/png')
                    : undefined,
            });
            toast({ title: 'PDF generado', description: 'Recibo descargado correctamente' });
        } catch (error) {
            console.error('Error generating receipt PDF:', error);
            toast({ title: 'Error', description: 'No se pudo generar el recibo PDF', variant: 'destructive' });
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
