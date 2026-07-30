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
  FormDescription,
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
import { cn, formatLastNameFirst, guestsLabel } from '@/lib/utils';
import { useRates } from '@/hooks/useRates';
import {
  getBookingPricing,
  selectableTiers,
  describeDownTier,
  bookingDiscountRatio,
  resolveEditedTotal,
} from '@/lib/occupancyPricing';
import { toast } from '@/hooks/use-toast';

/** Ver la nota en NewBookingDialog: centinela de "la que corresponda por ocupación". */
const TARIFA_AUTOMATICA = 'auto';

const editBookingSchema = z.object({
  checkInDate: z.date({ required_error: 'Fecha de check-in requerida' }),
  checkOutDate: z.date({ required_error: 'Fecha de check-out requerida' }),
  roomId: z.string().min(1, 'Selecciona una habitación'),
  adults: z.coerce.number().min(1, 'Mínimo 1 adulto'),
  children: z.coerce.number().min(0),
  infants: z.coerce.number().min(0),
  estimatedArrivalTime: z.string().optional(),
  notes: z.string().optional(),
  pricingRoomTypeId: z.string().optional(),
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
  const { rooms, roomTypes, updateRoomStatus } = useRoomOperations();
  const { data: rates = [] } = useRates();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCheckedIn = booking.status === 'CHECKED_IN';

  const form = useForm<EditBookingFormData>({
    resolver: zodResolver(editBookingSchema),
    defaultValues: {
      checkInDate: new Date(booking.checkInDate),
      checkOutDate: new Date(booking.checkOutDate),
      roomId: booking.roomId,
      adults: booking.adults,
      children: booking.children,
      infants: booking.infants ?? 0,
      estimatedArrivalTime: booking.estimatedArrivalTime || '',
      notes: booking.notes || '',
      pricingRoomTypeId: booking.pricingRoomTypeId || TARIFA_AUTOMATICA,
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
        infants: booking.infants ?? 0,
        estimatedArrivalTime: booking.estimatedArrivalTime || '',
        notes: booking.notes || '',
        pricingRoomTypeId: booking.pricingRoomTypeId || TARIFA_AUTOMATICA,
      });
    }
  }, [open, booking, form]);

  const watchedRoomId = form.watch('roomId');
  const watchedCheckIn = form.watch('checkInDate');
  const watchedCheckOut = form.watch('checkOutDate');
  // watch() returns the raw input value, and type="number" inputs hand back a
  // string. z.coerce.number() only runs at validation, so without Number() here
  // "2" + "0" concatenates into "20", and "2" !== 2 marks Adultos as changed
  // on every render.
  const watchedAdults = Number(form.watch('adults')) || 0;
  const watchedChildren = Number(form.watch('children')) || 0;
  const watchedInfants = Number(form.watch('infants')) || 0;
  const watchedNotes = form.watch('notes');
  const watchedArrival = form.watch('estimatedArrivalTime');
  const watchedPricingTypeId = form.watch('pricingRoomTypeId');

  const selectedRoom = rooms.find(r => r.id === watchedRoomId);
  const selectedRoomType = selectedRoom ? roomTypes.find(rt => rt.id === selectedRoom.roomTypeId) : null;

  const nights = watchedCheckIn && watchedCheckOut
    ? differenceInDays(watchedCheckOut, watchedCheckIn)
    : 0;

  const originalNights = differenceInDays(
    new Date(booking.checkOutDate),
    new Date(booking.checkInDate)
  );

  // El precio sale del tramo que corresponde a la gente que entra, no del tipo
  // de la habitación. Los menores de 5 no cuentan. Si recepción eligió una
  // tarifa a mano —acá o al tomar la reserva— manda esa y no se recalcula.
  const tierOptions = selectableTiers(roomTypes, selectedRoomType);
  const chosenPricingTypeId =
    watchedPricingTypeId &&
    watchedPricingTypeId !== TARIFA_AUTOMATICA &&
    tierOptions.some(rt => rt.id === watchedPricingTypeId)
      ? watchedPricingTypeId
      : null;
  const occupancyPricing = getBookingPricing(
    roomTypes,
    selectedRoomType,
    { adults: watchedAdults, children: watchedChildren },
    chosenPricingTypeId
  );

  // El tramo con el que se tomó la reserva, en la habitación con la que se tomó.
  // Es el punto de comparación: sin esto no hay contra qué correr lo pactado.
  const bookedRoom = rooms.find(r => r.id === booking.roomId);
  const bookedRoomType = bookedRoom ? roomTypes.find(rt => rt.id === bookedRoom.roomTypeId) : null;
  const bookedPricing = getBookingPricing(
    roomTypes,
    bookedRoomType,
    { adults: booking.adults, children: booking.children },
    booking.pricingRoomTypeId
  );

  // La promoción de la reserva, para reaplicarla sobre el tramo nuevo en vez de
  // escalarla por proporción. Mismo criterio que el check-in.
  const promo = booking.rateId ? rates.find(r => r.id === booking.rateId) ?? null : null;

  // La tarifa especial es un precio por noche pactado con el cliente: no sale de
  // ningún tramo, así que cambiar de habitación no la mueve.
  const isSpecialRate = booking.specialRateAmount != null;
  const specialRateNightly = isSpecialRate ? booking.specialRateAmount! : null;

  const datesChanged =
    (!!watchedCheckIn && format(watchedCheckIn, 'yyyy-MM-dd') !== format(new Date(booking.checkInDate), 'yyyy-MM-dd')) ||
    (!!watchedCheckOut && format(watchedCheckOut, 'yyyy-MM-dd') !== format(new Date(booking.checkOutDate), 'yyyy-MM-dd'));

  // Qué toca la plata y qué no. Los menores de 5 no se cobran, y las notas y la
  // hora de llegada tampoco: corregir una nota no tiene por qué repreciar nada.
  const pricingChanged =
    watchedRoomId !== booking.roomId ||
    datesChanged ||
    watchedAdults !== booking.adults ||
    watchedChildren !== booking.children ||
    (chosenPricingTypeId ?? null) !== (booking.pricingRoomTypeId ?? null);

  /**
   * Antes esto era `noches × precio de tramo`, que le devolvía el precio de
   * lista al huésped que había reservado con promoción: abrir el diálogo de una
   * reserva de $144.000 con 10% off ya proponía $160.000 sin que nadie tocara
   * nada. Ahora se respeta lo pactado, y si no cambió nada que afecte al precio
   * ni siquiera se recalcula.
   */
  const newTotalAmount = !pricingChanged
    ? booking.totalAmount
    : occupancyPricing && bookedPricing
      ? resolveEditedTotal({
          agreedTotal: booking.totalAmount,
          agreedNights: originalNights,
          nights,
          tierNightly: occupancyPricing.nightlyPrice,
          bookedTierNightly: bookedPricing.nightlyPrice,
          specialRateNightly,
          promo,
          discountRatio: bookingDiscountRatio(booking),
        })
      : booking.totalAmount;

  /** Lo que se cobra por noche de verdad, ya con la promo o la tarifa especial. */
  const effectiveNightly = nights > 0 ? Math.round(newTotalAmount / nights) : 0;

  /** Si esta reserva trae un descuento que hay que preservar, para decirlo. */
  const keepsPromo = !!promo || bookingDiscountRatio(booking) > 0;

  // Check room availability (exclude current booking)
  const conflicts = watchedRoomId && watchedCheckIn && watchedCheckOut
    ? checkRoomAvailability(watchedRoomId, watchedCheckIn, watchedCheckOut, booking.id)
    : { available: true, conflicts: [] };

  // Available rooms: exclude maintenance always, and include the booking's current room.
  // For CHECKED_IN: also exclude OCCUPIED rooms (physically occupied by another guest right now).
  const availableRooms = rooms.filter(r => {
    if (r.id === booking.roomId) return true;
    if (r.status === 'MAINTENANCE') return false;
    if (isCheckedIn && r.status === 'OCCUPIED') return false;
    return true;
  });

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

    if (watchedChildren !== booking.children) {
      diffs.push({
        label: 'Niños (5+)',
        from: String(booking.children),
        to: String(watchedChildren),
      });
    }

    if (watchedInfants !== (booking.infants ?? 0)) {
      diffs.push({
        label: 'Menores de 5',
        from: String(booking.infants ?? 0),
        to: String(watchedInfants),
      });
    }

    if ((watchedNotes || '') !== (booking.notes || '')) {
      diffs.push({
        label: 'Notas',
        from: booking.notes || '(vacío)',
        to: watchedNotes || '(vacío)',
      });
    }

    if ((watchedArrival || '') !== (booking.estimatedArrivalTime || '')) {
      diffs.push({
        label: 'Hora estimada de llegada',
        from: booking.estimatedArrivalTime ? `${booking.estimatedArrivalTime} hs` : '(sin definir)',
        to: watchedArrival ? `${watchedArrival} hs` : '(sin definir)',
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
  }, [watchedRoomId, watchedCheckIn, watchedCheckOut, watchedAdults, watchedChildren, watchedInfants, watchedNotes, watchedArrival, newTotalAmount, booking, rooms]);

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
        infants: data.infants,
        // '' (not undefined) so bookingToRow writes NULL and the hour can be cleared.
        estimatedArrivalTime: data.estimatedArrivalTime?.trim() || '',
        notes: data.notes,
        // Solo cuando hay algo que decir: '' borra una elección previa, pero
        // mandarlo en toda edición rompería las ediciones si el código llega
        // antes que la migración. Igual criterio que la promo al crear.
        ...(chosenPricingTypeId || booking.pricingRoomTypeId
          ? { pricingRoomTypeId: chosenPricingTypeId ?? '' }
          : {}),
        totalAmount: newTotalAmount,
      });

      // Si el huésped ya hizo check-in y se cambió de habitación, actualizar
      // el estado físico: la vieja queda sucia, la nueva pasa a ocupada.
      if (isCheckedIn && data.roomId !== booking.roomId) {
        await updateRoomStatus(booking.roomId, 'DIRTY');
        await updateRoomStatus(data.roomId, 'OCCUPIED');
      }

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
                            disabled={isCheckedIn}
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
                            disabled={isCheckedIn}
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

            {isCheckedIn && (
              <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md -mt-2">
                Las fechas no se pueden cambiar desde acá porque la estadía ya comenzó. Para agregar noches usá <strong>Extender estadía</strong>.
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

            {/* Guests count — los menores de 5 van aparte porque no se cobran */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                    <FormLabel>Niños (5+)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={10} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="infants"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Menores de 5</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={10} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Estimated arrival — the hour this guest announced, not the hotel policy */}
            <FormField
              control={form.control}
              name="estimatedArrivalTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hora estimada de llegada</FormLabel>
                  <FormControl>
                    <Input type="time" className="w-40" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Over capacity warning */}
            {/* Los menores de 5 no se cobran pero ocupan lugar: cuentan acá */}
            {selectedRoomType && (watchedAdults + watchedChildren + watchedInfants) > selectedRoomType.maxGuests && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  La capacidad máxima de esta habitación es de {guestsLabel(selectedRoomType.maxGuests)}.
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

            {/* La tarifa la propone la ocupación; el mostrador puede elegir otra.
                Con tarifa especial no se ofrece: el precio ya está pactado y no
                sale de ningún tramo. */}
            {!isSpecialRate && selectedRoomType && tierOptions.length > 1 && (
              <FormField
                control={form.control}
                name="pricingRoomTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarifa</FormLabel>
                    <Select value={chosenPricingTypeId ?? TARIFA_AUTOMATICA} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={TARIFA_AUTOMATICA}>Según la gente que entra</SelectItem>
                        {tierOptions.map(rt => (
                          <SelectItem key={rt.id} value={rt.id}>
                            {guestsLabel(rt.maxGuests)} — ${rt.basePrice.toLocaleString('es-AR')}/noche
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs">
                      Elegida a mano queda fija: el check-in no la recalcula.
                    </FormDescription>
                  </FormItem>
                )}
              />
            )}

            {/* Price recalculation */}
            {selectedRoomType && nights > 0 && (
              <div className="p-4 rounded-xl bg-background/60 backdrop-blur border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {isSpecialRate
                      ? 'Tarifa especial'
                      : `Tarifa ${guestsLabel(occupancyPricing?.pricingType.maxGuests ?? selectedRoomType.maxGuests)}`}
                    {' '}x {nights} noche{nights !== 1 ? 's' : ''}
                  </span>
                  {/* El precio por noche que se está cobrando de verdad. Antes
                      acá iba el del tramo, que en una reserva con promoción no
                      es lo que paga el huésped y no daba con el total de abajo. */}
                  <span className="font-medium">
                    ${effectiveNightly.toLocaleString('es-AR')} x {nights}
                  </span>
                </div>

                {isSpecialRate && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Precio pactado con el cliente: cambiar de habitación no lo mueve.
                  </p>
                )}
                {!isSpecialRate && keepsPromo && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Se mantiene la promoción{booking.promoLabel ? ` ${booking.promoLabel}` : ''} con la que se tomó la reserva.
                  </p>
                )}
                {!isSpecialRate && occupancyPricing?.isManual && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Tarifa elegida a mano: {guestsLabel(occupancyPricing.pricingType.maxGuests)}.
                  </p>
                )}
                {!isSpecialRate && !occupancyPricing?.isManual && occupancyPricing?.isDownTiered && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    {describeDownTier(occupancyPricing, selectedRoomType.maxGuests)}
                  </p>
                )}
                {watchedInfants > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {watchedInfants} menor{watchedInfants > 1 ? 'es' : ''} de 5 años sin cargo.
                  </p>
                )}
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
