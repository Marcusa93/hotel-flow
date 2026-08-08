import { useState } from 'react';
import { differenceInDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Sparkles } from 'lucide-react';
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
import { useUpdateBooking } from '@/hooks/useUpdateBooking';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useHotelSettings } from '@/hooks/useHotelSettings';
import { formatPesosInput, parsePesosInput } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { Booking } from '@/types/hotel';

interface PriceSpecialRateDialogProps {
    booking: Booking | null;
    onOpenChange: (open: boolean) => void;
}

const money = (n: number) => `$${n.toLocaleString('es-AR')}`;

/**
 * Ponerle el precio a una reserva marcada con tarifa especial. Solo administración.
 *
 * Recepción la marcó cuando llegó el huésped; acá se cierra el número. Al
 * guardar deja de estar pendiente, y el total de la estadía pasa a ser el precio
 * por noche por las noches que dure.
 *
 * Cero se puede guardar y es el caso más común de todos: el dueño se aloja y no
 * paga. Por eso el botón no se deshabilita con el campo vacío como en el resto
 * del sistema — acá vacío significa cero, no "falta completar".
 */
export function PriceSpecialRateDialog({ booking, onOpenChange }: PriceSpecialRateDialogProps) {
    const updateBooking = useUpdateBooking();
    const { guests } = useGuestOperations();
    const { rooms } = useRoomOperations();
    const { data: hotelSettings } = useHotelSettings();

    const [amountText, setAmountText] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [touched, setTouched] = useState(false);

    const sugerido = hotelSettings?.specialRateAmount ?? 0;
    // Mientras no lo toquen, se ofrece el precio de siempre. Si lo borran, es cero.
    const texto = touched ? amountText : (sugerido > 0 ? formatPesosInput(sugerido) : '');
    const nightly = parsePesosInput(texto).value || 0;

    const guest = guests.find(g => g.id === booking?.guestId);
    const room = rooms.find(r => r.id === booking?.roomId);
    const nights = booking
        ? Math.max(1, differenceInDays(new Date(booking.checkOutDate), new Date(booking.checkInDate)))
        : 0;
    const total = nightly * nights;

    const cerrar = () => {
        setAmountText('');
        setReason('');
        setTouched(false);
        onOpenChange(false);
    };

    const handleSubmit = async () => {
        if (!booking) return;
        setIsSubmitting(true);
        try {
            await updateBooking.mutateAsync({
                id: booking.id,
                specialRateAmount: nightly,
                specialRatePending: false,
                specialRateReason: reason.trim() || booking.specialRateReason || undefined,
                totalAmount: total,
            });
            toast({
                title: 'Tarifa puesta',
                description: nightly === 0
                    ? 'La estadía queda sin cargo'
                    : `${money(nightly)} por noche · total ${money(total)}`,
            });
            cerrar();
        } catch (error) {
            toast({
                title: 'No se pudo guardar',
                description: error instanceof Error ? error.message : 'Intentá de nuevo.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={!!booking} onOpenChange={(next) => { if (!next) cerrar(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-violet-500" />
                        Ponerle precio a la estadía
                    </DialogTitle>
                    <DialogDescription>
                        {guest?.fullName ?? 'Huésped'}
                        {room && ` · Hab. ${room.roomNumber}`}
                        {booking && (
                            <>
                                {' · '}
                                {format(new Date(booking.checkInDate), 'd MMM', { locale: es })} al{' '}
                                {format(new Date(booking.checkOutDate), 'd MMM', { locale: es })}
                                {` · ${nights} noche${nights > 1 ? 's' : ''}`}
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {booking?.specialRateReason && (
                        <p className="text-sm text-muted-foreground">
                            Recepción anotó: <strong>{booking.specialRateReason}</strong>
                        </p>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="sr-amount">Precio por noche</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">$</span>
                            <Input
                                id="sr-amount"
                                autoFocus
                                inputMode="decimal"
                                className="pl-7 tabular-nums"
                                placeholder="0"
                                value={texto}
                                onChange={e => { setTouched(true); setAmountText(parsePesosInput(e.target.value).display); }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {nightly === 0
                                ? 'En cero la estadía no se cobra.'
                                : `${nights} noche${nights > 1 ? 's' : ''} · total ${money(total)}`}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="sr-reason">Motivo {booking?.specialRateReason ? '(corregir)' : ''}</Label>
                        <Input
                            id="sr-reason"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder={booking?.specialRateReason || 'Dueño, cortesía, amigo de...'}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={cerrar}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Guardar precio
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
