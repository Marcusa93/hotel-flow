import { useEffect, useState } from 'react';
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
import { useCreateInvoice } from '@/hooks/useCreateInvoice';
import { useBookingCharges } from '@/hooks/useBookingCharges';
import { useCreateBookingCharge } from '@/hooks/useCreateBookingCharge';
import { toast } from '@/hooks/use-toast';
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
    Clock,
    Sparkles
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useHousekeepingStaff } from '@/hooks/useHousekeepingStaff';
import { buildBookingAccount } from '@/lib/bookingAccount';

/** Sentinel for "no personal assignee — notify every housekeeping user". */
const TEAM_OPTION = 'TEAM';

interface CheckoutDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    booking: BookingWithDetails;
    /** discountAmount hace falta para que un cupón no se lea como saldo pendiente */
    bookingPayments: Array<{ id: string; amount: number; status: string; method: string; date: Date; discountAmount?: number }>;
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
    const createInvoice = useCreateInvoice();
    const createBookingCharge = useCreateBookingCharge();
    const { data: bookingCharges = [] } = useBookingCharges(booking.id);

    const { data: staff = [], isLoading: isLoadingStaff } = useHousekeepingStaff();

    const [generateInvoice, setGenerateInvoice] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLateCheckout, setIsLateCheckout] = useState(false);
    const [lateCheckoutFee, setLateCheckoutFee] = useState(5000); // Default late fee
    const [confirmUnpaid, setConfirmUnpaid] = useState(false);
    const [assigneeId, setAssigneeId] = useState(TEAM_OPTION);

    const assignee = staff.find(s => s.id === assigneeId);

    // Each check-out is its own decision — don't carry over the previous pick.
    useEffect(() => {
        if (open) setAssigneeId(TEAM_OPTION);
    }, [open]);

    // Calculate payment summary
    const lateCharge = isLateCheckout ? lateCheckoutFee : 0;
    const account = buildBookingAccount({
        booking,
        payments: bookingPayments,
        charges: bookingCharges,
        pendingExtra: lateCharge,
    });
    const { paid: totalPaid, extras: totalChargesWithLate, total: adjustedTotal, discount: totalDiscount } = account;
    const totalCharges = totalChargesWithLate - lateCharge;
    const pendingAmount = account.balance;
    const isPaidInFull = account.isSettled;

    const nights = Math.ceil(
        (new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const handleCheckout = async () => {
        setIsProcessing(true);
        try {
            // 1. Persist late-checkout fee as a booking charge so it exists in the account
            if (isLateCheckout && lateCharge > 0) {
                await createBookingCharge.mutateAsync({
                    bookingId: booking.id,
                    category: 'OTRO',
                    description: 'Check-out tardío',
                    amount: lateCharge,
                    quantity: 1,
                });
            }

            // 2. Update booking status (also marks room DIRTY + creates housekeeping task
            //    and notifies whoever was picked above)
            await updateBookingStatus(booking.id, 'CHECKED_OUT', {
                assigneeId: assignee?.id,
                assigneeName: assignee?.name,
                roomNumber: booking.room.roomNumber,
                guestName: booking.guest.fullName,
            });

            // 3. Generate invoice if selected
            if (generateInvoice) {
                await createInvoice.mutateAsync({
                    bookingId: booking.id,
                    guestId: booking.guest.id,
                    dueDate: new Date(),
                    items: [
                        {
                            description: `Alojamiento Hab. ${booking.room.roomNumber} (${nights} noches)`,
                            quantity: 1,
                            unitPrice: booking.totalAmount,
                            itemType: 'ACCOMMODATION'
                        },
                        ...bookingCharges.map(charge => ({
                            description: charge.description,
                            quantity: charge.quantity,
                            unitPrice: charge.amount,
                            itemType: 'EXTRA' as const,
                        })),
                        ...(isLateCheckout && lateCharge > 0
                            ? [{
                                description: 'Check-out tardío',
                                quantity: 1,
                                unitPrice: lateCharge,
                                itemType: 'OTHER' as const,
                            }]
                            : []),
                    ],
                    taxRate: 0,
                    notes: `Checkout automático - ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`
                });
            }

            toast({
                title: '✅ Check-out realizado',
                description: assignee
                    ? `Se le avisó a ${assignee.name} que tiene que limpiar la habitación ${booking.room.roomNumber}.`
                    : `Se avisó al equipo de limpieza — habitación ${booking.room.roomNumber}.`,
            });

            onCheckoutComplete();
            onOpenChange(false);
        } catch (error) {
            toast({
                title: 'No se pudo completar el check-out',
                description: error instanceof Error ? error.message : 'Ocurrió un error inesperado. Intenta nuevamente.',
                variant: 'destructive',
            });
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
                            {totalCharges > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground">Consumos / extras</span>
                                    <span className="font-medium">+${totalCharges.toLocaleString('es-AR')}</span>
                                </div>
                            )}
                            {isLateCheckout && (
                                <div className="flex justify-between text-amber-600">
                                    <span className="text-sm flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Check-out tardío
                                    </span>
                                    <span className="font-medium">+${lateCharge.toLocaleString('es-AR')}</span>
                                </div>
                            )}
                            {totalDiscount > 0 && (
                                <div className="flex justify-between text-emerald-600">
                                    <span className="text-sm">Descuento promoción</span>
                                    <span className="font-medium">-${totalDiscount.toLocaleString('es-AR')}</span>
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
                                        min={0}
                                        max={booking.totalAmount}
                                        value={lateCheckoutFee}
                                        onChange={(e) => {
                                            const val = Math.max(0, Math.min(Number(e.target.value), booking.totalAmount));
                                            setLateCheckoutFee(val);
                                        }}
                                        className="w-28 pl-7 h-8 text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Housekeeping handoff */}
                    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Sparkles className="w-4 h-4 text-blue-500" />
                            Avisar a limpieza
                        </div>
                        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                            <BedDouble className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            La habitación {booking.room.roomNumber} queda marcada como "Sucia". Elegí quién la
                            limpia y le llega la notificación al instante.
                        </p>

                        {staff.length === 0 ? (
                            <p className="text-xs text-amber-600 dark:text-amber-500">
                                {isLoadingStaff
                                    ? 'Buscando personal de limpieza…'
                                    : 'No hay usuarios con rol Limpieza todavía. Se avisa al equipo; podés crear usuarios en Configuración → Usuarios.'}
                            </p>
                        ) : (
                            <Select value={assigneeId} onValueChange={setAssigneeId}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={TEAM_OPTION}>Todo el equipo de limpieza</SelectItem>
                                    {staff.map(member => (
                                        <SelectItem key={member.id} value={member.id}>
                                            {member.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
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
