import { useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Trash2, Search, FileText } from 'lucide-react';
import { useBookingOperations } from '@/hooks/domain/useBookingOperations';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { useCreateInvoice } from '@/hooks/useCreateInvoice';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
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
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { InvoiceItemType } from '@/types/hotel';

const invoiceItemSchema = z.object({
    description: z.string().min(1, 'Descripción requerida'),
    quantity: z.coerce.number().min(1, 'Mínimo 1'),
    unitPrice: z.coerce.number().min(0, 'Precio inválido'),
    itemType: z.enum(['ACCOMMODATION', 'SERVICE', 'EXTRA', 'OTHER'] as const),
});

const invoiceSchema = z.object({
    bookingId: z.string().min(1, 'Selecciona una reserva'),
    guestId: z.string().min(1, 'Huésped requerido'),
    taxRate: z.coerce.number().min(0).max(100).default(21),
    notes: z.string().optional(),
    items: z.array(invoiceItemSchema).min(1, 'Añade al menos un item'),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

interface InvoiceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    preselectedBookingId?: string;
}

export function InvoiceDialog({ open, onOpenChange, preselectedBookingId }: InvoiceDialogProps) {
    const { bookings } = useBookingOperations();
    const { guests } = useGuestOperations();
    const { rooms, roomTypes } = useRoomOperations();
    const createInvoiceMutation = useCreateInvoice();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const form = useForm<InvoiceFormData>({
        resolver: zodResolver(invoiceSchema),
        defaultValues: {
            bookingId: preselectedBookingId || '',
            guestId: '',
            taxRate: 21,
            notes: '',
            items: [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'items',
    });

    const selectedBookingId = form.watch('bookingId');
    const items = form.watch('items');
    const taxRate = form.watch('taxRate');

    // Calculate totals
    const subtotal = useMemo(() => {
        return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    }, [items]);

    const taxAmount = useMemo(() => subtotal * (taxRate / 100), [subtotal, taxRate]);
    const total = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);

    // Active bookings for selection
    const activeBookings = useMemo(() => {
        return bookings
            .filter(b => b.status === 'CHECKED_OUT' || b.status === 'CHECKED_IN')
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
            .sort((a, b) => new Date(b.checkOutDate).getTime() - new Date(a.checkOutDate).getTime());
    }, [bookings, guests, rooms, searchTerm]);

    // Handle booking selection - auto-populate items
    const handleBookingSelect = (bookingId: string) => {
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) return;

        form.setValue('bookingId', bookingId);
        form.setValue('guestId', booking.guestId);

        // Calculate nights
        const checkIn = new Date(booking.checkInDate);
        const checkOut = new Date(booking.checkOutDate);
        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

        const room = rooms.find(r => r.id === booking.roomId);
        const roomType = room ? roomTypes.find(rt => rt.id === room.roomTypeId) : null;

        // Set default accommodation item
        form.setValue('items', [{
            description: `Alojamiento ${roomType?.name || ''} - Hab. ${room?.roomNumber} (${nights} noches)`,
            quantity: nights,
            unitPrice: roomType?.basePrice || 0,
            itemType: 'ACCOMMODATION' as InvoiceItemType,
        }]);
    };

    const addItem = () => {
        append({
            description: '',
            quantity: 1,
            unitPrice: 0,
            itemType: 'OTHER',
        });
    };

    const onSubmit = async (data: InvoiceFormData) => {
        setIsSubmitting(true);
        try {
            await createInvoiceMutation.mutateAsync({
                bookingId: data.bookingId,
                guestId: data.guestId,
                taxRate: data.taxRate,
                notes: data.notes,
                // zod already validated these; the explicit mapping narrows the partial inferred type
                items: data.items.map(it => ({
                    description: it.description ?? '',
                    quantity: it.quantity ?? 1,
                    unitPrice: it.unitPrice ?? 0,
                    itemType: (it.itemType ?? 'OTHER') as InvoiceItemType,
                })),
            });

            toast({
                title: '✅ Factura creada',
                description: 'La factura se ha generado correctamente',
            });

            form.reset();
            onOpenChange(false);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudo crear la factura',
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

    const itemTypeLabels: Record<InvoiceItemType, string> = {
        ACCOMMODATION: 'Alojamiento',
        SERVICE: 'Servicio',
        EXTRA: 'Extra',
        OTHER: 'Otro',
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col overflow-hidden">
                <DialogHeader className="p-6 pb-4 flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-600" />
                        Nueva Factura
                    </DialogTitle>
                    <DialogDescription>
                        Crea una factura para una reserva con items desglosados
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    {/* Native scroll container: ScrollArea's height:100% viewport does not
                        resolve reliably against a flex-sized parent, cutting off the end
                        of the form. Same fix as NewPaymentDialog. */}
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                        <div className="flex-1 min-h-0 overflow-y-auto px-6">
                            <div className="space-y-5 pb-4">
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
                                                            {field.value ? getBookingLabel(field.value) : 'Buscar reserva...'}
                                                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[400px] p-0" align="start">
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

                                                                    return (
                                                                        <button
                                                                            key={booking.id}
                                                                            type="button"
                                                                            onClick={() => handleBookingSelect(booking.id)}
                                                                            className={cn(
                                                                                'w-full text-left px-3 py-2 rounded-lg transition-colors',
                                                                                'hover:bg-slate-100 dark:hover:bg-slate-800',
                                                                                field.value === booking.id && 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200'
                                                                            )}
                                                                        >
                                                                            <div className="flex justify-between items-start">
                                                                                <div>
                                                                                    <p className="font-medium text-sm">{guest?.fullName || 'Sin huésped'}</p>
                                                                                    <p className="text-xs text-muted-foreground">
                                                                                        Hab. {room?.roomNumber} • {format(new Date(booking.checkInDate), 'dd MMM', { locale: es })} - {format(new Date(booking.checkOutDate), 'dd MMM', { locale: es })}
                                                                                    </p>
                                                                                </div>
                                                                                <span className={cn(
                                                                                    'text-xs px-2 py-0.5 rounded-full',
                                                                                    booking.status === 'CHECKED_OUT' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'
                                                                                )}>
                                                                                    {booking.status === 'CHECKED_OUT' ? 'Finalizada' : 'En curso'}
                                                                                </span>
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

                                {/* Items Section */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <FormLabel>Items de Factura</FormLabel>
                                        <Button type="button" variant="outline" size="sm" onClick={addItem}>
                                            <Plus className="w-4 h-4 mr-1" />
                                            Añadir Item
                                        </Button>
                                    </div>

                                    {fields.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                                            Selecciona una reserva o añade items manualmente
                                        </p>
                                    ) : (
                                        <div className="space-y-3">
                                            {fields.map((field, index) => (
                                                <div key={field.id} className="flex gap-2 items-start p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                                    <div className="flex-1 grid grid-cols-12 gap-2">
                                                        <div className="col-span-5">
                                                            <Input
                                                                placeholder="Descripción"
                                                                {...form.register(`items.${index}.description`)}
                                                            />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <Select
                                                                value={form.watch(`items.${index}.itemType`)}
                                                                onValueChange={(v) => form.setValue(`items.${index}.itemType`, v as InvoiceItemType)}
                                                            >
                                                                <SelectTrigger className="h-10">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {Object.entries(itemTypeLabels).map(([key, label]) => (
                                                                        <SelectItem key={key} value={key}>{label}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <Input
                                                                type="number"
                                                                min={1}
                                                                placeholder="Cant."
                                                                {...form.register(`items.${index}.quantity`)}
                                                            />
                                                        </div>
                                                        <div className="col-span-3">
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                step={0.01}
                                                                placeholder="Precio"
                                                                {...form.register(`items.${index}.unitPrice`)}
                                                            />
                                                        </div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => remove(index)}
                                                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Tax Rate */}
                                <FormField
                                    control={form.control}
                                    name="taxRate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>IVA (%)</FormLabel>
                                            <FormControl>
                                                <Input type="number" min={0} max={100} step={1} className="w-24" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Totals Preview */}
                                <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 rounded-xl p-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span className="font-medium">${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">IVA ({taxRate}%)</span>
                                        <span className="font-medium">${taxAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between text-lg pt-2 border-t border-indigo-200/50">
                                        <span className="font-semibold">Total</span>
                                        <span className="font-bold text-indigo-600">${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>

                                {/* Notes */}
                                <FormField
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Notas (opcional)</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Observaciones adicionales..." rows={2} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex-shrink-0 p-4 border-t bg-slate-50 dark:bg-slate-900/50">
                            <div className="flex flex-col sm:flex-row gap-2 justify-end">
                                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || fields.length === 0}
                                    className="bg-indigo-600 hover:bg-indigo-700"
                                >
                                    {isSubmitting ? 'Creando...' : 'Crear Factura'}
                                </Button>
                            </div>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
