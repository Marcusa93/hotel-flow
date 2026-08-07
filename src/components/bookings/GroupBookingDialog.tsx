import { useMemo, useState } from 'react';
import { differenceInDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, CalendarIcon, Loader2, Users } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useCreateBookingGroup } from '@/hooks/useBookingGroups';
import { useAppRole } from '@/context/AppRoleContext';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface GroupBookingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Reserva masiva: un contingente que toma varias habitaciones.
 *
 * Se diferencia del alquiler del hotel completo en dos cosas. No cierra el
 * hotel: lo que el grupo no toma se sigue vendiendo. Y nace SIN precio, porque
 * el precio de un grupo se negocia y lo cierra administración — recepción arma
 * la reserva y el monto llega después.
 *
 * Cada habitación se guarda como una reserva normal, unidas por el grupo. Así el
 * contingente puede llegar de a poco y hacer check-in cuarto por cuarto, y
 * limpieza ve lo de siempre.
 */
export function GroupBookingDialog({ open, onOpenChange }: GroupBookingDialogProps) {
    const { addBooking, checkRoomAvailability } = useBookingOperations();
    const { guests } = useGuestOperations();
    const { rooms, roomTypes } = useRoomOperations();
    const { profileName } = useAppRole();
    const { user } = useAuth();
    const createGroup = useCreateBookingGroup();

    const [from, setFrom] = useState<Date | undefined>();
    const [to, setTo] = useState<Date | undefined>();
    const [guestId, setGuestId] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const nights = from && to ? differenceInDays(to, from) : 0;

    /**
     * Qué habitaciones se pueden tomar en esas fechas.
     *
     * Se calcula acá y no al guardar: elegir seis habitaciones para que la
     * cuarta rebote es hacer perder el trabajo de cargar todas. El trigger de la
     * base rechaza igual lo que se le escape.
     */
    const disponibilidad = useMemo(() => {
        if (!from || !to || nights <= 0) return null;
        return rooms.map(room => ({
            room,
            tipo: roomTypes.find(rt => rt.id === room.roomTypeId)?.name ?? '',
            libre: checkRoomAvailability(room.id, from, to).available,
        }));
    }, [rooms, roomTypes, from, to, nights, checkRoomAvailability]);

    const libres = disponibilidad?.filter(d => d.libre) ?? [];
    const ocupadas = disponibilidad?.filter(d => !d.libre) ?? [];

    const canSubmit = !!from && !!to && nights > 0 && !!guestId && selected.size > 0;

    const reset = () => {
        setFrom(undefined);
        setTo(undefined);
        setGuestId('');
        setSelected(new Set());
        setNotes('');
    };

    const toggle = (roomId: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(roomId)) next.delete(roomId);
            else next.add(roomId);
            return next;
        });
    };

    const handleSubmit = async () => {
        if (!canSubmit) return;
        setIsSubmitting(true);

        const roomIds = [...selected];
        const creadas: string[] = [];

        try {
            const group = await createGroup.mutateAsync({
                guestId,
                notes: notes.trim() || undefined,
                createdBy: user?.id,
                createdByName: profileName || user?.email || undefined,
            });

            // De a una: el trigger que evita el overbooking trabaja por reserva.
            for (const roomId of roomIds) {
                await addBooking({
                    guestId,
                    roomId,
                    checkInDate: from!,
                    checkOutDate: to!,
                    adults: 1,
                    children: 0,
                    infants: 0,
                    status: 'CONFIRMED',
                    // Sin precio: lo pone administración y se reparte entre las
                    // habitaciones. Hasta entonces el grupo figura "a tarifar".
                    totalAmount: 0,
                    groupId: group.id,
                    notes: notes.trim() || undefined,
                    receptionist: profileName || undefined,
                });
                creadas.push(roomId);
            }

            toast({
                title: 'Reserva masiva creada',
                description: `${roomIds.length} habitaciones · falta que administración le ponga el precio`,
            });
            reset();
            onOpenChange(false);
        } catch (error) {
            // Si se cortó en el medio, decir cuántas quedaron: el grupo existe y
            // las que entraron son reservas de verdad. Borrarlas por las dudas
            // sería peor —se perderían las que sí estaban bien— así que se avisa
            // y quien está adelante decide.
            const hechas = creadas.length;
            toast({
                title: hechas > 0 ? `Se cargaron ${hechas} de ${roomIds.length}` : 'No se pudo crear',
                description:
                    (error instanceof Error ? error.message : 'Intentá de nuevo.') +
                    (hechas > 0 ? ' Las que faltan se pueden agregar como reservas sueltas.' : ''),
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
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-500" />
                        Reserva masiva
                    </DialogTitle>
                    <DialogDescription>
                        Varias habitaciones para un mismo grupo. Las que no tome el contingente se
                        siguen vendiendo.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-3">
                        <DateField label="Desde" value={from} onChange={setFrom} />
                        <DateField label="Hasta" value={to} onChange={setTo} min={from} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="gb-guest">A nombre de</Label>
                        <select
                            id="gb-guest"
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

                    {/* Habitaciones */}
                    <div className="space-y-2">
                        <div className="flex items-baseline justify-between">
                            <Label>Habitaciones</Label>
                            {selected.size > 0 && (
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {selected.size} elegida{selected.size > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>

                        {!disponibilidad ? (
                            <p className="text-sm text-muted-foreground py-3">
                                Elegí las fechas y acá aparecen las habitaciones libres.
                            </p>
                        ) : libres.length === 0 ? (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-sm text-rose-800 dark:text-rose-200">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>No hay ninguna habitación libre en esas fechas.</span>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {libres.map(({ room, tipo }) => {
                                        const on = selected.has(room.id);
                                        return (
                                            <button
                                                key={room.id}
                                                type="button"
                                                onClick={() => toggle(room.id)}
                                                aria-pressed={on}
                                                className={cn(
                                                    'rounded-xl border px-3 py-2 text-left transition-colors',
                                                    on
                                                        ? 'border-primary bg-primary/10 font-semibold'
                                                        : 'border-border hover:bg-muted/60'
                                                )}
                                            >
                                                <span className="block font-mono text-sm">{room.roomNumber}</span>
                                                <span className="block text-[11px] text-muted-foreground truncate">{tipo}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {ocupadas.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        {ocupadas.length} habitación{ocupadas.length > 1 ? 'es' : ''} ya
                                        {ocupadas.length > 1 ? ' están ocupadas' : ' está ocupada'} en esas fechas:{' '}
                                        {ocupadas.map(o => o.room.roomNumber).join(', ')}
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="gb-notes">Notas (opcional)</Label>
                        <Textarea
                            id="gb-notes"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Contacto, cantidad de personas, condiciones acordadas..."
                            rows={2}
                        />
                    </div>

                    {/* El precio no se pone acá y conviene decirlo antes de guardar,
                        no después: quien carga esto espera un campo de monto. */}
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <p className="font-semibold">El precio lo pone administración</p>
                            <p className="text-[13px] leading-snug opacity-90">
                                La reserva queda marcada <strong>a tarifar</strong> hasta que le carguen
                                el monto. El grupo puede llegar y hacer check-in igual.
                                {nights > 0 && selected.size > 0 && (
                                    <> Son {selected.size} habitación{selected.size > 1 ? 'es' : ''} por {nights} noche{nights > 1 ? 's' : ''}.</>
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Crear reserva masiva
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
