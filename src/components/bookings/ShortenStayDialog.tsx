import { useEffect, useMemo, useState } from 'react';
import { addDays, differenceInDays, format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, CalendarMinus, CalendarIcon, Loader2 } from 'lucide-react';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { formatLastNameFirst, formatPesosInput, parsePesosInput, cn } from '@/lib/utils';
import { halfDayTotal } from '@/lib/occupancyPricing';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from '@/hooks/use-toast';

interface ShortenStayDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    booking: BookingWithDetails;
}

/**
 * Acortar una estadía que ya empezó.
 *
 * El huésped avisa que se va antes de lo pactado. Esto mueve dos cosas:
 * la fecha de salida (para liberar la habitación en el tablero) y el total
 * de la reserva (para que el estado de cuenta refleje lo que realmente se cobra).
 *
 * El precio por noche se deriva del total pactado dividido las noches originales,
 * y se puede editar: si se acordó otro monto en el mostrador, se pone a mano.
 *
 * El que se va antes rara vez se va a la mañana: usa la habitación hasta el
 * mediodía del último día. Sin poder cobrar ese medio día había que elegir entre
 * regalar medio día o cobrar la noche entera que no durmió, así que recepción
 * terminaba arreglando el número a mano en el precio por noche y el total dejaba
 * de explicar de dónde salía.
 */
export function ShortenStayDialog({ open, onOpenChange, booking }: ShortenStayDialogProps) {
    const { updateBooking } = useBookingOperations();

    const originalCheckOut = useMemo(
        () => startOfDay(new Date(booking.checkOutDate)),
        [booking.checkOutDate]
    );
    const checkIn = useMemo(
        () => startOfDay(new Date(booking.checkInDate)),
        [booking.checkInDate]
    );
    const originalNights = differenceInDays(originalCheckOut, checkIn);

    // Defecto: hoy si cae en el rango válido, si no el día anterior al checkout.
    const defaultNewCheckOut = useMemo(() => {
        const today = startOfDay(new Date());
        if (today > checkIn && today < originalCheckOut) return today;
        return addDays(originalCheckOut, -1);
    }, [checkIn, originalCheckOut]);

    const [newCheckOut, setNewCheckOut] = useState<Date>(defaultNewCheckOut);
    const [priceText, setPriceText] = useState('');
    const [pricePerNight, setPricePerNight] = useState(0);
    const [chargeHalfDay, setChargeHalfDay] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setNewCheckOut(defaultNewCheckOut);
            setChargeHalfDay(false);
            const nightly = originalNights > 0
                ? Math.round(booking.totalAmount / originalNights)
                : 0;
            setPricePerNight(nightly);
            setPriceText(formatPesosInput(nightly));
        }
    }, [open, defaultNewCheckOut, originalNights, booking.totalAmount]);

    const newNights = differenceInDays(newCheckOut, checkIn);
    const nightsRemoved = originalNights - newNights;
    // El medio día sale del mismo precio por noche que se está usando arriba: si
    // recepción lo corrige a mano, la media acompaña sin quedar sobre la tarifa
    // vieja. Ver halfDayTotal.
    const halfDayAmount = chargeHalfDay ? halfDayTotal(pricePerNight) : 0;
    const newTotal = newNights * pricePerNight + halfDayAmount;

    const isValid =
        newNights >= 1 &&
        newCheckOut > checkIn &&
        newCheckOut < originalCheckOut &&
        pricePerNight >= 0;

    const handleSubmit = async () => {
        if (!isValid) return;
        setIsSubmitting(true);
        try {
            await updateBooking(booking.id, {
                checkOutDate: newCheckOut,
                totalAmount: newTotal,
                // Queda marcada para que el detalle no ofrezca cobrar el medio
                // día otra vez y para que la duración diga "y media".
                halfDayAdd: chargeHalfDay,
            });
            toast({
                title: 'Estadía acortada',
                description: `${formatLastNameFirst(booking.guest.fullName)} sale el ${format(newCheckOut, "d 'de' MMMM", { locale: es })}${chargeHalfDay ? ' al mediodía' : ''} — nuevo total $${newTotal.toLocaleString('es-AR')}.`,
            });
            onOpenChange(false);
        } catch (e) {
            toast({
                title: 'No se pudo acortar la estadía',
                description: e instanceof Error ? e.message : 'Intentá nuevamente.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarMinus className="w-5 h-5" />
                        Acortar estadía
                    </DialogTitle>
                    <DialogDescription>
                        {formatLastNameFirst(booking.guest.fullName)} — Hab. {booking.room.roomNumber}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {/* Selector de nueva fecha de salida */}
                    <div className="space-y-2">
                        <Label>Nueva fecha de salida</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        'w-full pl-3 text-left font-normal',
                                        !newCheckOut && 'text-muted-foreground'
                                    )}
                                >
                                    {newCheckOut
                                        ? format(newCheckOut, 'PPP', { locale: es })
                                        : 'Seleccionar'}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={newCheckOut}
                                    onSelect={(d) => d && setNewCheckOut(startOfDay(d))}
                                    disabled={(date) =>
                                        date <= checkIn || date >= originalCheckOut
                                    }
                                    locale={es}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Indicador de cambio */}
                    <div className="flex items-center justify-center gap-3 p-3 rounded-xl bg-background/60 border">
                        <div className="text-center">
                            <p className="text-[10px] uppercase tracking-wider text-primary">Nueva salida</p>
                            <p className="font-bold text-primary">
                                {format(newCheckOut, 'd MMM', { locale: es })}
                            </p>
                        </div>
                        <ArrowLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="text-center">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Salida original</p>
                            <p className="font-medium text-muted-foreground/80">
                                {format(originalCheckOut, 'd MMM', { locale: es })}
                            </p>
                        </div>
                    </div>

                    {/* Precio por noche */}
                    <div className="space-y-2">
                        <Label htmlFor="shorten-price">Precio por noche</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none select-none">
                                $
                            </span>
                            <Input
                                id="shorten-price"
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
                            Precio original: $
                            {originalNights > 0
                                ? Math.round(booking.totalAmount / originalNights).toLocaleString('es-AR')
                                : 0}
                            /noche
                        </p>
                    </div>

                    {/* El medio día del último día. Se cobra cuando el huésped se
                        va al mediodía en vez de a la mañana. */}
                    <div className="flex items-start gap-3 p-3 rounded-xl border border-primary/10 bg-primary/5">
                        <Checkbox
                            id="shorten-half-day"
                            checked={chargeHalfDay}
                            onCheckedChange={(v) => setChargeHalfDay(v === true)}
                            className="mt-0.5"
                        />
                        <div className="space-y-1">
                            <Label htmlFor="shorten-half-day" className="cursor-pointer">
                                Cobrar media estadía del último día
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Se fue al mediodía del {format(newCheckOut, "d 'de' MMMM", { locale: es })}: suma el 50% de la noche
                                {pricePerNight > 0 && ` (+$${halfDayTotal(pricePerNight).toLocaleString('es-AR')})`}.
                            </p>
                        </div>
                    </div>

                    {/* Resumen */}
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                                {newNights} noche{newNights === 1 ? '' : 's'} × ${pricePerNight.toLocaleString('es-AR')}
                            </span>
                        </div>
                        {chargeHalfDay && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Media estadía del último día</span>
                                <span className="tabular-nums">+${halfDayAmount.toLocaleString('es-AR')}</span>
                            </div>
                        )}
                        {nightsRemoved > 0 && (
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>
                                    {nightsRemoved} noche{nightsRemoved === 1 ? '' : 's'} que no se cobran
                                </span>
                                <span>−${(nightsRemoved * pricePerNight).toLocaleString('es-AR')}</span>
                            </div>
                        )}
                        <Separator />
                        <div className="flex justify-between items-center">
                            <span className="font-semibold">Nuevo total de la reserva</span>
                            <span className="text-lg font-bold text-primary">
                                ${newTotal.toLocaleString('es-AR')}
                            </span>
                        </div>
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
                        Acortar estadía
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
