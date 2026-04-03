import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useCreateInvoice } from '@/hooks/useCreateInvoice';
import { BookingWithDetails } from '@/types/hotel';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    LogOut,
    AlertTriangle,
    CheckCircle,
    Receipt,
    CreditCard,
    Loader2,
    BedDouble,
    Clock
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CheckoutDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    booking: BookingWithDetails;
    bookingPayments: Array<{ id: string; amount: number; status: string; method: string; date: Date }>;
    onCheckoutComplete: () => void;
}

export function CheckoutDialog({
    open,
    onOpenChange,
    booking,
    bookingPayments,
    onCheckoutComplete
}: CheckoutDialogProps) {
    const { updateBookingStatus } = useBookingOperations();
    const { updateRoomStatus } = useRoomOperations();
    const createInvoice = useCreateInvoice();

    const [generateInvoice, setGenerateInvoice] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLateCheckout, setIsLateCheckout] = useState(false);
    const [lateCheckoutFee, setLateCheckoutFee] = useState(5000); // Default late fee
    const [confirmUnpaid, setConfirmUnpaid] = useState(false);

    // Calculate payment summary
    const totalPaid = bookingPayments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);
    const lateCharge = isLateCheckout ? lateCheckoutFee : 0;
    const adjustedTotal = booking.totalAmount + lateCharge;
    const pendingAmount = adjustedTotal - totalPaid;
    const isPaidInFull = pendingAmount <= 0;

    const nights = Math.ceil(
        (new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const handleCheckout = async () => {
        setIsProcessing(true);
        try {
            // 1. Update booking status
            await updateBookingStatus(booking.id, 'CHECKED_OUT');

            // 2. Mark room as dirty for cleaning
            await updateRoomStatus(booking.room.id, 'DIRTY');

            // 3. Generate invoice if selected
            if (generateInvoice) {
                await createInvoice.mutateAsync({
                    bookingId: booking.id,
                    guestId: booking.guest.id,
                    dueDate: new Date(),
                    items: [
                        {
                            description: `Alojamiento Hab. ${booking.room.roomNumber} (${nights} noches)`,
                            quantity: nights,
                            unitPrice: booking.roomType.basePrice,
                            itemType: 'ACCOMMODATION'
                        }
                    ],
                    taxRate: 0,
                    notes: `Checkout automático - ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`
                });
            }

            onCheckoutComplete();
            onOpenChange(false);
        } catch (error) {
            // Error silenced in production
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <LogOut className="w-5 h-5" />
                        Check-out de Huésped
                    </DialogTitle>
                    <DialogDescription>
                        Resumen de la estadía de {booking.guest.fullName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Booking Summary */}
                    <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Habitación</span>
                            <span className="font-medium flex items-center gap-2">
                                <BedDouble className="w-4 h-4" />
                                {booking.room.roomNumber} ({booking.roomType.maxGuests}p)
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Estadía</span>
                            <span className="font-medium">
                                {format(new Date(booking.checkInDate), 'd MMM', { locale: es })} - {format(new Date(booking.checkOutDate), 'd MMM', { locale: es })}
                                <span className="text-muted-foreground ml-1">({nights} noches)</span>
                            </span>
                        </div>
                    </div>

                    <Separator />

                    {/* Payment Summary */}
                    <div className="space-y-3">
                        <h4 className="font-medium flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Estado de Cuenta
                        </h4>

                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Total reserva</span>
                                <span className="font-medium">${booking.totalAmount.toLocaleString('es-AR')}</span>
                            </div>
                            {isLateCheckout && (
                                <div className="flex justify-between text-amber-600">
                                    <span className="text-sm flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Check-out tardío
                                    </span>
                                    <span className="font-medium">+${lateCharge.toLocaleString('es-AR')}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Total pagado</span>
                                <span className="font-medium text-emerald-600">${totalPaid.toLocaleString('es-AR')}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                                <span className="font-medium">Saldo pendiente</span>
                                <Badge variant={isPaidInFull ? 'default' : 'destructive'} className="text-base px-3 py-1">
                                    ${pendingAmount.toLocaleString('es-AR')}
                                </Badge>
                            </div>
                        </div>

                        {!isPaidInFull && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-700 dark:text-red-400 space-y-2">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                    <div className="text-sm">
                                        <p className="font-medium">⚠ Saldo pendiente: ${pendingAmount.toLocaleString('es-AR')}</p>
                                        <p className="text-xs opacity-80">El huésped tiene un saldo sin pagar. Si continúa, la deuda quedará registrada.</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3 ml-7">
                                    <Checkbox
                                        id="confirmUnpaid"
                                        checked={confirmUnpaid}
                                        onCheckedChange={(checked) => setConfirmUnpaid(!!checked)}
                                    />
                                    <label htmlFor="confirmUnpaid" className="text-xs cursor-pointer font-medium">
                                        Confirmo que autorizo el check-out con saldo pendiente
                                    </label>
                                </div>
                            </div>
                        )}

                        {isPaidInFull && (
                            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-700 dark:text-emerald-400">
                                <CheckCircle className="w-5 h-5" />
                                <span className="text-sm font-medium">Cuenta saldada completamente</span>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Options */}
                    <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                            <Checkbox
                                id="generateInvoice"
                                checked={generateInvoice}
                                onCheckedChange={(checked) => setGenerateInvoice(!!checked)}
                            />
                            <label htmlFor="generateInvoice" className="text-sm cursor-pointer flex items-center gap-2">
                                <Receipt className="w-4 h-4 text-muted-foreground" />
                                Generar factura automáticamente
                            </label>
                        </div>

                        <div className="flex items-center space-x-3">
                            <Checkbox
                                id="lateCheckout"
                                checked={isLateCheckout}
                                onCheckedChange={(checked) => setIsLateCheckout(!!checked)}
                            />
                            <label htmlFor="lateCheckout" className="text-sm cursor-pointer flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-500" />
                                Check-out tardío (cargo adicional)
                            </label>
                        </div>

                        {isLateCheckout && (
                            <div className="ml-6 flex items-center gap-2">
                                <Label htmlFor="lateFee" className="text-xs text-muted-foreground whitespace-nowrap">Cargo:</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input
                                        id="lateFee"
                                        type="number"
                                        value={lateCheckoutFee}
                                        onChange={(e) => setLateCheckoutFee(Number(e.target.value))}
                                        className="w-28 pl-7 h-8 text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Room Status Notice */}
                    <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 flex items-center gap-2">
                        <BedDouble className="w-4 h-4" />
                        La habitación {booking.room.roomNumber} se marcará como "Sucia" para limpieza
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                        Cancelar
                    </Button>
                    <Button onClick={handleCheckout} disabled={isProcessing || (!isPaidInFull && !confirmUnpaid)} className="bg-slate-800 hover:bg-slate-900">
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <LogOut className="w-4 h-4 mr-2" />
                                Confirmar Check-out
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
