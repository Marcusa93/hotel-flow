import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Search } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const paymentSchema = z.object({
    bookingId: z.string().min(1, 'Selecciona una reserva'),
    date: z.date({ required_error: 'Fecha requerida' }),
    method: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER'] as const),
    amount: z.coerce.number().positive('Monto debe ser mayor a 0'),
    reference: z.string().optional(),
    comment: z.string().optional(),
    status: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface NewPaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function NewPaymentDialog({ open, onOpenChange }: NewPaymentDialogProps) {
    const { addPayment, bookings, guests, rooms, payments } = useHotel();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const form = useForm<PaymentFormData>({
        resolver: zodResolver(paymentSchema),
        defaultValues: {
            bookingId: '',
            date: new Date(),
            method: 'CASH',
            amount: 0,
            reference: '',
            comment: '',
            status: 'PAID',
        },
    });

    const selectedBookingId = form.watch('bookingId');

    // Get active bookings (not cancelled)
    const activeBookings = useMemo(() => {
        return bookings
            .filter(b => b.status !== 'CANCELLED' && b.status !== 'NO_SHOW')
            .filter(b => {
                if (!searchTerm) return true;
                const guest = guests.find(g => g.id === b.guestId);
                const room = rooms.find(r => r.id === b.roomId);
                const search = searchTerm.toLowerCase();
                return (
                    guest?.fullName.toLowerCase().includes(search) ||
                    room?.roomNumber.toLowerCase().includes(search)
                );
            })
            .sort((a, b) => new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime());
    }, [bookings, guests, rooms, searchTerm]);

    // Calculate pending amount for selected booking
    const pendingAmount = useMemo(() => {
        if (!selectedBookingId) return 0;
        const booking = bookings.find(b => b.id === selectedBookingId);
        if (!booking) return 0;
        const paidAmount = payments
            .filter(p => p.bookingId === selectedBookingId && p.status === 'PAID')
            .reduce((sum, p) => sum + p.amount, 0);
        return Math.max(0, booking.totalAmount - paidAmount);
    }, [selectedBookingId, bookings, payments]);

    // Auto-fill amount when booking is selected
    const handleBookingSelect = (bookingId: string) => {
        form.setValue('bookingId', bookingId);
        const booking = bookings.find(b => b.id === bookingId);
        if (booking) {
            const paidAmount = payments
                .filter(p => p.bookingId === bookingId && p.status === 'PAID')
                .reduce((sum, p) => sum + p.amount, 0);
            const pending = Math.max(0, booking.totalAmount - paidAmount);
            form.setValue('amount', pending);
        }
    };

    const onSubmit = async (data: PaymentFormData) => {
        setIsSubmitting(true);

        try {
            await addPayment({
                bookingId: data.bookingId,
                date: data.date,
                method: data.method,
                amount: data.amount,
                reference: data.reference,
                comment: data.comment,
                status: data.status,
            });

            toast({
                title: '✅ Pago registrado',
                description: `Se registró un pago de $${data.amount.toLocaleString('es-AR')}`,
            });

            form.reset();
            setSearchTerm('');
            onOpenChange(false);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudo registrar el pago',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getBookingLabel = (bookingId: string) => {
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) return 'Seleccionar reserva';
        const guest = guests.find(g => g.id === booking.guestId);
        const room = rooms.find(r => r.id === booking.roomId);
        return `${guest?.fullName || 'Huésped'} - Hab. ${room?.roomNumber || '-'}`;
    };
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[85vh] p-0 flex flex-col overflow-hidden">
                <DialogHeader className="p-6 pb-4 flex-shrink-0">
                    <DialogTitle>Nuevo Cobro</DialogTitle>
                    <DialogDescription>
                        Registra un pago para una reserva existente
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                        <ScrollArea className="flex-1 px-6">
                            <div className="space-y-4 pb-4">
                                {/* Booking Selection */}
                                <FormField
                                    control={form.control}
                                    name="bookingId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Reserva</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className={cn(
                                                                'w-full justify-between font-normal',
                                                                !field.value && 'text-muted-foreground'
                                                            )}
                                                        >
                                                            {field.value ? getBookingLabel(field.value) : 'Seleccionar reserva...'}
                                                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[350px] p-0" align="start">
                                                    <div className="p-2 border-b">
                                                        <Input
                                                            placeholder="Buscar por huésped o habitación..."
                                                            value={searchTerm}
                                                            onChange={(e) => setSearchTerm(e.target.value)}
                                                            className="h-9"
                                                        />
                                                    </div>
                                                    <ScrollArea className="h-[200px]">
                                                        <div className="p-2 space-y-1">
                                                            {activeBookings.length === 0 ? (
                                                                <p className="text-sm text-muted-foreground text-center py-4">
                                                                    No se encontraron reservas
                                                                </p>
                                                            ) : (
                                                                activeBookings.map((booking) => {
                                                                    const guest = guests.find(g => g.id === booking.guestId);
                                                                    const room = rooms.find(r => r.id === booking.roomId);
                                                                    const paid = payments
                                                                        .filter(p => p.bookingId === booking.id && p.status === 'PAID')
                                                                        .reduce((sum, p) => sum + p.amount, 0);
                                                                    const pending = booking.totalAmount - paid;

                                                                    return (
                                                                        <button
                                                                            key={booking.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                handleBookingSelect(booking.id);
                                                                            }}
                                                                            className={cn(
                                                                                'w-full text-left px-3 py-2 rounded-lg transition-colors',
                                                                                'hover:bg-slate-100 dark:hover:bg-slate-800',
                                                                                field.value === booking.id && 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200'
                                                                            )}
                                                                        >
                                                                            <div className="flex justify-between items-start">
                                                                                <div>
                                                                                    <p className="font-medium text-sm">{guest?.fullName || 'Sin huésped'}</p>
                                                                                    <p className="text-xs text-muted-foreground">
                                                                                        Hab. {room?.roomNumber} • {format(new Date(booking.checkInDate), 'dd MMM', { locale: es })} - {format(new Date(booking.checkOutDate), 'dd MMM', { locale: es })}
                                                                                    </p>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <p className="text-xs font-medium text-emerald-600">
                                                                                        ${booking.totalAmount.toLocaleString('es-AR')}
                                                                                    </p>
                                                                                    {pending > 0 && (
                                                                                        <p className="text-xs text-amber-600">
                                                                                            Pend: ${pending.toLocaleString('es-AR')}
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </button>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                    </ScrollArea>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Amount */}
                                <FormField
                                    control={form.control}
                                    name="amount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Monto ($)</FormLabel>
                                            <FormControl>
                                                <Input type="number" min={0} step={0.01} {...field} />
                                            </FormControl>
                                            {pendingAmount > 0 && (
                                                <p className="text-xs text-amber-600">
                                                    Pendiente: ${pendingAmount.toLocaleString('es-AR')}
                                                </p>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Method */}
                                    <FormField
                                        control={form.control}
                                        name="method"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Método</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="CASH">Efectivo</SelectItem>
                                                        <SelectItem value="CARD">Tarjeta</SelectItem>
                                                        <SelectItem value="TRANSFER">Transferencia</SelectItem>
                                                        <SelectItem value="OTHER">Otro</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Status */}
                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Estado</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="PAID">Pagado</SelectItem>
                                                        <SelectItem value="PENDING">Pendiente</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Date */}
                                <FormField
                                    control={form.control}
                                    name="date"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Fecha</FormLabel>
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
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Reference */}
                                <FormField
                                    control={form.control}
                                    name="reference"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Referencia (opcional)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Nro. de transacción, comprobante..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Comment */}
                                <FormField
                                    control={form.control}
                                    name="comment"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Comentario (opcional)</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Observaciones..." rows={2} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </ScrollArea>

                        <div className="flex-shrink-0 p-4 border-t bg-slate-50 dark:bg-slate-900/50">
                            <div className="flex flex-col sm:flex-row gap-2 justify-end">
                                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700">
                                    {isSubmitting ? 'Registrando...' : 'Registrar Cobro'}
                                </Button>
                            </div>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
