import { useEffect, useMemo, useState } from 'react';
import { differenceInDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, ArrowRight, BedDouble, CalendarPlus, Loader2, Minus, Plus } from 'lucide-react';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useCreateBookingCharge } from '@/hooks/useCreateBookingCharge';
import { buildStayExtension, describeStayExtension } from '@/lib/stayExtension';
import { formatLastNameFirst, formatPesosInput, parsePesosInput } from '@/lib/utils';
import type { BookingWithDetails } from '@/types/hotel';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';

interface ExtendStayDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    booking: BookingWithDetails;
}

const MAX_NIGHTS = 30;

/**
 * Agregar noches a un huésped que ya está alojado.
 *
 * Editar Reserva no sirve para esto: se apaga en cuanto se hace el check-in
 * —cambiarle las fechas a alguien que ya entró es otra operación— y recalcula
 * el total pisando lo que se cotizó al reservar. Acá la salida se corre y las
 * noches nuevas entran como cargo de alojamiento, así la cuenta muestra por
 * separado lo pactado y lo agregado después.
 */
export function ExtendStayDialog({ open, onOpenChange, booking }: ExtendStayDialogProps) {
    const { bookings, updateBooking, checkRoomAvailability } = useBookingOperations();
    const createCharge = useCreateBookingCharge();

    const [nights, setNights] = useState(1);
    const [pricePerNight, setPricePerNight] = useState(booking.roomType.basePrice);
    const [priceText, setPriceText] = useState(formatPesosInput(booking.roomType.basePrice));
    const [isSubmitting, setIsSubmitting] = useState(false);

    const currentCheckOut = useMemo(() => new Date(booking.checkOutDate), [booking.checkOutDate]);

    // El precio de la habitación puede haber cambiado desde que se reservó, y la
    // recepción a veces pacta otro por las noches sueltas. Se propone la tarifa
    // vigente y se deja editar.
    useEffect(() => {
        if (open) {
            setNights(1);
            setPricePerNight(booking.roomType.basePrice);
            setPriceText(formatPesosInput(booking.roomType.basePrice));
        }
    }, [open, booking.roomType.basePrice]);

    const extension = buildStayExtension({ currentCheckOut, nights, pricePerNight });

    const availability = checkRoomAvailability(
        booking.roomId,
        extension.from,
        extension.to,
        booking.id
    );

    /**
     * Hasta cuándo se puede estirar antes de pisar otra reserva.
     *
     * Decirle a la recepción "hay conflicto" la obliga a probar de a una noche
     * con el huésped esperando en el mostrador. El dato que necesita es la
     * fecha en que entra el siguiente.
     */
    const nextBookingStart = useMemo(() => {
        const upcoming = bookings
            .filter(b =>
                b.roomId === booking.roomId &&
                b.id !== booking.id &&
                b.status !== 'CANCELLED' &&
                b.status !== 'NO_SHOW' &&
                b.status !== 'CHECKED_OUT' &&
                new Date(b.checkInDate) >= currentCheckOut
            )
            .map(b => new Date(b.checkInDate))
            .sort((a, b) => a.getTime() - b.getTime());

        return upcoming[0];
    }, [bookings, booking.roomId, booking.id, currentCheckOut]);

    const maxNights = nextBookingStart
        ? differenceInDays(nextBookingStart, currentCheckOut)
        : MAX_NIGHTS;

    const isValid = nights >= 1 && pricePerNight > 0 && availability.available;

    const handleSubmit = async () => {
        if (!isValid) return;

        setIsSubmitting(true);

        // La fecha primero y el cargo después, en ese orden a propósito. Si se
        // corta en el medio, esto deja la estadía extendida sin cobrar —se ve en
        // la cuenta al hacer el check-out y se agrega a mano—. Al revés quedaría
        // cobrada pero con la habitación libre desde la salida vieja, que es
        // justo la que otro puede reservar encima.
        try {
            await updateBooking(booking.id, { checkOutDate: extension.to });
        } catch {
            toast({
                title: 'No se pudo extender la estadía',
                description: 'La reserva quedó sin cambios. Intentá nuevamente.',
                variant: 'destructive',
            });
            setIsSubmitting(false);
            return;
        }

        try {
            await createCharge.mutateAsync({
                bookingId: booking.id,
                category: 'ALOJAMIENTO',
                description: describeStayExtension(extension),
                amount: extension.pricePerNight,
                quantity: extension.nights,
            });
        } catch {
            toast({
                title: 'Estadía extendida, pero sin cobrar',
                description: `La salida pasó al ${format(extension.to, 'd MMM', { locale: es })}. Los $${extension.total.toLocaleString('es-AR')} de las noches no se registraron: cargalos desde Consumos / Extras.`,
                variant: 'destructive',
            });
            onOpenChange(false);
            setIsSubmitting(false);
            return;
        }

        toast({
            title: 'Estadía extendida',
            description: `${formatLastNameFirst(booking.guest.fullName)} se queda hasta el ${format(extension.to, "d 'de' MMMM", { locale: es })} — $${extension.total.toLocaleString('es-AR')} a la cuenta.`,
        });

        onOpenChange(false);
        setIsSubmitting(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarPlus className="w-5 h-5" />
                        Extender estadía
                    </DialogTitle>
                    <DialogDescription>
                        {formatLastNameFirst(booking.guest.fullName)} — Hab. {booking.room.roomNumber}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {/* Noches adicionales */}
                    <div className="space-y-2">
                        <Label>Noches adicionales</Label>
                        <div className="flex items-center gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 rounded-full shrink-0"
                                onClick={() => setNights(n => Math.max(1, n - 1))}
                                disabled={nights <= 1}
                            >
                                <Minus className="w-4 h-4" />
                            </Button>
                            <Input
                                inputMode="numeric"
                                className="text-center text-lg font-bold tabular-nums"
                                value={nights}
                                onChange={(e) => {
                                    const parsed = parseInt(e.target.value.replace(/\D/g, ''), 10);
                                    setNights(Math.min(MAX_NIGHTS, Math.max(1, parsed || 1)));
                                }}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 rounded-full shrink-0"
                                onClick={() => setNights(n => Math.min(MAX_NIGHTS, n + 1))}
                                disabled={nights >= MAX_NIGHTS}
                            >
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Salida vieja → salida nueva */}
                    <div className="flex items-center justify-center gap-3 p-3 rounded-xl bg-background/60 border">
                        <div className="text-center">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Salida actual</p>
                            <p className="font-medium text-muted-foreground/80">
                                {format(extension.from, 'd MMM', { locale: es })}
                            </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                        <div className="text-center">
                            <p className="text-[10px] uppercase tracking-wider text-primary">Nueva salida</p>
                            <p className="font-bold text-primary">
                                {format(extension.to, 'd MMM', { locale: es })}
                            </p>
                        </div>
                    </div>

                    {/* Conflicto con la próxima reserva */}
                    {!availability.available && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>
                                {nextBookingStart ? (
                                    <>
                                        La habitación ya está reservada desde el{' '}
                                        <strong>{format(nextBookingStart, 'd MMM', { locale: es })}</strong>.{' '}
                                        {maxNights > 0
                                            ? `Podés extender hasta ${maxNights} noche${maxNights === 1 ? '' : 's'}, o mudarlo de habitación.`
                                            : 'No hay noches libres: hay que mudarlo de habitación.'}
                                    </>
                                ) : (
                                    <>La habitación no está disponible para esas noches.</>
                                )}
                            </span>
                        </div>
                    )}

                    {/* Precio por noche */}
                    <div className="space-y-2">
                        <Label htmlFor="extend-price">Precio por noche</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none select-none">
                                $
                            </span>
                            <Input
                                id="extend-price"
                                inputMode="decimal"
                                placeholder="0"
                                className="pl-7 tabular-nums"
                                value={priceText}
                                onChange={(e) => {
                                    const { display, value } = parsePesosInput(e.target.value);
                                    setPriceText(display);
                                    setPricePerNight(value);
                                }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Tarifa de {booking.roomType.name}: ${booking.roomType.basePrice.toLocaleString('es-AR')}/noche
                        </p>
                    </div>

                    {/* Total */}
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                                {extension.nights} noche{extension.nights === 1 ? '' : 's'} × ${extension.pricePerNight.toLocaleString('es-AR')}
                            </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                            <span className="font-semibold">A agregar a la cuenta</span>
                            <span className="text-lg font-bold text-primary">
                                ${extension.total.toLocaleString('es-AR')}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <BedDouble className="w-3 h-3 shrink-0" />
                            Se registra como cargo de Alojamiento, aparte del total de la reserva.
                        </p>
                    </div>
                </div>

                <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="w-full sm:w-auto"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !isValid}
                        className="w-full sm:w-auto"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Extender estadía
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
