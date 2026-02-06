import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, AlertTriangle, Users } from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
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

const bookingSchema = z.object({
  guestId: z.string().min(1, 'Selecciona un huésped'),
  roomId: z.string().min(1, 'Selecciona una habitación'),
  checkInDate: z.date({ required_error: 'Fecha de check-in requerida' }),
  checkOutDate: z.date({ required_error: 'Fecha de check-out requerida' }),
  adults: z.coerce.number().min(1, 'Mínimo 1 adulto'),
  children: z.coerce.number().min(0),
  notes: z.string().optional(),
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      guestId: '',
      roomId: '',
      adults: 1,
      children: 0,
      notes: '',
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

  // Calculate total
  const nights = watchedCheckIn && watchedCheckOut 
    ? differenceInDays(watchedCheckOut, watchedCheckIn)
    : 0;
  const totalAmount = selectedRoomType ? nights * selectedRoomType.basePrice : 0;

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
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    addBooking({
      guestId: data.guestId,
      roomId: data.roomId,
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
      adults: data.adults,
      children: data.children,
      status: 'CONFIRMED',
      totalAmount,
      notes: data.notes,
      needsReview: isOverCapacity,
    });

    toast({
      title: 'Reserva creada',
      description: `Reserva confirmada para ${nights} noches`,
    });

    setIsSubmitting(false);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Reserva</DialogTitle>
          <DialogDescription>
            Completa los datos para crear una nueva reserva
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    Esto es solo una advertencia (mock) - en producción se bloquearía.
                  </p>
                </div>
              </div>
            )}

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
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {nights} noche{nights > 1 ? 's' : ''} x ${selectedRoomType.basePrice.toLocaleString('es-AR')}
                  </span>
                  <span className="font-medium">${totalAmount.toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between font-medium text-lg pt-2 border-t">
                  <span>Total</span>
                  <span>${totalAmount.toLocaleString('es-AR')}</span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creando...' : 'Crear Reserva'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
