import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, differenceInDays, isWithinInterval, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, AlertTriangle, Users, Tag, Percent, Sparkles, UserPlus, ArrowLeft, Check, Loader2, Car, Globe, Search, ChevronsUpDown } from 'lucide-react';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useRates } from '@/hooks/useRates';
import { useCheckAvailability } from '@/hooks/useCheckAvailability';
import { COUNTRIES, DOCUMENT_TYPES } from '@/lib/constants';
import { getBestPromo, getPromoNightlyPrice } from '@/lib/promoPricing';
import type { DocumentType } from '@/types/hotel';
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Rate } from '@/types/hotel';

const bookingSchema = z.object({
  guestId: z.string(),
  roomId: z.string().min(1, 'Selecciona una habitación'),
  checkInDate: z.date({ required_error: 'Fecha de check-in requerida' }),
  checkOutDate: z.date({ required_error: 'Fecha de check-out requerida' }),
  adults: z.coerce.number().min(1, 'Mínimo 1 adulto'),
  children: z.coerce.number().min(0),
  estimatedArrivalTime: z.string().optional(),
  notes: z.string().optional(),
  receptionist: z.string().optional(),
  promoCode: z.string().optional(),
  confirmOverCapacity: z.boolean().optional(),
  hasVehicle: z.boolean().optional(),
  vehicleDescription: z.string().optional(),
  licensePlate: z.string().optional(),
  // New guest fields (used when guestId is '__new__')
  newGuestName: z.string().optional(),
  newGuestEmail: z.string().optional(),
  newGuestPhone: z.string().optional(),
  newGuestDocumentType: z.string().optional(),
  newGuestDocumentId: z.string().optional(),
  newGuestCountry: z.string().optional(),
}).refine((data) => data.checkOutDate > data.checkInDate, {
  message: 'Check-out debe ser posterior a check-in',
  path: ['checkOutDate'],
}).refine((data) => {
  if (data.guestId === '__new__') {
    return !!data.newGuestName && data.newGuestName.trim().length >= 2;
  }
  return data.guestId.length > 0;
}, {
  message: 'Ingresa el nombre del huésped o selecciona uno existente',
  path: ['newGuestName'],
}).refine((data) => {
  // Email is optional, but if provided it must be valid
  if (data.guestId === '__new__' && data.newGuestEmail && data.newGuestEmail.trim()) {
    return data.newGuestEmail.includes('@');
  }
  return true;
}, {
  message: 'Ingresa un email válido',
  path: ['newGuestEmail'],
}).refine((data) => {
  if (data.guestId !== '__new__') {
    return data.guestId.length > 0;
  }
  return true;
}, {
  message: 'Selecciona un huésped',
  path: ['guestId'],
});

type BookingFormData = z.infer<typeof bookingSchema>;

interface NewBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selects the room, for when the booking starts from Habitaciones. */
  preselectedRoomId?: string;
}

export function NewBookingDialog({ open, onOpenChange, preselectedRoomId }: NewBookingDialogProps) {
  const { bookings, addBooking, checkRoomAvailability } = useBookingOperations();
  const { guests, addGuest, updateGuest } = useGuestOperations();
  const { rooms, roomTypes } = useRoomOperations();
  const { data: rates = [] } = useRates();
  const checkAvailability = useCheckAvailability();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNewGuest, setIsNewGuest] = useState(false);
  const [isSavingGuest, setIsSavingGuest] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [appliedPromoCode, setAppliedPromoCode] = useState<Rate | null>(null);

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      guestId: '',
      roomId: '',
      adults: 1,
      children: 0,
      estimatedArrivalTime: '',
      notes: '',
      receptionist: '',
      promoCode: '',
      confirmOverCapacity: false,
      hasVehicle: false,
      vehicleDescription: '',
      licensePlate: '',
      newGuestName: '',
      newGuestEmail: '',
      newGuestPhone: '',
      newGuestDocumentType: 'DNI',
      newGuestDocumentId: '',
      newGuestCountry: '',
    },
  });

  const watchedRoomId = form.watch('roomId');
  // watch() returns the raw input value, and type="number" inputs hand back a
  // string. z.coerce.number() only runs at validation, so without Number() here
  // "2" + "0" concatenates into "20" and fakes an over-capacity warning.
  const watchedAdults = Number(form.watch('adults')) || 0;
  const watchedChildren = Number(form.watch('children')) || 0;
  const watchedCheckIn = form.watch('checkInDate');
  const watchedCheckOut = form.watch('checkOutDate');
  const watchedHasVehicle = form.watch('hasVehicle');
  const watchedGuestId = form.watch('guestId');

  // Auto-fill vehicle from guest profile
  useEffect(() => {
    if (watchedGuestId && watchedGuestId !== '__new__') {
      const selectedGuest = guests.find(g => g.id === watchedGuestId);
      if (selectedGuest?.hasVehicle) {
        form.setValue('hasVehicle', true);
        form.setValue('vehicleDescription', selectedGuest.vehicleDescription || '');
        form.setValue('licensePlate', selectedGuest.licensePlate || '');
      }
    }
  }, [watchedGuestId, guests, form]);

  const selectedRoom = rooms.find(r => r.id === watchedRoomId);
  const selectedRoomType = selectedRoom ? roomTypes.find(rt => rt.id === selectedRoom.roomTypeId) : null;

  const totalGuests = watchedAdults + watchedChildren;
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

  // Calculate pricing
  const basePrice = selectedRoomType?.basePrice || 0;
  const baseTotalAmount = nights * basePrice;

  // Best automatic promotion (cheapest for the guest, no code required)
  const bestAutoPromo = useMemo(
    () => getBestPromo(applicablePromotions.filter(p => !p.promoCode), basePrice),
    [applicablePromotions, basePrice]
  );

  // Determine effective price (considering promotions)
  const { effectivePrice, appliedPromo, savings } = useMemo(() => {
    // Only honor the applied promo code if it's still valid for the current
    // room/dates selection; otherwise fall back to the best automatic promo.
    const validAppliedCode = appliedPromoCode && applicablePromotions.some(p => p.id === appliedPromoCode.id)
      ? appliedPromoCode
      : null;
    const promo: Rate | null = validAppliedCode || bestAutoPromo;

    if (!promo) {
      return { effectivePrice: basePrice, appliedPromo: null, savings: 0 };
    }

    const finalPrice = getPromoNightlyPrice(promo, basePrice);

    return { effectivePrice: finalPrice, appliedPromo: promo, savings: basePrice - finalPrice };
  }, [basePrice, appliedPromoCode, bestAutoPromo, applicablePromotions]);

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

  // Exclude only rooms in maintenance: today's physical status (e.g. OCCUPIED)
  // says nothing about future dates — the per-date conflict check handles that.
  const availableRooms = rooms.filter(r =>
    r.status !== 'MAINTENANCE'
  );

  // Save new guest inline without closing the booking dialog
  const handleSaveNewGuest = async () => {
    const name = form.getValues('newGuestName')?.trim();
    const email = form.getValues('newGuestEmail')?.trim();
    const phone = form.getValues('newGuestPhone')?.trim();
    const documentType = form.getValues('newGuestDocumentType')?.trim();
    const documentId = form.getValues('newGuestDocumentId')?.trim();
    const country = form.getValues('newGuestCountry')?.trim();

    if (!name || name.length < 2) {
      form.setError('newGuestName', { message: 'Ingresa el nombre del huésped (mín. 2 caracteres)' });
      return;
    }
    // Email is optional, but validate format if provided
    if (email && !email.includes('@')) {
      form.setError('newGuestEmail', { message: 'Ingresa un email válido' });
      return;
    }

    setIsSavingGuest(true);
    try {
      const newGuest = await addGuest({
        fullName: name,
        email: email || '',
        phone: phone || '',
        documentType: (documentType as DocumentType) || undefined,
        documentId: documentId || undefined,
        country: country || undefined,
      });

      // Auto-select the new guest and switch back to selector
      form.setValue('guestId', newGuest.id);
      form.setValue('newGuestName', '');
      form.setValue('newGuestEmail', '');
      form.setValue('newGuestPhone', '');
      form.setValue('newGuestDocumentType', 'DNI');
      form.setValue('newGuestDocumentId', '');
      form.setValue('newGuestCountry', '');
      setIsNewGuest(false);

      toast({
        title: '✅ Huésped creado',
        description: `${newGuest.fullName} fue registrado y seleccionado automáticamente`,
      });
    } catch (error) {
      toast({
        title: 'Error al crear huésped',
        description: error instanceof Error ? error.message : 'Ocurrió un error inesperado',
        variant: 'destructive',
      });
    } finally {
      setIsSavingGuest(false);
    }
  };

  const onSubmit = async (data: BookingFormData) => {
    if (isOverCapacity && !data.confirmOverCapacity) {
      // Fallback: the checkbox lives in step 2 — send the user back there
      form.setError('confirmOverCapacity', {
        message: 'Debes confirmar para continuar',
      });
      toast({
        title: 'Capacidad excedida',
        description: 'Confirmá la capacidad excedida en el paso 2 para continuar.',
        variant: 'destructive',
      });
      setWizardStep(2);
      return;
    }

    setIsSubmitting(true);

    try {
      // Server-side availability check
      const isAvailable = await checkAvailability.mutateAsync({
        roomId: data.roomId,
        checkIn: data.checkInDate,
        checkOut: data.checkOutDate
      });

      if (!isAvailable) {
        toast({
          title: '❌ Habitación no disponible',
          description: 'La habitación ya tiene una reserva en estas fechas. Elige otra habitación o fechas diferentes.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      const finalGuestId = data.guestId;

      await addBooking({
        guestId: finalGuestId,
        roomId: data.roomId,
        checkInDate: data.checkInDate,
        checkOutDate: data.checkOutDate,
        estimatedArrivalTime: data.estimatedArrivalTime?.trim() || undefined,
        adults: data.adults,
        children: data.children,
        status: 'CONFIRMED',
        totalAmount,
        notes: appliedPromo
          ? `${data.notes || ''}\n[Promoción: ${appliedPromo.label}${appliedPromo.promoCode ? ` (${appliedPromo.promoCode})` : ''}]`.trim()
          : data.notes,
        needsReview: isOverCapacity,
        receptionist: data.receptionist?.trim() || undefined,
        hasVehicle: data.hasVehicle ?? false,
        vehicleDescription: data.hasVehicle ? data.vehicleDescription : undefined,
        licensePlate: data.hasVehicle ? data.licensePlate?.toUpperCase() : undefined,
      });

      // El auto se carga en la reserva, pero es un dato del huésped: sin esto la
      // ficha seguía diciendo "Sin vehículo registrado" y no se prellenaba nunca.
      // Si viene sin auto NO se borra lo que ya tenía: puede tener uno y no traerlo.
      if (data.hasVehicle) {
        const guest = guests.find(g => g.id === finalGuestId);
        const licensePlate = data.licensePlate?.trim().toUpperCase() || undefined;
        const vehicleDescription = data.vehicleDescription?.trim() || undefined;
        const isNewInfo =
          !guest?.hasVehicle ||
          (guest.licensePlate || undefined) !== licensePlate ||
          (guest.vehicleDescription || undefined) !== vehicleDescription;

        if (guest && isNewInfo) {
          try {
            await updateGuest(guest.id, { hasVehicle: true, vehicleDescription, licensePlate });
          } catch (err) {
            // La reserva ya quedó creada con el vehículo; no la hacemos fallar por la ficha.
            console.warn('[Reserva] No se pudo guardar el vehículo en la ficha del huésped:', err);
          }
        }
      }

      toast({
        title: '✅ Reserva creada',
        description: appliedPromo
          ? `${nights} noches con promoción "${appliedPromo.label}" - Ahorro: $${totalSavings.toLocaleString('es-AR')}`
          : `Reserva confirmada para ${nights} noches`,
      });

      form.reset();
      setIsNewGuest(false);
      setAppliedPromoCode(null);
      setPromoCodeInput('');
      setWizardStep(1);
      onOpenChange(false);
    } catch (error) {
      // Error handled by toast below
      toast({
        title: 'Error al crear reserva',
        description: error instanceof Error ? error.message : 'Ocurrió un error inesperado. Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Carry the room over when the booking was started from Habitaciones, so the
  // receptionist doesn't have to pick the room they were already looking at.
  useEffect(() => {
    if (open && preselectedRoomId) {
      form.setValue('roomId', preselectedRoomId);
    }
  }, [open, preselectedRoomId, form]);

  // Reset all dialog state on close so reopening starts fresh
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset();
      setIsNewGuest(false);
      setAppliedPromoCode(null);
      setPromoCodeInput('');
      setWizardStep(1);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Nueva Reserva</DialogTitle>
          <DialogDescription>
            {wizardStep === 1 ? 'Paso 1: Selecciona o crea un huésped' : wizardStep === 2 ? 'Paso 2: Habitación, fechas y promoción' : 'Paso 3: Revisa y confirma'}
          </DialogDescription>
          {/* Wizard progress */}
          <div className="flex items-center gap-2 pt-2">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all",
                  s < wizardStep ? "bg-emerald-500 text-white" :
                  s === wizardStep ? "bg-primary text-white" :
                  "bg-muted text-muted-foreground"
                )}>
                  {s < wizardStep ? <Check className="w-4 h-4" /> : s}
                </div>
                <span className={cn("text-xs font-medium hidden sm:block", s === wizardStep ? "text-foreground" : "text-muted-foreground")}>
                  {s === 1 ? 'Huésped' : s === 2 ? 'Habitación' : 'Confirmar'}
                </span>
                {s < 3 && <div className={cn("flex-1 h-0.5 rounded", s < wizardStep ? "bg-emerald-500" : "bg-muted")} />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* ═══ STEP 1: Guest ═══ */}
            {wizardStep === 1 && (<div className="space-y-4">
            {/* Guest selection */}
            {!isNewGuest ? (
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="guestId"
                  render={({ field }) => {
                    const selectedGuest = guests.find(g => g.id === field.value);
                    return (
                      <FormItem className="flex flex-col">
                        <FormLabel>Huésped</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  'w-full justify-between font-normal',
                                  !selectedGuest && 'text-muted-foreground'
                                )}
                              >
                                {selectedGuest ? (
                                  <span className="truncate">
                                    {selectedGuest.fullName}
                                    {selectedGuest.email ? (
                                      <span className="text-muted-foreground"> · {selectedGuest.email}</span>
                                    ) : selectedGuest.phone ? (
                                      <span className="text-muted-foreground"> · {selectedGuest.phone}</span>
                                    ) : null}
                                  </span>
                                ) : (
                                  'Buscar huésped por nombre, email o teléfono…'
                                )}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[--radix-popover-trigger-width] max-w-[520px]" align="start">
                            <Command
                              filter={(value, search) => {
                                // `value` is the id we register below. We do the actual match against
                                // the guest's fullName/email/phone via the keywords prop (cmdk joins them).
                                return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                              }}
                            >
                              <CommandInput placeholder="Buscar huésped…" autoFocus />
                              <CommandList>
                                <CommandEmpty>
                                  <div className="flex flex-col items-center gap-2 py-2">
                                    <p className="text-sm text-muted-foreground">No se encontró ningún huésped.</p>
                                  </div>
                                </CommandEmpty>
                                <CommandGroup>
                                  {guests.map(guest => {
                                    const searchable = [guest.fullName, guest.email, guest.phone, guest.documentId]
                                      .filter(Boolean)
                                      .join(' ')
                                      .toLowerCase();
                                    return (
                                      <CommandItem
                                        key={guest.id}
                                        value={searchable}
                                        onSelect={() => {
                                          field.onChange(guest.id);
                                          // close popover by blurring — Popover handles onOpenChange via Radix
                                          (document.activeElement as HTMLElement | null)?.blur();
                                        }}
                                      >
                                        <div className="flex flex-col flex-1 min-w-0">
                                          <span className="truncate">{guest.fullName}</span>
                                          <span className="text-xs text-muted-foreground truncate">
                                            {guest.email || guest.phone || 'Sin contacto'}
                                          </span>
                                        </div>
                                        {field.value === guest.id && (
                                          <Check className="h-4 w-4 ml-2 shrink-0 text-primary" />
                                        )}
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary/80 gap-1.5 px-0"
                  onClick={() => {
                    setIsNewGuest(true);
                    form.setValue('guestId', '__new__');
                  }}
                >
                  <UserPlus className="w-4 h-4" />
                  + Nuevo Huésped
                </Button>
              </div>
            ) : (
              <div className="space-y-3 p-4 rounded-xl border-2 border-primary/20 bg-primary/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">Nuevo Huésped</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground gap-1 h-7 text-xs"
                    onClick={() => {
                      setIsNewGuest(false);
                      form.setValue('guestId', '');
                      form.setValue('newGuestName', '');
                      form.setValue('newGuestEmail', '');
                      form.setValue('newGuestPhone', '');
                      form.setValue('newGuestDocumentType', 'DNI');
                      form.setValue('newGuestDocumentId', '');
                      form.setValue('newGuestCountry', '');
                    }}
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Seleccionar existente
                  </Button>
                </div>

                <div className="space-y-3">
                  {/* Nombre completo */}
                  <FormField
                    control={form.control}
                    name="newGuestName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Juan Pérez" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Tipo Doc + Nro Documento */}
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    <FormField
                      control={form.control}
                      name="newGuestDocumentType"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Tipo Doc</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || 'DNI'}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {DOCUMENT_TYPES.map(dt => (
                                <SelectItem key={dt.value} value={dt.value}>
                                  {dt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="newGuestDocumentId"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-3">
                          <FormLabel>Nro. Documento</FormLabel>
                          <FormControl>
                            <Input placeholder="12345678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Teléfono + Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name="newGuestPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono</FormLabel>
                          <FormControl>
                            <Input placeholder="+54 11 1234-5678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="newGuestEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Email (opcional)</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="juan@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* País */}
                  <FormField
                    control={form.control}
                    name="newGuestCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5" />
                          País
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar país" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COUNTRIES.map(c => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="button"
                  size="sm"
                  className="w-full gap-2 mt-2"
                  disabled={isSavingGuest}
                  onClick={handleSaveNewGuest}
                >
                  {isSavingGuest ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {isSavingGuest ? 'Guardando...' : 'Guardar Huésped'}
                </Button>
              </div>
            )}

            {/* Step 1 navigation */}
            <div className="flex justify-end pt-2">
              <Button type="button" onClick={() => {
                const guestId = form.getValues('guestId');
                if (!guestId || guestId === '__new__') {
                  form.setError('guestId', { message: 'Selecciona o crea un huésped primero' });
                  return;
                }
                setWizardStep(2);
              }}>
                Siguiente →
              </Button>
            </div>
            </div>)}

            {/* ═══ STEP 2: Room, Dates, Promo ═══ */}
            {wizardStep === 2 && (<div className="space-y-5">
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
                            Hab {room.roomNumber} — {roomType?.maxGuests}p (${roomType?.basePrice.toLocaleString('es-AR')}/noche)
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
                          disabled={(date) => date < startOfDay(new Date())}
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
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 2 navigation */}
            <div className="flex justify-between pt-2">
              <Button type="button" variant="outline" onClick={() => setWizardStep(1)}>
                ← Atrás
              </Button>
              <Button type="button" onClick={() => {
                const roomId = form.getValues('roomId');
                const checkIn = form.getValues('checkInDate');
                const checkOut = form.getValues('checkOutDate');
                if (!roomId) { form.setError('roomId', { message: 'Selecciona una habitación' }); return; }
                if (!checkIn) { form.setError('checkInDate', { message: 'Fecha de check-in requerida' }); return; }
                if (!checkOut) { form.setError('checkOutDate', { message: 'Fecha de check-out requerida' }); return; }
                if (checkOut <= checkIn) { form.setError('checkOutDate', { message: 'Check-out debe ser posterior' }); return; }
                if (isOverCapacity && !form.getValues('confirmOverCapacity')) {
                  form.setError('confirmOverCapacity', { message: 'Debes confirmar para continuar' });
                  return;
                }
                setWizardStep(3);
              }}>
                Siguiente →
              </Button>
            </div>
            </div>)}

            {/* ═══ STEP 3: Notes, Vehicle, Summary ═══ */}
            {wizardStep === 3 && (<div className="space-y-5">
            {/* Estimated arrival — the hour this guest announced, not the hotel policy */}
            <FormField
              control={form.control}
              name="estimatedArrivalTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hora estimada de llegada (opcional)</FormLabel>
                  <FormControl>
                    <Input type="time" className="w-40" {...field} />
                  </FormControl>
                  <FormDescription>
                    Si el huésped avisó a qué hora llega. Se avisa en el panel si pasa la hora y no hizo el check-in.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Receptionist in charge */}
            <FormField
              control={form.control}
              name="receptionist"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recepcionista a cargo (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del recepcionista" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            {/* Vehicle */}
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="hasVehicle"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="flex items-center gap-2 cursor-pointer">
                      <Car className="w-4 h-4" />
                      Viene con vehículo (cochera)
                    </FormLabel>
                  </FormItem>
                )}
              />

              {watchedHasVehicle && (
                <div className="grid gap-3 sm:grid-cols-2 p-4 rounded-xl border bg-muted/30">
                  <FormField
                    control={form.control}
                    name="vehicleDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción del vehículo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Toyota Corolla Gris" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="licensePlate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Patente</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: AB 123 CD"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            className="font-mono uppercase"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

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
              <Button type="button" variant="outline" onClick={() => setWizardStep(2)} className="w-full sm:w-auto">
                ← Atrás
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? 'Creando...' : 'Crear Reserva'}
              </Button>
            </DialogFooter>
            </div>)}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
