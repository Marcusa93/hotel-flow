import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import type { BookingWithDetails } from '@/types/hotel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { cn, formatLastNameFirst } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const editBookingSchema = z.object({
  checkInDate: z.date({ required_error: 'Fecha de check-in requerida' }),
  checkOutDate: z.date({ required_error: 'Fecha de check-out requerida' }),
  roomId: z.string().min(1, 'Selecciona una habitación'),
  adults: z.coerce.number().min(1, 'Mínimo 1 adulto'),
  children: z.coerce.number().min(0),
  notes: z.string().optional(),
}).refine((data) => data.checkOutDate > data.checkInDate, {
  message: 'Check-out debe ser posterior a check-in',
  path: ['checkOutDate'],
});

type EditBookingFormData = z.infer<typeof editBookingSchema>;

interface EditBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: BookingWithDetails;
}

export function EditBookingDialog({ open, onOpenChange, booking }: EditBookingDialogProps) {
  const { updateBooking, checkRoomAvailability } = useBookingOperations();
  const { rooms, roomTypes } = useRoomOperations();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditBookingFormData>({
    resolver: zodResolver(editBookingSchema),
    defaultValues: {
      checkInDate: new Date(booking.checkInDate),
      checkOutDate: new Date(booking.checkOutDate),
      roomId: booking.roomId,
      adults: booking.adults,
      children: booking.children,
      notes: booking.notes || '',
    },
  });

  // Reset form when booking changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        checkInDate: new Date(booking.checkInDate),
        checkOutDate: new Date(booking.checkOutDate),
        roomId: booking.roomId,
        adults: booking.adults,
        children: booking.children,
        notes: booking.notes || '',
      });
    }
  }, [open, booking, form]);

  const watchedRoomId = form.watch('roomId');
  const watchedCheckIn = form.watch('checkInDate');
  const watchedCheckOut = form.watch('checkOutDate');
  const watchedAdults = form.watch('adults');
  const watchedChildren = form.watch('children');
  const watchedNotes = form.watch('notes');

  const selectedRoom = rooms.find(r => r.id === watchedRoomId);
  const selectedRoomType = selectedRoom ? roomTypes.find(rt => rt.id === selectedRoom.roomTypeId) : null;

  const nights = watchedCheckIn && watchedCheckOut
    ? differenceInDays(watchedCheckOut, watchedCheckIn)
    : 0;

  const originalNights = differenceInDays(
    new Date(booking.checkOutDate),
    new Date(booking.checkInDate)
  );

  // Calculate new total amount
  const newTotalAmount = selectedRoomType ? nights * selectedRoomType.basePrice : 0;

  // Check room availability (exclude current booking)
  const conflicts = watchedRoomId && watchedCheckIn && watchedCheckOut
    ? checkRoomAvailability(watchedRoomId, watchedCheckIn, watchedCheckOut, booking.id)
    : { available: true, conflicts: [] };

  // Available rooms: exclude only rooms in maintenance (today's physical status
  // says nothing about future dates — the conflict check handles availability),
  // and always include the booking's current room.
  const availableRooms = rooms.filter(r =>
    r.status !== 'MAINTENANCE' || r.id === booking.roomId
  );

  // Detect changes for diff display
  const changes = useMemo(() => {
    const diffs: { label: string; from: string; to: string }[] = [];

    if (watchedRoomId !== booking.roomId) {
      const oldRoom = rooms.find(r => r.id === booking.roomId);
      const newRoom = rooms.find(r => r.id === watchedRoomId);
      diffs.push({
        label: 'Habitación',
        from: oldRoom?.roomNumber || '',
        to: newRoom?.roomNumber || '',
      });
    }

    if (watchedCheckIn && format(watchedCheckIn, 'yyyy-MM-dd') !== format(new Date(booking.checkInDate), 'yyyy-MM-dd')) {
      diffs.push({
        label: 'Check-in',
        from: format(new Date(booking.checkInDate), 'd MMM yyyy', { locale: es }),
        to: format(watchedCheckIn, 'd MMM yyyy', { locale: es }),
      });
    }

    if (watchedCheckOut && format(watchedCheckOut, 'yyyy-MM-dd') !== format(new Date(booking.checkOutDate), 'yyyy-MM-dd')) {
      diffs.push({
        label: 'Check-out',
        from: format(new Date(booking.checkOutDate), 'd MMM yyyy', { locale: es }),
        to: format(watchedCheckOut, 'd MMM yyyy', { locale: es }),
      });
    }

    if (watchedAdults !== booking.adults) {
      diffs.push({
        label: 'Adultos',
        from: String(booking.adults),
        to: String(watchedAdults),
      });
    }

    if ((watchedChildren || 0) !== booking.children) {
      diffs.push({
        label: 'Niños',
        from: String(booking.children),
        to: String(watchedChildren || 0),
      });
    }

    if ((watchedNotes || '') !== (booking.notes || '')) {
      diffs.push({
        label: 'Notas',
        from: booking.notes || '(vacío)',
        to: watchedNotes || '(vacío)',
      });
    }

    if (newTotalAmount !== booking.totalAmount) {
      diffs.push({
        label: 'Monto total',
        from: `$${booking.totalAmount.toLocaleString('es-AR')}`,
        to: `$${newTotalAmount.toLocaleString('es-AR')}`,
      });
    }

    return diffs;
  }, [watchedRoomId, watchedCheckIn, watchedCheckOut, watchedAdults, watchedChildren, watchedNotes, newTotalAmount, booking, rooms]);

  const hasChanges = changes.length > 0;

  const onSubmit = async (data: EditBookingFormData) => {
    if (!conflicts.available) {
      toast({
        title: 'Conflicto de disponibilidad',
        description: 'La habitación no está disponible para las fechas seleccionadas.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateBooking(booking.id, {
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
        roomId: data.roomId,
        adults: data.adults,
        children: data.children,
        notes: data.notes,
        totalAmount: newTotalAmount,
      });

      toast({
        title: 'Reserva actualizada',
        description: `La reserva de ${formatLastNameFirst(booking.guest.fullName)} fue modificada correctamente.`,
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error al actualizar',
        description: 'No se pudo guardar los cambios. Intentá nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Reserva</DialogTitle>
          <DialogDescription>
            Modificar reserva de <strong>{formatLastNameFirst(booking.guest.fullName)}</strong> — #{booking.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="checkInDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de entrada</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? format(field.value, 'PPP', { locale: es }) : 'Seleccionar'}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          locale={es}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="checkOutDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de salida</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? format(field.value, 'PPP', { locale: es }) : 'Seleccionar'}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => watchedCheckIn ? date <= watchedCheckIn : false}
                          locale={es}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {nights > 0 && (
              <p className="text-sm text-muted-foreground -mt-2">
                {nights} noche{nights !== 1 ? 's' : ''}
                {nights !== originalNights && (
                  <span className="text-primary font-medium ml-1">(antes: {originalNights})</span>
                )}
              </p>
            )}

            {/* Room */}
            <FormField
              control={form.control}
              name="roomId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Habitación</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar habitación" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableRooms.map((room) => {
                        const rt = roomTypes.find(t => t.id === room.roomTypeId);
                        return (
                          <SelectItem key={room.id} value={room.id}>
                            Hab. {room.roomNumber} — {rt?.name || 'Sin tipo'} — ${rt?.basePrice.toLocaleString('es-AR') || 0}/noche
                            {room.id === booking.roomId ? ' (actual)' : ''}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Conflict warning */}
            {!conflicts.available && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Esta habitación tiene {conflicts.conflicts.length} reserva{conflicts.conflicts.length > 1 ? 's' : ''} que se superpone{conflicts.conflicts.length > 1 ? 'n' : ''} con las fechas seleccionadas.
                </span>
              </div>
            )}

            {/* Guests count */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="adults"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adultos</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={10} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="children"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Niños</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={10} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Over capacity warning */}
            {selectedRoomType && (watchedAdults + (watchedChildren || 0)) > selectedRoomType.maxGuests && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  La capacidad máxima de esta habitación es de {selectedRoomType.maxGuests} persona{selectedRoomType.maxGuests > 1 ? 's' : ''}.
                </span>
              </div>
            )}

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notas o requerimientos especiales..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Price recalculation */}
            {selectedRoomType && nights > 0 && (
              <div className="p-4 rounded-xl bg-background/60 backdrop-blur border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {selectedRoomType.name} x {nights} noche{nights !== 1 ? 's' : ''}
                  </span>
                  <span className="font-medium">
                    ${selectedRoomType.basePrice.toLocaleString('es-AR')} x {nights}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className={cn(
                    newTotalAmount !== booking.totalAmount && 'text-primary'
                  )}>
                    ${newTotalAmount.toLocaleString('es-AR')}
                  </span>
                </div>
                {newTotalAmount !== booking.totalAmount && (
                  <p className="text-xs text-muted-foreground">
                    Antes: ${booking.totalAmount.toLocaleString('es-AR')}
                    {newTotalAmount > booking.totalAmount
                      ? ` (+$${(newTotalAmount - booking.totalAmount).toLocaleString('es-AR')})`
                      : ` (-$${(booking.totalAmount - newTotalAmount).toLocaleString('es-AR')})`
                    }
                  </p>
                )}
              </div>
            )}

            {/* Changes diff */}
            {hasChanges && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                  Cambios a aplicar
                </p>
                {changes.map((change, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground w-24 shrink-0 font-medium">{change.label}</span>
                    <span className="text-muted-foreground/70 truncate max-w-[120px]">{change.from}</span>
                    <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                    <span className="font-medium truncate max-w-[120px]">{change.to}</span>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !hasChanges || !conflicts.available}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
