import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    LogIn,
    BedDouble,
    Users,
    Calendar,
    CreditCard,
    CheckCircle2,
    AlertTriangle
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useHousekeepingTasks } from '@/hooks/domain/useHousekeepingOperations';
import { useCheckInOccupancy } from '@/hooks/useCheckInOccupancy';
import { getRoomCheckInWarning, checkInConfirmLabel } from '@/lib/roomReadiness';
import { RoomStatusWarning } from '@/components/shared';
import { CheckInOccupancy } from '@/components/bookings/CheckInOccupancy';
import { toast } from '@/hooks/use-toast';

interface QuickCheckInDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    bookingId: string;
    guestName: string;
    roomNumber: string;
    roomId: string;
    checkInDate: Date;
    checkOutDate: Date;
    totalAmount: number;
    amountPaid: number;
    adults: number;
    children: number;
}

export function QuickCheckInDialog({
    open,
    onOpenChange,
    bookingId,
    guestName,
    roomNumber,
    roomId,
    checkInDate,
    checkOutDate,
    totalAmount,
    amountPaid,
    adults,
    children,
}: QuickCheckInDialogProps) {
    const { updateBookingStatus, bookings } = useBookingOperations();
    const { updateRoomStatus, rooms } = useRoomOperations();
    const { data: housekeepingTasks = [] } = useHousekeepingTasks();
    const [isProcessing, setIsProcessing] = useState(false);

    const booking = bookings.find(b => b.id === bookingId);
    const occupancy = useCheckInOccupancy(booking);

    const nights = differenceInDays(checkOutDate, checkInDate);
    // totalAmount viene con los consumos adentro; lo que cambia por la ocupación
    // es solo la parte de alojamiento, así que se corrige por la diferencia en
    // vez de reemplazarlo —si no, un check-in se comía los extras del saldo.
    const adjustedTotal = totalAmount + (occupancy.newTotal - occupancy.currentTotal);
    const pendingAmount = adjustedTotal - amountPaid;
    const hasPendingPayment = pendingAmount > 0;

    // El estado de la habitación no bloquea el check-in, pero se avisa antes de confirmar.
    const room = rooms.find(r => r.id === roomId);
    const roomWarning = getRoomCheckInWarning(room, housekeepingTasks);

    const handleCheckIn = async () => {
        setIsProcessing(true);
        try {
            // 0. La ocupación real primero: define el total que se va a cobrar
            await occupancy.persist();

            // 1. Update booking status to CHECKED_IN
            await updateBookingStatus(bookingId, 'CHECKED_IN');

            // 2. Update room status to OCCUPIED
            await updateRoomStatus(roomId, 'OCCUPIED');

            toast({
                title: '✅ Check-in completado',
                description: `${guestName} - Habitación ${roomNumber}`,
            });

            onOpenChange(false);
        } catch (error) {
            toast({
                title: 'Error en check-in',
                description: 'No se pudo completar el check-in',
                variant: 'destructive',
            });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <LogIn className="w-5 h-5 text-emerald-500" />
                        Check-in Rápido
                    </DialogTitle>
                    <DialogDescription>
                        Confirmar llegada del huésped
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Estado de la habitación: primero, antes de que la mano vaya al botón */}
                    <RoomStatusWarning warning={roomWarning} />

                    {/* Guest Info */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                        <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="font-semibold">{guestName}</p>
                            {/* La composición del grupo la maneja el bloque de ocupación de abajo,
                                que además es el que define el precio. Repetirla acá daba dos
                                números para lo mismo y uno de los dos quedaba viejo. */}
                            <p className="text-sm text-muted-foreground">
                                Reservó {adults} adulto{adults > 1 ? 's' : ''}{children > 0 ? `, ${children} niño${children > 1 ? 's' : ''}` : ''}
                            </p>
                        </div>
                    </div>

                    {/* Room & Dates */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border bg-white dark:bg-slate-900">
                            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                <BedDouble className="w-3 h-3" />
                                Habitación
                            </div>
                            <p className="font-bold text-lg">{roomNumber}</p>
                        </div>
                        <div className="p-3 rounded-lg border bg-white dark:bg-slate-900">
                            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                <Calendar className="w-3 h-3" />
                                Estadía
                            </div>
                            <p className="font-bold text-lg">{nights} noche{nights > 1 ? 's' : ''}</p>
                        </div>
                    </div>

                    {/* Dates Detail */}
                    <div className="text-sm text-center text-muted-foreground">
                        {format(checkInDate, "d MMM", { locale: es })} → {format(checkOutDate, "d MMM yyyy", { locale: es })}
                    </div>

                    {/* Cuántos entran de verdad: acá se define lo que se cobra */}
                    <CheckInOccupancy
                        value={occupancy.value}
                        onChange={occupancy.setValue}
                        pricing={occupancy.pricing}
                        maxGuests={occupancy.maxGuests}
                        nights={occupancy.nights}
                        currentTotal={occupancy.currentTotal}
                        newTotal={occupancy.newTotal}
                    />

                    <Separator />

                    {/* Payment Status */}
                    <div className="p-3 rounded-lg border bg-white dark:bg-slate-900">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CreditCard className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">Estado de pago</span>
                            </div>
                            <Badge variant={hasPendingPayment ? "outline" : "default"} className={hasPendingPayment ? "border-amber-500 text-amber-600" : "bg-emerald-500"}>
                                {hasPendingPayment ? 'Pendiente' : 'Pagado'}
                            </Badge>
                        </div>
                        {hasPendingPayment && (
                            <div className="mt-2 flex items-center gap-2 text-amber-600 text-sm">
                                <AlertTriangle className="w-4 h-4" />
                                <span>Saldo pendiente: <strong>${pendingAmount.toLocaleString('es-AR')}</strong></span>
                            </div>
                        )}
                    </div>

                    {/* What will happen */}
                    <div className="text-xs text-muted-foreground bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                        <p className="font-medium mb-1">Al confirmar:</p>
                        <ul className="space-y-1">
                            <li className="flex items-center gap-2">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                Reserva pasa a "Checked-in"
                            </li>
                            <li className="flex items-center gap-2">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                Habitación {roomNumber} se marca como "Ocupada"
                            </li>
                        </ul>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleCheckIn}
                        disabled={isProcessing}
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        <LogIn className="w-4 h-4 mr-2" />
                        {isProcessing ? 'Procesando...' : checkInConfirmLabel(roomWarning)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
