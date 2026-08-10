import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, AlertTriangle, Loader2, ArrowRight, Wallet } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn, formatLastNameFirst, guestsLabel, formatPesosInput, parsePesosInput } from '@/lib/utils';
import { useAppRole } from '@/context/AppRoleContext';
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
  /** No se edita: viaja en el formulario para que la validación de fechas sepa
   *  que en una media estadía entrada y salida son el mismo día. */
  isHalfDay: z.boolean().optional(),
}).refine(
  (data) => data.isHalfDay
    ? data.checkOutDate.getTime() === data.checkInDate.getTime()
    : data.checkOutDate > data.checkInDate,
  {
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
  const { currentRole } = useAppRole();
  const isAdmin = currentRole === 'admin';
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Precio a mano: solo administración. Escribe el total de la estadía que quiera
   * y ese manda por sobre lo que salga por ocupación. Se guarda por el canal de
   * la tarifa especial —un precio por noche pactado— porque es el único que el
   * resto del sistema respeta y no recalcula: check-in, corregir ocupación y las
   * ediciones siguientes lo dejan quieto. La base, además, ya prohíbe por trigger
   * que alguien que no sea admin toque la tarifa especial.
   */
  const [manualPriceEnabled, setManualPriceEnabled] = useState(false);
  const [manualPriceText, setManualPriceText] = useState('');

  const isCheckedIn = booking.status === 'CHECKED_IN';
  /**
   * Media estadía. Las fechas quedan fijas: entra y sale el mismo día, y el
   * CHECK de la base lo exige. Convertirla en una estadía normal —o al revés—
   * es otra reserva, no una edición.
   */
  const isHalfDay = booking.isHalfDay === true;
  /**
   * Con el pasajero ya adentro la entrada sí se corrige —entró pasada la
   * medianoche y quedó cargado al día siguiente— pero la salida no se elige a
   * mano: se corre sola con la entrada, más abajo. Estirar la estadía sigue
   * siendo trabajo de Extender estadía, que cobra las noches nuevas como cargo
   * aparte en vez de repisar lo que se cotizó al reservar.
   */
  const checkInLocked = isHalfDay;
  const checkOutLocked = isCheckedIn || isHalfDay;

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
      isHalfDay: booking.isHalfDay === true,
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
        isHalfDay: booking.isHalfDay === true,
      });
      // El precio a mano arranca apagado cada vez: es una decisión puntual de
      // esta edición, no un estado que arrastrar de la reserva anterior.
      setManualPriceEnabled(false);
      setManualPriceText('');
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

  /**
   * Con la estadía empezada, mover la entrada corre la salida los mismos días.
   *
   * El caso es el pasajero que entra pasada la medianoche: el sistema lo carga
   * con la entrada del día que recién arranca y la salida un día más allá, así
   * que la estadía entera quedó corrida. Lo que está mal es dónde cae, no
   * cuánto dura — por eso se mueven las dos juntas y las noches no cambian.
   */
  useEffect(() => {
    if (!isCheckedIn || isHalfDay || !watchedCheckIn) return;
    const shifted = addDays(watchedCheckIn, originalNights);
    if (!watchedCheckOut || format(shifted, 'yyyy-MM-dd') !== format(watchedCheckOut, 'yyyy-MM-dd')) {
      form.setValue('checkOutDate', shifted, { shouldValidate: true });
    }
  }, [isCheckedIn, isHalfDay, watchedCheckIn, watchedCheckOut, originalNights, form]);

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

  /**
   * De las fechas, lo único que mueve el precio es cuántas noches son: el total
   * se arma desde `nights` y en ningún lado mira en qué días caen. Corriendo la
   * estadía sin cambiarle la duración no hay nada que repreciar, y recalcular
   * igual no era inofensivo —el techo por tarifa de lista le bajaba el total a
   * la reserva que se había tomado por encima de la lista de hoy.
   */
  const nightsChanged = nights !== originalNights;

  // Qué toca la plata y qué no. Los menores de 5 no se cobran, y las notas y la
  // hora de llegada tampoco: corregir una nota no tiene por qué repreciar nada.
  const pricingChanged =
    watchedRoomId !== booking.roomId ||
    nightsChanged ||
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
          isHalfDay,
          promo,
          discountRatio: bookingDiscountRatio(booking),
        })
      : booking.totalAmount;

  /** Lo que se cobra por noche de verdad, ya con la promo o la tarifa especial. */
  const effectiveNightly = nights > 0 ? Math.round(newTotalAmount / nights) : 0;

  // El total que escribió administración a mano, si está usando esa opción.
  const manualTotal = Math.round(parsePesosInput(manualPriceText).value || 0);
  const useManualPrice = isAdmin && manualPriceEnabled;
  /**
   * El total que va a quedar guardado. Con el precio a mano manda ese; si no, el
   * que salió por ocupación/promo/tarifa. Este es el número que ve el resto del
   * diálogo —el diff, la caja de precio y el submit— para que todos digan lo mismo.
   */
  const finalTotalAmount = useManualPrice ? manualTotal : newTotalAmount;

  /**
   * El precio por noche que se guarda como tarifa especial cuando administración
   * pone el total a mano. Es lo que hace que el total quede pegado. En media
   * estadía no hay noches: se guarda el total tal cual (la tarifa especial no se
   * aplica a la media estadía, pero el total sí queda escrito).
   */
  const manualNightly = nights > 0 ? Math.round(manualTotal / nights) : manualTotal;

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

    if (finalTotalAmount !== booking.totalAmount) {
      diffs.push({
        label: 'Monto total',
        from: `$${booking.totalAmount.toLocaleString('es-AR')}`,
        to: `$${finalTotalAmount.toLocaleString('es-AR')}`,
      });
    }

    return diffs;
  }, [watchedRoomId, watchedCheckIn, watchedCheckOut, watchedAdults, watchedChildren, watchedInfants, watchedNotes, watchedArrival, finalTotalAmount, booking, rooms]);

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
        totalAmount: finalTotalAmount,
        // Precio a mano de administración: se graba como tarifa especial para que
        // quede pegado —el resto del sistema no recalcula un precio pactado— y con
        // un motivo, que en cero una reserva no genera deuda ni alerta y sin esto
        // no habría cómo auditarla. Solo cuando de verdad se usó la opción.
        ...(useManualPrice
          ? {
              specialRateAmount: manualNightly,
              specialRatePending: false,
              specialRateReason:
                booking.specialRateReason || 'Precio puesto a mano por administración',
            }
          : {}),
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
                            disabled={checkInLocked}
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
                            disabled={checkOutLocked}
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

            {isHalfDay ? (
              <p className="text-sm text-muted-foreground -mt-2">Media estadía</p>
            ) : nights > 0 && (
              <p className="text-sm text-muted-foreground -mt-2">
                {nights} noche{nights !== 1 ? 's' : ''}
                {nights !== originalNights && (
                  <span className="text-primary font-medium ml-1">(antes: {originalNights})</span>
                )}
              </p>
            )}

            {isHalfDay ? (
              <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md -mt-2">
                Es una <strong>media estadía</strong>: entra y sale el mismo día, así que las fechas
                no se cambian. Sí se puede cambiar la habitación y la tarifa.
              </p>
            ) : isCheckedIn && (
              <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md -mt-2">
                La estadía ya comenzó, así que se corrige el <strong>día de entrada</strong> —el
                pasajero que entró pasada la medianoche y quedó cargado al día siguiente— y la
                salida se corre igual: siguen siendo {originalNights} noche{originalNights !== 1 ? 's' : ''} y
                el precio no cambia. Para agregar noches usá <strong>Extender estadía</strong>.
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

            {/* Precio a mano — solo administración. Escribe el total que quiera y
                ese manda sobre la tarifa. Recepción no ve esto: la base, además,
                rechaza por trigger que le toque la tarifa especial. */}
            {isAdmin && (
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="manual-price" className="flex items-center gap-2 text-sm font-medium">
                      <Wallet className="w-4 h-4 text-violet-500" />
                      Poner el precio a mano
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      El total que escribas manda sobre la tarifa y queda pactado.
                    </p>
                  </div>
                  <Switch
                    id="manual-price"
                    checked={manualPriceEnabled}
                    onCheckedChange={(next) => {
                      setManualPriceEnabled(next);
                      // Al prenderlo arranca del total actual, para editar desde
                      // ahí y no desde cero —cero es un precio válido y no
                      // queremos guardarlo sin querer.
                      if (next) setManualPriceText(formatPesosInput(newTotalAmount));
                    }}
                  />
                </div>

                {manualPriceEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="manual-price-amount" className="text-xs">Total de la estadía</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">$</span>
                      <Input
                        id="manual-price-amount"
                        inputMode="decimal"
                        className="pl-7 tabular-nums"
                        placeholder="0"
                        value={manualPriceText}
                        onChange={(e) => setManualPriceText(parsePesosInput(e.target.value).display)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {nights > 0
                        ? `${nights} noche${nights !== 1 ? 's' : ''} · queda en $${manualNightly.toLocaleString('es-AR')}/noche`
                        : 'Media estadía'}
                      {manualTotal === 0 && ' · en cero la estadía no se cobra'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Price recalculation */}
            {selectedRoomType && (nights > 0 || isHalfDay) && (
              <div className="p-4 rounded-xl bg-background/60 backdrop-blur border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {useManualPrice
                      ? `Precio a mano${!isHalfDay ? ` x ${nights} noche${nights !== 1 ? 's' : ''}` : ''}`
                      : isHalfDay
                        ? `Media estadía — 50% de ${guestsLabel(occupancyPricing?.pricingType.maxGuests ?? selectedRoomType.maxGuests)}`
                        : isSpecialRate
                          ? `Tarifa especial${booking.specialRateReason ? ` — ${booking.specialRateReason}` : ''}`
                          : `Tarifa ${guestsLabel(occupancyPricing?.pricingType.maxGuests ?? selectedRoomType.maxGuests)}` +
                            ` x ${nights} noche${nights !== 1 ? 's' : ''}`}
                  </span>
                  {/* El precio por noche que se está cobrando de verdad. Antes
                      acá iba el del tramo, que en una reserva con promoción no
                      es lo que paga el huésped y no daba con el total de abajo. */}
                  <span className="font-medium">
                    {useManualPrice
                      ? (isHalfDay ? `$${manualTotal.toLocaleString('es-AR')}` : `$${manualNightly.toLocaleString('es-AR')} x ${nights}`)
                      : isHalfDay
                        ? `$${(occupancyPricing?.nightlyPrice ?? 0).toLocaleString('es-AR')} / 2`
                        : `$${effectiveNightly.toLocaleString('es-AR')} x ${nights}`}
                  </span>
                </div>

                {isHalfDay && (
                  <p className="text-xs text-sky-600 dark:text-sky-400">
                    Sin pasar la noche. No toma promociones ni tarifa especial.
                  </p>
                )}

                {!isHalfDay && isSpecialRate && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Precio pactado con el cliente: cambiar de habitación no lo mueve.
                  </p>
                )}
                {!isHalfDay && !isSpecialRate && keepsPromo && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Se mantiene la promoción{booking.promoLabel ? ` ${booking.promoLabel}` : ''} con la que se tomó la reserva.
                  </p>
                )}
                {!isHalfDay && !isSpecialRate && occupancyPricing?.isManual && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Tarifa elegida a mano: {guestsLabel(occupancyPricing.pricingType.maxGuests)}.
                  </p>
                )}
                {!isHalfDay && !isSpecialRate && !occupancyPricing?.isManual && occupancyPricing?.isDownTiered && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    {describeDownTier(occupancyPricing, selectedRoomType.maxGuests)}
                  </p>
                )}
                {watchedInfants > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {watchedInfants} menor{watchedInfants > 1 ? 'es' : ''} de 5 años sin cargo.
                  </p>
                )}
                {useManualPrice && (
                  <p className="text-xs text-violet-600 dark:text-violet-400">
                    Precio puesto a mano por administración: manda sobre la tarifa.
                  </p>
                )}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className={cn(
                    finalTotalAmount !== booking.totalAmount && 'text-primary'
                  )}>
                    ${finalTotalAmount.toLocaleString('es-AR')}
                  </span>
                </div>
                {finalTotalAmount !== booking.totalAmount && (
                  <p className="text-xs text-muted-foreground">
                    Antes: ${booking.totalAmount.toLocaleString('es-AR')}
                    {finalTotalAmount > booking.totalAmount
                      ? ` (+$${(finalTotalAmount - booking.totalAmount).toLocaleString('es-AR')})`
                      : ` (-$${(booking.totalAmount - finalTotalAmount).toLocaleString('es-AR')})`
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
