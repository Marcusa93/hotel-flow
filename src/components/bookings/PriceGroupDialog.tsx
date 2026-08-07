import { useMemo, useState } from 'react';
import { differenceInDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Tag } from 'lucide-react';
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
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { usePriceBookingGroup } from '@/hooks/useBookingGroups';
import { useAppRole } from '@/context/AppRoleContext';
import { bookingsOfGroup, splitGroupAmount } from '@/lib/bookingGroup';
import { formatPesosInput, parsePesosInput } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { BookingGroup } from '@/types/hotel';

interface PriceGroupDialogProps {
    group: BookingGroup | null;
    onOpenChange: (open: boolean) => void;
}

const money = (n: number) => `$${n.toLocaleString('es-AR')}`;

/**
 * Ponerle el precio a una reserva masiva. Solo administración.
 *
 * El monto es lo acordado por el paquete entero, y el sistema lo reparte entre
 * las habitaciones: cada reserva necesita su parte para que el saldo del huésped
 * y la facturación sigan funcionando como en cualquier otra.
 *
 * El reparto se muestra antes de guardar. Quien tarifa está cerrando un trato y
 * tiene que poder ver en qué queda cada habitación sin tener que dividir de
 * cabeza.
 */
export function PriceGroupDialog({ group, onOpenChange }: PriceGroupDialogProps) {
    const { bookings } = useBookingOperations();
    const { guests } = useGuestOperations();
    const { rooms } = useRoomOperations();
    const { profileName } = useAppRole();
    const priceGroup = usePriceBookingGroup();

    const [amountText, setAmountText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const amount = parsePesosInput(amountText).value;
    const grupoBookings = useMemo(
        () => (group ? bookingsOfGroup(bookings, group.id) : []),
        [bookings, group]
    );

    const partes = splitGroupAmount(amount, grupoBookings.length);
    const guest = guests.find(g => g.id === group?.guestId);
    const primera = grupoBookings[0];
    const noches = primera
        ? differenceInDays(new Date(primera.checkOutDate), new Date(primera.checkInDate))
        : 0;

    // El orden tiene que ser el mismo con el que reparte la base, o el detalle
    // que se muestra acá no es el que se va a guardar.
    const ordenadas = useMemo(
        () =>
            [...grupoBookings].sort(
                (a, b) =>
                    a.roomId.localeCompare(b.roomId) ||
                    new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime() ||
                    a.id.localeCompare(b.id)
            ),
        [grupoBookings]
    );

    const handleSubmit = async () => {
        if (!group || amount <= 0) return;
        setIsSubmitting(true);
        try {
            await priceGroup.mutateAsync({
                groupId: group.id,
                total: amount,
                byName: profileName || undefined,
            });
            toast({
                title: 'Reserva masiva tarifada',
                description: `${money(amount)} repartidos entre ${grupoBookings.length} habitaciones`,
            });
            setAmountText('');
            onOpenChange(false);
        } catch (error) {
            toast({
                title: 'No se pudo tarifar',
                description: error instanceof Error ? error.message : 'Intentá de nuevo.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={!!group} onOpenChange={(next) => { if (!next) setAmountText(''); onOpenChange(next); }}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Tag className="w-5 h-5 text-indigo-500" />
                        Ponerle precio a la reserva masiva
                    </DialogTitle>
                    <DialogDescription>
                        {guest?.fullName ?? 'Grupo'}
                        {primera && (
                            <>
                                {' · '}
                                {format(new Date(primera.checkInDate), 'd MMM', { locale: es })} al{' '}
                                {format(new Date(primera.checkOutDate), 'd MMM', { locale: es })}
                                {noches > 0 && ` · ${noches} noche${noches > 1 ? 's' : ''}`}
                            </>
                        )}
                        {' · '}
                        {grupoBookings.length} habitación{grupoBookings.length > 1 ? 'es' : ''}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="pg-amount">Monto total acordado</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                                id="pg-amount"
                                inputMode="decimal"
                                className="pl-7 tabular-nums"
                                value={amountText}
                                onChange={e => setAmountText(parsePesosInput(e.target.value).display)}
                                onBlur={() => amount > 0 && setAmountText(formatPesosInput(amount))}
                            />
                        </div>
                        {amount > 0 && noches > 0 && (
                            <p className="text-xs text-muted-foreground">
                                Equivale a {money(Math.round(amount / noches))} por noche
                                {grupoBookings.length > 0 && (
                                    <>, o {money(Math.round(amount / noches / grupoBookings.length))} por
                                    habitación por noche</>
                                )}
                            </p>
                        )}
                    </div>

                    {amount > 0 && ordenadas.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                                Cómo queda repartido
                            </p>
                            {ordenadas.map((b, i) => {
                                const room = rooms.find(r => r.id === b.roomId);
                                return (
                                    <div
                                        key={b.id}
                                        className="flex justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"
                                    >
                                        <span className="text-muted-foreground font-mono">
                                            Hab. {room?.roomNumber ?? '?'}
                                        </span>
                                        <span className="font-medium tabular-nums">{money(partes[i] ?? 0)}</span>
                                    </div>
                                );
                            })}
                            <div className="flex justify-between pt-2 border-t font-bold">
                                <span>Total</span>
                                <span className="tabular-nums">{money(amount)}</span>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={amount <= 0 || isSubmitting || !grupoBookings.length}>
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Guardar precio
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
