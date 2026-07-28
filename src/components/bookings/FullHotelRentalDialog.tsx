import { useMemo, useState } from 'react';
import { differenceInDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, Building2, CalendarIcon, Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useAppRole } from '@/context/AppRoleContext';
import { cn, formatPesosInput, parsePesosInput } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface FullHotelRentalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Alquilar el hotel completo.
 *
 * Un contingente se lleva el hotel entero por unos días, a un monto acordado.
 * Use o no todas las habitaciones, queda cerrado para el resto.
 *
 * Se guarda como una reserva sin habitación, así hereda pagos, señas, consumos y
 * facturación sin duplicar nada. El bloqueo real lo hace el trigger de la base:
 * acá se avisa antes, para no mandar a guardar algo que va a rebotar.
 */
export function FullHotelRentalDialog({ open, onOpenChange }: FullHotelRentalDialogProps) {
    const { bookings, addBooking } = useBookingOperations();
    const { guests } = useGuestOperations();
    const { profileName } = useAppRole();

    const [from, setFrom] = useState<Date | undefined>();
    const [to, setTo] = useState<Date | undefined>();
    const [guestId, setGuestId] = useState('');
    const [amountText, setAmountText] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const amount = parsePesosInput(amountText).value;
    const nights = from && to ? differenceInDays(to, from) : 0;

    // Qué hay cargado en esas fechas. El hotel no se puede cerrar por arriba de
    // reservas que ya se le prometieron a alguien.
    const conflicts = useMemo(() => {
        if (!from || !to) return [];
        return bookings.filter(b => {
            if (b.status === 'CANCELLED' || b.status === 'NO_SHOW' || b.status === 'CHECKED_OUT') {
                return false;
            }
            return new Date(b.checkInDate) < to && new Date(b.checkOutDate) > from;
        });
    }, [bookings, from, to]);

    const canSubmit = !!from && !!to && nights > 0 && amount > 0 && !!guestId && conflicts.length === 0;

    const reset = () => {
        setFrom(undefined);
        setTo(undefined);
        setGuestId('');
        setAmountText('');
        setNotes('');
    };

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setIsSubmitting(true);
        try {
            await addBooking({
                guestId,
                // Sin habitación: el alquiler es del hotel, no de un cuarto.
                roomId: null as unknown as string,
                checkInDate: from!,
                checkOutDate: to!,
                adults: 1,
                children: 0,
                infants: 0,
                status: 'CONFIRMED',
                totalAmount: amount,
                isFullHotel: true,
                notes: notes.trim() || undefined,
                receptionist: profileName || undefined,
            });

            toast({
                title: 'Hotel alquilado',
                description: `Del ${format(from!, 'd MMM', { locale: es })} al ${format(to!, 'd MMM', { locale: es })} — $${amount.toLocaleString('es-AR')}`,
            });
            reset();
            onOpenChange(false);
        } catch (error) {
            toast({
                title: 'No se pudo alquilar el hotel',
                description: error instanceof Error ? error.message : 'Intentá de nuevo.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const DateField = ({ label, value, onChange, min }: {
        label: string;
        value?: Date;
        onChange: (d?: Date) => void;
        min?: Date;
    }) => (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn('w-full justify-start font-normal', !value && 'text-muted-foreground')}
                    >
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {value ? format(value, 'd MMM yyyy', { locale: es }) : 'Elegir fecha'}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={value}
                        onSelect={onChange}
                        disabled={min ? (d: Date) => d <= min : undefined}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-indigo-500" />
                        Alquilar el hotel completo
                    </DialogTitle>
                    <DialogDescription>
                        El hotel queda cerrado para el resto durante todo el período, usen o no
                        todas las habitaciones.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-3">
                        <DateField label="Desde" value={from} onChange={setFrom} />
                        <DateField label="Hasta" value={to} onChange={setTo} min={from} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="fh-guest">A nombre de</Label>
                        <select
                            id="fh-guest"
                            value={guestId}
                            onChange={e => setGuestId(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="">Elegí el cliente…</option>
                            {guests.map(g => (
                                <option key={g.id} value={g.id}>{g.fullName}</option>
                            ))}
                        </select>
                        <p className="text-xs text-muted-foreground">
                            El equipo, la empresa o quien contrata. Si no está, cargalo desde Huéspedes.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="fh-amount">Monto total acordado</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                                id="fh-amount"
                                inputMode="decimal"
                                className="pl-7 tabular-nums"
                                value={amountText}
                                onChange={e => setAmountText(parsePesosInput(e.target.value).display)}
                            />
                        </div>
                        {nights > 0 && amount > 0 && (
                            <p className="text-xs text-muted-foreground">
                                {nights} noche{nights > 1 ? 's' : ''} · equivale a $
                                {Math.round(amount / nights).toLocaleString('es-AR')} por noche
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="fh-notes">Notas (opcional)</Label>
                        <Textarea
                            id="fh-notes"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Contacto, cantidad de personas, condiciones..."
                            rows={2}
                        />
                    </div>

                    {conflicts.length > 0 && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-sm text-rose-800 dark:text-rose-200">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                                <p className="font-semibold">
                                    Hay {conflicts.length} reserva{conflicts.length > 1 ? 's' : ''} en esas fechas
                                </p>
                                <p className="text-[13px] leading-snug opacity-90">
                                    No se puede cerrar el hotel por arriba de algo que ya se prometió.
                                    Cancelalas o movelas antes.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Alquilar el hotel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
