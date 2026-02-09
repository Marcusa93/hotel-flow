import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, differenceInDays, isWithinInterval, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, AlertTriangle, Users, Tag, Percent, Sparkles } from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { useRates } from '@/hooks/useRates';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Rate } from '@/types/hotel';

const bookingSchema = z.object({
  guestId: z.string().min(1, 'Selecciona un huésped'),
  roomId: z.string().min(1, 'Selecciona una habitación'),
  checkInDate: z.date({ required_error: 'Fecha de check-in requerida' }),
  checkOutDate: z.date({ required_error: 'Fecha de check-out requerida' }),
  adults: z.coerce.number().min(1, 'Mínimo 1 adulto'),
  children: z.coerce.number().min(0),
  notes: z.string().optional(),
  promoCode: z.string().optional(),
  confirmOverCapacity: z.boolean().optional(),
}).refine((data) => data.checkOutDate > data.checkInDate, {
  message: 'Check-out debe ser posterior a check-in',
  path: ['checkOutDate'],
});

type BookingFormData = z.infer<typeof bookingSchema>;

interface NewBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewBookingDialog({ open, onOpenChange }: NewBookingDialogProps) {
  const { guests, rooms, roomTypes, addBooking, checkRoomAvailability } = useHotel();
  const { data: rates = [] } = useRates();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<Rate | null>(null);

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      guestId: '',
      roomId: '',
      adults: 1,
      children: 0,
      notes: '',
      promoCode: '',
      confirmOverCapacity: false,
    },
  });

  const watchedRoomId = form.watch('roomId');
  const watchedAdults = form.watch('adults');
  const watchedChildren = form.watch('children');
  const watchedCheckIn = form.watch('checkInDate');
  const watchedCheckOut = form.watch('checkOutDate');

  const selectedRoom = rooms.find(r => r.id === watchedRoomId);
  const selectedRoomType = selectedRoom ? roomTypes.find(rt => rt.id === selectedRoom.roomTypeId) : null;

  const totalGuests = (watchedAdults || 0) + (watchedChildren || 0);
  const isOverCapacity = selectedRoomType && totalGuests > selectedRoomType.maxGuests;

  // Check for conflicts
  const conflicts = watchedRoomId && watchedCheckIn && watchedCheckOut
    ? checkRoomAvailability(watchedRoomId, watchedCheckIn, watchedCheckOut)
    : { available: true, conflicts: [] };

  const nights = watchedCheckIn && watchedCheckOut
    ? differenceInDays(watchedCheckOut, watchedCheckIn)
    : 0;

  // Find applicable promotions
  const applicablePromotions = useMemo(() => {
    if (!selectedRoom || !watchedCheckIn || !watchedCheckOut) return [];

    return rates.filter(rate => {
      if (!rate.isActive) return false;

      // Check if rate applies to this room type (null means all types)
      if (rate.roomTypeId && rate.roomTypeId !== selectedRoom.roomTypeId) return false;

      // Check date overlap
      const rateStart = startOfDay(new Date(rate.startDate));
      const rateEnd = startOfDay(new Date(rate.endDate));
      const checkIn = startOfDay(watchedCheckIn);

      const hasDateOverlap = checkIn >= rateStart && checkIn <= rateEnd;
      if (!hasDateOverlap) return false;

      // Check minimum nights
      if (rate.minNights && nights < rate.minNights) return false;

      return true;
    });
  }, [rates, selectedRoom, watchedCheckIn, watchedCheckOut, nights]);

  // Best automatic promotion (lowest price, no code required)
  const bestAutoPromo = useMemo(() => {
    const autoPromos = applicablePromotions.filter(p => !p.promoCode);
    if (autoPromos.length === 0) return null;
    return autoPromos.reduce((best, current) =>
      current.price < best.price ? current : best
    );
  }, [applicablePromotions]);

  // Calculate pricing
  const basePrice = selectedRoomType?.basePrice || 0;
  const baseTotalAmount = nights * basePrice;

  // Determine effective price (considering promotions)
  const { effectivePrice, appliedPromo, savings } = useMemo(() => {
    let promo: Rate | null = appliedPromoCode || bestAutoPromo;

    if (!promo) {
      return { effectivePrice: basePrice, appliedPromo: null, savings: 0 };
    }

    let finalPrice = basePrice;

    // Apply discount based on type
    if (promo.discountType === 'FIXED' && promo.discountAmount) {
      finalPrice = Math.max(0, basePrice - promo.discountAmount);
    } else if (promo.discountPercent) {
      finalPrice = basePrice * (1 - promo.discountPercent / 100);
    } else if (promo.price && promo.price < basePrice) {
      finalPrice = promo.price;
    }

    const savings = basePrice - finalPrice;

    return { effectivePrice: finalPrice, appliedPromo: promo, savings };
  }, [basePrice, appliedPromoCode, bestAutoPromo]);

  const totalAmount = nights * effectivePrice;
  const totalSavings = nights * savings;

  // Handle promo code application
  const handleApplyPromoCode = () => {
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) return;

    const matchingPromo = applicablePromotions.find(p =>
      p.promoCode?.toUpperCase() === code
    );

    if (matchingPromo) {
      setAppliedPromoCode(matchingPromo);
      form.setValue('promoCode', code);
      toast({
        title: '🎉 Código aplicado',
        description: `Promoción "${matchingPromo.label}" activada`,
      });
    } else {
      // Check if code exists but doesn't apply
      const existsButNotApplicable = rates.find(p => p.promoCode?.toUpperCase() === code);
      if (existsButNotApplicable) {
        toast({
          title: 'Código no aplicable',
          description: 'Este código no es válido para las fechas o habitación seleccionada',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Código inválido',
          description: 'El código promocional no existe',
          variant: 'destructive',
        });
      }
    }
  };

  const handleRemovePromoCode = () => {
    setAppliedPromoCode(null);
    setPromoCodeInput('');
    form.setValue('promoCode', '');
  };

  const availableRooms = rooms.filter(r =>
    r.status === 'AVAILABLE' || r.status === 'DIRTY'
  );

  const onSubmit = async (data: BookingFormData) => {
    if (isOverCapacity && !data.confirmOverCapacity) {
      form.setError('confirmOverCapacity', {
        message: 'Debes confirmar para continuar',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await addBooking({
        guestId: data.guestId,
        roomId: data.roomId,
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
        adults: data.adults,
        children: data.children,
        status: 'CONFIRMED',
        totalAmount,
        notes: appliedPromo
          ? `${data.notes || ''}\n[Promoción: ${appliedPromo.label}${appliedPromo.promoCode ? ` (${appliedPromo.promoCode})` : ''}]`.trim()
          : data.notes,
        needsReview: isOverCapacity,
      });

      toast({
        title: '✅ Reserva creada',
        description: appliedPromo
          ? `${nights} noches con promoción "${appliedPromo.label}" - Ahorro: $${totalSavings.toLocaleString('es-AR')}`
          : `Reserva confirmada para ${nights} noches`,
      });

      form.reset();
      setAppliedPromoCode(null);
      setPromoCodeInput('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating booking:', error);
      toast({
        title: 'Error al crear reserva',
        description: error instanceof Error ? error.message : 'Ocurrió un error inesperado. Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Nueva Reserva</DialogTitle>
          <DialogDescription>
            Completa los datos para crear una nueva reserva
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Guest selection */}
            <FormField
              control={form.control}
              name="guestId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Huésped</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar huésped" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {guests.map(guest => (
                        <SelectItem key={guest.id} value={guest.id}>
                          {guest.fullName} ({guest.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Room selection */}
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
                      {availableRooms.map(room => {
                        const roomType = roomTypes.find(rt => rt.id === room.roomTypeId);
                        return (
                          <SelectItem key={room.id} value={room.id}>
                            {room.roomNumber} - {roomType?.name} (${roomType?.basePrice.toLocaleString('es-AR')}/noche)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="checkInDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Check-in</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP', { locale: es })
                            ) : (
                              <span>Seleccionar fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
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
                    <FormLabel>Check-out</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP', { locale: es })
                            ) : (
                              <span>Seleccionar fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date <= (watchedCheckIn || new Date())}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Conflict warning */}
            {!conflicts.available && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-destructive">Conflicto de disponibilidad</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Esta habitación tiene {conflicts.conflicts.length} reserva(s) que se superponen con las fechas seleccionadas.
                  </p>
                </div>
              </div>
            )}

            {/* Available Promotions Alert */}
            {applicablePromotions.length > 0 && !appliedPromoCode && bestAutoPromo && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">
                    ¡Promoción aplicada automáticamente!
                  </p>
                  <p className="text-xs text-emerald-600/80 mt-1">
                    "{bestAutoPromo.label}" - Precio: ${effectivePrice.toLocaleString('es-AR')}/noche
                    {savings > 0 && <span className="font-medium"> (Ahorro: ${savings.toLocaleString('es-AR')}/noche)</span>}
                  </p>
                </div>
              </div>
            )}

            {/* Promo Code Input */}
            <div className="space-y-2">
              <FormLabel className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Código promocional
              </FormLabel>
              {appliedPromoCode ? (
                <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-500 text-white">
                      {appliedPromoCode.promoCode}
                    </Badge>
                    <span className="text-sm text-purple-700 dark:text-purple-300">
                      {appliedPromoCode.label}
                    </span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={handleRemovePromoCode}>
                    Quitar
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Ingresa tu código"
                    value={promoCodeInput}
                    onChange={e => setPromoCodeInput(e.target.value.toUpperCase())}
                    className="font-mono uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleApplyPromoCode}
                    disabled={!promoCodeInput.trim()}
                  >
                    Aplicar
                  </Button>
                </div>
              )}
            </div>

            {/* Guests */}
            <div className="grid gap-4 sm:grid-cols-2">
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
            {isOverCapacity && (
              <div className="p-4 rounded-lg bg-accent/10 border border-accent/20 space-y-3">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Capacidad excedida</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalGuests} huéspedes para una habitación con capacidad máxima de {selectedRoomType?.maxGuests}.
                    </p>
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="confirmOverCapacity"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Confirmo que deseo continuar (se marcará como "Needs review")
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observaciones especiales, requerimientos..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Summary */}
            {nights > 0 && selectedRoomType && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {nights} noche{nights > 1 ? 's' : ''} x ${basePrice.toLocaleString('es-AR')}
                  </span>
                  <span className={cn(appliedPromo && "line-through text-muted-foreground")}>
                    ${baseTotalAmount.toLocaleString('es-AR')}
                  </span>
                </div>

                {appliedPromo && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600 flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      {appliedPromo.label}
                    </span>
                    <span className="text-emerald-600 font-medium">
                      -${totalSavings.toLocaleString('es-AR')}
                    </span>
                  </div>
                )}

                <div className="flex justify-between font-bold text-lg pt-3 border-t">
                  <span>Total</span>
                  <div className="text-right">
                    <span className="text-primary">${totalAmount.toLocaleString('es-AR')}</span>
                    {appliedPromo && (
                      <p className="text-xs font-normal text-emerald-600">
                        ¡Ahorras ${totalSavings.toLocaleString('es-AR')}!
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? 'Creando...' : 'Crear Reserva'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
